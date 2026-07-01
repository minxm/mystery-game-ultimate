import { generateImagePromptsWithAI, generateImageWithRetry } from '@/lib/ai';
import { shouldGenerateImages } from '@/lib/ai-config';
import { patchCaseJob } from '@/lib/case-job-store';
import { buildFallbackImagePrompts } from '@/lib/image-prompt';
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
    console.log('[CaseAssembler] Progressive: victim → suspects → text → scene');

    const fallbackPrompts = buildFallbackImagePrompts(caseContent);
    let imagePrompts = fallbackPrompts;
    try {
      const aiPrompts = await Promise.race([
        generateImagePromptsWithAI(caseContent),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('image prompt timeout')), 30000)
        ),
      ]);
      imagePrompts = aiPrompts;
    } catch (error) {
      console.warn('[CaseAssembler] Fallback image prompts:', (error as Error)?.message);
    }

    await patchCaseJob(jobId, { progressMessage: '正在绘制受害者肖像…' }, jobMeta);
    const victimImageUrl = await generateImageWithRetry(imagePrompts.victim);
    caseData.victim.imageUrl = victimImageUrl || caseData.victim.imageUrl;
    await advanceStage('victim_ready', '受害者档案已锁定', caseData);

    await patchCaseJob(jobId, { progressMessage: '正在绘制嫌疑人肖像…' }, jobMeta);
    const suspectImageById: Record<string, string> = {};
    for (let i = 0; i < suspects.length; i++) {
      const suspect = suspects[i] as { id?: string };
      const id = String(suspect.id || `s${i + 1}`);
      const prompt = imagePrompts.suspects[id];
      if (prompt) {
        const url = await generateImageWithRetry(prompt);
        if (url) suspectImageById[id] = url;
      }
      caseData.suspects = caseData.suspects.map((s) => ({
        ...s,
        imageUrl: suspectImageById[s.id] || s.imageUrl,
      }));
      await patchCaseJob(jobId, {
        progressMessage: `嫌疑人肖像 ${i + 1}/${suspects.length}…`,
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
  const suspectImageById: Record<string, string> = {};

  if (shouldGenerateImages()) {
    const suspects = Array.isArray(caseContent?.suspects) ? caseContent.suspects : [];
    console.log('[CaseAssembler] Generating image prompts (Qwen3-8B) + images (Kolors)...');

    // 图片 prompt 用 Qwen 增强；失败或超时则立即用本地模板，不阻塞 Kolors 生图
    const fallbackPrompts = buildFallbackImagePrompts(caseContent);
    let imagePrompts = fallbackPrompts;
    try {
      const aiPrompts = await Promise.race([
        generateImagePromptsWithAI(caseContent),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('image prompt generation timed out')), 30000)
        ),
      ]);
      imagePrompts = aiPrompts;
    } catch (error) {
      console.warn(
        '[CaseAssembler] Using fallback image prompts:',
        (error as Error)?.message
      );
    }

    // 现场 + 受害者串行，嫌疑人最多 2 路并发，降低限流概率
    sceneImageUrl = await generateImageWithRetry(imagePrompts.scene);
    victimImageUrl = await generateImageWithRetry(imagePrompts.victim);

    const suspectTasks = suspects.map((suspect: any, index: number) => async (): Promise<{ id: string; url: string }> => {
      const id = String(suspect.id || `s${index + 1}`);
      const prompt = imagePrompts.suspects[id];
      const url = prompt ? await generateImageWithRetry(prompt) : '';
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
