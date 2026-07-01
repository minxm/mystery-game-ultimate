import { NextResponse } from 'next/server';
import { requireMonitorAccess } from '@/lib/server-admin-auth';

/** 当前登录用户是否为管理员（与 /monitor 相同鉴权） */
export async function GET() {
  const access = await requireMonitorAccess();
  return NextResponse.json({ isAdmin: access.allowed });
}
