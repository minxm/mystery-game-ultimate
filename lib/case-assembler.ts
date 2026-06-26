import { generateImage } from '@/lib/ai';
import { shouldGenerateImages } from '@/lib/ai-config';
import { CaseData } from '@/lib/types';
import { generateId } from '@/lib/utils';

function getPlaceholderImage(name: string) {
  const encodedName = encodeURIComponent(name);
  return `https://ui-avatars.com/api/?name=${encodedName}&size=512&background=8b0000&color=fff&bold=true`;
}

function buildScenePrompt(setting: string, deathMethod: string, description: string) {
  return `Cinematic noir mystery crime scene photograph, ${setting}, ${deathMethod}, dark atmospheric lighting, dramatic shadows, realistic, moody detective story, no text, no watermark. ${description.slice(0, 120)}`;
}

function buildPortraitPrompt(
  name: string,
  gender: string | undefined,
  age: number,
  occupation: string,
  personality: string
) {
  const normalizedGender = gender === 'female' ? 'female' : 'male';
  return `Realistic portrait photo of a Chinese ${normalizedGender} adult, name ${name}, age ${age}, occupation ${occupation}, personality ${personality}. Keep the face, hairstyle, clothing, and body traits clearly ${normalizedGender}. Dark mystery thriller aesthetic, dramatic side lighting, serious expression, realistic skin texture, no text, no watermark, not androgynous.`;
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
    suspects: caseContent.suspects.map((suspect: any, index: number) => ({
      ...suspect,
      id: suspect.id || `s${index + 1}`,
      imageUrl: getPlaceholderImage(suspect.name),
    })),
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
