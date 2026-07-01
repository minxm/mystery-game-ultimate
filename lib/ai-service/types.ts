/** AI 服务层 — 统一调用类型 */

export type AiOperation =
  | 'case_framework'
  | 'case_polish'
  | 'case_full'
  | 'case_base'
  | 'case_cast'
  | 'case_details'
  | 'image_prompt'
  | 'image_generate'
  | 'chat_interrogate'
  | 'evaluate'
  | 'embedding';

export type AiCallStatus = 'success' | 'error' | 'timeout';

export interface AiCallContext {
  operation: AiOperation;
  userId?: string | null;
  caseId?: string | null;
  jobId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AiCallLogEntry {
  operation: AiOperation;
  model: string;
  status: AiCallStatus;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  errorMessage?: string;
  userId?: string | null;
  caseId?: string | null;
  jobId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
