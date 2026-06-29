import { generateImageWithRetry } from '@/lib/ai';
import { shouldGenerateImages } from '@/lib/ai-config';
import { CaseData } from '@/lib/types';
import { generateId } from '@/lib/utils';
import { getAvatarPlaceholder, getScenePlaceholder } from '@/lib/placeholder';

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 限制并发数，避免 5 张图同时请求触发 API 限流导致部分失败 */
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  );
  return results;
}

function buildScenePrompt(setting: string, deathMethod: string, description: string) {
  return `anime background art, mystery crime scene, ${setting}, ${description.slice(0, 120)}, ${deathMethod}, Detective Conan anime style, cel-shaded environment illustration, dark navy blue atmosphere, dramatic blue and purple lighting, wide angle view, Japanese mystery anime aesthetic, high quality 2D animation art, no text, no watermark, no characters`;
}

function buildPortraitPrompt(
  name: string,
  gender: string | undefined,
  age: number,
  occupation: string,
  personality: string
) {
  const genderWord = gender === 'female' ? 'female' : 'male';
  const genderJP = gender === 'female' ? 'woman' : 'man';
  return `anime character portrait, ${genderJP}, ${age} years old, ${occupation}, ${personality || 'neutral'} expression, Detective Conan anime art style, cel-shaded, clean 2D lineart, dramatic side lighting, dark navy background, Japanese mystery anime, vibrant colors, half body shot, clearly ${genderWord} appearance, no text, no watermark`;
}

export function buildCaseData(difficulty: string, caseContent: any): CaseData {
  const suspectsRaw = Array.isArray(caseContent?.suspects) ? caseContent.suspects : [];
  if (suspectsRaw.length < 3) {
    throw new Error(`buildCaseData: suspects 无效（${suspectsRaw.length} 人）`);
  }
  if (!caseContent?.victim?.name) {
    throw new Error('buildCaseData: victim 数据不完整');
  }
  if (!caseContent?.truth?.killer) {
    throw new Error('buildCaseData: truth 数据不完整');
  }

  return {
    id: generateId(),
    title: caseContent.title,
    difficulty: difficulty as CaseData['difficulty'],
    setting: caseContent.setting,
    victim: {
      ...caseContent.victim,
      imageUrl: getAvatarPlaceholder(caseContent.victim.name),
    },
    deathMethod: caseContent.deathMethod,
    sceneDescription: caseContent.sceneDescription,
    sceneImageUrl: getScenePlaceholder(caseContent.title || caseContent.setting || 'scene'),
    // 先 map 再 shuffle，使凶手位置每次随机，避免总在末尾
    suspects: shuffleArray(
      suspectsRaw.map((suspect: any, index: number) => ({
        ...suspect,
        id: suspect.id || `s${index + 1}`,
        imageUrl: getAvatarPlaceholder(suspect.name),
      }))
    ),
    evidence: (caseContent.evidence || []).map((item: any, index: number) => ({
      ...item,
      id: item.id || `e${index + 1}`,
    })),
    timeline: caseContent.timeline || [],
    truth: caseContent.truth,
    redHerrings: caseContent.redHerrings || [],
    createdAt: Date.now(),
  };
}

export async function buildCaseDataWithImages(
  difficulty: string,
  caseContent: any
): Promise<CaseData> {
  let sceneImageUrl = '';
  let victimImageUrl = '';
  const suspectImageById: Record<string, string> = {};

  if (shouldGenerateImages()) {
    const suspects = Array.isArray(caseContent?.suspects) ? caseContent.suspects : [];
    console.log('[CaseAssembler] Generating AI images (scene + victim + suspects)...');

    const scenePrompt = buildScenePrompt(
      caseContent.setting,
      caseContent.deathMethod,
      caseContent.sceneDescription
    );
    const victimPrompt = buildPortraitPrompt(
      caseContent.victim.name,
      caseContent.victim.gender,
      caseContent.victim.age,
      caseContent.victim.occupation,
      'victim'
    );

    // 现场 + 受害者串行，嫌疑人最多 2 路并发，降低限流概率
    sceneImageUrl = await generateImageWithRetry(scenePrompt);
    victimImageUrl = await generateImageWithRetry(victimPrompt);

    const suspectTasks = suspects.map((suspect: any, index: number) => async (): Promise<{ id: string; url: string }> => {
      const id = String(suspect.id || `s${index + 1}`);
      const url = await generateImageWithRetry(
        buildPortraitPrompt(
          suspect.name,
          suspect.gender,
          suspect.age,
          suspect.occupation,
          suspect.personality
        )
      );
      return { id, url };
    });

    const suspectResults = await runWithConcurrency<{ id: string; url: string }>(suspectTasks, 2);
    for (const { id, url } of suspectResults) {
      if (url) suspectImageById[id] = url;
    }

    const aiCount =
      (sceneImageUrl ? 1 : 0) +
      (victimImageUrl ? 1 : 0) +
      Object.keys(suspectImageById).length;
    console.log(`[CaseAssembler] AI images done: ${aiCount}/5 succeeded`);
  }

  const caseData = buildCaseData(difficulty, caseContent);
  caseData.victim.imageUrl = victimImageUrl || caseData.victim.imageUrl;
  caseData.sceneImageUrl = sceneImageUrl || caseData.sceneImageUrl;
  // 按嫌疑人 id 绑定图片，避免 shuffle 后下标错位
  caseData.suspects = caseData.suspects.map((suspect) => ({
    ...suspect,
    imageUrl: suspectImageById[suspect.id] || suspect.imageUrl,
  }));
  return caseData;
}
