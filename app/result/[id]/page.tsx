'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Home, Share2, Clock, Target, Brain, AlertCircle,
  Shield, ChevronDown, ChevronUp, Sparkles, Unlock,
} from 'lucide-react';
import { CaseData } from '@/lib/types';
import { storage, getScoreRating, formatTime, loadCaseData } from '@/lib/utils';
import { normalizeTruthShape } from '@/lib/case-schema';
import ParticleBackground from '@/components/ParticleBackground';
import CaseSocialPanel from '@/components/CaseSocialPanel';

interface Evaluation {
  score: number;
  breakdown: { killer: number; method: number; motive: number; logic: number };
  feedback: string;
  rating: string;
  killerCorrect?: boolean;
  missedClues: string[];
}

const SCORE_ITEMS = [
  { key: 'killer', label: '凶手身份', max: 40, icon: Target },
  { key: 'method', label: '作案手法', max: 30, icon: Brain },
  { key: 'motive', label: '作案动机', max: 20, icon: AlertCircle },
  { key: 'logic',  label: '逻辑链条', max: 10, icon: Shield },
];

function RingScore({ score }: { score: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <div className="relative w-44 h-44 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(30,144,255,0.1)" strokeWidth="8"/>
        <motion.circle
          cx="60" cy="60" r={r} fill="none"
          stroke="url(#scoreGrad)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.8, ease: 'easeOut', delay: 0.2 }}
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0066cc"/>
            <stop offset="100%" stopColor="#00d4ff"/>
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-5xl font-black text-white"
          initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }}
          transition={{ type:'spring', delay:0.5, duration:0.6 }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-blue-400/60 font-mono tracking-widest">SCORE</span>
      </div>
    </div>
  );
}

