'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Skull, Users, FileText, Sparkles } from 'lucide-react';
import Image from 'next/image';
import ParticleBackground from '@/components/ParticleBackground';
import { isStageAtLeast, CaseJobStage } from '@/lib/case-job-store';
import { CaseData } from '@/lib/types';
import { saveCaseData } from '@/lib/case-store';
import { getAvatarPlaceholder } from '@/lib/placeholder';

const STAGE_LABELS: Record<CaseJobStage, string> = {
  pending: '正在分析案情…',
  victim_ready: '受害者档案已锁定',
  suspects_ready: '嫌疑人肖像绘制中…',
  text_ready: '案件卷宗整理中…',
  done: '取证完成',
};

export default function GeneratingPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;
  const [stage, setStage] = useState<CaseJobStage>('pending');
  const [message, setMessage] = useState('正在提交生成任务…');
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [error, setError] = useState('');
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  const markBroken = (id: string) =>
    setImgErrors((prev) => new Set([...prev, id]));

  const finishCase = useCallback(
    async (data: CaseData) => {
      await saveCaseData(data);
      router.push(`/case/${data.id}`);
    },
    [router]
  );

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    const startedAt = Date.now();
    const maxWaitMs = 720000;

    async function poll() {
      while (!cancelled && Date.now() - startedAt < maxWaitMs) {
        try {
          const res = await fetch(
            `/api/generate-case/status?jobId=${encodeURIComponent(jobId)}`
          );
          const data = await res.json().catch(() => ({}));

          if (res.ok && data.caseData) {
            setCaseData(data.caseData);
          }
          if (data.stage) {
            setStage(data.stage);
          }
          if (data.progressMessage) {
            setMessage(data.progressMessage);
          } else if (data.stage && STAGE_LABELS[data.stage as CaseJobStage]) {
            setMessage(STAGE_LABELS[data.stage as CaseJobStage]);
          }

          if (data.status === 'error') {
            setError(data.error || '案件生成失败');
            return;
          }

          if (data.status === 'done' && data.caseData) {
            setStage('done');
            setMessage('取证完成，正在打开卷宗…');
            await new Promise((r) => setTimeout(r, 800));
            if (!cancelled) await finishCase(data.caseData);
            return;
          }
        } catch (e) {
          console.warn('[Generating] poll error:', e);
        }

        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!cancelled) {
        setError('生成超时，请返回首页重试');
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [jobId, finishCase]);

  const showVictim = isStageAtLeast(stage, 'victim_ready') && caseData?.victim;
  const showSuspects = isStageAtLeast(stage, 'suspects_ready') && caseData?.suspects;
  const showText = isStageAtLeast(stage, 'text_ready') && caseData;

  return (
    <div className="min-h-screen relative overflow-hidden bg-dark-900 page-shell">
      <ParticleBackground />

      <div className="relative z-10 container mx-auto px-4 py-10 max-w-3xl">
        {/* 顶部加载状态 */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-blood-500/60 mb-4 relative">
            <div className="absolute inset-0 rounded-full border-2 border-blood-500 border-t-transparent animate-spin" />
            <Sparkles className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white mb-2 tracking-wide">
            案件生成中
          </h1>
          <p className="text-blue-400/80 text-sm animate-pulse">{message}</p>
          {error && (
            <div className="mt-4 text-blood-400 text-sm">
              {error}
              <button
                type="button"
                onClick={() => router.push('/')}
                className="block mx-auto mt-3 text-blue-400 underline"
              >
                返回首页
              </button>
            </div>
          )}
        </motion.div>

        {/* 受害者 */}
        <AnimatePresence>
          {showVictim && (
            <motion.section
              key="victim"
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="glass-dark rounded-2xl p-6 mb-6 border border-blood-500/30"
            >
              <div className="flex items-center gap-2 mb-4 text-blood-400">
                <Skull className="w-5 h-5" />
                <span className="text-xs font-mono tracking-widest">VICTIM</span>
              </div>
              <div className="flex gap-5 items-center">
                <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-xl overflow-hidden border-2 border-blood-500/50 flex-shrink-0 shadow-[0_0_24px_rgba(230,57,70,0.25)]">
                  {!imgErrors.has('victim') && caseData!.victim.imageUrl ? (
                    <Image
                      src={caseData!.victim.imageUrl}
                      alt={caseData!.victim.name}
                      fill
                      className="object-cover object-top"
                      unoptimized
                      onError={() => markBroken('victim')}
                    />
                  ) : (
                    <div
                      className="w-full h-full bg-cover bg-center"
                      style={{
                        backgroundImage: `url("${getAvatarPlaceholder(caseData!.victim.name)}")`,
                      }}
                    />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{caseData!.victim.name}</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    {caseData!.victim.age} 岁 · {caseData!.victim.occupation}
                  </p>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* 嫌疑人 */}
        <AnimatePresence>
          {showSuspects && (
            <motion.section
              key="suspects"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mb-6"
            >
              <div className="flex items-center gap-2 mb-4 text-blue-400">
                <Users className="w-5 h-5" />
                <span className="text-xs font-mono tracking-widest">SUSPECTS</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {caseData!.suspects.map((suspect, i) => (
                  <motion.div
                    key={suspect.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.12 }}
                    className="glass-dark rounded-xl p-4 border border-blue-900/40 text-center"
                  >
                    <div className="relative w-16 h-16 mx-auto rounded-full overflow-hidden border border-blue-500/40 mb-2">
                      {!imgErrors.has(suspect.id) && suspect.imageUrl ? (
                        <Image
                          src={suspect.imageUrl}
                          alt={suspect.name}
                          fill
                          className="object-cover object-top"
                          unoptimized
                          onError={() => markBroken(suspect.id)}
                        />
                      ) : (
                        <div
                          className="w-full h-full bg-cover bg-center"
                          style={{
                            backgroundImage: `url("${getAvatarPlaceholder(suspect.name)}")`,
                          }}
                        />
                      )}
                    </div>
                    <p className="text-sm font-bold text-white">{suspect.name}</p>
                    <p className="text-xs text-gray-500">{suspect.occupation}</p>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* 案件文本 */}
        <AnimatePresence>
          {showText && (
            <motion.section
              key="text"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="glass-dark rounded-2xl p-6 border border-blue-500/25"
            >
              <div className="flex items-center gap-2 mb-4 text-blue-300">
                <FileText className="w-5 h-5" />
                <span className="text-xs font-mono tracking-widest">CASE FILE</span>
              </div>
              <h2 className="text-2xl font-black text-white mb-2">{caseData!.title}</h2>
              <p className="text-sm text-blue-400/70 mb-3">{caseData!.setting}</p>
              <p className="text-sm text-gray-300 leading-relaxed mb-3">
                {caseData!.sceneDescription}
              </p>
              <p className="text-xs text-blood-400/80 font-mono">
                死因：{caseData!.deathMethod}
              </p>
              {!isStageAtLeast(stage, 'done') && (
                <p className="mt-4 text-xs text-gray-500 animate-pulse">
                  正在还原案发现场…
                </p>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        <p className="text-center text-xs text-gray-600 mt-8">请保持页面打开，内容将逐步呈现</p>
      </div>
    </div>
  );
}
