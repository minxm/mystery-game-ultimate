import { createAdminClientSafe } from '@/lib/supabase/admin';
import type { AiCallLogEntry } from './types';

/** 异步写入 AI 调用日志，不阻塞主流程 */
export function logAiCall(entry: AiCallLogEntry): void {
  void persistAiCallLog(entry).catch((err) => {
    console.warn('[AI-Service] Failed to persist call log:', (err as Error)?.message);
  });
}

async function persistAiCallLog(entry: AiCallLogEntry): Promise<void> {
  const admin = createAdminClientSafe();
  if (!admin) return;

  const { error } = await admin.from('ai_call_logs').insert({
    operation: entry.operation,
    model: entry.model,
    status: entry.status,
    latency_ms: entry.latencyMs,
    prompt_tokens: entry.promptTokens ?? null,
    completion_tokens: entry.completionTokens ?? null,
    total_tokens: entry.totalTokens ?? null,
    error_message: entry.errorMessage ?? null,
    user_id: entry.userId ?? null,
    case_id: entry.caseId ?? null,
    job_id: entry.jobId ?? null,
    metadata: entry.metadata ?? {},
  });

  if (error) {
    // 表未迁移时静默降级
    if (!error.message.includes('does not exist')) {
      console.warn('[AI-Service] log insert failed:', error.message);
    }
  }
}
