/**
 * 名侦探柯南 TV 动画画风（TMS 赛璐珞），供 Kolors 文生图统一后缀。
 * 人物类额外强调原创面孔，避免生成工藤新一/柯南形象。
 */
export const IMAGE_STYLE_SUFFIX =
  'Detective Conan TV anime style, TMS Entertainment 2000s Japanese anime, cel shading, thin clean lineart, soft flat anime colors, subtle gradient shadows, mystery thriller atmosphere, cinematic cool blue lighting';

export const IMAGE_CHARACTER_EXTRA =
  'original unique character design, distinctive facial features, age-appropriate proportions, NOT Conan Edogawa, NOT Shinichi Kudo';

export const IMAGE_NEGATIVE_HINT =
  'no text, no watermark, no Conan Edogawa, no Shinichi Kudo, no child detective, no round glasses, no red bow tie, no blue school blazer uniform, no famous anime protagonist, no identical face to Detective Conan, no photorealistic, no 3D CGI';

export const IMAGE_SCENE_NEGATIVE_HINT =
  'no text, no watermark, no people, no characters, no anime boy detective, no photorealistic, no 3D CGI';

export interface CaseImagePrompts {
  scene: string;
  victim: string;
  suspects: Record<string, string>;
}

export type ImagePromptKind = 'character' | 'scene';

/** 根据年龄生成面部比例提示，避免幼童脸贴在成年人身上 */
export function ageAppropriateFaceHint(age: number): string {
  if (age >= 50) return 'mature elderly face, visible age lines, dignified expression';
  if (age >= 35) return 'mature adult face, defined jawline, realistic adult anime proportions';
  if (age >= 22) return 'young adult face, adult anime proportions, not childlike';
  if (age >= 16) return 'teenager face, high school age proportions';
  return 'youthful face, clear teenage proportions, not elementary school child';
}

/** 确保每条 prompt 都带上统一画风与负向描述 */
export function applyImageStyle(prompt: string, kind: ImagePromptKind = 'character'): string {
  const trimmed = prompt.trim().replace(/[,\s]+$/, '');
  const base = trimmed || (kind === 'scene' ? 'mystery crime scene' : 'anime character portrait');

  let result = base;
  if (!/Detective Conan/i.test(result)) {
    const extra = kind === 'character' ? `, ${IMAGE_CHARACTER_EXTRA}` : '';
    result = `${result}, ${IMAGE_STYLE_SUFFIX}${extra}`;
  } else if (kind === 'character' && !/NOT Conan/i.test(result)) {
    result = `${result}, ${IMAGE_CHARACTER_EXTRA}`;
  }

  const negative = kind === 'scene' ? IMAGE_SCENE_NEGATIVE_HINT : IMAGE_NEGATIVE_HINT;
  if (!result.includes('no text')) {
    result = `${result}, ${negative}`;
  }
  return result;
}

function buildFallbackScenePrompt(caseContent: Record<string, unknown>): string {
  const title = String(caseContent.title || '');
  const setting = String(caseContent.setting || '');
  const deathMethod = String(caseContent.deathMethod || '');
  const description = String(caseContent.sceneDescription || '').slice(0, 180);

  return applyImageStyle(
    `Detective Conan anime crime scene background, wide cinematic shot, "${title}", ${setting}, ${description}, cause of death: ${deathMethod}, empty scene without people, dark navy and violet atmosphere, dramatic spotlight and moonlight, anime background art`,
    'scene'
  );
}

function buildFallbackPortraitPrompt(
  name: string,
  gender: string | undefined,
  age: number,
  occupation: string,
  personality: string,
  context?: { setting?: string; relationship?: string; role?: 'victim' | 'suspect' }
): string {
  const genderJP = gender === 'female' ? 'woman' : 'man';
  const roleHint =
    context?.role === 'victim'
      ? 'deceased victim portrait, subtle tragic aura, melancholic eyes'
      : 'murder mystery suspect portrait, guarded suspicious expression, tense posture';
  const relationHint = context?.relationship
    ? `, relationship to victim: ${context.relationship}`
    : '';
  const settingHint = context?.setting ? `, story setting: ${context.setting}` : '';
  const faceHint = ageAppropriateFaceHint(age);

  return applyImageStyle(
    `Detective Conan anime character portrait, original character "${name}", ${genderJP}, ${age} years old, ${occupation}, ${personality || 'neutral'} personality, ${faceHint}, ${roleHint}${relationHint}${settingHint}, unique hairstyle and facial structure, half body shot, dark navy background, dramatic side lighting, anime cel shading`,
    'character'
  );
}

/** Qwen3-8B 失败时的本地模板 fallback */
export function buildFallbackImagePrompts(caseContent: Record<string, unknown>): CaseImagePrompts {
  const victim = (caseContent.victim || {}) as Record<string, unknown>;
  const suspects = Array.isArray(caseContent.suspects) ? caseContent.suspects : [];
  const setting = String(caseContent.setting || '');

  const suspectPrompts: Record<string, string> = {};
  for (let i = 0; i < suspects.length; i++) {
    const s = suspects[i] as Record<string, unknown>;
    const id = String(s.id || `s${i + 1}`);
    suspectPrompts[id] = buildFallbackPortraitPrompt(
      String(s.name || `Suspect ${i + 1}`),
      s.gender as string | undefined,
      Number(s.age) || 30,
      String(s.occupation || 'unknown'),
      String(s.personality || 'neutral'),
      {
        setting,
        relationship: String(s.relationship || ''),
        role: 'suspect',
      }
    );
  }

  return {
    scene: buildFallbackScenePrompt(caseContent),
    victim: buildFallbackPortraitPrompt(
      String(victim.name || 'Victim'),
      victim.gender as string | undefined,
      Number(victim.age) || 40,
      String(victim.occupation || 'unknown'),
      String(victim.background || 'tragic').slice(0, 40),
      { setting, role: 'victim' }
    ),
    suspects: suspectPrompts,
  };
}

export function normalizeImagePrompts(
  raw: unknown,
  caseContent: Record<string, unknown>
): CaseImagePrompts {
  const fallback = buildFallbackImagePrompts(caseContent);
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const scene =
    typeof data.scene === 'string' && data.scene.trim()
      ? applyImageStyle(data.scene, 'scene')
      : fallback.scene;

  const victim =
    typeof data.victim === 'string' && data.victim.trim()
      ? applyImageStyle(data.victim, 'character')
      : fallback.victim;

  const suspects: Record<string, string> = { ...fallback.suspects };
  const rawSuspects = data.suspects;
  if (rawSuspects && typeof rawSuspects === 'object' && !Array.isArray(rawSuspects)) {
    for (const [id, prompt] of Object.entries(rawSuspects as Record<string, unknown>)) {
      if (typeof prompt === 'string' && prompt.trim()) {
        suspects[id] = applyImageStyle(prompt, 'character');
      }
    }
  }

  return { scene, victim, suspects };
}
