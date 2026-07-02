'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Heart, ChevronLeft, Loader2, RefreshCw, Sparkles, FileSearch, ChevronRight,
} from 'lucide-react';
import BackButton from '@/components/BackButton';
import ParticleBackground from '@/components/ParticleBackground';
import { useAuth } from '@/components/AuthProvider';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { inflight } from '@/lib/inflight';
import { storage } from '@/lib/utils';
import type { CaseData } from '@/lib/types';

interface FavoriteItem {
  caseId: string;
  caseData: CaseData;
  favoritedAt: string;
  score: number | null;
  completed: boolean;
}

/** 合并本地进度（完成状态常仅存于 localStorage） */
function mergeLocalProgress(items: FavoriteItem[]): FavoriteItem[] {
  return items.map((item) => {
    const local = storage.getProgress(item.caseId);
    const localEval = storage.getEvaluation(item.caseId);
    const localDone =
      localEval != null || local?.score != null || local?.endTime != null;
    if (!localDone) return item;
    return {
      ...item,
      completed: true,
      score: item.score ?? localEval?.score ?? local?.score ?? null,
    };
  });
}

const DIFFICULTY_META: Record<
  CaseData['difficulty'],
  { label: string; color: string; border: string; glow: string }
> = {
  easy: { label: '简单', color: 'text-cyan-400', border: 'border-cyan-500/30', glow: 'shadow-[0_0_20px_rgba(34,211,238,0.15)]' },
  medium: { label: '中等', color: 'text-blue-400', border: 'border-blue-500/30', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]' },
  hard: { label: '困难', color: 'text-orange-400', border: 'border-orange-500/30', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.15)]' },
  expert: { label: '专家', color: 'text-rose-400', border: 'border-rose-500/30', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]' },
};

function FavoriteCard({ item, index }: { item: FavoriteItem; index: number }) {
  const diff = DIFFICULTY_META[item.caseData.difficulty] ?? DIFFICULTY_META.medium;
  const href = item.completed ? `/archive/${item.caseId}` : `/case/${item.caseId}`;
  const caseNo = item.caseId.slice(-6).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45 }}
    >
      <Link
        href={href}
        className={`group block relative overflow-hidden rounded-2xl detective-border ${diff.glow} transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/40`}
        style={{
          background: 'linear-gradient(160deg, rgba(10,24,48,0.95), rgba(4,13,26,0.98))',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-400/40 to-transparent" />

        {item.caseData.sceneImageUrl ? (
          <div className="relative h-36 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.caseData.sceneImageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-45 group-hover:opacity-65 group-hover:scale-105 transition-all duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#040d1a] via-[#040d1a]/50 to-transparent" />
            <div className="absolute top-3 right-3">
              <Heart className="w-5 h-5 text-pink-400 fill-pink-400/80 drop-shadow-[0_0_8px_rgba(244,114,182,0.6)]" />
            </div>
          </div>
        ) : (
          <div className="h-2 bg-gradient-to-r from-pink-500/60 via-rose-400/40 to-transparent" />
        )}

        <div className="p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="font-mono text-[10px] text-pink-400/45 tracking-widest">#{caseNo}</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${diff.border} ${diff.color} bg-black/20`}>
              {diff.label}
            </span>
          </div>

          <h3 className="text-base font-black text-white/95 leading-snug line-clamp-2 group-hover:text-pink-100 transition-colors">
            {item.caseData.title}
          </h3>
          <p className="mt-2 text-xs text-white/35 font-mono line-clamp-1">
            {item.caseData.setting || '未知地点'}
          </p>

          <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-[10px] text-white/30 font-mono">
              {new Date(item.favoritedAt).toLocaleDateString('zh-CN')} 收藏
            </span>
            <div className="flex items-center gap-2">
              {item.completed && item.score != null && (
                <span className="text-sm font-black text-cyan-300 tabular-nums">{item.score}</span>
              )}
              <span className="inline-flex items-center gap-0.5 text-[10px] text-pink-400/70 group-hover:text-pink-300 transition-colors">
                {item.completed ? '查看档案' : '开始推理'}
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFavorites = useCallback(async (manual = false) => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }

    if (manual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await authenticatedFetch('/api/cases/favorites');
      const data = await res.json();
      if (res.ok && data.success) {
        setItems(mergeLocalProgress(data.items ?? []));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    void inflight(`favorites:${userId}`, () => loadFavorites());
  }, [authLoading, userId, loadFavorites]);

  return (
    <div className="min-h-screen relative page-shell bg-dark-900">
      <ParticleBackground />

      <div className="fixed inset-0 pointer-events-none z-10">
        {['top-0 left-0 border-l border-t','top-0 right-0 border-r border-t','bottom-0 left-0 border-l border-b','bottom-0 right-0 border-r border-b'].map((cls, i) => (
          <div key={i} className={`absolute w-14 h-14 border-pink-500/15 ${cls}`} />
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-4 py-10 max-w-4xl">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <BackButton className="inline-flex items-center gap-1 text-pink-400/70 hover:text-pink-400 text-sm shrink-0">
              <ChevronLeft className="w-4 h-4" /> 返回
            </BackButton>
            <h1 className="page-heading min-w-0 truncate">收藏档案</h1>
          </div>
          {userId && (
            <button
              type="button"
              onClick={() => void loadFavorites(true)}
              disabled={loading || refreshing}
              className="p-2 rounded-lg border border-pink-400/20 hover:border-pink-400/40 transition disabled:opacity-50 shrink-0"
              title="刷新"
            >
              <RefreshCw className={`w-4 h-4 text-pink-400/60 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {!userId && !authLoading && (
          <div className="glass-dark rounded-2xl p-12 text-center detective-border">
            <Heart className="w-12 h-12 text-pink-400/30 mx-auto mb-4" />
            <p className="text-white/50">登录后查看你的收藏案件</p>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-pink-400 animate-spin" />
          </div>
        )}

        {!loading && userId && items.length === 0 && (
          <div className="glass-dark rounded-2xl p-12 text-center detective-border">
            <Sparkles className="w-10 h-10 text-blue-400/40 mx-auto mb-4" />
            <p className="text-white/50 mb-2">暂无收藏案件</p>
            <p className="text-xs text-white/30 mb-6">在结果页点击「收藏」即可加入档案库</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-medium hover:opacity-90 transition"
            >
              <FileSearch className="w-4 h-4" />
              去首页选案
            </Link>
          </div>
        )}

        {!loading && items.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 px-4 py-3 rounded-xl border border-pink-400/15 bg-pink-400/[0.03]"
            >
              <p className="text-xs font-mono text-pink-400/50 tracking-widest text-center">
                共 {items.length} 份收藏 · DETECTIVE ARCHIVE
              </p>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {items.map((item, i) => (
                <FavoriteCard key={item.caseId} item={item} index={i} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