export default function ResultPage() {
  const router = useRouter();
  const params = useParams();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [showTruth, setShowTruth] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const caseId = params.id as string;
    let cancelled = false;

    (async () => {
      const data = await loadCaseData(caseId);
      if (cancelled) return;
      if (data) setCaseData(data);
    })();

    const evalData = sessionStorage.getItem('evaluation');
    if (evalData) {
      try {
        const parsed = JSON.parse(evalData) as Partial<Evaluation>;
        setEvaluation({
          score: Number(parsed.score) || 0,
          breakdown: {
            killer: Number(parsed.breakdown?.killer) || 0,
            method: Number(parsed.breakdown?.method) || 0,
            motive: Number(parsed.breakdown?.motive) || 0,
            logic: Number(parsed.breakdown?.logic) || 0,
          },
          feedback: parsed.feedback ?? '',
          rating: parsed.rating ?? '',
          killerCorrect: parsed.killerCorrect,
          missedClues: Array.isArray(parsed.missedClues) ? parsed.missedClues : [],
        });
      } catch {
        /* ignore corrupt session data */
      }
    }
    const progress = storage.getProgress(caseId);
    if (progress?.endTime) setTimeSpent(Math.floor((progress.endTime - progress.startTime) / 1000));
    setTimeout(() => setShown(true), 200);

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleShare = () => {
    const text = `我在AI剧本杀《${caseData?.title}》中获得了${evaluation?.score}分！评级：${evaluation?.rating}`;
    if (navigator.share) navigator.share({ title: 'AI剧本杀', text });
    else { navigator.clipboard.writeText(text); alert('已复制到剪贴板'); }
  };

  if (!caseData || !evaluation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="w-14 h-14 border-2 border-blood-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const scoreInfo = getScoreRating(evaluation.score, evaluation.killerCorrect);
  const truth = normalizeTruthShape(caseData.truth);

  const getBarColor = (score: number, max: number) => {
    const ratio = score / max;
    if (ratio >= 0.8) return 'from-blue-600 to-cyan-400';
    if (ratio >= 0.5) return 'from-blue-700 to-blue-400';
    return 'from-gray-700 to-gray-500';
  };

  return (
    <div className="min-h-screen relative bg-dark-900">
      <ParticleBackground />

      {/* 四角装饰 */}
      <div className="fixed inset-0 pointer-events-none z-10">
        {['top-0 left-0 border-l border-t','top-0 right-0 border-r border-t','bottom-0 left-0 border-l border-b','bottom-0 right-0 border-r border-b'].map((cls,i)=>(
          <div key={i} className={`absolute w-12 h-12 border-blue-500/20 ${cls}`}/>
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-4 py-10 max-w-3xl">

        {/* ── 标题 ── */}
        <motion.div
          initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }}
          className="text-center mb-10"
        >
          <p className="text-xs font-mono text-blue-500/50 tracking-[0.4em] mb-1">CASE CLOSED</p>
          <h1 className="text-2xl font-black conan-title tracking-wider">{caseData.title}</h1>
        </motion.div>

        {/* ── 评分环 + 评级 ── */}
        <motion.div
          initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }}
          transition={{ type:'spring', duration:0.9 }}
          className="rounded-2xl p-8 mb-6 relative overflow-hidden"
          style={{ background:'linear-gradient(160deg,rgba(10,24,48,0.95),rgba(4,13,26,0.98))', border:'1px solid rgba(30,144,255,0.25)', boxShadow:'0 0 60px rgba(30,144,255,0.1)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"/>

          <RingScore score={evaluation.score} />

          <div className="text-center mt-6">
            <motion.div
              initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.8 }}
            >
              <span
                className={`text-4xl font-black tracking-wide block mb-1 ${scoreInfo.color}`}
                style={{ textShadow: `0 0 30px currentColor` }}
              >
                {scoreInfo.rating}
              </span>
              <p className="text-gray-400 text-sm">{scoreInfo.description}</p>
            </motion.div>
          </div>

          {/* CASE SOLVED 印章 */}
          {evaluation.score >= 70 && (
            <motion.div
              initial={{ rotate:-15, scale:0, opacity:0 }}
              animate={{ rotate:-12, scale:1, opacity:0.9 }}
              transition={{ delay:1.2, type:'spring', duration:0.6 }}
              className="absolute top-6 right-6 border-2 border-blue-400/60 rounded px-3 py-1 text-blue-400/60 text-xs font-black tracking-widest"
            >
              SOLVED
            </motion.div>
          )}

          {/* 用时 */}
          <div className="flex items-center justify-center gap-2 mt-5 text-gray-500 text-xs font-mono">
            <Clock className="w-3.5 h-3.5"/> 用时 {formatTime(timeSpent)}
          </div>
        </motion.div>

        {/* ── 评分细则 ── */}
        <motion.div
          initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.4 }}
          className="rounded-2xl p-6 mb-5 glass-dark"
        >
          <div className="flex items-center gap-2 mb-5">
            <Trophy className="w-5 h-5 text-clue-400"/>
            <h2 className="text-base font-black tracking-wide text-white">评分明细</h2>
          </div>
          <div className="space-y-5">
            {SCORE_ITEMS.map((item, i) => {
              const rawScore = (evaluation.breakdown as any)[item.key] as number;
              const pct = Math.min(100, (rawScore / item.max) * 100);
              return (
                <motion.div key={item.key}
                  initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay: 0.5 + i*0.1 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <item.icon className="w-4 h-4 text-blue-400/70"/>
                      <span className="text-sm font-bold">{item.label}</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-white">
                      {rawScore} <span className="text-gray-600">/ {item.max}</span>
                    </span>
                  </div>
                  <div className="relative w-full bg-dark-800 rounded-full h-2.5 overflow-hidden">
                    <motion.div
                      initial={{ width:0 }}
                      animate={{ width:`${pct}%` }}
                      transition={{ delay: 0.6 + i*0.1, duration:0.9, ease:'easeOut' }}
                      className={`h-full rounded-full bg-gradient-to-r ${getBarColor(rawScore, item.max)}`}
                      style={{ boxShadow: pct > 50 ? '0 0 8px rgba(30,144,255,0.5)' : undefined }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── 专家点评 ── */}
        <motion.div
          initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.6 }}
          className="rounded-2xl p-6 mb-5 glass-dark"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-clue-400"/>
            <h2 className="text-base font-black tracking-wide text-white">侦探长评语</h2>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">{evaluation.feedback}</p>

          {evaluation.missedClues.length > 0 && (
            <div className="mt-5 pt-5 border-t border-blue-900/30">
              <h3 className="text-sm font-bold mb-3 text-clue-400 tracking-wide">遗漏线索</h3>
              <ul className="space-y-2">
                {evaluation.missedClues.map((clue, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-400 text-sm">
                    <span className="text-blue-500 mt-0.5">▸</span>
                    <span>{clue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>

        {/* ── 真相揭晓 ── */}
        <motion.div
          initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.8 }}
          className="rounded-2xl mb-7 overflow-hidden"
          style={{ border:'1px solid rgba(30,144,255,0.2)', background:'rgba(10,24,48,0.9)' }}
        >
          <button
            onClick={() => setShowTruth(!showTruth)}
            className="w-full flex items-center justify-between px-6 py-5 group"
          >
            <div className="flex items-center gap-3">
              <Unlock className="w-5 h-5 text-danger-400"/>
              <span className="text-base font-black tracking-wide text-danger-400">真相解密</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
              {showTruth ? <><ChevronUp className="w-4 h-4 text-blue-400"/> 收起</>
                        : <><ChevronDown className="w-4 h-4 text-gray-500"/> 点击查看</>}
            </div>
          </button>

          <AnimatePresence>
            {showTruth && (
              <motion.div
                initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
                transition={{ duration:0.35 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-7 space-y-5 border-t border-blue-900/30">
                  {[
                    { label: '真凶', value: truth.killer },
                    { label: '手法', value: truth.method },
                    { label: '动机', value: truth.motive },
                  ].map(({ label, value }) => (
                    <div key={label} className="pt-5">
                      <p className="text-xs font-mono text-blue-400/50 tracking-widest mb-1">{label.toUpperCase()}</p>
                      <p className="text-gray-200 text-sm leading-relaxed">{value}</p>
                    </div>
                  ))}

                  <div className="pt-5">
                    <p className="text-xs font-mono text-blue-400/50 tracking-widest mb-3">PROCESS</p>
                    <div className="space-y-3">
                      {truth.process.map((step, i) => (
                        <motion.div
                          key={`${i}-${step.slice(0, 24)}`}
                          initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.08 }}
                          className="flex items-start gap-3"
                        >
                          <div className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-mono text-blue-400">{i+1}</span>
                          </div>
                          <p className="text-gray-300 text-sm leading-relaxed">{step}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-5">
                    <p className="text-xs font-mono text-blue-400/50 tracking-widest mb-3">KEY CLUES</p>
                    <ul className="space-y-2">
                      {truth.keyClues.map((clue, i) => (
                        <li key={`${i}-${clue.slice(0, 24)}`} className="flex items-start gap-2 text-gray-400 text-sm">
                          <span className="text-clue-400 mt-0.5">◆</span> {clue}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {caseData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="mt-6"
          >
            <CaseSocialPanel caseId={caseData.id} caseTitle={caseData.title} />
          </motion.div>
        )}

        {/* ── 操作按钮 ── */}
        <motion.div
          initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1 }}
          className="flex gap-3"
        >
          <button
            onClick={() => router.push('/')}
            className="flex-1 flex items-center justify-center gap-2 py-3 glass rounded-xl hover:bg-dark-700 transition text-sm font-bold text-gray-400 hover:text-white"
          >
            <Home className="w-4 h-4"/> 返回首页
          </button>
          <motion.button
            whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm overflow-hidden relative group"
            style={{ background:'linear-gradient(135deg,#0066cc,#1e90ff)', boxShadow:'0 0 20px rgba(30,144,255,0.3)' }}
          >
            <span className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-500"/>
            <Share2 className="w-4 h-4 relative"/> <span className="relative">分享战绩</span>
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
