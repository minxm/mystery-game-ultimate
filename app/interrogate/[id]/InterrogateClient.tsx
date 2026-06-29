'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Info, X } from 'lucide-react';
import { CaseData, Suspect, InterrogationMessage } from '@/lib/types';
import { storage, loadCaseData, findSuspectByParam, getSuspectId } from '@/lib/utils';
import { serializeCaseForPrompt } from '@/lib/case-prompt';
import { getAvatarPlaceholder } from '@/lib/placeholder';
import ParticleBackground from '@/components/ParticleBackground';
import Image from 'next/image';

function resolveSuspectParam(): string | null {
  if (typeof window === 'undefined') return null;

  const urlParam = new URLSearchParams(window.location.search).get('suspect');
  if (urlParam) return urlParam;

  const cached = sessionStorage.getItem('interrogateTarget');
  if (!cached) return null;

  try {
    const { suspectId } = JSON.parse(cached) as { suspectId?: string };
    return suspectId || null;
  } catch {
    return null;
  }
}

export default function InterrogateClient() {
  const router = useRouter();
  const params = useParams();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [suspect, setSuspect] = useState<Suspect | null>(null);
  const [messages, setMessages] = useState<InterrogationMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [imgError, setImgError] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const caseId = params.id as string;
    const suspectParam = resolveSuspectParam();

    setPageError('');
    let cancelled = false;

    (async () => {
      const data = await loadCaseData(caseId);
      if (cancelled) return;

      if (!data) {
        setPageError('案件数据不存在，请先重新生成案件。');
        setIsPageLoading(false);
        return;
      }

      setCaseData(data);

      if (!suspectParam) {
        setPageError('未指定要审问的嫌疑人。');
        setIsPageLoading(false);
        return;
      }

      const foundSuspect = findSuspectByParam(data.suspects, suspectParam);
      if (!foundSuspect) {
        setPageError(`未找到对应嫌疑人（${suspectParam}），请返回调查页重试。`);
        setIsPageLoading(false);
        return;
      }

      const suspectIndex = data.suspects.findIndex(
        (s) => s === foundSuspect || s.id === foundSuspect.id || s.name === foundSuspect.name
      );
      const normalizedSuspect = {
        ...foundSuspect,
        id: getSuspectId(foundSuspect, suspectIndex >= 0 ? suspectIndex : 0),
      };

      setSuspect(normalizedSuspect);

      const savedMessages = storage.getInterrogation(caseId, normalizedSuspect.id);
      setMessages(
        savedMessages.length > 0
          ? savedMessages
          : [
              {
                role: 'assistant',
                content: `我是${normalizedSuspect.name}。你想问我什么？`,
                timestamp: Date.now(),
              },
            ]
      );
      setIsPageLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !suspect || !caseData) return;

    const userMessage: InterrogationMessage = {
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    const streamTimestamp = Date.now() + 1;
    const streamingPlaceholder: InterrogationMessage = {
      role: 'assistant',
      content: '',
      timestamp: streamTimestamp,
    };

    setMessages((prev) => [...prev, userMessage, streamingPlaceholder]);
    setInput('');
    setIsLoading(true);
    inputRef.current?.focus();

    const updateStreamingMessage = (content: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.timestamp === streamTimestamp ? { ...m, content } : m
        )
      );
    };

    try {
      const progress = storage.getProgress(caseData.id);
      const discoveredEvidence = progress?.discoveredEvidence || [];
      const evidenceTexts = caseData.evidence
        .filter((e) => discoveredEvidence.includes(e.id))
        .map((e) => `${e.name}: ${e.description}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch('/api/interrogate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suspect: {
            id: suspect.id,
            name: suspect.name,
            isGuilty: suspect.isGuilty,
          },
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          evidence: evidenceTexts,
          caseData: JSON.parse(serializeCaseForPrompt(caseData)),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok || !response.body) {
        throw new Error('审问请求失败');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedContent = '';
      let finalContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith('data: ')) continue;

          let payload: { delta?: string; done?: boolean; content?: string; error?: string };
          try {
            payload = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (payload.error) {
            finalContent = payload.content || payload.error;
            updateStreamingMessage(finalContent);
            break;
          }

          if (payload.delta) {
            streamedContent += payload.delta;
            updateStreamingMessage(streamedContent);
          }

          if (payload.done && payload.content) {
            finalContent = payload.content;
            updateStreamingMessage(finalContent);
          }
        }
      }

      const replyContent =
        finalContent || streamedContent || '抱歉，我现在有点紧张，不知道该说什么...';
      updateStreamingMessage(replyContent);

      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.timestamp === streamTimestamp ? { ...m, content: replyContent } : m
        );
        storage.saveInterrogation(caseData.id, suspect.id, updated);
        return updated;
      });

      if (progress && !progress.interrogatedSuspects.includes(suspect.id)) {
        storage.saveProgress({
          ...progress,
          interrogatedSuspects: [...progress.interrogatedSuspects, suspect.id],
        });
      }
    } catch (error: unknown) {
      const err = error as { name?: string };
      const errorContent =
        err.name === 'AbortError'
          ? '请求超时，请重试...'
          : '抱歉，我现在有点紧张，不知道该说什么...';

      setMessages((prev) => {
        const hasPlaceholder = prev.some((m) => m.timestamp === streamTimestamp);
        const updated = hasPlaceholder
          ? prev.map((m) =>
              m.timestamp === streamTimestamp ? { ...m, content: errorContent } : m
            )
          : [
              ...prev,
              { role: 'assistant' as const, content: errorContent, timestamp: Date.now() },
            ];
        storage.saveInterrogation(caseData.id, suspect.id, updated);
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-2 border-blood-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-blue-400 tracking-widest text-sm animate-pulse">正在连接审问室…</p>
        </div>
      </div>
    );
  }

  if (pageError || !caseData || !suspect) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-dark-900">
        <div className="glass-dark rounded-xl p-8 max-w-lg w-full text-center">
          <h1 className="text-xl font-bold text-blood-500 mb-4">无法进入审问</h1>
          <p className="text-gray-300 mb-6 text-sm">{pageError || '页面状态异常，请返回调查页重试。'}</p>
          <button
            type="button"
            onClick={() => router.push(caseData ? `/investigate/${caseData.id}` : '/')}
            className="px-6 py-3 rounded-xl font-bold text-sm transition"
            style={{ background: 'linear-gradient(135deg,#0066cc,#1e90ff)' }}
          >
            返回上一页
          </button>
        </div>
      </div>
    );
  }

  const tips = ['询问不在场证明', '用证据质问对方', '注意情绪与回避', '对比不同嫌疑人'];

  return (
    <div className="h-[100dvh] flex flex-col relative bg-dark-900 overflow-hidden page-shell max-w-[100vw]">
      <ParticleBackground />

      {/* ── 顶部导航栏 ── */}
      <header
        className="relative z-20 flex-shrink-0 border-b border-blue-900/30"
        style={{ background: 'rgba(4,13,26,0.94)', backdropFilter: 'blur(20px)' }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 min-w-0 max-w-full">
          {/* 返回按钮 */}
          <button
            type="button"
            onClick={() => router.push(`/investigate/${caseData.id}`)}
            className="flex items-center gap-1.5 text-blue-400/60 hover:text-blue-400 transition flex-shrink-0 p-1.5 rounded-lg hover:bg-blue-500/10"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">返回</span>
          </button>

          {/* 嫌疑人信息 */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0 px-1">
            {/* 头像 */}
            <div className="relative w-9 h-9 rounded-full overflow-hidden border border-blood-500/60 flex-shrink-0 shadow-[0_0_12px_rgba(230,57,70,0.3)]">
              {suspect.imageUrl && !imgError ? (
                <Image
                  src={suspect.imageUrl}
                  alt={suspect.name}
                  fill
                  className="object-cover object-top"
                  unoptimized
                  onError={() => setImgError(true)}
                />
              ) : (
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: `url("${getAvatarPlaceholder(suspect.name)}")` }}
                />
              )}
            </div>

            {/* 名字和职业 */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blood-600/20 border border-blood-500/30 text-blood-400 font-mono flex-shrink-0">
                  SUSPECT
                </span>
                <h1 className="text-sm font-black text-white truncate">{suspect.name}</h1>
              </div>
              <p className="text-[11px] text-blue-400/50 font-mono truncate">
                {suspect.age}岁 · {suspect.occupation}
              </p>
            </div>
          </div>

          {/* 审问技巧切换 */}
          <button
            type="button"
            onClick={() => setShowTips((v) => !v)}
            className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition ${
              showTips ? 'text-blue-400 bg-blue-500/15 border border-blue-500/30' : 'text-gray-500 glass hover:text-gray-300'
            }`}
          >
            {showTips ? <X className="w-4 h-4" /> : <Info className="w-4 h-4" />}
          </button>
        </div>

        {/* 审问技巧面板 */}
        <AnimatePresence>
          {showTips && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-blue-900/20"
            >
              <div className="px-4 py-2 flex flex-wrap gap-2">
                {tips.map((tip) => (
                  <span
                    key={tip}
                    className="text-xs text-blue-300/70 bg-blue-600/10 border border-blue-500/20 px-2.5 py-1 rounded-full"
                  >
                    {tip}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 扫描线装饰 */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
      </header>

      {/* ── 消息区域 ── */}
      <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain min-w-0 w-full">
        <div className="px-3 sm:px-4 py-4 space-y-3 pb-2 w-full max-w-4xl mx-auto min-w-0 box-border">

          {/* 审问室信息条 */}
          <div className="flex items-center gap-2 my-2 min-w-0 w-full">
            <div className="flex-1 min-w-0 h-px bg-blue-900/40" />
            <span className="text-[10px] font-mono text-blue-500/40 tracking-widest px-1 shrink-0 whitespace-nowrap">
              <span className="hidden sm:inline">INTERROGATION · </span>
              审问室
            </span>
            <div className="flex-1 min-w-0 h-px bg-blue-900/40" />
          </div>

          {messages.map((message, index) => {
            const isStreamingBubble =
              isLoading &&
              index === messages.length - 1 &&
              message.role === 'assistant' &&
              !message.content;

            return (
            <motion.div
              key={message.timestamp}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`flex items-end gap-1.5 sm:gap-2 w-full min-w-0 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {/* 嫌疑人头像 */}
              {message.role === 'assistant' && (
                <div className="relative w-7 h-7 rounded-full overflow-hidden border border-blood-500/40 flex-shrink-0 mb-0.5">
                  {suspect.imageUrl && !imgError ? (
                    <Image src={suspect.imageUrl} alt={suspect.name} fill className="object-cover object-top" unoptimized onError={() => setImgError(true)} />
                  ) : (
                    <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url("${getAvatarPlaceholder(suspect.name)}")` }} />
                  )}
                </div>
              )}

              <div
                className={`min-w-0 max-w-[min(82%,calc(100vw-3.5rem))] sm:max-w-[72%] px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'rounded-2xl rounded-br-sm text-white chat-bubble-user'
                    : 'rounded-2xl rounded-bl-sm text-gray-200 chat-bubble-suspect'
                }`}
              >
                {isStreamingBubble ? (
                  <div className="flex gap-1.5 items-center h-4 py-0.5">
                    {[0, 150, 300].map((delay) => (
                      <div
                        key={delay}
                        className="w-2 h-2 rounded-full bg-blue-400"
                        style={{ animation: `bounce 1s ${delay}ms infinite` }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
                {!isStreamingBubble && (
                <p className={`text-[10px] mt-1.5 font-mono ${message.role === 'user' ? 'text-blue-200/50 text-right' : 'text-gray-600'}`}>
                  {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </p>
                )}
              </div>

              {/* 侦探图标 */}
              {message.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mb-0.5">
                  <span className="text-xs">🔍</span>
                </div>
              )}
            </motion.div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── 输入区域（固定底部）── */}
      <div
        className="relative z-20 flex-shrink-0 border-t border-blue-900/30 px-3 sm:px-4 py-2.5 sm:py-3 min-w-0 w-full"
        style={{ background: 'rgba(4,13,26,0.94)', backdropFilter: 'blur(20px)' }}
      >
        <div className="flex gap-2 items-center max-w-4xl mx-auto min-w-0 w-full">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="输入审问问题…"
            className="flex-1 min-w-0 px-4 py-3 rounded-xl border text-sm text-white placeholder:text-gray-600 transition focus:outline-none"
            style={{
              background: 'rgba(10,24,48,0.8)',
              borderColor: input.trim() ? 'rgba(30,144,255,0.5)' : 'rgba(30,80,160,0.3)',
              boxShadow: input.trim() ? '0 0 10px rgba(30,144,255,0.15)' : 'none',
            }}
            disabled={isLoading}
          />
          <motion.button
            type="button"
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.93 }}
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #0055bb, #1e90ff)',
              boxShadow: '0 0 18px rgba(30,144,255,0.45)',
            }}
          >
            <Send className="w-5 h-5 text-white" />
          </motion.button>
        </div>
        {/* 安全区底部间距（iOS Home Bar） */}
        <div className="h-safe-area-inset-bottom" />
      </div>
    </div>
  );
}
