'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Trophy, Medal, Loader2, RefreshCw, Crown, Star, Zap, Target,
} from 'lucide-react';
import BackButton from '@/components/BackButton';
import DetectiveStatStrip from '@/components/DetectiveStatStrip';
import ParticleBackground from '@/components/ParticleBackground';
import { inflight } from '@/lib/inflight';
import type { LeaderboardEntry } from '@/lib/supabase/database';

const PODIUM_META = [
  {
    rank: 2,
    height: 'h-28',
    gradient: 'from-gray-400/20 to-gray-600/5',
    border: 'border-gray-400/30',
    icon: Medal,
    iconClass: 'text-gray-300',
    scoreClass: 'text-gray-200',
    delay: 0.15,
  },
  {
    rank: 1,
    height: 'h-36',
    gradient: 'from-yellow-400/25 to-amber-600/5',
    border: 'border-yellow-400/40',
    icon: Crown,
    iconClass: 'text-yellow-400',
    scoreClass: 'text-yellow-300',
    delay: 0.05,
  },
  {
    rank: 3,
    height: 'h-24',
    gradient: 'from-orange-400/20 to-orange-700/5',
    border: 'border-orange-400/30',
    icon: Medal,
    iconClass: 'text-orange-400',
    scoreClass: 'text-orange-300',
    delay: 0.25,
  },
] as const;

function PodiumSlot({
  entry,
  meta,
}: {
  entry: LeaderboardEntry | undefined;
  meta: (typeof PODIUM_META)[number];
}) {
  const Icon = meta.icon;
  const displayName = entry?.displayName ?? '—';
  const avgScore = entry ? Math.round(entry.avgScore) : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: meta.delay, duration: 0.55, type: 'spring' }}
      className={`flex flex-col items-center ${meta.rank === 1 ? 'order-2' : meta.rank === 2 ? 'order-1' : 'order-3'}`}
    >
      <div className="relative mb-3">
        <div
          className={`w-16 h-16 rounded-full border-2 ${meta.border} flex items-center justify-center overflow-hidden`}
          style={{
            background: 'linear-gradient(160deg, rgba(10,24,48,0.9), rgba(4,13,26,0.95))',
            boxShadow: meta.rank === 1 ? '0 0 30px rgba(250,204,21,0.25)' : undefined,
          }}
        >
          {entry?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Icon className={`w-7 h-7 ${meta.iconClass}`} />
          )}
        </div>
        <span
          className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${meta.border} bg-[#040d1a] ${meta.iconClass}`}
        >
          {meta.rank}
        </span>
      </div>

      <p className="text-sm font-bold text-white/90 truncate max-w-[100px] text-center mb-1">
        {displayName}
      </p>
      <p className={`text-2xl font-black tabular-nums ${meta.scoreClass}`}>{avgScore}</p>
      <p className="text-[9px] text-white/30 font-mono tracking-wider mb-3">AVG SCORE</p>

      <div
        className={`w-full max-w-[120px] ${meta.height} rounded-t-xl border-t border-x ${meta.border} bg-gradient-to-b ${meta.gradient} flex items-end justify-center pb-2`}
      >
        {meta.rank === 1 && (
          <Trophy className="w-5 h-5 text-yellow-400/60 animate-pulse" />
        )}
      </div>
    </motion.div>
  );
}

function RankRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + rank * 0.03 }}
      className="group relative flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl overflow-hidden transition-all duration-300 hover:border-blue-400/30"
      style={{
        background: 'linear-gradient(135deg, rgba(10,24,48,0.7), rgba(4,13,26,0.85))',
        border: '1px solid rgba(30,144,255,0.12)',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />

      <span className="relative w-7 sm:w-8 shrink-0 text-center font-mono text-xs sm:text-sm font-bold text-white/25 tabular-nums">
        {String(rank).padStart(2, '0')}
      </span>

      <div className="relative w-10 h-10 rounded-full border border-blue-500/20 overflow-hidden shrink-0 bg-[#0a1830]">
        {entry.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-blue-400/50 text-xs font-bold">
            {entry.displayName.slice(0, 1)}
          </div>
        )}
      </div>

      <div className="relative flex-1 min-w-0 overflow-hidden">
        <p className="font-bold text-white truncate group-hover:text-blue-100 transition-colors text-sm sm:text-base">
          {entry.displayName}
        </p>
        <div className="flex items-center gap-2 sm:gap-3 mt-0.5 text-[9px] sm:text-[10px] text-white/35 font-mono flex-nowrap whitespace-nowrap overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <span className="inline-flex items-center gap-0.5 sm:gap-1 shrink-0">
            <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
            {entry.totalCases}案
          </span>
          <span className="text-white/15 shrink-0">·</span>
          <span className="inline-flex items-center gap-0.5 sm:gap-1 shrink-0">
            <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-clue-400/70 shrink-0" />
            {entry.perfectSolves}完美
          </span>
          {entry.bestScore != null && (
            <>
              <span className="text-white/15 shrink-0">·</span>
              <span className="inline-flex items-center gap-0.5 sm:gap-1 shrink-0">
                <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400/70 shrink-0" />
                最高{entry.bestScore}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="relative text-right shrink-0 pl-1">
        <p className="text-lg sm:text-xl font-black text-cyan-400 tabular-nums leading-none">{Math.round(entry.avgScore)}</p>
        <p className="text-[9px] text-white/25 font-mono tracking-widest">SCORE</p>
      </div>
    </motion.div>
  );
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadLeaderboard = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch('/api/leaderboard', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.success) {
        setEntries(data.entries ?? []);
        setError('');
      } else {
        setError(data.error || '加载失败');
      }
    } catch {
      setError('加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void inflight('leaderboard', () => loadLeaderboard());
  }, [loadLeaderboard]);

  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);
  const totalCases = entries.reduce((sum, e) => sum + e.totalCases, 0);
  const totalPerfect = entries.reduce((sum, e) => sum + e.perfectSolves, 0);

  return (
    <div className="min-h-screen relative overflow-hidden page-shell bg-dark-900">
      <ParticleBackground />

      <div className="fixed inset-0 pointer-events-none z-10 mystery-scanlines opacity-30" />
      <div className="fixed inset-0 pointer-events-none z-10">
        {['top-0 left-0 border-l border-t','top-0 right-0 border-r border-t','bottom-0 left-0 border-l border-b','bottom-0 right-0 border-r border-b'].map((cls, i) => (
          <div key={i} className={`absolute w-16 h-16 border-blue-500/20 ${cls}`} />
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-4 py-10 max-w-3xl">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <BackButton className="flex items-center gap-1 text-sm text-blue-400/60 hover:text-blue-400 transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4" />
              返回
            </BackButton>
            <h1 className="page-heading min-w-0">
              <span className="truncate">侦探排行榜</span>
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void loadLeaderboard(true)}
            disabled={loading || refreshing}
            className="p-2 rounded-lg border border-blue-500/20 hover:border-blue-400/40 transition disabled:opacity-50 shrink-0"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 text-blue-400/60 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center detective-border"
            style={{ background: 'linear-gradient(160deg, rgba(10,24,48,0.9), rgba(4,13,26,0.95))' }}
          >
            <Trophy className="w-12 h-12 text-yellow-400/30 mx-auto mb-4" />
            <p className="text-white/50 mb-2">{error || '暂无排行数据'}</p>
            <p className="text-xs text-white/30">登录并完成案件推理后即可上榜</p>
          </div>
        ) : (
          <>
            {entries.length > 0 && (
              <DetectiveStatStrip
                columns={3}
                items={[
                  { label: '上榜侦探', value: entries.length, accent: 'cyan', code: '01' },
                  { label: '累计破案', value: totalCases, accent: 'blue', code: '02' },
                  { label: '完美推理', value: totalPerfect, accent: 'amber', code: '03' },
                ]}
              />
            )}

            {entries.length >= 3 && (
              <motion.section
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="mb-10 p-6 rounded-2xl detective-border relative overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, rgba(10,24,48,0.85), rgba(4,13,26,0.95))',
                  boxShadow: '0 0 60px rgba(30,144,255,0.08)',
                }}
              >
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent" />
                <p className="text-center text-[10px] font-mono text-yellow-400/40 tracking-[0.35em] mb-8">
                  TOP DETECTIVES · 三甲
                </p>
                <div className="grid grid-cols-3 gap-2 items-end max-w-md mx-auto">
                  {PODIUM_META.map((meta) => (
                    <PodiumSlot
                      key={meta.rank}
                      entry={topThree[meta.rank - 1]}
                      meta={meta}
                    />
                  ))}
                </div>
              </motion.section>
            )}

            <section className="space-y-2">
              {(entries.length < 3 ? entries : rest).map((entry, i) => (
                <RankRow
                  key={entry.userId}
                  entry={entry}
                  rank={entries.length < 3 ? i + 1 : i + 4}
                />
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
