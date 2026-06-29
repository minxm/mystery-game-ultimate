import { CaseData } from '@/lib/types';

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
};

function getMemoryStore(): Map<string, CaseJobRecord> {
  if (!globalForCaseJobs.__caseJobMemoryStore) {
    globalForCaseJobs.__caseJobMemoryStore = new Map();
  }
  return globalForCaseJobs.__caseJobMemoryStore;
}

function isNetlifyBlobsAvailable(): boolean {
  return (
    typeof process.env.NETLIFY_BLOBS_CONTEXT === 'string' ||
    (process.env.NETLIFY === 'true' && typeof process.env.SITE_ID === 'string')
  );
}

export async function setCaseJob(jobId: string, record: CaseJobRecord): Promise<void> {
  if (isNetlifyBlobsAvailable()) {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('case-jobs');
    await store.setJSON(jobId, record);
  } else {
    getMemoryStore().set(jobId, record);
  }
}

export async function getCaseJob(jobId: string): Promise<CaseJobRecord | null> {
  if (isNetlifyBlobsAvailable()) {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('case-jobs');
    return store.get(jobId, { type: 'json' });
  }
  return getMemoryStore().get(jobId) ?? null;
}

export async function patchCaseJob(
  jobId: string,
  patch: Partial<CaseJobRecord>
): Promise<void> {
  const current = await getCaseJob(jobId);
  if (!current) return;
  await setCaseJob(jobId, {
    ...current,
    ...patch,
    caseData: patch.caseData ?? current.caseData,
  });
}
