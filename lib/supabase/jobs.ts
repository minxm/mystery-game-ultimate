import { createAdminClientSafe } from './admin';
import { CaseData } from '@/lib/types';
import { CaseJobRecord, CaseJobStage, CaseJobStatus } from '@/lib/case-job-store';

interface JobRow {
  job_id: string;
  user_id: string | null;
  difficulty: string;
  status: CaseJobStatus;
  stage: CaseJobStage;
  case_data: CaseData | null;
  error: string | null;
  progress_message: string | null;
  created_at: string;
}

function rowToRecord(row: JobRow): CaseJobRecord {
  return {
    status: row.status,
    stage: row.stage,
    caseData: row.case_data ?? undefined,
    error: row.error ?? undefined,
    progressMessage: row.progress_message ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function supabaseSetCaseJob(
  jobId: string,
  record: CaseJobRecord,
  userId?: string | null,
  difficulty?: string
): Promise<boolean> {
  const admin = createAdminClientSafe();
  if (!admin) return false;

  let resolvedDifficulty = difficulty;
  let resolvedUserId = userId;

  if (resolvedDifficulty === undefined || resolvedUserId === undefined) {
    const { data: existing } = await admin
      .from('case_generation_jobs')
      .select('difficulty, user_id')
      .eq('job_id', jobId)
      .maybeSingle();

    if (resolvedDifficulty === undefined) {
      resolvedDifficulty = existing?.difficulty ?? undefined;
    }
    if (resolvedUserId === undefined && existing) {
      resolvedUserId = existing.user_id;
    }
  }

  if (!resolvedDifficulty) {
    console.warn('[CaseJob] Skip Supabase upsert: difficulty required for job', jobId);
    return false;
  }

  const payload: Record<string, unknown> = {
    job_id: jobId,
    difficulty: resolvedDifficulty,
    status: record.status,
    stage: record.stage,
    case_data: record.caseData ?? null,
    error: record.error ?? null,
    progress_message: record.progressMessage ?? null,
    created_at: new Date(record.createdAt).toISOString(),
  };
  if (resolvedUserId !== undefined) payload.user_id = resolvedUserId;

  const { error } = await admin
    .from('case_generation_jobs')
    .upsert(payload, { onConflict: 'job_id' });

  if (error) {
    console.error('[CaseJob] Supabase upsert failed:', error.message, 'jobId:', jobId);
    return false;
  }
  return true;
}

export async function supabaseGetCaseJob(jobId: string): Promise<CaseJobRecord | null> {
  const admin = createAdminClientSafe();
  if (!admin) return null;

  const { data, error } = await admin
    .from('case_generation_jobs')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToRecord(data as JobRow);
}

export async function supabasePatchCaseJob(
  jobId: string,
  patch: Partial<CaseJobRecord>,
  meta?: { userId?: string | null; difficulty?: string }
): Promise<void> {
  const current = await supabaseGetCaseJob(jobId);
  if (!current) {
    await supabaseSetCaseJob(
      jobId,
      {
        status: 'pending',
        stage: 'pending',
        createdAt: Date.now(),
        ...patch,
      },
      meta?.userId,
      meta?.difficulty
    );
    return;
  }

  await supabaseSetCaseJob(
    jobId,
    {
      ...current,
      ...patch,
      caseData: patch.caseData ?? current.caseData,
    },
    meta?.userId,
    meta?.difficulty
  );
}
