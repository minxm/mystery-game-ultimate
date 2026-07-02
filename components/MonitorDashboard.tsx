'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Activity,
  ChevronLeft,
  Zap,
  Clock,
  Database,
  AlertTriangle,
  RefreshCw,
  Loader2,
  X,
  Server,
  Users,
  CheckCircle2,
} from 'lucide-react';
import type { MonitorInventoryClaimer } from '@/lib/supabase/database';
import BackButton from '@/components/BackButton';
import ParticleBackground from '@/components/ParticleBackground';
import OnlinePresence from '@/components/OnlinePresence';
import { ListPagination, paginateSlice, MODAL_LIST_PAGE_SIZE } from '@/components/ListPagination';
import { useAuth } from '@/components/AuthProvider';
import { getAccessToken } from '@/lib/authenticated-fetch';
import { inflight } from '@/lib/inflight';
import { refreshMonitorStats } from '@/app/monitor/actions';
import {
  EMPTY_MONITOR_STATS,
  normalizeMonitorStats,
  type MonitorStatsPayload,
} from '@/app/monitor/types';

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '初级',
  medium: '中级',
  hard: '高级',
  expert: '专家',
};

const DIFFICULTY_STYLE: Record<string, string> = {
  easy: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
  medium: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  hard: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  expert: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
};

const INVENTORY_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  available: { label: '未领取', className: 'text-cyan-400' },
  claimed: { label: '已领取', className: 'text-amber-400' },
  archived: { label: '已归档', className: 'text-white/40' },
};

const PANEL_BG = 'linear-gradient(160deg, rgba(10,24,48,0.92), rgba(4,13,26,0.98))';
const CARD_FRAME =
  'relative rounded-xl p-4 detective-border shadow-[0_0_20px_rgba(34,211,238,0.08)] overflow-hidden h-full';
const INVENTORY_PAGE_SIZE = 10;
const ERRORS_PAGE_SIZE = 8;

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-CN');
}

function claimerLabel(claimer: MonitorInventoryClaimer) {
  return claimer.displayName ?? (claimer.userId ? claimer.userId.slice(0, 8) : '游客');
}

function hasInventoryClaimers(item: { status: string; claimers: unknown[] }) {
  return item.claimers.length > 0 || item.status === 'claimed';
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  glow,
  delay,
}: {
  label: string;
  value: string | number;
  icon: typeof Activity;
  color: string;
  glow: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45 }}
      className={`${CARD_FRAME} ${glow}`}
      style={{ background: PANEL_BG }}
    >
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent" />
      <Icon className={`w-5 h-5 ${color} mb-2 opacity-90`} />
      <p className="text-2xl font-black text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-white/35 font-mono tracking-wider mt-1">{label}</p>
    </motion.div>
  );
}

function PanelShell({
  title,
  icon: Icon,
  iconClass,
  subtitle,
  children,
  delay = 0,
}: {
  title: string;
  icon: typeof Database;
  iconClass?: string;
  subtitle?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="rounded-2xl detective-border overflow-hidden"
      style={{ background: PANEL_BG, boxShadow: '0 0 40px rgba(30,144,255,0.06)' }}
    >
      <div className="px-5 py-4 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-white/80 flex items-center gap-2 tracking-wide">
          <Icon className={`w-4 h-4 ${iconClass ?? 'text-cyan-400'}`} />
          {title}
        </h2>
        {subtitle && (
          <p className="text-[10px] text-white/35 font-mono tracking-wider">{subtitle}</p>
        )}
      </div>
      <div className="p-5">{children}</div>
    </motion.section>
  );
}

