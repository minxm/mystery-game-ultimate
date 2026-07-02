import { generateImageWithRetry } from '@/lib/ai';
import { shouldGenerateImages } from '@/lib/ai-config';
import { patchCaseJob } from '@/lib/case-job-store';
import {
  applySuspectImages,
  generateSuspectImagesByPrompts,
  resolveImagePrompts,
  suspectIdsFromContent,
} from '@/lib/case-image-utils';
import { normalizeTruthShape } from './case-schema';
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
    truth: normalizeTruthShape(caseContent.truth),
    redHerrings: caseContent.redHerrings || [],
    createdAt: Date.now(),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 渐进式生图并推送 job 阶段：受害者图 → 嫌疑人图 → 文本 → 现场图 → 完成 */
export async function buildCaseDataWithImagesProgressive(
  difficulty: string,
  caseContent: any,
  jobId: string
): Promise<CaseData> {
  const caseData = buildCaseData(difficulty, caseContent);
  const jobMeta = { difficulty };

  await patchCaseJob(jobId, {
    stage: 'pending',
    progressMessage: 'AI 正在构建案件框架…',
    caseData,
  }, jobMeta);

  const advanceStage = async (
    stage: 'victim_ready' | 'suspects_ready' | 'text_ready',
    message: string,
    data: CaseData
  ) => {
    await patchCaseJob(jobId, { stage, progressMessage: message, caseData: { ...data } }, jobMeta);
  };

  if (shouldGenerateImages()) {
    const suspects = Array.isArray(caseContent?.suspects) ? caseContent.suspects : [];
    const suspectIds = suspectIdsFromContent(suspects);
    console.log('[CaseAssembler] Progressive: victim → suspects → text → scene');

    const imagePrompts = await resolveImagePrompts(caseContent);

    await patchCaseJob(jobId, { progressMessage: '正在绘制受害者肖像…' }, jobMeta);
    const victimImageUrl = await generateImageWithRetry(imagePrompts.victim);
    caseData.victim.imageUrl = victimImageUrl || caseData.victim.imageUrl;
    await advanceStage('victim_ready', '受害者档案已锁定', caseData);

    await patchCaseJob(jobId, { progressMessage: '正在绘制嫌疑人肖像…' }, jobMeta);
    const suspectImageById: Record<string, string> = {};
    for (let i = 0; i < suspectIds.length; i++) {
      const id = suspectIds[i];
      const batch = await generateSuspectImagesByPrompts([id], imagePrompts, { concurrency: 1 });
      Object.assign(suspectImageById, batch);
      Object.assign(caseData, applySuspectImages(caseData, suspectImageById));
      await patchCaseJob(jobId, {
        progressMessage: `嫌疑人肖像 ${i + 1}/${suspectIds.length}…`,
        caseData: { ...caseData },
      }, jobMeta);
    }
    await advanceStage('suspects_ready', '嫌疑人已全部登场', caseData);

    await advanceStage('text_ready', '案件卷宗整理完成', caseData);

    await patchCaseJob(jobId, { progressMessage: '正在还原案发现场…' }, jobMeta);
    const sceneImageUrl = await generateImageWithRetry(imagePrompts.scene);
    caseData.sceneImageUrl = sceneImageUrl || caseData.sceneImageUrl;
  } else {
    await sleep(400);
    await advanceStage('victim_ready', '受害者档案已锁定', caseData);
    await sleep(400);
    await advanceStage('suspects_ready', '嫌疑人已全部登场', caseData);
    await sleep(400);
    await advanceStage('text_ready', '案件卷宗整理完成', caseData);
  }

  await patchCaseJob(jobId, {
    status: 'done',
    stage: 'done',
    progressMessage: '取证完成',
    caseData: { ...caseData },
  }, jobMeta);

  return caseData;
}

export async function buildCaseDataWithImages(
  difficulty: string,
  caseContent: any
): Promise<CaseData> {
  let sceneImageUrl = '';
  let victimImageUrl = '';
  let suspectImageById: Record<string, string> = {};

  if (shouldGenerateImages()) {
    const suspects = Array.isArray(caseContent?.suspects) ? caseContent.suspects : [];
    const suspectIds = suspectIdsFromContent(suspects);
    console.log('[CaseAssembler] Generating image prompts (Qwen3-8B) + images (Kolors)...');

    const imagePrompts = await resolveImagePrompts(caseContent);

    sceneImageUrl = await generateImageWithRetry(imagePrompts.scene);
    victimImageUrl = await generateImageWithRetry(imagePrompts.victim);
    suspectImageById = await generateSuspectImagesByPrompts(suspectIds, imagePrompts, {
      concurrency: 2,
    });

    const aiCount =
      (sceneImageUrl ? 1 : 0) +
      (victimImageUrl ? 1 : 0) +
      Object.keys(suspectImageById).length;
    console.log(`[CaseAssembler] AI images done: ${aiCount}/${2 + suspectIds.length} succeeded`);
  }

  const caseData = buildCaseData(difficulty, caseContent);
  caseData.victim.imageUrl = victimImageUrl || caseData.victim.imageUrl;
  caseData.sceneImageUrl = sceneImageUrl || caseData.sceneImageUrl;
  return applySuspectImages(caseData, suspectImageById);
}
