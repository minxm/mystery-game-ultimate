import { getStore } from '@netlify/blobs';
import { CaseData } from '@/lib/types';

export type CaseJobStatus = 'pending' | 'done' | 'error';

export interface CaseJobRecord {
  status: CaseJobStatus;
  caseData?: CaseData;
  error?: string;
  createdAt: number;
}

function getCaseJobStore() {
  return getStore('case-jobs');
}

export async function setCaseJob(jobId: string, record: CaseJobRecord) {
  const store = getCaseJobStore();
  await store.setJSON(jobId, record);
}

export async function getCaseJob(jobId: string): Promise<CaseJobRecord | null> {
  const store = getCaseJobStore();
  return store.get(jobId, { type: 'json' });
}
