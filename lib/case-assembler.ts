import { generateImage } from '@/lib/ai';
import { shouldGenerateImages } from '@/lib/ai-config';
import { CaseData } from '@/lib/types';
import { generateId } from '@/lib/utils';

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getPlaceholderImage(name: string) {
  const encodedName = encodeURIComponent(name);
  return `https://ui-avatars.com/api/?name=${encodedName}&size=512&background=1e90ff&color=fff&bold=true`;
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
  return `anime character portrait, ${genderJP}, ${age} years old, ${occupation}, ${personality} expression, Detective Conan anime art style, cel-shaded, clean 2D lineart, dramatic side lighting, dark navy background, Japanese mystery anime, vibrant colors, half body shot, clearly ${genderWord} appearance, no text, no watermark`;
}

export function buildCaseData(difficulty: string, caseContent: any): CaseData {
  return {
    id: generateId(),
    title: caseContent.title,
    difficulty: difficulty as CaseData['difficulty'],
    setting: caseContent.setting,
    victim: {
      ...caseContent.victim,
      imageUrl: getPlaceholderImage(caseContent.victim.name),
    },
    deathMethod: caseContent.deathMethod,
    sceneDescription: caseContent.sceneDescription,
    sceneImageUrl: getPlaceholderImage('Crime Scene'),
    // 先 map 再 shuffle，使凶手位置每次随机，避免总在末尾
    suspects: shuffleArray(
      caseContent.suspects.map((suspect: any, index: number) => ({
        ...suspect,
        id: suspect.id || `s${index + 1}`,
        imageUrl: getPlaceholderImage(suspect.name),
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
  let suspectImageUrls: string[] = [];

  if (shouldGenerateImages()) {
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
    const suspectPrompts = caseContent.suspects.map((suspect: any) =>
      buildPortraitPrompt(
        suspect.name,
        suspect.gender,
        suspect.age,
        suspect.occupation,
        suspect.personality
      )
    );

    [sceneImageUrl, victimImageUrl, ...suspectImageUrls] = await Promise.all([
      generateImage(scenePrompt),
      generateImage(victimPrompt),
      ...suspectPrompts.map((prompt: string) => generateImage(prompt)),
    ]);
  }

  const caseData = buildCaseData(difficulty, caseContent);
  caseData.victim.imageUrl = victimImageUrl || caseData.victim.imageUrl;
  caseData.sceneImageUrl = sceneImageUrl || caseData.sceneImageUrl;
  caseData.suspects = caseData.suspects.map((suspect, index) => ({
    ...suspect,
    imageUrl: suspectImageUrls[index] || suspect.imageUrl,
  }));
  return caseData;
}
