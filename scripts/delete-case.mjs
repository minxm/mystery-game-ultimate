import { readFileSync } from 'fs';
import { resolve } from 'path';

const caseId = process.argv[2];
if (!caseId) {
  console.error('Usage: node scripts/delete-case.mjs <caseId>');
  process.exit(1);
}

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
    Prefer: init.method === 'DELETE' ? 'return=representation' : undefined,
    ...init.headers,
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const env = loadEnv();

const existing = await rest(
  env,
  `cases?id=eq.${encodeURIComponent(caseId)}&select=id,title,difficulty`
);

if (!existing?.length) {
  console.log(`案件 ${caseId} 不存在，无需删除`);
  process.exit(0);
}

console.log('即将删除:', existing[0]);

await rest(env, `case_inventory?case_id=eq.${encodeURIComponent(caseId)}`, { method: 'DELETE' });

const deleted = await rest(env, `cases?id=eq.${encodeURIComponent(caseId)}`, { method: 'DELETE' });
console.log('已删除:', deleted);
