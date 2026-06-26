import {
  generateCaseBaseWithAI,
  generateCaseCastWithAI,
  generateCaseDetailsWithAI,
} from '@/lib/ai';
import { buildCaseDataWithImages } from '@/lib/case-assembler';
import { CaseData } from '@/lib/types';

export async function buildCaseFromPhases(difficulty: string): Promise<CaseData> {
  console.log('[Orchestrator] Step 1/3: base');
  const base = await generateCaseBaseWithAI(difficulty);

  console.log('[Orchestrator] Step 2/3: cast');
  const cast = await generateCaseCastWithAI(difficulty, base);

  const core = { ...base, ...cast };
  console.log('[Orchestrator] Step 3/3: details');
  const details = await generateCaseDetailsWithAI(difficulty, core);

  return buildCaseDataWithImages(difficulty, { ...core, ...details });
}
