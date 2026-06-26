import { CaseData } from '@/lib/types';

export type CaseJobStatus = 'pending' | 'done' | 'error';

export interface CaseJobRecord {
  status: CaseJobStatus;
  caseData?: CaseData;
  error?: string;
  createdAt: number;
}

// 本地开发时使用内存存储（进程内）
const memoryStore = new Map<string, CaseJobRecord>();

function isNetlifyBlobsAvailable(): boolean {
  // Netlify 运行时会注入 NETLIFY_BLOBS_CONTEXT 或同时具备 NETLIFY + SITE_ID
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
    memoryStore.set(jobId, record);
  }
}

export async function getCaseJob(jobId: string): Promise<CaseJobRecord | null> {
  if (isNetlifyBlobsAvailable()) {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('case-jobs');
    return store.get(jobId, { type: 'json' });
  } else {
    return memoryStore.get(jobId) ?? null;
  }
}
