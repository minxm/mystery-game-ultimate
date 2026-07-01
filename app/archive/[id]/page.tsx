'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Skull,
  Target,
  Brain,
  Share2,
  Sparkles,
  MessageCircle,
  Trophy,
} from 'lucide-react';
import ParticleBackground from '@/components/ParticleBackground';
import CaseSocialPanel from '@/components/CaseSocialPanel';
import { getAvatarPlaceholder, getScenePlaceholder } from '@/lib/placeholder';
import { normalizeTruthShape } from '@/lib/case-schema';
import { getScoreRating, formatTime } from '@/lib/utils';
import type { CaseData, InterrogationMessage } from '@/lib/types';

interface ArchiveEvaluation {
  score: number;
  breakdown: Record<string, number>;
  feedback: string;
  rating: string;
  killerCorrect?: boolean;
  missedClues: string[];
  userDeduction?: string;
}

interface ArchivePayload {
  caseData: CaseData;
  progress: { startTime: number; endTime?: number; score?: number };
  evaluation: ArchiveEvaluation;
  interrogations: Record<string, InterrogationMessage[]>;
}

export default function CaseArchivePage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;
  const [archive, setArchive] = useState<ArchivePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTruth, setShowTruth] = useState(false);
  const [showChats, setShowChats] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/cases/archive/${encodeURIComponent(caseId)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success || !data.archive) {
          setError(data.error || '无法加载案件档案');
          return;
        }
        setArchive(data.archive as ArchivePayload);
      } catch {
        if (!cancelled) setError('加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const handleRegenerateSimilar = async () => {
    if (!archive) return;
    setRegenerating(true);
    try {
      const res = await fetch('/api/generate-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: archive.caseData.difficulty, phase: 'start' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '生成失败');
      if (data.source === 'inventory' && data.caseData) {
        router.push(`/case/${data.caseId ?? data.caseData.id}`);
        return;
      }
      if (data.jobId) {
        router.push(`/generating/${data.jobId}`);
      }
    } catch (e) {
      alert(`生成失败：${(e as Error).message}`);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="w-14 h-14 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !archive) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-dark-900 px-4">
        <p className="text-white/60 mb-4">{error || '档案不存在'}</p>
        <Link href="/" className="text-blue-400 text-sm hover:underline">
          返回首页
        </Link>
      </div>
    );
  }

  const { caseData, progress, evaluation, interrogations } = archive;
  const truth = normalizeTruthShape(caseData.truth);
  const scoreInfo = getScoreRating(evaluation.score, evaluation.killerCorrect);
  const timeSpent =
    progress.endTime && progress.startTime
      ? Math.floor((progress.endTime - progress.startTime) / 1000)
      : 0;
  const chatEntries = Object.entries(interrogations).filter(([, msgs]) => msgs.length > 0);

  return (
    <div className="min-h-screen relative bg-dark-900 page-shell">
      <ParticleBackground />
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-blue-400/70 hover:text-blue-400">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <FileText className="w-6 h-6 text-blue-400" />
          <div>
            <p className="text-[10px] font-mono text-blue-400/50 tracking-widest">CASE ARCHIVE</p>
            <h1 className="text-xl font-bold text-white">案件档案</h1>
          </div>
        </div>

        {/* 案件信息 */}
        <section className="glass-panel p-5 mb-6">
          <h2 className="text-lg font-black text-white mb-2">{caseData.title}</h2>
          <p className="text-sm text-blue-400/70 mb-3">{caseData.setting}</p>
          <p className="text-sm text-gray-300 leading-relaxed mb-4">{caseData.sceneDescription}</p>
          {caseData.sceneImageUrl ? (
            <div className="relative h-40 rounded-xl overflow-hidden mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={caseData.sceneImageUrl} alt="" className="w-full h-full object-cover opacity-80" />
            </div>
          ) : (
            <div
              className="h-32 rounded-xl bg-cover bg-center mb-4 opacity-60"
              style={{ backgroundImage: `url("${getScenePlaceholder(caseData.title)}")` }}
            />
          )}
          <div className="flex items-center gap-2 text-blood-400 mb-4">
            <Skull className="w-4 h-4" />
            <span className="text-sm font-bold">{caseData.victim.name}</span>
            <span className="text-xs text-gray-500">
              {caseData.victim.age} 岁 · {caseData.victim.occupation}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {caseData.suspects.map((s) => (
              <div key={s.id} className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/5">
                <div className="relative w-12 h-12 mx-auto rounded-full overflow-hidden mb-1">
                  {s.imageUrl ? (
                    <Image src={s.imageUrl} alt="" fill className="object-cover object-top" unoptimized />
                  ) : (
                    <div
                      className="w-full h-full bg-cover bg-center"
                      style={{ backgroundImage: `url("${getAvatarPlaceholder(s.name)}")` }}
                    />
                  )}
                </div>
                <p className="text-xs font-medium text-white truncate">{s.name}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 你的推理 */}
        {evaluation.userDeduction && (
          <section className="glass-panel p-5 mb-6">
            <h2 className="text-sm font-medium text-white/70 mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" /> 你的推理
            </h2>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
              {evaluation.userDeduction}
            </p>
          </section>
        )}

        {/* AI 评分报告 */}
        <section className="glass-panel p-5 mb-6">
          <h2 className="text-sm font-medium text-white/70 mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> AI 评分报告
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-4xl font-black text-white">{evaluation.score}</span>
            <div>
              <p className={`text-sm font-bold ${scoreInfo.color}`}>{evaluation.rating}</p>
              {timeSpent > 0 && (
                <p className="text-xs text-white/40 font-mono">用时 {formatTime(timeSpent)}</p>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed mb-4">{evaluation.feedback}</p>
          {evaluation.missedClues.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-orange-400/80 mb-2">遗漏线索</p>
              <ul className="space-y-1">
                {evaluation.missedClues.map((clue, i) => (
                  <li key={i} className="text-xs text-white/50">· {clue}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { key: 'killer', label: '凶手', icon: Target },
              { key: 'method', label: '手法', icon: Brain },
              { key: 'motive', label: '动机', icon: Brain },
              { key: 'logic', label: '逻辑', icon: Brain },
            ].map(({ key, label }) => (
              <div key={key} className="flex justify-between px-2 py-1.5 rounded bg-white/[0.03]">
                <span className="text-white/40">{label}</span>
                <span className="text-blue-300 tabular-nums">
                  {evaluation.breakdown[key] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 案件真相 */}
        <section className="glass-panel p-5 mb-6">
          <button
            type="button"
            onClick={() => setShowTruth((v) => !v)}
            className="w-full flex items-center justify-between text-sm font-medium text-white/70"
          >
            <span className="flex items-center gap-2">
              <Skull className="w-4 h-4 text-blood-400" /> 案件真相
            </span>
            {showTruth ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showTruth && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 space-y-3 text-sm text-gray-300 leading-relaxed"
            >
              <p><strong className="text-white">凶手：</strong>{truth.killer}</p>
              <p><strong className="text-white">手法：</strong>{truth.method}</p>
              <p><strong className="text-white">动机：</strong>{truth.motive}</p>
              <ul className="list-disc list-inside space-y-1">
                {truth.process.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </motion.div>
          )}
        </section>

        {/* 聊天记录（可选） */}
        {chatEntries.length > 0 && (
          <section className="glass-panel p-5 mb-6">
            <button
              type="button"
              onClick={() => setShowChats((v) => !v)}
              className="w-full flex items-center justify-between text-sm font-medium text-white/70"
            >
              <span className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-cyan-400" /> 审问记录
              </span>
              {showChats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showChats && (
              <div className="mt-4 space-y-4 max-h-80 overflow-y-auto">
                {chatEntries.map(([suspectId, messages]) => {
                  const suspect = caseData.suspects.find((s) => s.id === suspectId);
                  return (
                    <div key={suspectId} className="border-t border-white/5 pt-3">
                      <p className="text-xs text-blue-400 mb-2">{suspect?.name ?? suspectId}</p>
                      {messages.map((m, i) => (
                        <div
                          key={i}
                          className={`text-xs mb-2 ${m.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}
                        >
                          <span className="font-mono text-[10px] text-white/30 mr-2">
                            {m.role === 'user' ? '你' : '嫌疑人'}
                          </span>
                          {m.content}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 分享 & 同类生成 */}
        <section className="glass-panel p-5 mb-6">
          <CaseSocialPanel caseId={caseData.id} caseTitle={caseData.title} />
        </section>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleRegenerateSimilar}
            disabled={regenerating}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {regenerating ? '生成中…' : `再来一个${caseData.difficulty === 'hard' ? '困难' : caseData.difficulty === 'easy' ? '简单' : '同类'}案件`}
          </button>
          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-medium transition-colors"
          >
            <Share2 className="w-4 h-4" />
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
