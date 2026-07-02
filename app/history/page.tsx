'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Loader2, RefreshCw, FileSearch,
  CheckCircle2, Radar, ChevronRight, Sparkles,
} from 'lucide-react';
import BackButton from '@/components/BackButton';
import DetectiveStatStrip from '@/components/DetectiveStatStrip';
import ParticleBackground from '@/components/ParticleBackground';
import { useAuth } from '@/components/AuthProvider';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { inflight } from '@/lib/inflight';
import type { UserStats } from '@/lib/types';

interface HistoryEntry {
  id: string;
  caseId: string;
  caseTitle: string;
  score: number | null;
  rating: string;
  killerCorrect: boolean | null;
  createdAt: string;
  status: 'in_progress' | 'completed';
}

const EMPTY_STATS: UserStats = {
  casesCompleted: 0,
  averageScore: 0,
  perfectSolves: 0,
  streak: 0,
  achievements: [],
};

const STAT_ITEMS = [
  { key: 'casesCompleted', label: '已完成', accent: 'cyan' as const, code: '01' },
  { key: 'averageScore', label: '均分', accent: 'blue' as const, code: '02' },
  { key: 'perfectSolves', label: '完美推理', accent: 'amber' as const, code: '03' },
  { key: 'streak', label: '连胜', accent: 'violet' as const, code: '04' },
] as const;

function HistoryStatsPanel({ stats }: { stats: UserStats }) {
  const values: Record<(typeof STAT_ITEMS)[number]['key'], string> = {
    casesCompleted: String(stats.casesCompleted),
    averageScore: String(Math.round(stats.averageScore)),
    perfectSolves: String(stats.perfectSolves),
    streak: String(stats.streak),
  };

  return (
    <DetectiveStatStrip
      columns={4}
      items={STAT_ITEMS.map((item) => ({
        label: item.label,
        value: values[item.key],
        accent: item.accent,
        code: item.code,
      }))}
    />
  );
}

