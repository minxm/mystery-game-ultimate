'use client';

import { motion } from 'framer-motion';
import { Search, Brain, Clock, Trophy, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ParticleBackground from '@/components/ParticleBackground';
import { saveCaseData } from '@/lib/case-store';

export default function HomePage() {
  const router = useRouter();
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState('');

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function pollCaseJob(jobId: string, maxWaitMs = 180000): Promise<any> {
    const startedAt = Date.now();
    let dots = 0;

    while (Date.now() - startedAt < maxWaitMs) {
      dots = (dots + 1) % 4;
      setGeneratingStatus(`AI 正在生成案件${'.'.repeat(dots + 1)}`);

      const response = await fetch(`/api/generate-case/status?jobId=${encodeURIComponent(jobId)}`);
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.status === 'done' && data.caseData) {
        return data.caseData;
      }
      if (data.status === 'error') {
        throw new Error(data.error || '案件生成失败');
      }

      await sleep(2000);
    }

    throw new Error('生成超时，请稍后重试');
  }

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

      if (startData.sync && startData.caseData) {
        await saveCaseData(startData.caseData);
        router.push(`/case/${startData.caseId}`);
        return;
      }

      if (!startData.jobId) {
        throw new Error('未收到任务 ID');
      }

      const caseData = await pollCaseJob(startData.jobId);
      await saveCaseData(caseData);
      router.push(`/case/${caseData.id}`);
    } catch (error: any) {
      console.error('[Frontend] Case generation failed:', error);
      alert(`生成案件失败：${error.message || '请重试'}`);
    } finally {
      setIsGenerating(false);
      setGeneratingStatus('');
    }
  };

  const difficulties = [
    { id: 'easy', name: '简单', desc: '适合新手侦探', icon: '🔍', color: 'from-green-600 to-green-800' },
    { id: 'medium', name: '中等', desc: '考验推理能力', icon: '🎯', color: 'from-yellow-600 to-yellow-800' },
    { id: 'hard', name: '困难', desc: '高手的挑战', icon: '🔥', color: 'from-orange-600 to-orange-800' },
    { id: 'expert', name: '专家', desc: '神探的试炼', icon: '💀', color: 'from-red-600 to-red-800' },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      <ParticleBackground />

      {/* Hero Section */}
      <div className="relative z-10 container mx-auto px-4 py-12 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12 md:mb-16"
        >
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 180 }}
            className="inline-block mb-4 md:mb-6"
          >
            <Search className="w-16 h-16 md:w-24 md:h-24 text-blood-500 mx-auto animate-pulse-slow" />
          </motion.div>

          <h1 className="text-4xl md:text-7xl font-black mb-4 md:mb-6 conan-title tracking-wider">
            AI 推理侦探
          </h1>
          <p className="text-lg md:text-2xl text-blue-300 mb-3 md:mb-4 font-medium">
            — 真相永远只有一个 —
          </p>
          <p className="text-sm md:text-lg text-gray-400 max-w-2xl mx-auto px-4">
            每个案件都是 AI 实时生成的独家悬疑故事<br />
            挑战你的推理直觉，揭开层层迷雾
          </p>
        </motion.div>

        {/* 特色功能 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-12 md:mb-16 max-w-5xl mx-auto px-4"
        >
          {[
            { icon: Brain, title: 'AI 生成案件', desc: '无限可能的推理故事', num: '01' },
            { icon: Clock, title: '实时审问', desc: '与嫌疑人智能对话', num: '02' },
            { icon: Trophy, title: '智能评分', desc: '专业的推理评估系统', num: '03' },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="relative glass p-5 md:p-7 rounded-xl card-hover text-center detective-border overflow-hidden"
            >
              <span className="absolute top-3 right-4 font-mono text-xs text-blue-500/30">{feature.num}</span>
              <div className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-blood-600/30 to-blood-500/10 flex items-center justify-center border border-blue-500/20">
                <feature.icon className="w-7 h-7 md:w-8 md:h-8 text-blood-500" />
              </div>
              <h3 className="text-base md:text-lg font-bold mb-1.5 tracking-wide">{feature.title}</h3>
              <p className="text-xs md:text-sm text-gray-400">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* 难度选择 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="max-w-4xl mx-auto px-4"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-6 md:mb-8 flex items-center justify-center gap-3">
            <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
            <span className="text-glow">选择案件难度</span>
            <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8 md:mb-12">
            {difficulties.map((diff) => (
              <motion.button
                key={diff.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDifficulty(diff.id)}
                className={`relative p-4 md:p-6 rounded-xl border-2 transition-all overflow-hidden ${
                  selectedDifficulty === diff.id
                    ? 'border-blood-500 bg-gradient-to-br ' + diff.color + ' shadow-[0_0_30px_rgba(30,144,255,0.3)]'
                    : 'border-blue-900/40 glass hover:border-blue-500/40 hover:shadow-[0_0_15px_rgba(30,144,255,0.1)]'
                }`}
              >
                <div className="text-3xl md:text-4xl mb-2">{diff.icon}</div>
                <div className="text-lg md:text-2xl font-bold mb-1 md:mb-2">{diff.name}</div>
                <div className="text-xs md:text-sm text-gray-300">{diff.desc}</div>
              </motion.button>
            ))}
          </div>

          {/* 开始按钮 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStartCase}
              disabled={isGenerating}
              className="relative w-full md:w-auto px-10 md:px-14 py-3.5 md:py-4 rounded-xl text-lg md:text-xl font-black tracking-wider overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #0066cc 0%, #1e90ff 50%, #00d4ff 100%)',
                boxShadow: '0 0 40px rgba(30,144,255,0.45), 0 4px 20px rgba(0,0,0,0.4)',
              }}
            >
              {/* 扫光 */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              {isGenerating ? (
                <span className="relative flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {generatingStatus || 'AI 正在分析案情…'}
                </span>
              ) : (
                <span className="relative flex items-center justify-center gap-2">
                  <Search className="w-5 h-5" />
                  开始推理
                  <Sparkles className="w-4 h-4" />
                </span>
              )}
            </motion.button>
            <p className="mt-4 text-xs md:text-sm text-gray-500">
              提交后 AI 在后台生成，约 30–90 秒，请保持页面打开
            </p>
          </motion.div>
        </motion.div>

        {/* 底部装饰 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-12 md:mt-20 text-center text-gray-600 text-xs md:text-sm px-4"
        >
          <p className="text-blue-900/60">每个案件 AI 实时生成，保证独一无二的体验</p>
          <p className="mt-2 text-gray-700">Powered by SiliconFlow · Detective Mode ON 🔍</p>
        </motion.div>
      </div>

      {/* 顶/底扫光线 */}
      <div className="fixed top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60" />
      <div className="fixed bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60" />

      {/* 角落侦探方框装饰 */}
      <div className="fixed top-0 left-0 w-20 h-20 md:w-32 md:h-32 border-l-2 border-t-2 border-blue-500/30 rounded-tl-lg" />
      <div className="fixed top-0 right-0 w-20 h-20 md:w-32 md:h-32 border-r-2 border-t-2 border-blue-500/30 rounded-tr-lg" />
      <div className="fixed bottom-0 left-0 w-20 h-20 md:w-32 md:h-32 border-l-2 border-b-2 border-blue-500/30 rounded-bl-lg" />
      <div className="fixed bottom-0 right-0 w-20 h-20 md:w-32 md:h-32 border-r-2 border-b-2 border-blue-500/30 rounded-br-lg" />
    </div>
  );
}
