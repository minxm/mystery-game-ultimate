/** 客户端云同步工具（登录用户自动同步到 Supabase） */
import { GameProgress, InterrogationMessage } from './types';

export async function syncProgress(progress: GameProgress): Promise<void> {
  try {
    await fetch('/api/sync/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progress),
    });
  } catch {
    // 静默失败，本地存储仍可用
  }
}

export async function syncEvaluation(
  caseId: string,
  evaluation: Record<string, unknown>,
  userDeduction?: string
): Promise<void> {
  try {
    await fetch('/api/sync/evaluation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, evaluation, userDeduction }),
    });
  } catch {
    // 静默失败
  }
}

export async function syncInterrogation(
  caseId: string,
  suspectId: string,
  messages: InterrogationMessage[]
): Promise<void> {
  try {
    await fetch('/api/sync/interrogation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, suspectId, messages }),
    });
  } catch {
    // 静默失败
  }
}
