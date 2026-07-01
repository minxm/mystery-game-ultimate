import type { AiCallContext } from './types';

/** 请求级 AI 上下文（在 API route / job worker 入口设置） */
let requestContext: Partial<Omit<AiCallContext, 'operation'>> = {};

export function setAiRequestContext(ctx: Partial<Omit<AiCallContext, 'operation'>>): void {
  requestContext = ctx;
}

export function clearAiRequestContext(): void {
  requestContext = {};
}

export function buildContext(operation: AiCallContext['operation']): AiCallContext {
  return {
    operation,
    userId: requestContext.userId ?? null,
    caseId: requestContext.caseId ?? null,
    jobId: requestContext.jobId ?? null,
    metadata: requestContext.metadata,
  };
}
