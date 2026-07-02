import { generateImagePromptsWithAI, generateImageWithRetry } from '@/lib/ai';
import { buildFallbackImagePrompts, type CaseImagePrompts } from '@/lib/image-prompt';
import { isAvatarPlaceholder } from '@/lib/placeholder';
import type { CaseData } from '@/lib/types';

export {
  caseDataHasMissingCharacterImages,
  isBetterCharacterImageUrl,
  listMissingCharacterImageIds,
  mergeCaseCharacterImages,
} from '@/lib/case-image-merge';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 限制并发数，避免多张图同时请求触发 API 限流 */
export async function runWithConcurrency<T>(
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

export async function resolveImagePrompts(
  caseContent: Record<string, unknown>
): Promise<CaseImagePrompts> {
  const fallbackPrompts = buildFallbackImagePrompts(caseContent);
  try {
    const aiPrompts = await Promise.race([
      generateImagePromptsWithAI(caseContent),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('image prompt timeout')), 30000)
      ),
    ]);
    return aiPrompts;
  } catch (error) {
    console.warn('[CaseImage] Using fallback image prompts:', (error as Error)?.message);
    return fallbackPrompts;
  }
}

export function suspectIdsFromContent(
  suspects: Array<{ id?: string }>
): string[] {
  return suspects.map((s, index) => String(s.id || `s${index + 1}`));
}

export function caseDataToPromptContent(caseData: CaseData): Record<string, unknown> {
  return {
    title: caseData.title,
    setting: caseData.setting,
    deathMethod: caseData.deathMethod,
    sceneDescription: caseData.sceneDescription,
    victim: caseData.victim,
    suspects: caseData.suspects,
  };
}

function isGeneratedCharacterImage(url: string): boolean {
  return !!url && !isAvatarPlaceholder(url);
}

/** 批量生成嫌疑人肖像，失败 id 串行补图 */
export async function generateSuspectImagesByPrompts(
  suspectIds: string[],
  imagePrompts: CaseImagePrompts,
  options?: {
    concurrency?: number;
    retryDelayMs?: number;
    retryAttempts?: number;
    onEach?: (id: string, url: string, pass: 'initial' | 'retry') => void;
  }
): Promise<Record<string, string>> {
  const suspectImageById: Record<string, string> = {};
  const concurrency = options?.concurrency ?? 2;
  const retryDelayMs = options?.retryDelayMs ?? 1200;
  const retryAttempts = options?.retryAttempts ?? 4;

  const initialTasks = suspectIds.map((id) => async () => {
    const prompt = imagePrompts.suspects[id];
    const url = prompt ? await generateImageWithRetry(prompt) : '';
    return { id, url };
  });

  const initialResults = await runWithConcurrency(initialTasks, concurrency);
  for (const { id, url } of initialResults) {
    if (isGeneratedCharacterImage(url)) {
      suspectImageById[id] = url;
      options?.onEach?.(id, url, 'initial');
    }
  }

  const missingIds = suspectIds.filter((id) => !suspectImageById[id]);
  for (let i = 0; i < missingIds.length; i++) {
    const id = missingIds[i];
    if (i > 0) await sleep(retryDelayMs);
    const prompt = imagePrompts.suspects[id];
    const url = prompt ? await generateImageWithRetry(prompt, retryAttempts) : '';
    if (isGeneratedCharacterImage(url)) {
      suspectImageById[id] = url;
      options?.onEach?.(id, url, 'retry');
      console.log(`[CaseImage] Suspect ${id} recovered on retry`);
    } else {
      console.warn(`[CaseImage] Suspect ${id} still missing after retry`);
    }
  }

  return suspectImageById;
}

export function applySuspectImages(
  caseData: CaseData,
  suspectImageById: Record<string, string>
): CaseData {
  return {
    ...caseData,
    suspects: caseData.suspects.map((suspect) => ({
      ...suspect,
      imageUrl: isGeneratedCharacterImage(suspectImageById[suspect.id] ?? '')
        ? suspectImageById[suspect.id]
        : suspect.imageUrl,
    })),
  };
}

