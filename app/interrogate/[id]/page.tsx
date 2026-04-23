'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, User } from 'lucide-react';
import { CaseData, Suspect, InterrogationMessage } from '@/lib/types';
import { storage } from '@/lib/utils';
import ParticleBackground from '@/components/ParticleBackground';
import Image from 'next/image';

export default function InterrogatePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [suspect, setSuspect] = useState<Suspect | null>(null);
  const [messages, setMessages] = useState<InterrogationMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const caseId = params.id as string;
    const suspectId = searchParams.get('suspect');

    const data = storage.getCase(caseId);
    if (data) {
      setCaseData(data);
      const foundSuspect = data.suspects.find((s) => s.id === suspectId);
      if (foundSuspect) {
        setSuspect(foundSuspect);

        // 添加初始消息
        setMessages([
          {
            role: 'assistant',
            content: `我是${foundSuspect.name}。你想问我什么？`,
            timestamp: Date.now(),
          },
        ]);
      }
    }
  }, [params.id, searchParams]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !suspect || !caseData) return;

    const userMessage: InterrogationMessage = {
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const progress = storage.getProgress(caseData.id);
      const discoveredEvidence = progress?.discoveredEvidence || [];
      const evidenceTexts = caseData.evidence
        .filter((e) => discoveredEvidence.includes(e.id))
        .map((e) => `${e.name}: ${e.description}`);

      const response = await fetch('/api/interrogate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suspect,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          evidence: evidenceTexts,
          caseContext: `${caseData.sceneDescription}\n死因：${caseData.deathMethod}`,
        }),
      });

      const data = await response.json();
      if (data.success) {
        const assistantMessage: InterrogationMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // 更新进度
        if (progress && !progress.interrogatedSuspects.includes(suspect.id)) {
          storage.saveProgress({
            ...progress,
            interrogatedSuspects: [...progress.interrogatedSuspects, suspect.id],
          });
        }
      }
    } catch (error) {
      console.error('审问失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!caseData || !suspect) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blood-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <ParticleBackground />

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        {/* 顶部 */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push(`/investigate/${caseData.id}`)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
            返回调查
          </button>
          <h1 className="text-2xl font-bold">审问 - {suspect.name}</h1>
          <div className="w-24" />
        </div>

        {/* 嫌疑人信息卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-dark rounded-lg p-6 mb-6"
        >
          <div className="flex items-start gap-6">
            <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-blood-500 flex-shrink-0">
              {suspect.imageUrl ? (
                <Image src={suspect.imageUrl} alt={suspect.name} fill className="object-cover" />
              ) : (
                <div className="w-full h-full bg-dark-700 flex items-center justify-center">
                  <User className="w-12 h-12 text-gray-600" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">{suspect.name}</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">年龄：</span>
                  <span>{suspect.age} 岁</span>
                </div>
                <div>
                  <span className="text-gray-500">职业：</span>
                  <span>{suspect.occupation}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">关系：</span>
                  <span>{suspect.relationship}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">性格：</span>
                  <span>{suspect.personality}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 对话区域 */}
        <div className="glass-dark rounded-lg p-6 mb-6 h-[500px] flex flex-col">
          <div className="flex-1 overflow-y-auto mb-4 space-y-4">
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-4 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blood-600 text-white'
                      : 'bg-dark-700 text-gray-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-50 mt-2">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-dark-700 p-4 rounded-lg">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                    <div
                      className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <div
                      className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 输入框 */}
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="输入你的问题..."
              className="flex-1 px-4 py-3 bg-dark-700 rounded-lg border border-gray-700 focus:border-blood-500 focus:outline-none"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim()}
              className="px-6 py-3 bg-blood-600 rounded-lg hover:bg-blood-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              发送
            </button>
          </div>
        </div>

        {/* 提示 */}
        <div className="glass p-4 rounded-lg">
          <h3 className="font-bold mb-2 text-blood-500">审问技巧</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• 询问不在场证明的细节</li>
            <li>• 用已发现的证据质问嫌疑人</li>
            <li>• 注意嫌疑人的情绪变化和回避</li>
            <li>• 交叉对比不同嫌疑人的说法</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
