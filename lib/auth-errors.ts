import type { AuthError } from '@supabase/supabase-js';

const PHONE_PROVIDER_MSG =
  '短信登录未开启：请在 Supabase Dashboard → Authentication → Providers → Phone 中启用，并配置 Twilio 等短信服务商（Account SID、Auth Token、Message Service SID）。';

function getAuthErrorCode(error: AuthError): string {
  const code = (error as AuthError & { code?: string }).code;
  return typeof code === 'string' ? code : '';
}

/** 将 Supabase Auth 错误转为用户可读中文提示 */
export function formatAuthError(error: AuthError | null | undefined): string | null {
  if (!error) return null;

  const code = getAuthErrorCode(error);
  const msg = error.message ?? '';

  if (code === 'phone_provider_disabled' || msg.includes('Unsupported phone provider')) {
    return PHONE_PROVIDER_MSG;
  }

  if (code === 'sms_send_failed') {
    return '验证码发送失败，请稍后重试，或改用邮箱登录。';
  }

  if (code === 'otp_expired') {
    return '验证码已过期，请重新获取。';
  }

  if (code === 'invalid_otp') {
    return '验证码不正确，请检查后重试。';
  }

  return msg || '操作失败，请重试';
}

/** 从登录回调 URL（query + hash）解析错误码 */
export function parseAuthCallbackError(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  if (params.get('auth') !== 'error') return null;

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = hashParams.get('error_code') ?? params.get('reason') ?? '';

  if (code === 'otp_expired') {
    return '登录链接已失效或已过期，请重新发送登录邮件。';
  }
  if (code === 'missing_code') {
    return '登录回调缺少授权码，请重新发送登录邮件。';
  }
  if (code === 'exchange_failed' || code === 'pkce_code_verifier_not_found') {
    return '登录会话已过期，请在同一浏览器中重新发送登录邮件后再试。';
  }

  const description = hashParams.get('error_description');
  if (description) return decodeURIComponent(description.replace(/\+/g, ' '));

  return '登录失败，请重试';
}

/** 清除 URL 中的 auth 错误参数 */
export function clearAuthCallbackParams(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('auth') && !url.hash.includes('error')) return;
  url.searchParams.delete('auth');
  url.searchParams.delete('reason');
  url.hash = '';
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}
