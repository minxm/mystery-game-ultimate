'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trophy, Home, Share2, Clock, Target, Brain, AlertCircle } from 'lucide-react';
import { CaseData } from '@/lib/types';
import { storage, getScoreRating, formatTime } from '@/lib/utils';
import ParticleBackground from '@/components/ParticleBackground';

interface Evaluation {
  score: number;
  breakdown: {
    killer: number;
    method: number;
    motive: number;
    logic: number;
  };
  feedback: string;
  rating: string;
  missedClues: string[];
}

export default function ResultPage() {
  const router = useRouter();
  const params = useParams();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [showTruth, setShowTruth] = useState(false);

  useEffect(() => {
    const caseId = params.id as string;
    const data = storage.getCase(caseId);
    if (data) {
      setCaseData(data);
    }

    const evalData = sessionStorage.getItem('evaluation');
    if (evalData) {
      setEvaluation(JSON.parse(evalData));
    }

    const progress = storage.getProgress(caseId);
    if (progress && progress.endTime) {
      const spent = Math.floor((progress.endTime - progress.startTime) / 1000);
      setTimeSpent(spent);
    }
  }, [params.id]);

  const handleShare = () => {
    const text = `我在AI剧本杀《${caseData?.title}》中获得了${evaluation?.score}分！评级：${evaluation?.rating}`;
    if (navigator.share) {
      navigator.share({
        title: 'AI剧本杀',
        text: text,
      });
    } else {
      navigator.clipboard.writeText(text);
      alert('已复制到剪贴板');
    }
  };

  if (!caseData || !evaluation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blood-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const scoreInfo = getScoreRating(evaluation.score);

  return (
    <div className="min-h-screen relative">
      <ParticleBackground />

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-4xl">
        {/* 评分展示 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', duration: 0.8 }}
          className="text-center mb-12"
        >
          <Trophy className="w-24 h-24 text-yellow-400 mx-auto mb-6 animate-float" />
          <h1 className="text-6xl font-bold mb-4 text-glow">{evaluation.score}</h1>
          <p className={`text-3xl font-bold mb-2 ${scoreInfo.color}`}>{scoreInfo.rating}</p>
          <p className="text-xl text-gray-400">{scoreInfo.description}</p>
        </motion.div>

        {/* 详细评分 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-dark rounded-lg p-8 mb-8"
        >
          <h2 className="text-2xl font-bold mb-6">评分详情</h2>
          <div className="space-y-4">
            {[
              { label: '凶手身份', score: evaluation.breakdown.killer, max: 40, icon: Target },
              { label: '作案手法', score: evaluation.breakdown.method, max: 30, icon: Brain },
              { label: '动机分析', score: evaluation.breakdown.motive, max: 20, icon: AlertCircle },
              { label: '逻辑链条', score: evaluation.breakdown.logic, max: 10, icon: Clock },
            ].map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <item.icon className="w-5 h-5 text-blood-500" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <span className="text-lg font-bold">
                    {item.score} / {item.max}
                  </span>
                </div>
                <div className="w-full bg-dark-700 rounded-full h-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.score / item.max) * 100}%` }}
                    transition={{ delay: 0.5 + index * 0.1, duration: 0.8 }}
                    className="h-full bg-gradient-to-r from-blood-600 to-blood-500"
                  />
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="flex items-center gap-4 text-gray-400">
              <Clock className="w-5 h-5" />
              <span>用时：{formatTime(timeSpent)}</span>
            </div>
          </div>
        </motion.div>

        {/* AI 评价 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-dark rounded-lg p-8 mb-8"
        >
          <h2 className="text-2xl font-bold mb-4">专家点评</h2>
          <p className="text-gray-300 leading-relaxed">{evaluation.feedback}</p>

          {evaluation.missedClues.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <h3 className="text-lg font-bold mb-3 text-yellow-400">遗漏的关键线索</h3>
              <ul className="space-y-2">
                {evaluation.missedClues.map((clue, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-400">
                    <span className="text-blood-500">•</span>
                    <span>{clue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>

        {/* 真相揭晓 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="glass-dark rounded-lg p-8 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-blood-500">真相揭晓</h2>
            <button
              onClick={() => setShowTruth(!showTruth)}
              className="px-4 py-2 bg-blood-600 rounded-lg hover:bg-blood-500 transition"
            >
              {showTruth ? '隐藏真相' : '查看真相'}
            </button>
          </div>

          {showTruth && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-bold mb-2 text-yellow-400">真凶</h3>
                <p className="text-gray-300">{caseData.truth.killer}</p>
              </div>

              <div>
                <h3 className="text-lg font-bold mb-2 text-yellow-400">作案手法</h3>
                <p className="text-gray-300">{caseData.truth.method}</p>
              </div>

              <div>
                <h3 className="text-lg font-bold mb-2 text-yellow-400">真实动机</h3>
                <p className="text-gray-300">{caseData.truth.motive}</p>
              </div>

              <div>
                <h3 className="text-lg font-bold mb-2 text-yellow-400">作案过程</h3>
                <div className="space-y-3">
                  {caseData.truth.process.map((step, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-blood-600 flex items-center justify-center flex-shrink-0 mt-1">
                        {index + 1}
                      </div>
                      <p className="text-gray-300 flex-1">{step}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold mb-2 text-yellow-400">关键线索</h3>
                <ul className="space-y-2">
                  {caseData.truth.keyClues.map((clue, index) => (
                    <li key={index} className="flex items-start gap-2 text-gray-300">
                      <span className="text-blood-500">•</span>
                      <span>{clue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* 操作按钮 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex gap-4 justify-center"
        >
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-8 py-3 glass rounded-lg hover:bg-dark-700 transition"
          >
            <Home className="w-5 h-5" />
            返回首页
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-8 py-3 bg-blood-600 rounded-lg hover:bg-blood-500 transition"
          >
            <Share2 className="w-5 h-5" />
            分享成绩
          </button>
        </motion.div>
      </div>
    </div>
  );
}
