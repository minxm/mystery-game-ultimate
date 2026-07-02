'use client';

import { useId } from 'react';

/** 审问页用户消息头像 — 与首页 Hero 放大镜同系的侦探标识 */
export default function DetectiveChatAvatar({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const lensId = `detectiveLens-${uid}`;
  const handleId = `detectiveHandle-${uid}`;

  return (
    <div
      className={`detective-chat-avatar relative w-7 h-7 rounded-full flex-shrink-0 mb-0.5 overflow-hidden border border-blood-500/40 flex items-center justify-center ${className}`}
      role="img"
      aria-label="侦探"
      title="侦探"
    >
      <div className="detective-chat-avatar__bg absolute inset-0 rounded-full" />
      <div className="detective-chat-avatar__pulse absolute inset-[2px] rounded-full pointer-events-none" />
      <svg
        viewBox="0 0 24 24"
        className="relative z-10 w-[17px] h-[17px] drop-shadow-[0_0_4px_rgba(30,144,255,0.55)]"
        aria-hidden
      >
        <defs>
          <linearGradient id={lensId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="55%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id={handleId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
        </defs>
        <circle cx="10.2" cy="10.2" r="6.2" fill="rgba(4,13,26,0.55)" stroke={`url(#${lensId})`} strokeWidth="1.45" />
        <circle cx="10.2" cy="10.2" r="4.2" fill="none" stroke="rgba(125,211,252,0.22)" strokeWidth="0.65" />
        <path
          d="M7.4 8.1 Q10.2 6.4 12.6 8.2"
          fill="none"
          stroke="rgba(255,255,255,0.42)"
          strokeWidth="0.85"
          strokeLinecap="round"
        />
        <circle cx="10.5" cy="10.5" r="1.05" fill="#fbbf24" />
        <path
          d="M14.8 14.8 L18.6 18.6"
          stroke={`url(#${handleId})`}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
