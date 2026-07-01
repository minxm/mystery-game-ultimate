/**
 * AI 服务层 — 所有模型调用的统一入口
 *
 * Qwen / GLM / DeepSeek / Kolors / bge-m3 均通过此层调用，
 * 自动记录 latency、token 消耗与失败原因，便于排查与优化。
 */
import type OpenAI from 'openai';
import { AI_CONFIG, getAiConfigError } from '@/lib/ai-config';
import { aiClient, aiJsonClient } from './client';
import { logAiCall } from './logger';
import type { AiCallContext, AiCallStatus, ChatMessage } from './types';

export type { AiCallContext, AiOperation } from './types';
export { AI_CONFIG, getAiConfigError, isServerlessEnv } from '@/lib/ai-config';
export { setAiRequestContext, clearAiRequestContext, buildContext } from './context';

function assertConfigured() {
  const err = getAiConfigError();
  if (err) throw new Error(err);
}

function resolveStatus(error: unknown): AiCallStatus {
  const msg = (error as Error)?.message || '';
  const code = (error as { code?: string; status?: number })?.code;
  if (code === 'ECONNABORTED' || msg.includes('timeout') || msg.includes('timed out')) {
    return 'timeout';
  }
  return 'error';
}

function extractUsage(completion: {
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}) {
  return {
    promptTokens: completion.usage?.prompt_tokens,
    completionTokens: completion.usage?.completion_tokens,
    totalTokens: completion.usage?.total_tokens,
  };
}

interface TimedResult<T> {
  result: T;
  latencyMs: number;
}

async function withTiming<T>(fn: () => Promise<T>): Promise<TimedResult<T>> {
  const start = Date.now();
  const result = await fn();
  return { result, latencyMs: Date.now() - start };
}

function recordCall(
  ctx: AiCallContext,
  model: string,
  status: AiCallStatus,
  latencyMs: number,
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number },
  errorMessage?: string
) {
  logAiCall({
    operation: ctx.operation,
    model,
    status,
    latencyMs,
    promptTokens: usage?.promptTokens,
    completionTokens: usage?.completionTokens,
    totalTokens: usage?.totalTokens,
    errorMessage,
    userId: ctx.userId,
    caseId: ctx.caseId,
    jobId: ctx.jobId,
    metadata: ctx.metadata,
  });
}

/** JSON 结构化输出（案件生成、图片 Prompt、评分） */
export async function chatJsonCompletion(
  ctx: AiCallContext,
  model: string,
  messages: ChatMessage[],
  options: {
    maxTokens: number;
    temperature?: number;
    frequencyPenalty?: number;
    useJsonClient?: boolean;
    extra?: Record<string, unknown>;
  }
): Promise<OpenAI.Chat.ChatCompletion> {
  assertConfigured();
  const client = options.useJsonClient !== false ? aiJsonClient : aiClient;

  try {
    const { result, latencyMs } = await withTiming(() =>
      client.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.6,
        frequency_penalty: options.frequencyPenalty ?? 0.3,
        max_tokens: options.maxTokens,
        response_format: { type: 'json_object' },
        ...options.extra,
      } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming)
    );

    recordCall(ctx, model, 'success', latencyMs, extractUsage(result));
    return result;
  } catch (error) {
    const status = resolveStatus(error);
    recordCall(ctx, model, status, 0, undefined, (error as Error)?.message);
    throw error;
  }
}

/** 非 JSON 对话补全 */
export async function chatCompletion(
  ctx: AiCallContext,
  model: string,
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number; extra?: Record<string, unknown> } = {}
): Promise<OpenAI.Chat.ChatCompletion> {
  assertConfigured();

  try {
    const { result, latencyMs } = await withTiming(() =>
      aiClient.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.8,
        max_tokens: options.maxTokens ?? 300,
        ...options.extra,
      })
    );

    recordCall(ctx, model, 'success', latencyMs, extractUsage(result));
    return result;
  } catch (error) {
    const status = resolveStatus(error);
    recordCall(ctx, model, status, 0, undefined, (error as Error)?.message);
    throw error;
  }
}

/** 流式对话（审讯）— 在流结束后记录日志 */
export async function chatCompletionStream(
  ctx: AiCallContext,
  model: string,
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  assertConfigured();
  const start = Date.now();

  try {
    const stream = await aiClient.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 300,
      stream: true,
    });

    // 包装迭代器以在流结束时记录
    return wrapStreamWithLogging(stream, ctx, model, start);
  } catch (error) {
    const status = resolveStatus(error);
    recordCall(ctx, model, status, Date.now() - start, undefined, (error as Error)?.message);
    throw error;
  }
}

async function* wrapStreamWithLogging(
  stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
  ctx: AiCallContext,
  model: string,
  start: number
): AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> {
  let lastChunk: OpenAI.Chat.Completions.ChatCompletionChunk | undefined;
  try {
    for await (const chunk of stream) {
      lastChunk = chunk;
      yield chunk;
    }
    const usage = lastChunk?.usage
      ? {
          promptTokens: lastChunk.usage.prompt_tokens,
          completionTokens: lastChunk.usage.completion_tokens,
          totalTokens: lastChunk.usage.total_tokens,
        }
      : undefined;
    recordCall(ctx, model, 'success', Date.now() - start, usage);
  } catch (error) {
    const status = resolveStatus(error);
    recordCall(ctx, model, status, Date.now() - start, undefined, (error as Error)?.message);
    throw error;
  }
}

/** 文生图（Kolors） */
export async function imageGeneration(
  ctx: AiCallContext,
  prompt: string,
  options: { responseFormat?: 'b64_json' | 'url' } = {}
): Promise<OpenAI.Images.ImagesResponse> {
  assertConfigured();
  const params: OpenAI.Images.ImageGenerateParams = {
    model: AI_CONFIG.imageModel,
    prompt,
    n: 1,
    size: '1024x1024',
  };
  if (options.responseFormat) {
    params.response_format = options.responseFormat;
  }

  try {
    const { result, latencyMs } = await withTiming(() => aiClient.images.generate(params));
    recordCall(ctx, AI_CONFIG.imageModel, 'success', latencyMs, {
      totalTokens: undefined,
    }, undefined);
    return result;
  } catch (error) {
    const status = resolveStatus(error);
    recordCall(ctx, AI_CONFIG.imageModel, status, 0, undefined, (error as Error)?.message);
    throw error;
  }
}

/** 向量嵌入（bge-m3） */
export async function createEmbeddings(
  ctx: AiCallContext,
  inputs: string[]
): Promise<number[][]> {
  assertConfigured();
  if (inputs.length === 0) return [];

  try {
    const { result, latencyMs } = await withTiming(() =>
      aiClient.embeddings.create({
        model: AI_CONFIG.embeddingModel,
        input: inputs,
      })
    );

    recordCall(ctx, AI_CONFIG.embeddingModel, 'success', latencyMs, {
      totalTokens: result.usage?.total_tokens,
    });

    return result.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  } catch (error) {
    const status = resolveStatus(error);
    recordCall(ctx, AI_CONFIG.embeddingModel, status, 0, undefined, (error as Error)?.message);
    throw error;
  }
}

/** 创建带上下文的 AI 调用器（便于在 job 流程中传递 userId/jobId） */
export function createAiContext(
  base: Partial<AiCallContext> & Pick<AiCallContext, 'operation'>
): AiCallContext {
  return {
    userId: base.userId ?? null,
    caseId: base.caseId ?? null,
    jobId: base.jobId ?? null,
    metadata: base.metadata,
    operation: base.operation,
  };
}
