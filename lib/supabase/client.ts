import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from './env';

export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}

/** 安全创建客户端，未配置时返回 null */
export function createClientSafe() {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
