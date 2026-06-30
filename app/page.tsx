'use client';

import { motion } from 'framer-motion';
import {
  Brain,
  Clock,
  Trophy,
  Sparkles,
  Search,
  Target,
  Flame,
  Skull,
  ChevronRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ParticleBackground from '@/components/ParticleBackground';
import HomeAtmosphere, { HeroMagnifierIcon } from '@/components/HomeAtmosphere';
import AuthButton from '@/components/AuthButton';
import OnlinePresence from '@/components/OnlinePresence';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState('');

  const handleStartCase = async () => {
    setIsGenerating(true);
    setGeneratingStatus('正在提交生成任务…');
    try {
      const response = await fetch('/api/generate-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: selectedDifficulty, phase: 'start' }),
      });

      const startData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(startData.error || `HTTP error! status: ${response.status}`);
      }

      if (!startData.jobId) {
        throw new Error('未收到任务 ID');
      }

      router.push(
        `/generating/${startData.jobId}?difficulty=${encodeURIComponent(selectedDifficulty)}`
      );
    } catch (error: unknown) {
      console.error('[Frontend] Case generation failed:', error);
      alert(`生成案件失败：${(error as Error)?.message || '请重试'}`);
      setIsGenerating(false);
      setGeneratingStatus('');
    }
  };

  const difficulties = [
    {
      id: 'easy',
      name: '简单',
      desc: '新手侦探',
      icon: Search,
      active: 'border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_28px_rgba(34,211,238,0.2)]',
      idle: 'border-white/5 hover:border-cyan-400/30',
      iconColor: 'text-cyan-400',
    },
    {
      id: 'medium',
      name: '中等',
      desc: '推理试炼',
      icon: Target,
      active: 'border-blue-400/60 bg-blue-500/10 shadow-[0_0_28px_rgba(30,144,255,0.25)]',
      idle: 'border-white/5 hover:border-blue-400/30',
      iconColor: 'text-blue-400',
    },
    {
      id: 'hard',
      name: '困难',
      desc: '高手对决',
      icon: Flame,
      active: 'border-orange-400/50 bg-orange-500/10 shadow-[0_0_28px_rgba(251,146,60,0.2)]',
      idle: 'border-white/5 hover:border-orange-400/30',
      iconColor: 'text-orange-400',
    },
    {
      id: 'expert',
      name: '专家',
      desc: '神探试炼',
      icon: Skull,
      active: 'border-danger-500/50 bg-danger-600/10 shadow-[0_0_28px_rgba(230,57,70,0.2)]',
      idle: 'border-white/5 hover:border-danger-500/30',
      iconColor: 'text-danger-500',
    },
  ];

  const features = [
    { icon: Brain, title: 'AI 生成案件', desc: '每一次推理都是独家剧本', num: '01' },
    { icon: Clock, title: '实时审问', desc: '与嫌疑人心理博弈', num: '02' },
    { icon: Trophy, title: '智能评分', desc: '专业级推理评估', num: '03' },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden page-shell">
      <HomeAtmosphere />
      <ParticleBackground />

      {/* 顶栏 */}
      <header className="relative z-20 border-b border-white/[0.06] bg-[#040d1a]/60 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-6xl">
          <span className="font-mono text-[10px] tracking-[0.35em] text-blue-400/50 uppercase">
            Detective OS
          </span>
          <div className="flex items-center gap-4">
            <OnlinePresence />
            <Link
              href="/leaderboard"
              className="text-[10px] font-mono tracking-wider text-white/40 hover:text-blue-300/80 transition-colors"
            >
              排行榜
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      <div className="relative z-10 container mx-auto px-4 py-10 md:py-16 max-w-6xl">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="flex flex-col md:flex-row items-center gap-10 md:gap-14 mb-14 md:mb-20"
        >
          <div className="flex-1 text-center md:text-left min-w-0">
            <p className="font-mono text-[10px] md:text-xs tracking-[0.4em] text-blue-400/55 mb-5 uppercase">
              Immersive Mystery · AI Powered
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black conan-title tracking-wide leading-[1.1] mb-5">
              AI 推理侦探
            </h1>
            <p className="text-base md:text-xl text-blue-200/80 font-medium mb-2 tracking-wide">
              真相，永远只有一个
            </p>
            <p className="text-sm md:text-base text-gray-500 max-w-lg mx-auto md:mx-0 leading-relaxed">
              实时生成的独家悬疑案件 · 审问嫌疑人 · 拼凑线索 · 揭开迷雾
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center md:justify-start gap-3">
              {['独家剧本', '知识库 RAG', '沉浸式体验'].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full text-[10px] font-mono tracking-wider border border-blue-500/20 text-blue-300/60 bg-blue-500/5"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <HeroMagnifierIcon />
        </motion.section>

        {/* 功能卡片 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14 md:mb-16"
        >
          {features.map((feature, i) => (
            <motion.div
              key={feature.num}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.08 }}
              className="group relative rounded-2xl p-5 md:p-6 overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm hover:border-blue-500/25 transition-all duration-500"
            >
              <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-blue-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="absolute top-4 right-5 font-mono text-[10px] text-white/15">
                {feature.num}
              </span>
              <div className="relative flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center border border-blue-500/20 bg-blue-500/5 shrink-0">
                  <feature.icon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white/95 mb-1">{feature.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* 难度选择 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="max-w-3xl mx-auto"
        >
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-blue-500/40" />
            <h2 className="text-sm md:text-base font-bold tracking-[0.3em] text-blue-300/80 uppercase flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400/70" />
              选择难度
            </h2>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-blue-500/40" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            {difficulties.map((diff) => {
              const selected = selectedDifficulty === diff.id;
              const Icon = diff.icon;
              return (
                <motion.button
                  key={diff.id}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedDifficulty(diff.id)}
                  className={`relative rounded-2xl p-4 md:p-5 text-left transition-all duration-300 border backdrop-blur-sm ${
                    selected ? diff.active : diff.idle
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 mb-3 ${selected ? diff.iconColor : 'text-gray-500'}`}
                  />
                  <div className="text-lg font-bold text-white/95">{diff.name}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{diff.desc}</div>
                  {selected && (
                    <motion.div
                      layoutId="diff-ring"
                      className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none"
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* CTA */}
          <div className="text-center">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStartCase}
              disabled={isGenerating}
              className="group relative w-full md:w-auto inline-flex items-center justify-center gap-3 px-10 md:px-12 py-4 rounded-2xl text-base md:text-lg font-bold tracking-wide overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #0044aa 0%, #1e90ff 45%, #00c8ff 100%)',
                boxShadow:
                  '0 0 48px rgba(30,144,255,0.35), 0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              <span
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
              />
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                  <span>{generatingStatus || 'AI 正在分析案情…'}</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>开始推理</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </motion.button>
            <p className="mt-4 text-[11px] text-gray-600 font-mono tracking-wider">
              生成过程逐步呈现 · 受害者 → 嫌疑人 → 卷宗
            </p>
          </div>
        </motion.section>

        <footer className="mt-16 md:mt-24 text-center space-y-1">
          <p className="text-[10px] font-mono text-white/20 tracking-[0.2em]">
            POWERED BY SILICONFLOW
          </p>
          <p className="text-[10px] text-white/10">每个案件独一无二 · 永不重复</p>
        </footer>
      </div>

      {/* 角落取景框 */}
      <div className="fixed top-12 left-3 w-12 h-12 md:w-16 md:h-16 border-l border-t border-blue-500/20 rounded-tl-lg pointer-events-none z-10" />
      <div className="fixed top-12 right-3 w-12 h-12 md:w-16 md:h-16 border-r border-t border-blue-500/20 rounded-tr-lg pointer-events-none z-10" />
      <div className="fixed bottom-3 left-3 w-12 h-12 md:w-16 md:h-16 border-l border-b border-blue-500/20 rounded-bl-lg pointer-events-none z-10" />
      <div className="fixed bottom-3 right-3 w-12 h-12 md:w-16 md:h-16 border-r border-b border-blue-500/20 rounded-br-lg pointer-events-none z-10" />
    </div>
  );
}
