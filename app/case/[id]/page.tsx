'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FileText, Users, Clock, ArrowRight, Skull } from 'lucide-react';
import { CaseData } from '@/lib/types';
import { storage } from '@/lib/utils';
import ParticleBackground from '@/components/ParticleBackground';
import Image from 'next/image';

export default function CasePage() {
  const router = useRouter();
  const params = useParams();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCase = async () => {
      const caseId = params.id as string;

      // 先从 localStorage 获取
      let data = storage.getCase(caseId);

      if (!data) {
        // 如果没有，可能是刚生成的，从 sessionStorage 获取
        const sessionData = sessionStorage.getItem('currentCase');
        if (sessionData) {
          data = JSON.parse(sessionData);
          if (data) {
            storage.saveCase(data);
          }
        }
      }

      if (data) {
        setCaseData(data);

        // 初始化游戏进度
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
    };

    loadCase();
  }, [params.id]);

  const handleStartInvestigation = () => {
    router.push(`/investigate/${caseData?.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blood-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">加载案件中...</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Skull className="w-16 h-16 text-blood-500 mx-auto mb-4" />
          <p className="text-xl text-gray-400">案件不存在</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-6 py-2 bg-blood-600 rounded-lg hover:bg-blood-500 transition"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <ParticleBackground />

      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* 案件标题 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold mb-4 text-glow">{caseData.title}</h1>
          <div className="flex items-center justify-center gap-6 text-gray-400">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {caseData.setting}
            </span>
            <span className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {caseData.suspects.length} 名嫌疑人
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              难度：{caseData.difficulty}
            </span>
          </div>
        </motion.div>

        {/* 受害者信息 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-dark rounded-lg p-8 mb-8 max-w-4xl mx-auto"
        >
          <h2 className="text-2xl font-bold mb-6 text-blood-500">受害者档案</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              {caseData.victim.imageUrl ? (
                <div className="relative w-full aspect-square rounded-lg overflow-hidden border-2 border-blood-500">
                  <Image
                    src={caseData.victim.imageUrl}
                    alt={caseData.victim.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-full aspect-square rounded-lg bg-dark-700 flex items-center justify-center border-2 border-blood-500">
                  <Skull className="w-24 h-24 text-blood-500" />
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500">姓名：</span>
                  <span className="text-xl font-bold ml-2">{caseData.victim.name}</span>
                </div>
                <div>
                  <span className="text-gray-500">年龄：</span>
                  <span className="ml-2">{caseData.victim.age} 岁</span>
                </div>
                <div>
                  <span className="text-gray-500">职业：</span>
                  <span className="ml-2">{caseData.victim.occupation}</span>
                </div>
                <div>
                  <span className="text-gray-500">死因：</span>
                  <span className="ml-2 text-blood-500">{caseData.deathMethod}</span>
                </div>
                <div className="pt-4 border-t border-gray-700">
                  <p className="text-gray-300 leading-relaxed">{caseData.victim.background}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 案发现场 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-dark rounded-lg p-8 mb-8 max-w-4xl mx-auto"
        >
          <h2 className="text-2xl font-bold mb-6 text-blood-500">案发现场</h2>
          {caseData.sceneImageUrl && (
            <div className="relative w-full h-96 rounded-lg overflow-hidden mb-6">
              <Image
                src={caseData.sceneImageUrl}
                alt="案发现场"
                fill
                className="object-cover"
              />
            </div>
          )}
          <p className="text-gray-300 leading-relaxed whitespace-pre-line">
            {caseData.sceneDescription}
          </p>
        </motion.div>

        {/* 嫌疑人预览 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="max-w-4xl mx-auto mb-12"
        >
          <h2 className="text-2xl font-bold mb-6 text-center">嫌疑人</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {caseData.suspects.map((suspect, index) => (
              <motion.div
                key={suspect.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="glass rounded-lg p-6 text-center"
              >
                {suspect.imageUrl ? (
                  <div className="relative w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden border-2 border-gray-600">
                    <Image
                      src={suspect.imageUrl}
                      alt={suspect.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-dark-700 flex items-center justify-center border-2 border-gray-600">
                    <Users className="w-16 h-16 text-gray-600" />
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2">{suspect.name}</h3>
                <p className="text-gray-400 text-sm mb-1">{suspect.age} 岁 · {suspect.occupation}</p>
                <p className="text-gray-500 text-sm">{suspect.relationship}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* 开始调查按钮 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleStartInvestigation}
            className="px-12 py-4 bg-gradient-to-r from-blood-600 to-blood-500 rounded-lg text-xl font-bold shadow-lg hover:shadow-blood-500/50 transition-all flex items-center gap-3 mx-auto"
          >
            开始调查
            <ArrowRight className="w-6 h-6" />
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
