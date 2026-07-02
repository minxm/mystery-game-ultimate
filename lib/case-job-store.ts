import { isServerlessEnv } from '@/lib/ai-config';
import { CaseData } from '@/lib/types';
import { getSupabaseServiceRoleKey, isSupabaseConfigured } from '@/lib/supabase/env';

export type CaseJobStage =
  | 'pending'
  | 'victim_ready'
  | 'suspects_ready'
  | 'text_ready'
  | 'done';

export type CaseJobStatus = 'pending' | 'done' | 'error';

export interface CaseJobRecord {
  status: CaseJobStatus;
  /** 渐进展示阶段（与 status 独立：status=done 时 stage=done） */
  stage: CaseJobStage;
  caseData?: CaseData;
  error?: string;
  progressMessage?: string;
  createdAt: number;
}

const STAGE_ORDER: CaseJobStage[] = [
  'pending',
  'victim_ready',
  'suspects_ready',
  'text_ready',
  'done',
];

export function isStageAtLeast(current: CaseJobStage, target: CaseJobStage): boolean {
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(target);
}

// 本地开发：挂到 globalThis，避免 Next 按路由分包后各 bundle 各自一份 Map
const globalForCaseJobs = globalThis as typeof globalThis & {
  __caseJobMemoryStore?: Map<string, CaseJobRecord>;
  __caseJobMetaStore?: Map<string, { userId?: string | null; difficulty?: string }>;
};

function getMetaStore(): Map<string, { userId?: string | null; difficulty?: string }> {
  if (!globalForCaseJobs.__caseJobMetaStore) {
    globalForCaseJobs.__caseJobMetaStore = new Map();
  }
  return globalForCaseJobs.__caseJobMetaStore;
}

function resolveJobMeta(
  jobId: string,
  meta?: { userId?: string | null; difficulty?: string }
): { userId?: string | null; difficulty?: string } | undefined {
  const store = getMetaStore();
  const existing = store.get(jobId);
  if (!meta && !existing) return undefined;
  const merged = { ...existing, ...meta };
  store.set(jobId, merged);
  return merged;
}

function getMemoryStore(): Map<string, CaseJobRecord> {
  if (!globalForCaseJobs.__caseJobMemoryStore) {
    globalForCaseJobs.__caseJobMemoryStore = new Map();
  }
  return globalForCaseJobs.__caseJobMemoryStore;
}

function isSupabaseJobsAvailable(): boolean {
  return isSupabaseConfigured() && Boolean(getSupabaseServiceRoleKey());
}

/** 本地开发或未配置 Supabase 时，用内存 store 保证跨 API 路由可读 */
function shouldMirrorToMemory(): boolean {
  return !isServerlessEnv() || !isSupabaseJobsAvailable();
}

export async function setCaseJob(
  jobId: string,
  record: CaseJobRecord,
  meta?: { userId?: string | null; difficulty?: string }
): Promise<void> {
  const resolvedMeta = resolveJobMeta(jobId, meta);
  let supabaseOk = true;
  if (isSupabaseJobsAvailable()) {
    const { supabaseSetCaseJob } = await import('@/lib/supabase/jobs');
    supabaseOk = await supabaseSetCaseJob(jobId, record, resolvedMeta?.userId, resolvedMeta?.difficulty);
  }
  if (shouldMirrorToMemory() || !supabaseOk) {
    getMemoryStore().set(jobId, record);
  }
}

export async function getCaseJob(jobId: string): Promise<CaseJobRecord | null> {
  // 本地开发优先读内存，避免 Supabase 写入失败导致 status 404
  if (!isServerlessEnv()) {
    const fromMemory = getMemoryStore().get(jobId);
    if (fromMemory) return fromMemory;
  }
  if (isSupabaseJobsAvailable()) {
    const { supabaseGetCaseJob } = await import('@/lib/supabase/jobs');
    const fromDb = await supabaseGetCaseJob(jobId);
    if (fromDb) return fromDb;
  }
  return getMemoryStore().get(jobId) ?? null;
}

export async function patchCaseJob(
  jobId: string,
  patch: Partial<CaseJobRecord>,
  meta?: { userId?: string | null; difficulty?: string }
): Promise<void> {
  const resolvedMeta = resolveJobMeta(jobId, meta);
  const current = await getCaseJob(jobId);
  const base: CaseJobRecord = current ?? {
    status: 'pending',
    stage: 'pending',
    createdAt: Date.now(),
  };
  await setCaseJob(jobId, {
    ...base,
    ...patch,
    caseData: patch.caseData ?? base.caseData,
  }, resolvedMeta);
}
