import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from './env';

export async function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component 中可能无法写 cookie
        }
      },
    },
  });
}

export async function createClientSafe() {
  if (!isSupabaseConfigured()) return null;
  return createClient();
}

export async function getUserIdFromAccessToken(accessToken: string): Promise<string | null> {
  const supabase = await createClientSafe();
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return null;
  return user.id;
}

/** 优先 Bearer token，其次 cookie session；Server Action 可传入 accessToken */
export async function getSessionUserId(accessToken?: string | null): Promise<string | null> {
  if (accessToken) {
    const fromArg = await getUserIdFromAccessToken(accessToken);
    if (fromArg) return fromArg;
  }

  try {
    const headerStore = await headers();
    const auth = headerStore.get('authorization');
    if (auth?.startsWith('Bearer ')) {
      const fromHeader = await getUserIdFromAccessToken(auth.slice('Bearer '.length).trim());
      if (fromHeader) return fromHeader;
    }
  } catch {
    /* headers() 在部分上下文不可用 */
  }

  const supabase = await createClientSafe();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
