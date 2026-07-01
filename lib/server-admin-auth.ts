import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/supabase/server';

/** 仅服务端读取，禁止 NEXT_PUBLIC_ 前缀 */
function readServerSecret(envKey: string): string | undefined {
  const value = process.env[envKey]?.trim();
  return value || undefined;
}

function secureCompare(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Cron / 外部 HTTP 专用鉴权。
 * 使用 Authorization: Bearer <secret>，secret 仅存于服务端环境变量，切勿传入客户端。
 */
export function authorizeCronBearer(
  request: NextRequest,
  envKey: 'INVENTORY_REFILL_SECRET'
): NextResponse | null {
  const expected = readServerSecret(envKey);

  if (!expected) {
    if (isProduction()) {
      return NextResponse.json(
        { success: false, error: '服务端未配置密钥，拒绝访问' },
        { status: 503 }
      );
    }
    // 开发环境未配置时放行，便于本地调试
    return null;
  }

  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
  }

  const token = auth.slice('Bearer '.length).trim();
  if (!secureCompare(token, expected)) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
  }

  return null;
}

/**
 * 监控页 Server Action / RSC 鉴权。
 * 生产环境需配置 ADMIN_USER_IDS（逗号分隔 Supabase user UUID），通过登录态校验，不在 HTTP 中传 secret。
 */
export async function requireMonitorAccess(): Promise<
  { allowed: true; userId: string | null } | { allowed: false }
> {
  const adminIds = readServerSecret('ADMIN_USER_IDS')
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (!adminIds?.length) {
    if (isProduction()) {
      return { allowed: false };
    }
    const userId = await getSessionUserId().catch(() => null);
    return { allowed: true, userId };
  }

  const userId = await getSessionUserId().catch(() => null);
  if (!userId || !adminIds.includes(userId)) {
    return { allowed: false };
  }

  return { allowed: true, userId };
}
