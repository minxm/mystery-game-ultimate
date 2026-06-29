/**
 * 本地内联 SVG 占位图（data URI）。
 *
 * 线上（Netlify）默认关闭 AI 生图以避免网关超时，过去用 ui-avatars.com 外部服务，
 * 国内访问时不时超时/被墙，导致「图片加载失败」。改为内联 SVG data URI 后：
 * - 零网络请求，永不加载失败
 * - 随名字确定性地生成配色，视觉统一又有区分度
 */

const AVATAR_PALETTES: Array<[string, string]> = [
  ['#0b3d91', '#1e90ff'],
  ['#0f766e', '#22d3ee'],
  ['#3b0764', '#a855f7'],
  ['#7f1d1d', '#ef4444'],
  ['#14532d', '#22c55e'],
  ['#78350f', '#f59e0b'],
  ['#1e1b4b', '#6366f1'],
  ['#831843', '#ec4899'],
  ['#0c4a6e', '#38bdf8'],
  ['#374151', '#9ca3af'],
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function firstGrapheme(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  return Array.from(trimmed)[0];
}

function toDataUri(svg: string): string {
  // 压缩多余空白后编码，避免 data URI 过长
  const compact = svg.replace(/\s{2,}/g, ' ').trim();
  return `data:image/svg+xml,${encodeURIComponent(compact)}`;
}

/** 生成嫌疑人/受害者头像占位图（含首字与确定性渐变背景） */
export function getAvatarPlaceholder(name: string): string {
  const palette = AVATAR_PALETTES[hashString(name) % AVATAR_PALETTES.length];
  const [c1, c2] = palette;
  const char = firstGrapheme(name);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
        <radialGradient id="v" cx="50%" cy="38%" r="75%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0.35)"/>
        </radialGradient>
      </defs>
      <rect width="512" height="512" fill="url(#g)"/>
      <rect width="512" height="512" fill="url(#v)"/>
      <circle cx="256" cy="200" r="92" fill="rgba(255,255,255,0.10)"/>
      <path d="M120 470c0-86 60-150 136-150s136 64 136 150z" fill="rgba(255,255,255,0.10)"/>
      <text x="256" y="268" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="210" font-weight="700" fill="rgba(255,255,255,0.92)" text-anchor="middle" dominant-baseline="middle">${escapeXml(char)}</text>
    </svg>`;
  return toDataUri(svg);
}

/** 生成案发现场占位图（抽象悬疑氛围） */
export function getScenePlaceholder(seed = 'scene'): string {
  const palette = AVATAR_PALETTES[hashString(seed) % 3];
  const [c1, c2] = palette;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="640" viewBox="0 0 1024 640">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#040d1a"/>
          <stop offset="55%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="640" fill="url(#bg)"/>
      <g stroke="rgba(255,255,255,0.06)" stroke-width="1">
        <line x1="0" y1="160" x2="1024" y2="160"/>
        <line x1="0" y1="320" x2="1024" y2="320"/>
        <line x1="0" y1="480" x2="1024" y2="480"/>
        <line x1="256" y1="0" x2="256" y2="640"/>
        <line x1="512" y1="0" x2="512" y2="640"/>
        <line x1="768" y1="0" x2="768" y2="640"/>
      </g>
      <circle cx="430" cy="300" r="120" fill="none" stroke="rgba(30,144,255,0.5)" stroke-width="6"/>
      <line x1="516" y1="386" x2="640" y2="500" stroke="rgba(30,144,255,0.5)" stroke-width="14" stroke-linecap="round"/>
      <text x="512" y="588" font-family="monospace" font-size="34" letter-spacing="14" fill="rgba(255,255,255,0.45)" text-anchor="middle">CRIME SCENE</text>
    </svg>`;
  return toDataUri(svg);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
