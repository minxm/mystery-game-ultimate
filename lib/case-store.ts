import { CaseData } from './types';

const DB_NAME = 'mystery-game-ultimate';
const DB_VERSION = 1;
const STORE = 'cases';
const LEGACY_CASES_KEY = 'mystery_cases';
/** 保留最近 N 个案件，避免 IndexedDB 无限膨胀 */
const MAX_STORED_CASES = 12;

/** 同页跳转时的内存缓存，避免重复读库 */
const memoryCache = new Map<string, CaseData>();

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('当前环境不支持 IndexedDB'));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
}

function idbPut(db: IDBDatabase, caseData: CaseData): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(caseData);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB 写入失败'));
  });
}

function idbGet(db: IDBDatabase, id: string): Promise<CaseData | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as CaseData | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 读取失败'));
  });
}

function idbGetAll(db: IDBDatabase): Promise<CaseData[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as CaseData[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 读取失败'));
  });
}

function idbDelete(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB 删除失败'));
  });
}

async function pruneOldCases(db: IDBDatabase): Promise<void> {
  const all = await idbGetAll(db);
  if (all.length <= MAX_STORED_CASES) return;
  const sorted = [...all].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const toRemove = sorted.slice(MAX_STORED_CASES);
  await Promise.all(toRemove.map((c) => idbDelete(db, c.id)));
  for (const c of toRemove) memoryCache.delete(c.id);
}

function readLegacyCase(id: string): CaseData | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LEGACY_CASES_KEY);
    if (!raw) return null;
    const cases = JSON.parse(raw) as CaseData[];
    return cases.find((c) => c.id === id) ?? null;
  } catch {
    return null;
  }
}

/** 保存完整案件（含 base64 AI 图），使用 IndexedDB，不受 localStorage 5MB 限制 */
export async function saveCaseData(caseData: CaseData): Promise<void> {
  memoryCache.set(caseData.id, caseData);
  const db = await openDb();
  try {
    await idbPut(db, caseData);
    await pruneOldCases(db);
  } finally {
    db.close();
  }
}

/** 按 id 加载案件；优先内存缓存 → IndexedDB → 旧版 localStorage */
export async function loadCaseDataById(id: string): Promise<CaseData | null> {
  const cached = memoryCache.get(id);
  if (cached) return cached;

  const legacy = readLegacyCase(id);
  if (legacy) {
    memoryCache.set(id, legacy);
    await saveCaseData(legacy).catch(() => {});
    return legacy;
  }

  const db = await openDb();
  try {
    const fromIdb = await idbGet(db, id);
    if (fromIdb) memoryCache.set(id, fromIdb);
    return fromIdb;
  } finally {
    db.close();
  }
}

export async function clearCaseStore(): Promise<void> {
  memoryCache.clear();
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  try {
    const all = await idbGetAll(db);
    await Promise.all(all.map((c) => idbDelete(db, c.id)));
  } finally {
    db.close();
  }
}
