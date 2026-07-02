/**
 * 一次性数据补全：为老案件写入 scene_image_url（HTTP 封面地址）
 * 用法: node scripts/backfill-scene-image-url.mjs
 */
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
    ...init.headers,
  };
  if (init.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function runSql(env, sql) {
  const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SQL ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function parseDataUrl(dataUrl) {
  const imageMatch = dataUrl.match(/^data:(image\/\w+);base64,([\s\S]+)$/);
  if (imageMatch) {
    const mime = imageMatch[1];
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    return { buffer: Buffer.from(imageMatch[2], 'base64'), mime, ext };
  }
  const genericMatch = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (genericMatch) {
    const rawMime = genericMatch[1];
    const mime = rawMime.startsWith('image/') ? rawMime : 'image/png';
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    return { buffer: Buffer.from(genericMatch[2], 'base64'), mime, ext };
  }
  return null;
}

async function uploadSceneImage(env, caseId, dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  const path = `${caseId}/scene.${parsed.ext}`;
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/case-images/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': parsed.mime,
      'x-upsert': 'true',
    },
    body: parsed.buffer,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upload ${caseId} ${res.status}: ${text}`);
  }

  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/case-images/${path}`;
}

async function ensureColumn(env) {
  try {
    await rest(env, 'cases?select=scene_image_url&limit=1');
    console.log('[schema] scene_image_url 列已存在');
    return;
  } catch (error) {
    if (!String(error.message).includes('scene_image_url does not exist')) {
      throw error;
    }
  }

  console.log('[schema] 正在添加 scene_image_url 列…');
  try {
    await runSql(
      env,
      `
      alter table public.cases add column if not exists scene_image_url text;
      update public.cases
      set scene_image_url = case_data->>'sceneImageUrl'
      where scene_image_url is null
        and case_data->>'sceneImageUrl' like 'http%';
      create index if not exists cases_scene_image_url_idx
        on public.cases(scene_image_url)
        where scene_image_url is not null;
      `
    );
    console.log('[schema] 已通过 Management API 添加列');
    return;
  } catch (error) {
    console.warn('[schema] Management API 不可用，尝试 pg 直连…', error.message);
  }

  const dbUrl = env.SUPABASE_DB_URL || env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      '无法自动执行 DDL。请在 Supabase SQL Editor 执行 supabase/migrations/20250701000002_case_scene_image_url.sql，或设置 SUPABASE_DB_URL 后重试。'
    );
  }

  const { Client } = await import('pg');
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query('alter table public.cases add column if not exists scene_image_url text;');
    await client.query(`
      update public.cases
      set scene_image_url = case_data->>'sceneImageUrl'
      where scene_image_url is null
        and case_data->>'sceneImageUrl' like 'http%';
    `);
    await client.query(`
      create index if not exists cases_scene_image_url_idx
        on public.cases(scene_image_url)
        where scene_image_url is not null;
    `);
    console.log('[schema] 已通过 pg 添加列');
  } finally {
    await client.end();
  }
}

async function listCaseIds(env) {
  const rows = await rest(env, 'cases?select=id,title&order=created_at.asc');
  return rows ?? [];
}

async function loadCaseRow(env, caseId) {
  const rows = await rest(
    env,
    `cases?id=eq.${encodeURIComponent(caseId)}&select=id,title,scene_image_url,case_data`
  );
  return rows?.[0] ?? null;
}

async function saveCaseCover(env, caseId, publicUrl, caseData) {
  const nextCaseData = { ...caseData, sceneImageUrl: publicUrl };
  await rest(env, `cases?id=eq.${encodeURIComponent(caseId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      scene_image_url: publicUrl,
      case_data: nextCaseData,
    }),
  });
}

const env = loadEnv();
await ensureColumn(env);

const cases = await listCaseIds(env);
console.log(`[backfill] 共 ${cases.length} 个案件待检查`);

let updated = 0;
let skipped = 0;
let failed = 0;

for (const item of cases) {
  const row = await loadCaseRow(env, item.id);
  if (!row) continue;

  const currentColumn = row.scene_image_url;
  const sceneUrl = row.case_data?.sceneImageUrl;

  if (currentColumn?.startsWith('http')) {
    skipped++;
    continue;
  }

  try {
    let publicUrl = null;

    if (sceneUrl?.startsWith('http')) {
      publicUrl = sceneUrl;
    } else if (sceneUrl?.startsWith('data:')) {
      console.log(`[upload] ${row.id} ${row.title}`);
      publicUrl = await uploadSceneImage(env, row.id, sceneUrl);
    }

    if (!publicUrl) {
      console.warn(`[skip] ${row.id} ${row.title} — 无可用封面`);
      skipped++;
      continue;
    }

    await saveCaseCover(env, row.id, publicUrl, row.case_data);
    console.log(`[ok] ${row.id} ${row.title}`);
    updated++;
  } catch (error) {
    console.error(`[fail] ${row.id} ${row.title}:`, error.message);
    failed++;
  }
}

console.log(JSON.stringify({ total: cases.length, updated, skipped, failed }, null, 2));
