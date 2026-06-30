import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl, isSupabaseConfigured } from './env';

/** 服务端 Admin 客户端（绕过 RLS，仅用于后台任务） */
export function createAdminClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }
  const serviceKey = getSupabaseServiceRoleKey();
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 未配置');
  }
  return createClient(getSupabaseUrl(), serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createAdminClientSafe() {
  if (!isSupabaseConfigured() || !getSupabaseServiceRoleKey()) return null;
  return createAdminClient();
}
