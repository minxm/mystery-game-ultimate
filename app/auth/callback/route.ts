import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const redirectTo = next.startsWith('/') ? next : '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth=error&reason=missing_code`);
  }

  const response = NextResponse.redirect(`${origin}${redirectTo}`);
  const cookieStore = await cookies();

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Route Handler 中 cookieStore.set 可能失败，仍写入 response
          }
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const params = new URLSearchParams({
      auth: 'error',
      reason: error.code ?? 'exchange_failed',
    });
    return NextResponse.redirect(`${origin}/?${params.toString()}`);
  }

  return response;
}
