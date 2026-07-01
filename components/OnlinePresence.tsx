'use client';

import { Users } from 'lucide-react';
import { useOnlineCount } from './PresenceProvider';

interface OnlinePresenceProps {
  /** 监控页大卡片样式 */
  variant?: 'inline' | 'card';
}

export default function OnlinePresence({ variant = 'inline' }: OnlinePresenceProps) {
  const count = useOnlineCount();

  if (count === null) {
    return variant === 'card' ? (
      <div className="glass-panel p-4 animate-pulse">
        <div className="h-5 w-5 rounded bg-white/10 mb-2" />
        <div className="h-7 w-12 rounded bg-white/10 mb-1" />
        <div className="h-3 w-16 rounded bg-white/10" />
      </div>
    ) : null;
  }

  if (variant === 'card') {
    return (
      <div className="glass-panel p-4">
        <Users className="w-5 h-5 text-green-400 mb-2" />
        <p className="text-2xl font-bold text-white tabular-nums">{count}</p>
        <p className="text-xs text-white/40 mt-1 flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          在线侦探
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-1.5 text-xs font-mono text-green-400/90"
      title="当前在线侦探"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <Users className="w-3.5 h-3.5 shrink-0" />
      <span className="tabular-nums">{count}</span>
      <span className="text-green-400/70">在线</span>
    </div>
  );
}
