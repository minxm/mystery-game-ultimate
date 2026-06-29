'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Users, FileText, Clock, MessageSquare,
  ArrowLeft, CheckCircle, Send, Fingerprint, Zap,
} from 'lucide-react';
import { CaseData, Evidence, Suspect } from '@/lib/types';
import { storage, loadCaseData, getSuspectId } from '@/lib/utils';
import { getAvatarPlaceholder } from '@/lib/placeholder';
import ParticleBackground from '@/components/ParticleBackground';
import Image from 'next/image';

const SIGNIFICANCE_CONFIG = {
  critical: { color: 'text-danger-400', bg: 'bg-danger-600/20 border-danger-500/40', dot: 'bg-danger-500', label: '关键' },
  high:     { color: 'text-orange-400', bg: 'bg-orange-600/20 border-orange-500/40', dot: 'bg-orange-500', label: '重要' },
  medium:   { color: 'text-clue-400',   bg: 'bg-yellow-600/20 border-yellow-500/40', dot: 'bg-yellow-400', label: '一般' },
  low:      { color: 'text-gray-400',   bg: 'bg-gray-600/20 border-gray-500/30',    dot: 'bg-gray-500', label: '次要' },
};

export default function InvestigatePage() {
  const router = useRouter();
  const params = useParams();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [activeTab, setActiveTab] = useState<'evidence' | 'suspects' | 'timeline'>('evidence');
  const [discoveredEvidence, setDiscoveredEvidence] = useState<string[]>([]);
  const [deduction, setDeduction] = useState('');
  const [showSubmit, setShowSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [interrogatedSuspects, setInterrogatedSuspects] = useState<string[]>([]);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const markBroken = (id: string) =>
    setBrokenImages((prev) => new Set([...prev, id]));

  useEffect(() => {
    const caseId = params.id as string;
    let cancelled = false;

    (async () => {
      const data = await loadCaseData(caseId);
      if (cancelled) return;

      if (data) {
        setCaseData(data);
        const progress = storage.getProgress(caseId);
        if (progress) {
          setDiscoveredEvidence(progress.discoveredEvidence);
          setInterrogatedSuspects(progress.interrogatedSuspects);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleDiscoverEvidence = (evidenceId: string) => {
    if (!discoveredEvidence.includes(evidenceId)) {
      const newDiscovered = [...discoveredEvidence, evidenceId];
      setDiscoveredEvidence(newDiscovered);
      const progress = storage.getProgress(caseData!.id);
      if (progress) storage.saveProgress({ ...progress, discoveredEvidence: newDiscovered });
    }
  };

  const handleInterrogate = (suspect: Suspect, index: number) => {
    if (!caseData) return;
    const suspectId = getSuspectId(suspect, index);
    sessionStorage.setItem('interrogateTarget', JSON.stringify({ caseId: caseData.id, suspectId }));
    router.push(`/interrogate/${caseData.id}?suspect=${encodeURIComponent(suspectId)}`);
  };

  const handleSubmitDeduction = async () => {
    if (!deduction.trim()) { alert('请输入你的推理'); return; }
    setIsSubmitting(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseData, userDeduction: deduction }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      if (data.success) {
        const progress = storage.getProgress(caseData!.id);
        if (progress) storage.saveProgress({ ...progress, endTime: Date.now(), score: data.evaluation.score });
        storage.updateStats(data.evaluation.score);
        sessionStorage.setItem('evaluation', JSON.stringify(data.evaluation));
        router.push(`/result/${caseData?.id}`);
      } else { alert(data.error || '评分失败，请重试'); }
    } catch (error: any) {
      if (error.name === 'AbortError') alert('请求超时，请检查网络连接后重试');
      else alert('提交失败，请重试');
    } finally { setIsSubmitting(false); }
  };

  if (!caseData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="w-14 h-14 border-2 border-blood-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'evidence', label: '物证', icon: Search, count: `${discoveredEvidence.length}/${caseData.evidence.length}` },
    { id: 'suspects', label: '嫌疑人', icon: Users, count: `${interrogatedSuspects.length}/${caseData.suspects.length}` },
    { id: 'timeline', label: '时间线', icon: Clock, count: `${caseData.timeline.length}` },
  ];

  return (
    <div className="min-h-screen relative bg-dark-900 page-shell overflow-x-hidden">
      <ParticleBackground />

      {/* 四角装饰 */}
      <div className="fixed inset-0 pointer-events-none z-10">
        {['top-0 left-0 border-l border-t','top-0 right-0 border-r border-t','bottom-0 left-0 border-l border-b','bottom-0 right-0 border-r border-b'].map((cls,i)=>(
          <div key={i} className={`absolute w-12 h-12 border-blue-500/30 ${cls}`}/>
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-4 py-6 max-w-6xl">

        {/* ── 顶部导航 ── */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => router.push(`/case/${caseData.id}`)}
            className="flex items-center gap-1.5 text-blue-400/60 hover:text-blue-400 transition text-sm flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">返回档案</span>
          </button>
          <div className="flex-1 text-center min-w-0 px-1">
            <h1 className="text-base md:text-xl font-black tracking-wide conan-title line-clamp-1">{caseData.title}</h1>
            <p className="text-xs text-blue-500/40 font-mono tracking-widest hidden sm:block">INVESTIGATION MODE</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowSubmit(true)}
            className="relative flex-shrink-0 px-3 py-2 rounded-lg text-sm font-bold tracking-wide overflow-hidden group"
            style={{ background: 'linear-gradient(135deg,#0066cc,#1e90ff)', boxShadow: '0 0 20px rgba(30,144,255,0.35)' }}
          >
            <span className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
            <span className="relative flex items-center gap-1.5">
              <Fingerprint className="w-4 h-4"/>
              <span className="hidden sm:inline">提交推理</span>
            </span>
          </motion.button>
        </div>

        {/* ── Tab 标签 ── */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-3 px-2 md:px-4 rounded-xl transition-all text-sm font-bold relative overflow-hidden ${
                  active
                    ? 'text-white'
                    : 'glass text-gray-400 hover:text-blue-300 hover:border-blue-500/30'
                }`}
                style={active ? {
                  background: 'linear-gradient(135deg,#0066cc80,#1e90ff80)',
                  border: '1px solid rgba(30,144,255,0.5)',
                  boxShadow: '0 0 20px rgba(30,144,255,0.2)',
                } : {}}
              >
                <tab.icon className="w-4 h-4" />
                <span className="tracking-wide">{tab.label}</span>
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${active ? 'bg-white/20' : 'bg-dark-700 text-gray-500'}`}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        {/* ── 内容区域 ── */}
        <AnimatePresence mode="wait">

          {/* 证据 */}
          {activeTab === 'evidence' && (
            <motion.div key="evidence" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-16 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {caseData.evidence.map((ev, i) => {
                const found = discoveredEvidence.includes(ev.id);
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.05 }}
                    whileHover={{ y:-4 }}
                    onClick={() => handleDiscoverEvidence(ev.id)}
                    className={`relative glass-dark rounded-xl p-5 cursor-pointer transition-all border ${
                      found ? 'border-blue-500/50 shadow-[0_0_20px_rgba(30,144,255,0.2)]' : 'border-blue-900/30 hover:border-blue-500/30'
                    }`}
                  >
                    {/* 编号 */}
                    <span className="absolute top-3 right-4 text-xs font-mono text-blue-500/30">#{String(i+1).padStart(2,'0')}</span>
                    {/* 状态 */}
                    {found && <CheckCircle className="w-5 h-5 text-blue-400 mb-2" />}
                    {!found && <div className="w-5 h-5 rounded-full border border-gray-600 mb-2 flex items-center justify-center">
                      <Search className="w-3 h-3 text-gray-600"/>
                    </div>}

                    <h3 className={`text-base font-bold mb-1 ${found ? 'text-white' : 'text-gray-300'}`}>{ev.name}</h3>
                    <p className="text-xs font-mono text-blue-400/60 mb-2">{ev.location}</p>
                    <p className={`text-sm leading-relaxed mb-3 ${found ? 'text-gray-200' : 'text-gray-500'}`}>{ev.description}</p>

                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border ${
                      (SIGNIFICANCE_CONFIG as any)[ev.significance]?.bg ?? 'bg-gray-700/30 border-gray-600/30'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${(SIGNIFICANCE_CONFIG as any)[ev.significance]?.dot ?? 'bg-gray-500'}`}/>
                      <span className={(SIGNIFICANCE_CONFIG as any)[ev.significance]?.color ?? 'text-gray-400'}>
                        {(SIGNIFICANCE_CONFIG as any)[ev.significance]?.label ?? ev.significance}
                      </span>
                    </div>

                    {!found && (
                      <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-dark-900/40 backdrop-blur-[1px]">
                        <span className="text-xs tracking-widest text-gray-500 font-mono">点击调查</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* 嫌疑人 */}
          {activeTab === 'suspects' && (
            <motion.div key="suspects" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-16 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-5"
            >
              {caseData.suspects.map((suspect, index) => {
                const sid = getSuspectId(suspect, index);
                const interrogated = interrogatedSuspects.includes(sid);
                return (
                  <motion.div
                    key={sid}
                    initial={{ opacity:0, scale:0.94 }} animate={{ opacity:1, scale:1 }} transition={{ delay: index*0.08 }}
                    className={`relative rounded-2xl overflow-hidden border transition-all ${
                      interrogated
                        ? 'border-blue-500/50 shadow-[0_0_30px_rgba(30,144,255,0.2)]'
                        : 'border-blue-900/30'
                    }`}
                    style={{ background: 'linear-gradient(160deg, rgba(10,24,48,0.95) 0%, rgba(4,13,26,0.98) 100%)' }}
                  >
                    {/* 顶部标签条 */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-blue-900/30"
                      style={{ background: 'linear-gradient(90deg,rgba(30,144,255,0.08),transparent)' }}>
                      <span className="text-xs font-mono text-blue-500/60 tracking-widest">SUSPECT #{String(index+1).padStart(2,'0')}</span>
                      {interrogated
                        ? <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400 tracking-widest"><CheckCircle className="w-3 h-3"/>已审问</span>
                        : <span className="text-[10px] text-gray-600 font-mono tracking-widest">UNKNOWN</span>
                      }
                    </div>

                    {/* 头像区域 */}
                    <div className="relative w-full aspect-[4/3] overflow-hidden">
                      {suspect.imageUrl && !brokenImages.has(sid) ? (
                        <Image
                          src={suspect.imageUrl}
                          alt={suspect.name}
                          fill
                          className="object-cover object-top"
                          unoptimized
                          onError={() => markBroken(sid)}
                        />
                      ) : (
                        <div
                          className="w-full h-full bg-cover bg-center"
                          style={{ backgroundImage: `url("${getAvatarPlaceholder(suspect.name)}")` }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/20 to-transparent" />

                      {/* 扫描线装饰 */}
                      {interrogated && (
                        <div className="absolute top-3 left-3 right-3 flex gap-1">
                          {[...Array(3)].map((_,i)=>(
                            <div key={i} className="flex-1 h-0.5 bg-blue-400/30 rounded"/>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 信息区域 */}
                    <div className="px-5 pb-5">
                      <h3 className="text-2xl font-black text-white tracking-wide mt-3 mb-1">{suspect.name}</h3>
                      <p className="text-xs font-mono text-blue-300/60 mb-4">{suspect.age} 岁 · {suspect.occupation}</p>

                      <div className="space-y-2 mb-5">
                        {[
                          ['关系', suspect.relationship],
                          ['性格', suspect.personality],
                          ['不在场', suspect.alibi],
                        ].map(([k,v]) => (
                          <div key={k} className="flex gap-2 text-sm">
                            <span className="text-blue-500/50 w-12 shrink-0 font-mono text-xs pt-0.5">{k}</span>
                            <span className="text-gray-300 text-xs leading-relaxed">{v}</span>
                          </div>
                        ))}
                      </div>

                      {/* 审问按钮 */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleInterrogate(suspect, index)}
                        className={`relative w-full py-2.5 rounded-xl text-sm font-bold tracking-wide flex items-center justify-center gap-2 overflow-hidden group ${
                          interrogated
                            ? 'border border-blue-500/30 text-blue-300'
                            : 'text-white'
                        }`}
                        style={!interrogated ? {
                          background: 'linear-gradient(135deg,#0066cc,#1e90ff)',
                          boxShadow: '0 0 20px rgba(30,144,255,0.3)',
                        } : {
                          background: 'rgba(30,144,255,0.08)',
                        }}
                      >
                        <span className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-500"/>
                        <MessageSquare className="w-4 h-4 relative z-10" />
                        <span className="relative z-10">{interrogated ? '继续审问' : '开始审问'}</span>
                        {interrogated && <Zap className="w-3.5 h-3.5 text-blue-400 relative z-10"/>}
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* 时间线 */}
          {activeTab === 'timeline' && (
            <motion.div key="timeline" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-16 }}
              className="max-w-3xl mx-auto"
            >
              <div className="space-y-4">
                {caseData.timeline.map((event, index) => {
                  const sig = (SIGNIFICANCE_CONFIG as any)[event.significance] ?? SIGNIFICANCE_CONFIG.low;
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay: index*0.06 }}
                      className={`relative flex gap-4 p-4 rounded-xl border transition-all ${sig.bg}`}
                    >
                      {/* 时间 */}
                      <div className="shrink-0 text-center">
                        <div className={`text-lg font-black font-mono ${sig.color}`}>{event.time}</div>
                        <div className={`w-2 h-2 rounded-full mx-auto mt-1 ${sig.dot}`}/>
                      </div>
                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-blue-400/60 text-xs font-mono">{event.location}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${sig.color} bg-dark-900/40`}>{sig.label}</span>
                        </div>
                        <p className="text-white font-medium text-sm leading-relaxed">{event.event}</p>
                        {event.witness && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Users className="w-3 h-3"/> {event.witness}
                          </p>
                        )}
                      </div>
                      {/* 左侧竖线 */}
                      {index < caseData.timeline.length - 1 && (
                        <div className="absolute left-[2.15rem] top-full w-px h-4 bg-blue-500/20"/>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 推理提交弹窗 ── */}
      <AnimatePresence>
        {showSubmit && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 bg-dark-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowSubmit(false)}
          >
            <motion.div
              initial={{ scale:0.92, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.92, opacity:0 }}
              className="w-full max-w-2xl rounded-2xl p-1 relative"
              style={{ background: 'linear-gradient(135deg,#0066cc40,#1e90ff20,#00d4ff10)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass-dark rounded-2xl p-7">
                <div className="flex items-center gap-3 mb-2">
                  <Fingerprint className="w-6 h-6 text-blood-500"/>
                  <h2 className="text-2xl font-black tracking-wide conan-title">提交推理</h2>
                </div>
                <p className="text-gray-400 text-sm mb-5">
                  请详细说明：<span className="text-blue-300">谁是凶手？作案手法？动机？</span>
                </p>
                <textarea
                  value={deduction}
                  onChange={(e) => setDeduction(e.target.value)}
                  placeholder="输入你的完整推理过程..."
                  className="w-full h-48 bg-dark-900 border border-blue-900/40 focus:border-blue-500/50 rounded-xl p-4 text-white text-sm resize-none focus:outline-none leading-relaxed placeholder:text-gray-600 transition"
                />
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => setShowSubmit(false)}
                    className="flex-1 py-3 glass rounded-xl hover:bg-dark-700 transition text-sm font-bold text-gray-400"
                  >取消</button>
                  <motion.button
                    whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
                    onClick={handleSubmitDeduction}
                    disabled={isSubmitting || !deduction.trim()}
                    className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 relative overflow-hidden group"
                    style={{ background:'linear-gradient(135deg,#0066cc,#1e90ff)', boxShadow:'0 0 20px rgba(30,144,255,0.3)' }}
                  >
                    <span className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-500"/>
                    {isSubmitting ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/><span className="relative">分析中…</span></>
                    ) : (
                      <><Send className="w-4 h-4 relative"/><span className="relative">提交推理</span></>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
