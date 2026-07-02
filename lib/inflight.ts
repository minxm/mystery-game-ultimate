const inflightMap = new Map<string, Promise<unknown>>();

/** 合并同一 key 的并发请求（Strict Mode 双挂载 / auth 重复触发） */
export function inflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflightMap.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = fn().finally(() => {
    inflightMap.delete(key);
  });
  inflightMap.set(key, promise);
  return promise;
}
