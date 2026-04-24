'use client';

import { motion } from 'framer-motion';
import { Skull, Brain, Clock, Trophy, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ParticleBackground from '@/components/ParticleBackground';

export default function HomePage() {
  const router = useRouter();
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('medium');
  const [isGenerating, setIsGenerating] = useState(false);

  const difficulties = [
    { id: 'easy', name: '简单', desc: '适合新手侦探', icon: '🔍', color: 'from-green-600 to-green-800' },
    { id: 'medium', name: '中等', desc: '考验推理能力', icon: '🎯', color: 'from-yellow-600 to-yellow-800' },
    { id: 'hard', name: '困难', desc: '高手的挑战', icon: '🔥', color: 'from-orange-600 to-orange-800' },
    { id: 'expert', name: '专家', desc: '神探的试炼', icon: '💀', color: 'from-red-600 to-red-800' },
  ];

  const handleStartCase = async () => {
    setIsGenerating(true);
    try {
      console.log('[Frontend] Starting case generation...');

      const response = await fetch('/api/generate-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: selectedDifficulty }),
      });

      console.log('[Frontend] Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Frontend] Response data:', {
        success: data.success,
        hasCaseId: !!data.caseId,
        hasCaseData: !!data.caseData
      });

      if (data.success && data.caseId && data.caseData) {
        console.log('[Frontend] Saving case to sessionStorage...');
        sessionStorage.setItem('currentCase', JSON.stringify(data.caseData));
        console.log('[Frontend] Navigating to case page...');
        router.push(`/case/${data.caseId}`);
      } else {
        console.error('[Frontend] Invalid response data:', data);
        alert('生成案件失败：数据格式错误');
      }
    } catch (error: any) {
      console.error('[Frontend] Case generation failed:', error);
      alert(`生成案件失败：${error.message || '请重试'}`);
    } finally {
      setIsGenerating(false);
    }
  };

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
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="inline-block mb-4 md:mb-6"
          >
            <Skull className="w-16 h-16 md:w-24 md:h-24 text-blood-500 mx-auto animate-pulse-slow" />
          </motion.div>

          <h1 className="text-4xl md:text-7xl font-bold mb-4 md:mb-6 text-glow">
            AI 剧本杀
          </h1>
          <p className="text-lg md:text-2xl text-gray-400 mb-3 md:mb-4">
            沉浸式推理游戏平台
          </p>
          <p className="text-sm md:text-lg text-gray-500 max-w-2xl mx-auto px-4">
            每个案件都是独一无二的悬疑故事<br />
            挑战你的推理极限，揭开层层迷雾
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
            { icon: Brain, title: 'AI 生成案件', desc: '无限可能的推理故事' },
            { icon: Clock, title: '实时审问', desc: '与嫌疑人智能对话' },
            { icon: Trophy, title: '智能评分', desc: '专业的推理评估系统' },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="glass p-4 md:p-6 rounded-lg card-hover text-center"
            >
              <feature.icon className="w-10 h-10 md:w-12 md:h-12 text-blood-500 mb-3 md:mb-4 mx-auto" />
              <h3 className="text-lg md:text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-sm md:text-base text-gray-400">{feature.desc}</p>
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
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-6 md:mb-8 flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-blood-500" />
            选择难度
            <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-blood-500" />
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8 md:mb-12">
            {difficulties.map((diff) => (
              <motion.button
                key={diff.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDifficulty(diff.id)}
                className={`p-4 md:p-6 rounded-lg border-2 transition-all ${
                  selectedDifficulty === diff.id
                    ? 'border-blood-500 bg-gradient-to-br ' + diff.color + ' shadow-lg shadow-blood-500/30'
                    : 'border-gray-700 glass hover:border-gray-600'
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
              className="w-full md:w-auto px-8 md:px-12 py-3 md:py-4 bg-gradient-to-r from-blood-600 to-blood-500 rounded-lg text-lg md:text-xl font-bold shadow-lg hover:shadow-blood-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  生成案件中...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
                  开始推理
                  <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
                </span>
              )}
            </motion.button>
            <p className="mt-4 text-xs md:text-sm text-gray-500">
              生成时间约 15-30 秒，请耐心等待
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
          <p>每个案件都是 AI 实时生成，保证独一无二的体验</p>
          <p className="mt-2 text-gray-700">Powered by AI · Made with ❤️</p>
        </motion.div>
      </div>

      {/* 装饰线条 */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blood-500 to-transparent opacity-50" />
      <div className="fixed bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blood-500 to-transparent opacity-50" />

      {/* 角落装饰 */}
      <div className="fixed top-0 left-0 w-20 h-20 md:w-32 md:h-32 border-l-2 border-t-2 border-blood-500/30 rounded-tl-lg" />
      <div className="fixed top-0 right-0 w-20 h-20 md:w-32 md:h-32 border-r-2 border-t-2 border-blood-500/30 rounded-tr-lg" />
      <div className="fixed bottom-0 left-0 w-20 h-20 md:w-32 md:h-32 border-l-2 border-b-2 border-blood-500/30 rounded-bl-lg" />
      <div className="fixed bottom-0 right-0 w-20 h-20 md:w-32 md:h-32 border-r-2 border-b-2 border-blood-500/30 rounded-br-lg" />
    </div>
  );
}
