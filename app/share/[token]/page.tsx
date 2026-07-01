'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Share2, Play, Loader2, AlertCircle } from 'lucide-react';
import ParticleBackground from '@/components/ParticleBackground';
import { CaseData } from '@/lib/types';
import { saveCaseData } from '@/lib/case-store';

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/share?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.caseData) {
          setCaseData(data.caseData);
        } else {
          setError(data.error || '案件不存在');
        }
      })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleStart = async () => {
    if (!caseData) return;
    await saveCaseData(caseData);
    router.push(`/case/${caseData.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center page-shell gap-4">
        <AlertCircle className="w-12 h-12 text-danger-500" />
        <p className="text-white/70">{error || '案件不存在'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative page-shell">
      <ParticleBackground />
      <div className="relative z-10 container mx-auto px-4 py-16 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8 text-center space-y-6"
        >
          <Share2 className="w-10 h-10 text-cyan-400 mx-auto" />
          <h1 className="text-2xl font-bold text-white">{caseData.title}</h1>
          <p className="text-white/60 text-sm">{caseData.setting}</p>
          <p className="text-white/50 text-sm line-clamp-3">{caseData.sceneDescription}</p>
          <p className="text-xs text-blue-400/60 font-mono">
            难度：{caseData.difficulty} · 来自好友分享
          </p>
          <button
            onClick={handleStart}
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl text-white font-medium hover:opacity-90 transition"
          >
            <Play className="w-5 h-5" />
            挑战此案件
          </button>
        </motion.div>
      </div>
    </div>
  );
}
