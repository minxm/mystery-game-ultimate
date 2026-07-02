import { generateImageWithRetry } from '@/lib/ai';
import { shouldGenerateImages } from '@/lib/ai-config';
import {
  applySuspectImages,
  caseDataToPromptContent,
  generateSuspectImagesByPrompts,
  listMissingCharacterImageIds,
  resolveImagePrompts,
  suspectIdsFromContent,
} from '@/lib/case-image-utils';
import { isAvatarPlaceholder } from '@/lib/placeholder';
import type { CaseData } from '@/lib/types';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 补全案件中缺失的 AI 人物肖像（受害者 + 嫌疑人） */
export async function repairCaseMissingImages(
  caseData: CaseData
): Promise<{ caseData: CaseData; repaired: string[] }> {
  if (!shouldGenerateImages()) {
    return { caseData, repaired: [] };
  }

  const missingBefore = listMissingCharacterImageIds(caseData);
  if (missingBefore.length === 0) {
    return { caseData, repaired: [] };
  }

  const imagePrompts = await resolveImagePrompts(caseDataToPromptContent(caseData));
  let updated: CaseData = { ...caseData };
  const repaired: string[] = [];

  if (isAvatarPlaceholder(updated.victim.imageUrl)) {
    const url = await generateImageWithRetry(imagePrompts.victim, 4);
    if (url && !isAvatarPlaceholder(url)) {
      updated = { ...updated, victim: { ...updated.victim, imageUrl: url } };
      repaired.push('victim');
    }
  }

  const missingSuspects = updated.suspects.filter((s) => isAvatarPlaceholder(s.imageUrl));
  for (let i = 0; i < missingSuspects.length; i++) {
    const suspect = missingSuspects[i];
    if (i > 0) await sleep(1200);
    const prompt = imagePrompts.suspects[suspect.id];
    const url = prompt ? await generateImageWithRetry(prompt, 4) : '';
    if (url && !isAvatarPlaceholder(url)) {
      updated = {
        ...updated,
        suspects: updated.suspects.map((s) =>
          s.id === suspect.id ? { ...s, imageUrl: url } : s
        ),
      };
      repaired.push(suspect.id);
    }
  }

  const stillMissing = listMissingCharacterImageIds(updated);
  if (stillMissing.length) {
    console.warn('[CaseImageRepair] Still missing after repair:', stillMissing.join(', '));
  }

  return { caseData: updated, repaired };
}
