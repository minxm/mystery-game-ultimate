import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const text = readFileSync(resolve('.env.local'), 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/\s+#.*$/, '');
  }
  return env;
}

async function rest(env, path, init = {}) {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...init.headers,
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const env = loadEnv();

const [invJobs, cases, inventory, inventoryStats] = await Promise.all([
  rest(env, 'case_generation_jobs?job_id=like.inv-*&select=job_id,difficulty,status'),
  rest(env, 'cases?user_id=is.null&select=id,title'),
  rest(env, 'case_inventory?select=case_id,difficulty,status'),
  rest(env, 'case_inventory_stats?select=*'),
]);

const inventoryCaseIds = new Set((inventory ?? []).map((r) => r.case_id));
const orphanCases = (cases ?? []).filter((c) => !inventoryCaseIds.has(c.id));

console.log(JSON.stringify({
  invJobs: invJobs ?? [],
  inventoryCount: inventory?.length ?? 0,
  inventoryStats: inventoryStats ?? [],
  orphanCases: orphanCases.map((c) => ({ id: c.id, title: c.title })),
}, null, 2));

if ((invJobs ?? []).length > 0) {
  const ids = invJobs.map((j) => j.job_id).join(',');
  await rest(env, `case_generation_jobs?job_id=in.(${ids})`, { method: 'DELETE' });
  console.log(`cleanup inv jobs: deleted ${invJobs.length}`);
}

if (orphanCases.length > 0) {
  const ids = orphanCases.map((c) => c.id).join(',');
  await rest(env, `cases?id=in.(${ids})`, { method: 'DELETE' });
  console.log(`cleanup orphan cases: deleted ${orphanCases.length}`);
}
