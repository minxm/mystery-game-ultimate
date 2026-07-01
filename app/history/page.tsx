'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { History, Trophy, Target, ChevronLeft, Loader2 } from 'lucide-react';
import ParticleBackground from '@/components/ParticleBackground';
import { useAuth } from '@/components/AuthProvider';

interface HistoryEntry {
  id: string;
  caseId: string;
  caseTitle: string;
  score: number;
  rating: string;
  killerCorrect: boolean | null;
  createdAt: string;
}

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetch('/api/history')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setHistory(data.history);
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  return (
    <div className="min-h-screen relative page-shell">
      <ParticleBackground />
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-blue-400/70 hover:text-blue-400 text-sm mb-6"
        >
          <ChevronLeft className="w-4 h-4" /> 返回首页
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <History className="w-7 h-7 text-cyan-400" />
          <h1 className="text-2xl font-bold text-white">推理历史</h1>
        </div>

        {!user && !authLoading && (
          <p className="text-white/50 text-center py-12">登录后查看你的推理记录</p>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        )}

        {!loading && user && history.length === 0 && (
          <p className="text-white/50 text-center py-12">还没有完成过案件，去首页开始推理吧</p>
        )}

        <div className="space-y-3">
          {history.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-panel p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{entry.caseTitle}</p>
                <p className="text-xs text-white/40 mt-1">
                  {new Date(entry.createdAt).toLocaleDateString('zh-CN')}
                  {entry.killerCorrect === true && ' · 指认正确'}
                  {entry.killerCorrect === false && ' · 指认错误'}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-lg font-bold text-cyan-400">{entry.score}</span>
                <span className="text-xs text-white/50">{entry.rating}</span>
                <Link
                  href={`/result/${entry.caseId}`}
                  className="text-xs text-blue-400 hover:underline"
                >
                  复盘
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
