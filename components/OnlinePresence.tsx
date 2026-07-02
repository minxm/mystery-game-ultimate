'use client';

import { useState } from 'react';
import { Users, X } from 'lucide-react';
import { useOnlinePresence } from './PresenceProvider';
import type { OnlinePresenceUser } from './PresenceProvider';
import { ListPagination, paginateSlice, MODAL_LIST_PAGE_SIZE } from '@/components/ListPagination';

const PANEL_BG = 'linear-gradient(160deg, rgba(10,24,48,0.92), rgba(4,13,26,0.98))';
const CARD_FRAME =
  'relative rounded-xl p-4 detective-border shadow-[0_0_20px_rgba(34,211,238,0.08)] overflow-hidden h-full';

interface OnlinePresenceProps {
  /** 监控页大卡片样式 */
  variant?: 'inline' | 'card';
  /** 与监控页 StatCard 一致的边框样式 */
  framed?: boolean;
}

export default function OnlinePresence({ variant = 'inline', framed = false }: OnlinePresenceProps) {
  const { count, users } = useOnlinePresence();
  const [showModal, setShowModal] = useState(false);
  const [modalPage, setModalPage] = useState(1);

  const cardShellClass = framed
    ? `${CARD_FRAME}`
    : 'glass-panel p-4 h-full';

  const cardStyle = framed ? { background: PANEL_BG } : undefined;

  const totalUsers = users.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / MODAL_LIST_PAGE_SIZE));
  const safeModalPage = Math.min(modalPage, totalPages);
  const pagedUsers = paginateSlice(users, safeModalPage, MODAL_LIST_PAGE_SIZE);

  if (count === null) {
    return variant === 'card' ? (
      <div className={`${cardShellClass} animate-pulse`} style={cardStyle}>
        {framed && (
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent" />
        )}
        <div className="h-5 w-5 rounded bg-white/10 mb-2" />
        <div className="h-7 w-12 rounded bg-white/10 mb-1" />
        <div className="h-3 w-16 rounded bg-white/10" />
      </div>
    ) : null;
  }

  const openModal = () => {
    if (count > 0) {
      setModalPage(1);
      setShowModal(true);
    }
  };

  const countButtonClass =
    count > 0
      ? 'text-cyan-400 hover:text-cyan-300 underline underline-offset-2 decoration-cyan-400/40 hover:decoration-cyan-300/60 transition-colors cursor-pointer'
      : 'cursor-default';

  const modal = showModal && (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      onClick={() => setShowModal(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl detective-border overflow-hidden shadow-2xl"
        style={{ background: PANEL_BG }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">在线侦探</h3>
            <p className="text-xs text-white/40 mt-1">共 {count} 人在线</p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <ul className="px-4 pt-4 pb-2 space-y-1 max-h-72 overflow-y-auto">
          {pagedUsers.map((item: OnlinePresenceUser) => (
            <li
              key={item.name}
              className="flex items-center gap-2 py-2.5 px-2 rounded-lg hover:bg-white/[0.03] border-b border-white/[0.04] last:border-0"
            >
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              <span className="text-white/80 text-sm">{item.name}</span>
              {item.name === '游客' && item.count > 1 && (
                <span className="text-xs text-white/35 tabular-nums">×{item.count}</span>
              )}
            </li>
          ))}
        </ul>
        <ListPagination
          page={safeModalPage}
          pageSize={MODAL_LIST_PAGE_SIZE}
          total={totalUsers}
          onPageChange={setModalPage}
        />
      </div>
    </div>
  );

  if (variant === 'card') {
    return (
      <>
        <div className={cardShellClass} style={cardStyle}>
          {framed && (
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent" />
          )}
          <Users className="w-5 h-5 text-green-400 mb-2 opacity-90" />
          <button
            type="button"
            onClick={openModal}
            disabled={count === 0}
            className={`text-2xl font-black tabular-nums ${countButtonClass} ${
              count === 0 ? 'text-white' : ''
            }`}
            title={count > 0 ? '查看在线侦探' : undefined}
          >
            {count}
          </button>
          <p className="text-[10px] text-white/35 font-mono tracking-wider mt-1 flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
            在线侦探
          </p>
        </div>
        {modal}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={count === 0}
        className="flex items-center gap-1.5 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-1.5 text-xs font-mono text-green-400/90 disabled:cursor-default"
        title={count > 0 ? '查看在线侦探' : '当前在线侦探'}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <Users className="w-3.5 h-3.5 shrink-0" />
        <span className={`tabular-nums ${count > 0 ? countButtonClass : ''}`}>{count}</span>
        <span className="text-green-400/70">在线</span>
      </button>
      {modal}
    </>
  );
}
