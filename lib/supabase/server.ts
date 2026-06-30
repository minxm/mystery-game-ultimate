import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
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

export async function getSessionUserId(): Promise<string | null> {
  const supabase = await createClientSafe();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
