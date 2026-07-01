import { readFileSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

function loadEnv() {
  const text = readFileSync(resolve('.env.local'), 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/\s+#.*$/, '');
  }
  return env;
}

const env = loadEnv();
const secret = env.INVENTORY_REFILL_SECRET;
if (!secret) {
  console.error('INVENTORY_REFILL_SECRET missing in .env.local');
  process.exit(1);
}

const baseUrl = process.env.REFILL_BASE_URL ?? 'http://localhost:3000';
const difficulty = process.argv[2] || process.env.REFILL_DIFFICULTY;
const maxPerRun = Number(process.env.REFILL_MAX_PER_RUN ?? (difficulty ? 2 : 1));

const body = JSON.stringify({
  maxPerRun,
  ...(difficulty ? { difficulty } : {}),
});

const result = spawnSync(
  'curl.exe',
  [
    '-s',
    '-w',
    '\nHTTP_CODE:%{http_code}',
    '-X',
    'POST',
    `${baseUrl}/api/inventory/refill`,
    '-H',
    `Authorization: Bearer ${secret}`,
    '-H',
    'Content-Type: application/json',
    '-d',
    body,
    '--max-time',
    '3600',
  ],
  { encoding: 'utf8' }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

const output = result.stdout ?? '';
const match = output.match(/\nHTTP_CODE:(\d+)$/);
const httpCode = match?.[1] ?? '?';
const json = match ? output.slice(0, match.index) : output;

console.log(`HTTP ${httpCode}`);
console.log(json.trim());

if (result.status !== 0) process.exit(result.status ?? 1);
