import { createClientSafe } from '@/lib/supabase/client';

/** 从 Supabase 客户端读取 access token（不依赖 cookie 同步） */
export async function getAccessToken(): Promise<string | null> {
  const supabase = createClientSafe();
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;

  const { data: { session: refreshed } } = await supabase.auth.refreshSession();
  return refreshed?.access_token ?? null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带 Authorization Bearer 的 fetch，401 时刷新 session 并重试。
 * 解决 AuthProvider 已就绪但 cookie 尚未写入导致的首屏 401。
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options?: { retries?: number }
): Promise<Response> {
  const maxRetries = options?.retries ?? 2;
  const supabase = createClientSafe();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const token = await getAccessToken();
    const headers = new Headers(init.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(input, {
      ...init,
      headers,
      cache: init.cache ?? 'no-store',
    });

    if (res.status !== 401 || attempt === maxRetries) {
      return res;
    }

    if (supabase) {
      await supabase.auth.refreshSession().catch(() => {});
    }
    await sleep(300 * (attempt + 1));
  }

  return fetch(input, { ...init, cache: init.cache ?? 'no-store' });
}