function HistoryEntryCard({ entry, index }: { entry: HistoryEntry; index: number }) {
  const caseNo = entry.caseId.slice(-6).toUpperCase();
  const isCompleted = entry.status === 'completed';
  const href = isCompleted ? `/archive/${entry.caseId}` : `/investigate/${entry.caseId}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Link
        href={href}
        className="group block relative overflow-hidden rounded-xl detective-border transition-all duration-300 hover:border-blue-400/35 hover:shadow-[0_0_30px_rgba(30,144,255,0.1)]"
        style={{ background: 'linear-gradient(135deg, rgba(10,24,48,0.75), rgba(4,13,26,0.9))' }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="relative flex items-center gap-4 p-4 sm:p-5">
          <div
            className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border ${
              isCompleted
                ? 'border-cyan-500/30 bg-cyan-500/10'
                : 'border-amber-500/30 bg-amber-500/10'
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-6 h-6 text-cyan-400" />
            ) : (
              <Radar className="w-6 h-6 text-amber-400 animate-pulse" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-[10px] text-blue-400/40 tracking-widest">#{caseNo}</span>
              {isCompleted ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-cyan-400/25 text-cyan-300/90 bg-cyan-500/10 font-mono">
                  CASE CLOSED
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-400/30 text-amber-300/90 bg-amber-500/10 font-mono">
                  调查中
                </span>
              )}
            </div>
            <p className="text-white font-bold truncate group-hover:text-blue-100 transition-colors">
              {entry.caseTitle}
            </p>
            <p className="text-xs text-white/35 mt-1 font-mono">
              {new Date(entry.createdAt).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
              {isCompleted && entry.killerCorrect === true && ' · 指认正确 ✓'}
              {isCompleted && entry.killerCorrect === false && ' · 指认错误 ✗'}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            {isCompleted && entry.score != null && (
              <div className="text-right hidden sm:block">
                <p className="text-2xl font-black text-cyan-400 tabular-nums leading-none">{entry.score}</p>
                <p className="text-[10px] text-white/30 font-mono mt-0.5">{entry.rating || 'SCORE'}</p>
              </div>
            )}
            <span className="inline-flex items-center gap-0.5 text-xs text-blue-400/70 group-hover:text-blue-300 transition-colors whitespace-nowrap">
              {isCompleted ? '查看档案' : '继续调查'}
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<UserStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async (manual = false) => {
    if (!userId) {
      setHistory([]);
      setStats(EMPTY_STATS);
      setLoading(false);
      return;
    }

    if (manual) setRefreshing(true);
    else setLoading(true);

    try {
      const [historyRes, statsRes] = await Promise.all([
        authenticatedFetch('/api/history'),
        authenticatedFetch('/api/user/stats'),
      ]);
      const [historyData, statsData] = await Promise.all([
        historyRes.json(),
        statsRes.json(),
      ]);

      if (historyData.success) setHistory(historyData.history);
      if (statsData.success && statsData.stats) setStats(statsData.stats);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setHistory([]);
      setStats(EMPTY_STATS);
      setLoading(false);
      return;
    }
    void inflight(`history:${userId}`, () => loadHistory());
  }, [authLoading, userId, loadHistory]);

  const completedCount = history.filter((h) => h.status === 'completed').length;
  const inProgressCount = history.filter((h) => h.status === 'in_progress').length;

  return (
    <div className="min-h-screen relative page-shell bg-dark-900">
      <ParticleBackground />

      <div className="fixed inset-0 pointer-events-none z-10 mystery-scanlines opacity-20" />
      <div className="fixed inset-0 pointer-events-none z-10">
        {['top-0 left-0 border-l border-t','top-0 right-0 border-r border-t','bottom-0 left-0 border-l border-b','bottom-0 right-0 border-r border-b'].map((cls, i) => (
          <div key={i} className={`absolute w-14 h-14 border-blue-500/20 ${cls}`} />
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-4 py-10 max-w-3xl">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <BackButton className="inline-flex items-center gap-1 text-blue-400/70 hover:text-blue-400 text-sm shrink-0">
              <ChevronLeft className="w-4 h-4" /> 返回
            </BackButton>
            <h1 className="page-heading min-w-0 truncate">推理历史</h1>
          </div>
          {userId && (
            <button
              type="button"
              onClick={() => void loadHistory(true)}
              disabled={loading || refreshing}
              className="p-2 rounded-lg border border-blue-500/20 hover:border-blue-400/40 transition disabled:opacity-50 shrink-0"
              title="刷新"
            >
              <RefreshCw className={`w-4 h-4 text-blue-400/60 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {!userId && !authLoading && (
          <div
            className="rounded-2xl p-12 text-center detective-border"
            style={{ background: 'linear-gradient(160deg, rgba(10,24,48,0.9), rgba(4,13,26,0.95))' }}
          >
            <FileSearch className="w-12 h-12 text-blue-400/30 mx-auto mb-4" />
            <p className="text-white/50">登录后查看你的推理记录</p>
          </div>
        )}

        {userId && !loading && <HistoryStatsPanel stats={stats} />}

        {userId && !loading && history.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs font-mono text-blue-400/40 tracking-widest text-center mb-5"
          >
            共 {history.length} 条记录 · 已结案 {completedCount} · 进行中 {inProgressCount}
          </motion.p>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
          </div>
        )}

        {!loading && userId && history.length === 0 && (
          <div
            className="rounded-2xl p-12 text-center detective-border"
            style={{ background: 'linear-gradient(160deg, rgba(10,24,48,0.9), rgba(4,13,26,0.95))' }}
          >
            <Sparkles className="w-10 h-10 text-blue-400/30 mx-auto mb-4" />
            <p className="text-white/50 mb-2">暂无推理记录</p>
            <p className="text-xs text-white/30 mb-6">去首页挑选案件，开始你的侦探之旅</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-medium hover:opacity-90 transition"
            >
              <FileSearch className="w-4 h-4" />
              前往选案
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {!loading && history.map((entry, i) => (
            <HistoryEntryCard key={entry.id} entry={entry} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
