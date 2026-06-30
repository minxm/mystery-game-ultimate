'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Medal } from 'lucide-react';
import ParticleBackground from '@/components/ParticleBackground';
import type { LeaderboardEntry } from '@/lib/supabase/database';

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setEntries(data.entries);
      })
      .finally(() => setLoading(false));
  }, []);

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-orange-400" />;
    return <span className="w-5 text-center text-sm font-mono text-white/30">{rank}</span>;
  };

  return (
    <div className="min-h-screen relative overflow-hidden page-shell">
      <ParticleBackground />

      <div className="relative z-10 container mx-auto px-4 py-10 max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </Link>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            侦探排行榜
          </h1>
        </div>

        {loading ? (
          <div className="text-center text-white/40 py-20 animate-pulse">加载中…</div>
        ) : entries.length === 0 ? (
          <div className="glass-dark rounded-2xl p-10 text-center border border-white/10">
            <p className="text-white/50 mb-2">暂无排行数据</p>
            <p className="text-xs text-white/30">登录并完成案件推理后即可上榜</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-center gap-4 p-4 rounded-xl border backdrop-blur-sm ${
                  i < 3
                    ? 'border-yellow-500/20 bg-yellow-500/5'
                    : 'border-white/5 bg-white/[0.02]'
                }`}
              >
                <div className="w-8 flex justify-center">{rankIcon(i + 1)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{entry.displayName}</p>
                  <p className="text-xs text-white/40">
                    {entry.totalCases} 案 · {entry.perfectSolves} 完美推理
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-blue-400">{Math.round(entry.avgScore)}</p>
                  <p className="text-[10px] text-white/30">均分</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