export default function MonitorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<MonitorStatsPayload>(EMPTY_MONITOR_STATS);
  const [accessDenied, setAccessDenied] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(() => new Date());
  const [claimersModal, setClaimersModal] = useState<{
    title: string;
    claimers: MonitorInventoryClaimer[];
  } | null>(null);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [errorsPage, setErrorsPage] = useState(1);
  const [claimersPage, setClaimersPage] = useState(1);

  const openClaimersModal = (payload: { title: string; claimers: MonitorInventoryClaimer[] }) => {
    setClaimersPage(1);
    setClaimersModal(payload);
  };

  const fetchStats = useCallback(async (accessToken?: string | null) => {
    setLoading(true);
    try {
      const token = accessToken ?? (await getAccessToken());
      const result = await refreshMonitorStats(token);
      if (result.success && result.stats) {
        setStats(normalizeMonitorStats(result.stats));
        setAccessDenied(false);
        setLastUpdate(new Date());
        setInventoryPage(1);
        setErrorsPage(1);
        return;
      }
      if (result.error === '无权访问监控数据') {
        setAccessDenied(true);
      }
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void inflight(`monitor:${user?.id ?? 'guest'}`, () => fetchStats());
  }, [authLoading, user?.id, fetchStats]);

  if (accessDenied) {
    return (
      <div className="min-h-screen relative page-shell bg-dark-900 flex items-center justify-center">
        <ParticleBackground />
        <div className="relative z-10 text-center px-4">
          <AlertTriangle className="w-12 h-12 text-orange-400/50 mx-auto mb-4" />
          <p className="text-white/70 mb-2 font-bold">无权访问监控页</p>
          <p className="text-xs text-white/40 mb-6 max-w-sm">
            生产环境请配置 ADMIN_USER_IDS 并使用管理员账号登录
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-blue-500/30 text-blue-400 text-sm hover:bg-blue-500/10 transition"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  if (!initialized || authLoading) {
    return (
      <div className="min-h-screen relative page-shell bg-dark-900">
        <ParticleBackground />
        <div className="relative z-10 flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
          <p className="text-xs font-mono text-cyan-400/40 tracking-widest">INITIALIZING...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: '排队生成', value: stats.pendingJobs, icon: Activity, color: 'text-orange-400', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.1)]' },
    { label: '近1h AI 调用', value: stats.aiCallsLastHour, icon: Zap, color: 'text-cyan-400', glow: 'shadow-[0_0_20px_rgba(34,211,238,0.1)]' },
    { label: '平均耗时', value: `${stats.avgLatencyMs}ms`, icon: Clock, color: 'text-blue-400', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.1)]' },
    { label: '近1h Token', value: (stats.tokensLastHour ?? 0).toLocaleString(), icon: Server, color: 'text-violet-400', glow: 'shadow-[0_0_20px_rgba(167,139,250,0.1)]' },
  ];

  const availableCount = stats.inventory.filter((item) => !hasInventoryClaimers(item)).length;
  const claimedCount = stats.inventory.filter((item) => hasInventoryClaimers(item)).length;

  const inventoryTotalPages = Math.max(1, Math.ceil(stats.inventory.length / INVENTORY_PAGE_SIZE));
  const errorsTotalPages = Math.max(1, Math.ceil(stats.recentErrors.length / ERRORS_PAGE_SIZE));
  const safeInventoryPage = Math.min(inventoryPage, inventoryTotalPages);
  const safeErrorsPage = Math.min(errorsPage, errorsTotalPages);

  const pagedInventory = stats.inventory.slice(
    (safeInventoryPage - 1) * INVENTORY_PAGE_SIZE,
    safeInventoryPage * INVENTORY_PAGE_SIZE
  );
  const pagedErrors = stats.recentErrors.slice(
    (safeErrorsPage - 1) * ERRORS_PAGE_SIZE,
    safeErrorsPage * ERRORS_PAGE_SIZE
  );

  const claimersModalPageSize = MODAL_LIST_PAGE_SIZE;
  const claimersTotal = claimersModal?.claimers.length ?? 0;
  const claimersTotalPages = Math.max(1, Math.ceil(claimersTotal / claimersModalPageSize));
  const safeClaimersPage = Math.min(claimersPage, claimersTotalPages);
  const pagedClaimers = claimersModal
    ? paginateSlice(claimersModal.claimers, safeClaimersPage, claimersModalPageSize)
    : [];

  return (
    <div className="min-h-screen relative page-shell bg-dark-900">
      <ParticleBackground />

      <div className="fixed inset-0 pointer-events-none z-10 mystery-scanlines opacity-25" />
      <div className="fixed inset-0 pointer-events-none z-10">
        {['top-0 left-0 border-l border-t','top-0 right-0 border-r border-t','bottom-0 left-0 border-l border-b','bottom-0 right-0 border-r border-b'].map((cls, i) => (
          <div key={i} className={`absolute w-16 h-16 border-cyan-500/15 ${cls}`} />
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-4 py-10 max-w-5xl">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <BackButton className="flex items-center gap-1 text-sm text-cyan-400/60 hover:text-cyan-400 transition-colors shrink-0">
              <ChevronLeft className="w-4 h-4" />
              返回
            </BackButton>
            <h1 className="page-heading min-w-0 truncate flex items-center gap-2">
              <span>实时监控</span>
              <span className="text-[10px] font-mono font-normal text-white/30 shrink-0 hidden sm:inline">
                · {lastUpdate.toLocaleTimeString('zh-CN')}
              </span>
            </h1>
          </div>
          <button
            onClick={() => void fetchStats()}
            disabled={loading}
            className="p-2 rounded-lg border border-cyan-500/20 hover:border-cyan-400/40 transition disabled:opacity-50 shrink-0"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 text-cyan-400/60 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <OnlinePresence variant="card" framed />
          {statCards.map((card, i) => (
            <StatCard key={card.label} {...card} delay={0.05 + i * 0.06} />
          ))}
        </div>

        <div className="space-y-6">
          <PanelShell
            title="案件库存"
            icon={Database}
            subtitle={
              stats.inventory.length > 0
                ? `共 ${stats.inventory.length} 件 · 未领 ${availableCount} · 已领 ${claimedCount}`
                : undefined
            }
            delay={0.2}
          >
            {stats.inventory.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-6">暂无库存数据（需执行数据库迁移）</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-cyan-500/15 text-left">
                      {['案件名称', '难度', '状态', '领取人数', '最近领取', '入库时间', '游玩'].map((h) => (
                        <th key={h} className="py-2.5 pr-3 font-mono text-[10px] text-cyan-400/45 tracking-wider font-medium whitespace-nowrap">
                          {h.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedInventory.map((item, i) => {
                      const claimed = hasInventoryClaimers(item);
                      const statusMeta = claimed
                        ? INVENTORY_STATUS_LABEL.claimed
                        : (INVENTORY_STATUS_LABEL[item.status] ?? {
                            label: item.status,
                            className: 'text-white/50',
                          });
                      const diffStyle = DIFFICULTY_STYLE[item.difficulty] ?? DIFFICULTY_STYLE.medium;

                      return (
                        <motion.tr
                          key={item.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.25 + i * 0.02 }}
                          className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3 pr-3">
                            <Link
                              href={`/case/${item.caseId}`}
                              className="text-white/85 hover:text-cyan-300 transition-colors font-medium"
                            >
                              {item.title}
                            </Link>
                            <p className="text-[10px] text-white/20 font-mono mt-0.5">{item.caseId.slice(-8)}</p>
                          </td>
                          <td className="py-3 pr-3 whitespace-nowrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${diffStyle}`}>
                              {DIFFICULTY_LABEL[item.difficulty] ?? item.difficulty}
                            </span>
                          </td>
                          <td className={`py-3 pr-3 whitespace-nowrap text-xs font-mono ${statusMeta.className}`}>
                            {statusMeta.label}
                          </td>
                          <td className="py-3 pr-3 whitespace-nowrap">
                            {item.claimers.length > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openClaimersModal({ title: item.title, claimers: item.claimers })
                                }
                                className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-bold tabular-nums transition-colors"
                              >
                                <Users className="w-3.5 h-3.5" />
                                {item.claimers.length}
                              </button>
                            ) : (
                              <span className="text-white/25 tabular-nums">0</span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-white/35 whitespace-nowrap font-mono text-[11px]">
                            {formatDateTime(item.claimers[0]?.claimedAt ?? null)}
                          </td>
                          <td className="py-3 pr-3 text-white/35 whitespace-nowrap font-mono text-[11px]">
                            {formatDateTime(item.createdAt)}
                          </td>
                          <td className="py-3 text-white/50 tabular-nums font-mono text-xs">{item.playCount}</td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
                <ListPagination
                  page={safeInventoryPage}
                  pageSize={INVENTORY_PAGE_SIZE}
                  total={stats.inventory.length}
                  onPageChange={setInventoryPage}
                  className="pt-4 mt-4 !px-0"
                />
              </div>
            )}
          </PanelShell>

          <PanelShell
            title="近期 AI 错误"
            icon={AlertTriangle}
            iconClass="text-orange-400"
            subtitle={stats.recentErrors.length > 0 ? `${stats.recentErrors.length} 条记录` : undefined}
            delay={0.3}
          >
            {stats.recentErrors.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-8 h-8 text-green-400/40 mx-auto mb-2" />
                <p className="text-white/40 text-sm">系统运行正常，暂无错误</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pagedErrors.map((err, i) => (
                  <motion.div
                    key={`${err.createdAt}-${err.operation}-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.04 }}
                    className="rounded-lg border border-orange-500/15 bg-orange-500/[0.03] p-3 hover:border-orange-400/25 transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-mono text-white/30">
                        {new Date(err.createdAt).toLocaleString('zh-CN')}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-orange-400/30 text-orange-300 bg-orange-500/10 font-mono">
                        {err.operation}
                      </span>
                      <span className="text-[10px] text-white/40 font-mono">{err.model}</span>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed break-all">{err.errorMessage}</p>
                  </motion.div>
                ))}
                <ListPagination
                  page={safeErrorsPage}
                  pageSize={ERRORS_PAGE_SIZE}
                  total={stats.recentErrors.length}
                  onPageChange={setErrorsPage}
                  className="pt-4 mt-4 !px-0"
                />
              </div>
            )}
          </PanelShell>
        </div>

        {claimersModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
            onClick={() => setClaimersModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md rounded-2xl detective-border overflow-hidden shadow-2xl"
              style={{ background: PANEL_BG }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-mono text-cyan-400/50 tracking-widest mb-1">CLAIM LOG</p>
                  <h3 className="text-base font-bold text-white">{claimersModal.title}</h3>
                  <p className="text-xs text-white/40 mt-1">共 {claimersModal.claimers.length} 人领取</p>
                </div>
                <button
                  type="button"
                  onClick={() => setClaimersModal(null)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition"
                  aria-label="关闭"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ul className="px-4 pt-4 pb-2 space-y-1 max-h-72 overflow-y-auto">
                {pagedClaimers.map((claimer, index) => (
                  <li
                    key={`${claimer.userId ?? 'guest'}-${claimer.claimedAt}-${index}`}
                    className="flex items-center justify-between gap-3 py-2.5 px-2 rounded-lg hover:bg-white/[0.03] border-b border-white/[0.04] last:border-0"
                  >
                    <span className="text-white/80 text-sm">{claimerLabel(claimer)}</span>
                    <span className="text-[11px] text-white/35 font-mono whitespace-nowrap">
                      {formatDateTime(claimer.claimedAt)}
                    </span>
                  </li>
                ))}
              </ul>
              <ListPagination
                page={safeClaimersPage}
                pageSize={claimersModalPageSize}
                total={claimersTotal}
                onPageChange={setClaimersPage}
              />
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
