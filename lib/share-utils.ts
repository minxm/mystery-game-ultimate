/** 构建带链接的分享文案（微信粘贴分享最可靠） */
export function buildShareMessage(title: string, url: string): string {
  return `来挑战这个推理案件「${title}」！\n${url}`;
}

export function isWeChatBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

/** 兼容移动端 WebView 的复制 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** 尝试唤起微信（需在用户点击事件中调用） */
export function tryOpenWeChatApp(): void {
  if (typeof window === 'undefined') return;
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) {
    window.location.href =
      'intent://platformapi/startapp#Intent;scheme=weixin;package=com.tencent.mm;end';
    return;
  }
  window.location.href = 'weixin://';
}

/**
 * 微信分享：复制完整文案后尝试打开微信。
 * 系统分享面板选微信在多数机型上不可靠，故不走 navigator.share。
 */
export async function shareToWeChat(title: string, url: string): Promise<boolean> {
  const message = buildShareMessage(title, url);
  const copied = await copyText(message);
  if (!copied) return false;

  if (!isWeChatBrowser()) {
    tryOpenWeChatApp();
  }
  return true;
}

/**
 * 系统原生分享（非微信专用）。
 * 仅传 url，兼容性最好；微信仍可能失败，应优先用 shareToWeChat。
 */
export async function systemShare(
  url: string
): Promise<'shared' | 'cancelled' | 'unavailable'> {
  if (!navigator.share) return 'unavailable';

  const payload = { url };
  if (navigator.canShare && !navigator.canShare(payload)) {
    return 'unavailable';
  }

  try {
    await navigator.share(payload);
    return 'shared';
  } catch (err) {
    if ((err as Error).name === 'AbortError') return 'cancelled';
    return 'unavailable';
  }
}
