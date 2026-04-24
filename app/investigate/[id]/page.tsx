'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Users,
  FileText,
  Clock,
  MessageSquare,
  ArrowLeft,
  CheckCircle,
  Send,
} from 'lucide-react';
import { CaseData, Evidence, Suspect } from '@/lib/types';
import { storage } from '@/lib/utils';
import ParticleBackground from '@/components/ParticleBackground';
import Image from 'next/image';

export default function InvestigatePage() {
  const router = useRouter();
  const params = useParams();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [activeTab, setActiveTab] = useState<'evidence' | 'suspects' | 'timeline'>('evidence');
  const [discoveredEvidence, setDiscoveredEvidence] = useState<string[]>([]);
  const [selectedSuspect, setSelectedSuspect] = useState<Suspect | null>(null);
  const [deduction, setDeduction] = useState('');
  const [showSubmit, setShowSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const caseId = params.id as string;
    const data = storage.getCase(caseId);
    if (data) {
      setCaseData(data);
      const progress = storage.getProgress(caseId);
      if (progress) {
        setDiscoveredEvidence(progress.discoveredEvidence);
      }
    }
  }, [params.id]);

  const handleDiscoverEvidence = (evidenceId: string) => {
    if (!discoveredEvidence.includes(evidenceId)) {
      const newDiscovered = [...discoveredEvidence, evidenceId];
      setDiscoveredEvidence(newDiscovered);

      const progress = storage.getProgress(caseData!.id);
      if (progress) {
        storage.saveProgress({
          ...progress,
          discoveredEvidence: newDiscovered,
        });
      }
    }
  };

  const handleInterrogate = (suspect: Suspect) => {
    router.push(`/interrogate/${caseData?.id}?suspect=${suspect.id}`);
  };

  const handleSubmitDeduction = async () => {
    if (!deduction.trim()) {
      alert('请输入你的推理');
      return;
    }

    setIsSubmitting(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseData,
          userDeduction: deduction,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      if (data.success) {
        const progress = storage.getProgress(caseData!.id);
        if (progress) {
          storage.saveProgress({
            ...progress,
            endTime: Date.now(),
            score: data.evaluation.score,
          });
        }

        storage.updateStats(data.evaluation.score);

        sessionStorage.setItem('evaluation', JSON.stringify(data.evaluation));
        router.push(`/result/${caseData?.id}`);
      } else {
        alert(data.error || '评分失败，请重试');
      }
    } catch (error: any) {
      console.error('提交失败:', error);
      if (error.name === 'AbortError') {
        alert('请求超时，请检查网络连接后重试');
      } else {
        alert('提交失败，请重试');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!caseData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blood-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <ParticleBackground />

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* 顶部导航 */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 md:mb-8">
          <button
            onClick={() => router.push(`/case/${caseData.id}`)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm md:text-base">返回案件</span>
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-center flex-1">{caseData.title}</h1>
          <button
            onClick={() => setShowSubmit(true)}
            className="w-full md:w-auto px-4 md:px-6 py-2 bg-blood-600 rounded-lg hover:bg-blood-500 transition text-sm md:text-base"
          >
            提交推理
          </button>
        </div>

        {/* 标签页 - 移动端优化 */}
        <div className="grid grid-cols-3 md:flex gap-2 md:gap-4 mb-6 md:mb-8">
          {[
            { id: 'evidence', label: '证据', icon: Search },
            { id: 'suspects', label: '嫌疑人', icon: Users },
            { id: 'timeline', label: '时间线', icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-2 md:px-6 py-3 rounded-lg transition ${
                activeTab === tab.id
                  ? 'bg-blood-600 text-white shadow-lg shadow-blood-500/30'
                  : 'glass text-gray-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              <tab.icon className="w-5 h-5 md:w-5 md:h-5" />
              <span className="text-xs md:text-base font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <AnimatePresence mode="wait">
          {activeTab === 'evidence' && (
            <motion.div
              key="evidence"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {caseData.evidence.map((evidence) => (
                <motion.div
                  key={evidence.id}
                  whileHover={{ scale: 1.05 }}
                  className={`glass-dark rounded-lg p-6 cursor-pointer evidence-card ${
                    discoveredEvidence.includes(evidence.id) ? 'border-2 border-blood-500' : ''
                  }`}
                  onClick={() => handleDiscoverEvidence(evidence.id)}
                >
                  {discoveredEvidence.includes(evidence.id) && (
                    <CheckCircle className="w-6 h-6 text-blood-500 mb-2" />
                  )}
                  <h3 className="text-xl font-bold mb-2">{evidence.name}</h3>
                  <p className="text-gray-400 text-sm mb-3">{evidence.location}</p>
                  <p className="text-gray-300 mb-4">{evidence.description}</p>
                  <div className="text-sm text-blood-500">重要性：{evidence.significance}</div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {activeTab === 'suspects' && (
            <motion.div
              key="suspects"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {caseData.suspects.map((suspect) => (
                <motion.div
                  key={suspect.id}
                  whileHover={{ scale: 1.05 }}
                  className="glass-dark rounded-lg p-6 suspect-card"
                >
                  {suspect.imageUrl ? (
                    <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-4">
                      <Image
                        src={suspect.imageUrl}
                        alt={suspect.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-square rounded-lg bg-dark-700 flex items-center justify-center mb-4">
                      <Users className="w-24 h-24 text-gray-600" />
                    </div>
                  )}
                  <h3 className="text-2xl font-bold mb-2">{suspect.name}</h3>
                  <div className="space-y-2 text-sm mb-4">
                    <div>
                      <span className="text-gray-500">年龄：</span>
                      <span>{suspect.age} 岁</span>
                    </div>
                    <div>
                      <span className="text-gray-500">职业：</span>
                      <span>{suspect.occupation}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">关系：</span>
                      <span>{suspect.relationship}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">性格：</span>
                      <span>{suspect.personality}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleInterrogate(suspect)}
                    className="w-full py-2 bg-blood-600 rounded-lg hover:bg-blood-500 transition flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    审问
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}

          {activeTab === 'timeline' && (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-dark rounded-lg p-8 max-w-4xl mx-auto"
            >
              <div className="space-y-6">
                {caseData.timeline.map((event, index) => (
                  <div key={index} className="flex gap-4 relative pl-8 timeline-item">
                    <div
                      className={`absolute left-0 top-2 w-4 h-4 rounded-full ${
                        event.significance === 'critical'
                          ? 'bg-red-500'
                          : event.significance === 'high'
                          ? 'bg-orange-500'
                          : event.significance === 'medium'
                          ? 'bg-yellow-500'
                          : 'bg-gray-500'
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-blood-500 font-bold">{event.time}</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-gray-400">{event.location}</span>
                      </div>
                      <p className="text-white mb-1">{event.event}</p>
                      {event.witness && (
                        <p className="text-sm text-gray-500">目击者：{event.witness}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 提交推理弹窗 */}
        <AnimatePresence>
          {showSubmit && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
              onClick={() => setShowSubmit(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-dark rounded-lg p-8 max-w-2xl w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-3xl font-bold mb-6 text-blood-500">提交你的推理</h2>
                <p className="text-gray-400 mb-6">
                  请详细说明：谁是凶手？作案手法是什么？动机是什么？
                </p>
                <textarea
                  value={deduction}
                  onChange={(e) => setDeduction(e.target.value)}
                  placeholder="输入你的完整推理过程..."
                  className="w-full h-64 bg-dark-800 border border-gray-700 rounded-lg p-4 text-white resize-none focus:outline-none focus:border-blood-500"
                />
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={() => setShowSubmit(false)}
                    disabled={isSubmitting}
                    className="flex-1 py-3 glass rounded-lg hover:bg-dark-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSubmitDeduction}
                    disabled={isSubmitting || !deduction.trim()}
                    className="flex-1 py-3 bg-blood-600 rounded-lg hover:bg-blood-500 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        提交中...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        提交推理
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
