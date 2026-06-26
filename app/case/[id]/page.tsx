'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, Users, Clock, ArrowRight, Skull, AlertTriangle, Eye } from 'lucide-react';
import { CaseData } from '@/lib/types';
import { storage } from '@/lib/utils';
import ParticleBackground from '@/components/ParticleBackground';
import Image from 'next/image';

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '初级',
  medium: '中级',
  hard: '高级',
  expert: '专家',
};

export default function CasePage() {
  const router = useRouter();
  const params = useParams();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [caseNum, setCaseNum] = useState('');

  useEffect(() => {
    const caseId = params.id as string;
    let data = storage.getCase(caseId);
    if (!data) {
      const sessionData = sessionStorage.getItem('currentCase');
      if (sessionData) {
        data = JSON.parse(sessionData);
        if (data) storage.saveCase(data);
      }
    }
    if (data) {
      setCaseData(data);
      setCaseNum(data.id.slice(-6).toUpperCase());
      const progress = storage.getProgress(caseId);
      if (!progress) {
        storage.saveProgress({
          caseId,
          discoveredEvidence: [],
          interrogatedSuspects: [],
          notes: '',
          startTime: Date.now(),
        });
      }
    }
    setLoading(false);
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-2 border-blood-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-blue-400 tracking-widest text-sm animate-pulse">正在解密档案…</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center glass-dark rounded-xl p-10">
          <Skull className="w-16 h-16 text-blood-500 mx-auto mb-4" />
          <p className="text-xl text-gray-400 mb-6">档案不存在</p>
          <button onClick={() => router.push('/')} className="btn-primary">
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-dark-900">
      <ParticleBackground />

      {/* 四角扫描框 */}
      <div className="fixed inset-0 pointer-events-none z-10">
        {['top-0 left-0 border-l-2 border-t-2 rounded-tl-xl',
          'top-0 right-0 border-r-2 border-t-2 rounded-tr-xl',
          'bottom-0 left-0 border-l-2 border-b-2 rounded-bl-xl',
          'bottom-0 right-0 border-r-2 border-b-2 rounded-br-xl',
        ].map((cls, i) => (
          <div key={i} className={`absolute w-16 h-16 border-blue-500/40 ${cls}`} />
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-4 py-10 max-w-5xl">

        {/* ── 顶部档案编号 ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-blue-400/60 hover:text-blue-400 transition text-sm tracking-widest"
          >
            ◀ 返回
          </button>
          <div className="text-center">
            <p className="text-blue-500/50 text-xs tracking-[0.3em] mb-1">CASE FILE</p>
            <p className="text-blue-400 font-mono text-lg tracking-widest">#{caseNum}</p>
          </div>
          <div className="flex items-center gap-2 text-xs tracking-widest text-blue-500/40">
            <Eye className="w-4 h-4" />
            <span>机密档案</span>
          </div>
        </motion.div>

        {/* ── 案件标题 ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="inline-block relative">
            {/* 警告标签 */}
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.4em] text-danger-500 font-bold">
              ▶ CONFIDENTIAL ◀
            </span>
            <h1 className="text-4xl md:text-6xl font-black conan-title py-2 tracking-wider">
              {caseData.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-sm">
            {[
              { icon: Search, text: caseData.setting },
              { icon: Users, text: `${caseData.suspects.length} 名嫌疑人` },
              { icon: Clock, text: `难度：${DIFFICULTY_LABEL[caseData.difficulty] ?? caseData.difficulty}` },
              { icon: AlertTriangle, text: caseData.deathMethod },
            ].map(({ icon: Icon, text }, i) => (
              <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-blue-300/80 border border-blue-500/20">
                <Icon className="w-3.5 h-3.5 text-blue-400" />
                {text}
              </span>
            ))}
          </div>
        </motion.div>

        {/* ── 受害者档案 ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative glass-dark rounded-2xl p-6 md:p-8 mb-8 detective-border overflow-hidden"
        >
          {/* 档案标签 */}
          <div className="absolute top-0 left-6 px-4 py-1 bg-danger-600 rounded-b-lg text-xs font-bold tracking-widest text-white">
            VICTIM · 受害者
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-4">
            {/* 头像 */}
            <div className="md:col-span-1">
              <div className="relative w-full aspect-square rounded-xl overflow-hidden border-2 border-blue-500/40 shadow-[0_0_30px_rgba(30,144,255,0.2)]">
                {caseData.victim.imageUrl ? (
                  <Image src={caseData.victim.imageUrl} alt={caseData.victim.name} fill className="object-cover" unoptimized />
                ) : (
                  <div className="w-full h-full bg-dark-700 flex items-center justify-center">
                    <Skull className="w-20 h-20 text-blue-900" />
                  </div>
                )}
                {/* 扫描覆盖层 */}
                <div className="absolute inset-0 bg-gradient-to-t from-dark-900/60 to-transparent pointer-events-none" />
                <div className="absolute bottom-2 left-2 right-2 text-center">
                  <span className="text-xs font-mono text-blue-300/70 tracking-widest">DECEASED</span>
                </div>
              </div>
            </div>

            {/* 信息 */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-3xl font-black text-white tracking-wide">{caseData.victim.name}</h2>
                <span className="px-2 py-0.5 rounded text-xs bg-danger-600/30 text-danger-400 border border-danger-500/30 font-mono">DEAD</span>
              </div>

              {[
                ['年龄', `${caseData.victim.age} 岁`],
                ['职业', caseData.victim.occupation],
                ['死因', caseData.deathMethod],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="text-blue-500/60 text-sm w-10 shrink-0 font-mono pt-0.5">{label}</span>
                  <span className={`text-sm leading-relaxed ${label === '死因' ? 'text-danger-400 font-bold' : 'text-gray-200'}`}>{value}</span>
                </div>
              ))}

              <div className="pt-4 border-t border-blue-500/10">
                <p className="text-sm text-gray-400 leading-relaxed">{caseData.victim.background}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── 案发现场 ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="relative glass-dark rounded-2xl p-6 md:p-8 mb-8 detective-border overflow-hidden"
        >
          <div className="absolute top-0 left-6 px-4 py-1 bg-blue-700 rounded-b-lg text-xs font-bold tracking-widest text-white">
            CRIME SCENE · 案发现场
          </div>

          <div className="mt-4">
            {caseData.sceneImageUrl && (
              <div className="relative w-full h-64 md:h-96 rounded-xl overflow-hidden mb-6 border border-blue-500/20 shadow-[0_0_40px_rgba(30,144,255,0.15)]">
                <Image src={caseData.sceneImageUrl} alt="案发现场" fill className="object-cover" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-900/50 to-transparent pointer-events-none" />
                <div className="absolute top-3 right-3 px-2 py-1 rounded bg-dark-900/70 border border-blue-500/30 text-xs font-mono text-blue-400">
                  SCENE #001
                </div>
              </div>
            )}
            <p className="text-gray-300 leading-8 text-sm md:text-base tracking-wide">
              {caseData.sceneDescription}
            </p>
          </div>
        </motion.div>

        {/* ── 嫌疑人阵列 ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-12"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
            <h2 className="text-sm font-bold tracking-[0.4em] text-blue-400 flex items-center gap-2">
              <Users className="w-4 h-4" /> SUSPECTS · 嫌疑人
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {caseData.suspects.map((suspect, index) => (
              <motion.div
                key={suspect.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className="suspect-card glass rounded-xl p-5 text-center detective-border group cursor-default"
              >
                {/* 编号 */}
                <div className="absolute top-3 right-3 text-xs font-mono text-blue-500/40 group-hover:text-blue-400 transition">
                  #{String(index + 1).padStart(2, '0')}
                </div>

                {/* 头像 */}
                <div className="relative w-28 h-28 mx-auto mb-4 rounded-xl overflow-hidden border-2 border-blue-500/30 shadow-[0_0_20px_rgba(30,144,255,0.15)] group-hover:border-blue-400/60 transition-colors">
                  {suspect.imageUrl ? (
                    <Image src={suspect.imageUrl} alt={suspect.name} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full bg-dark-700 flex items-center justify-center">
                      <Users className="w-12 h-12 text-blue-900" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-900/40 to-transparent" />
                </div>

                <h3 className="text-xl font-bold mb-1 text-white tracking-wide">{suspect.name}</h3>
                <p className="text-blue-300/70 text-xs mb-1 font-mono">{suspect.age} 岁 · {suspect.occupation}</p>
                <p className="text-gray-500 text-xs">{suspect.relationship}</p>

                <div className="mt-3 h-px bg-blue-500/10 group-hover:bg-blue-500/30 transition-colors" />
                <p className="mt-2 text-xs text-blue-500/40 group-hover:text-blue-400/60 transition font-mono tracking-wider">UNKNOWN STATUS</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── 开始调查按钮 ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center"
        >
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => router.push(`/investigate/${caseData.id}`)}
            className="relative inline-flex items-center gap-3 px-12 py-4 rounded-xl text-xl font-black tracking-wider overflow-hidden group"
            style={{
              background: 'linear-gradient(135deg, #0066cc 0%, #1e90ff 50%, #00d4ff 100%)',
              boxShadow: '0 0 40px rgba(30,144,255,0.5), 0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            {/* 光泽扫光 */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <Search className="w-6 h-6 relative z-10" />
            <span className="relative z-10">开始调查</span>
            <ArrowRight className="w-6 h-6 relative z-10 group-hover:translate-x-1 transition-transform" />
          </motion.button>
          <p className="mt-3 text-xs text-blue-500/40 tracking-widest">INVESTIGATE · INTERROGATE · DEDUCE</p>
        </motion.div>
      </div>
    </div>
  );
}
