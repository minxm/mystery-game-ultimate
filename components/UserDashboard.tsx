'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft, CheckCircle2, Radar, FileSearch, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { saveCaseData, storage } from '@/lib/utils';
import type { CaseData, GameProgress, CaseEvaluation } from '@/lib/types';

type CaseCarouselItem = {
  caseData: CaseData;
  index: number;
  done?: boolean;
  inProgress?: boolean;
  score?: number;
};

type RawCaseItem = {
  caseData: CaseData;
  done?: boolean;
  score?: number;
  progress?: GameProgress | null;
  evaluation?: CaseEvaluation | null;
};

interface HomeDashboardContextValue {
  recommended: CaseCarouselItem[];
  played: CaseCarouselItem[];
  recommendedLoading: boolean;
  playedLoading: boolean;
}

const HomeDashboardContext = createContext<HomeDashboardContextValue>({
  recommended: [],
  played: [],
  recommendedLoading: false,
  playedLoading: false,
});

function resolvePlayedCaseStatus(item: RawCaseItem) {
  const caseId = item.caseData.id;
  const localProgress = storage.getProgress(caseId);
  const localEval = storage.getEvaluation(caseId);
  const progress = item.progress ?? localProgress;

  const done =
    item.done === true ||
    item.evaluation != null ||
    localEval != null ||
    progress?.score != null ||
    progress?.endTime != null;

  const score =
    item.evaluation?.score ??
    item.score ??
    localEval?.score ??
    progress?.score;

  const inProgress = !done && progress != null;

  return { done, score, inProgress, progress };
}

function resolveCaseContinueHref(caseId: string, done?: boolean): string {
  if (done) return `/archive/${caseId}`;
  const progress = storage.getProgress(caseId);
  if (!progress) return `/case/${caseId}`;
  const investigating =
    progress.discoveredEvidence.length > 0 ||
    progress.interrogatedSuspects.length > 0;
  return investigating ? `/investigate/${caseId}` : `/case/${caseId}`;
}

function mapCaseItems(raw: RawCaseItem[]): CaseCarouselItem[] {
  return raw.map((item, index) => {
    const { done, score, inProgress } = resolvePlayedCaseStatus(item);
    return {
      caseData: item.caseData,
      index,
      done,
      score,
      inProgress,
    };
  });
}

async function cacheCasesLocally(items: RawCaseItem[]) {
  for (const item of items) {
    if (!item.caseData.suspects?.length) continue;
    try {
      await saveCaseData(item.caseData);
      if (item.progress) storage.saveProgress(item.progress);
    } catch {
      // 本地缓存失败不影响列表展示
    }
  }
}

const recommendedInflight = new Map<string, Promise<RawCaseItem[]>>();
const playedInflight = new Map<string, Promise<RawCaseItem[]>>();

async function fetchRecommendedCases(): Promise<RawCaseItem[]> {
  const key = 'default';
  const existing = recommendedInflight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<RawCaseItem[]> => {
    const res = await fetch('/api/cases/recommended');
    const json = await res.json();
    return res.ok && json.success && Array.isArray(json.items)
      ? (json.items as RawCaseItem[])
      : [];
  })().finally(() => {
    recommendedInflight.delete(key);
  });

  recommendedInflight.set(key, promise);
  return promise;
}

async function fetchPlayedCases(userId: string): Promise<RawCaseItem[]> {
  const existing = playedInflight.get(userId);
  if (existing) return existing;

  const promise = (async (): Promise<RawCaseItem[]> => {
    const res = await authenticatedFetch('/api/cases/played');
    const json = await res.json();
    return res.ok && json.success && Array.isArray(json.items)
      ? (json.items as RawCaseItem[])
      : [];
  })().finally(() => {
    playedInflight.delete(userId);
  });

  playedInflight.set(userId, promise);
  return promise;
}

export function HomeDashboardProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isConfigured, loading: authLoading } = useAuth();
  const [recommended, setRecommended] = useState<CaseCarouselItem[]>([]);
  const [played, setPlayed] = useState<CaseCarouselItem[]>([]);
  const [recommendedLoading, setRecommendedLoading] = useState(true);
  const [playedLoading, setPlayedLoading] = useState(true);

  useEffect(() => {
    if (authLoading || pathname !== '/') return;

    let cancelled = false;

    (async () => {
      if (!isConfigured) {
        setRecommended([]);
        setPlayed([]);
        setRecommendedLoading(false);
        setPlayedLoading(false);
        return;
      }

      setRecommendedLoading(true);
      setPlayedLoading(!!user);

      void (async () => {
        try {
          const raw = await fetchRecommendedCases();
          if (cancelled) return;
          setRecommended(mapCaseItems(raw));
          void cacheCasesLocally(raw);
        } catch {
          if (!cancelled) setRecommended([]);
        } finally {
          if (!cancelled) setRecommendedLoading(false);
        }
      })();

      if (user) {
        void (async () => {
          try {
            const raw = await fetchPlayedCases(user.id);
            if (cancelled) return;
            setPlayed(mapCaseItems(raw));
            void cacheCasesLocally(raw);
          } catch {
            if (!cancelled) setPlayed([]);
          } finally {
            if (!cancelled) setPlayedLoading(false);
          }
        })();
      } else {
        setPlayed([]);
        setPlayedLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isConfigured, user?.id, authLoading, pathname]);

  return (
    <HomeDashboardContext.Provider
      value={{ recommended, played, recommendedLoading, playedLoading }}
    >
      {children}
    </HomeDashboardContext.Provider>
  );
}

function useHomeDashboard() {
  return useContext(HomeDashboardContext);
}

const DIFFICULTY_META: Record<
  CaseData['difficulty'],
  { label: string; color: string; border: string; bg: string; bar: string }
> = {
  easy: {
    label: '简单',
    color: 'text-cyan-400',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/10',
    bar: 'from-cyan-500/80 via-cyan-400/40 to-transparent',
  },
  medium: {
    label: '中等',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
    bar: 'from-blue-500/80 via-blue-400/40 to-transparent',
  },
  hard: {
    label: '困难',
    color: 'text-orange-400',
    border: 'border-orange-500/30',
    bg: 'bg-orange-500/10',
    bar: 'from-orange-500/80 via-orange-400/40 to-transparent',
  },
  expert: {
    label: '专家',
    color: 'text-danger-500',
    border: 'border-danger-500/30',
    bg: 'bg-danger-600/10',
    bar: 'from-danger-500/80 via-danger-500/40 to-transparent',
  },
};

function CaseCard({
  caseData,
  index,
  variant,
  done,
  inProgress,
  score,
}: {
  caseData: CaseData;
  index: number;
  variant: 'recommended' | 'played';
  done?: boolean;
  inProgress?: boolean;
  score?: number;
}) {
  const diff = DIFFICULTY_META[caseData.difficulty] ?? DIFFICULTY_META.medium;
  const caseNo = caseData.id.slice(-6).toUpperCase();
  const href = resolveCaseContinueHref(caseData.id, done);

  return (
    <Link href={href} className="group recent-case-card h-full">
      {caseData.sceneImageUrl ? (
        <div className="relative h-28 md:h-32 shrink-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={caseData.sceneImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#040d1a] via-[#040d1a]/60 to-transparent" />
          <div className={`absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r ${diff.bar}`} />
        </div>
      ) : (
        <div className={`h-1 shrink-0 bg-gradient-to-r ${diff.bar}`} />
      )}

      <div className="flex flex-col flex-1 p-4 min-h-0">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="font-mono text-[10px] text-blue-400/45 tracking-wider">
            {String(index + 1).padStart(2, '0')} · #{caseNo}
          </span>
          <span
            className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold border ${diff.border} ${diff.bg} ${diff.color}`}
          >
            {diff.label}
          </span>
        </div>

        <h3 className="text-sm md:text-[15px] font-bold text-white/95 leading-snug line-clamp-2 min-h-[2.5rem] md:min-h-[2.75rem] group-hover:text-blue-100 transition-colors">
          {caseData.title}
        </h3>

        <p className="mt-2 text-[10px] text-white/35 font-mono line-clamp-1 tracking-wide">
          {caseData.setting || '未知地点'}
        </p>

        <div className="mt-auto pt-4 flex items-end justify-between gap-2 border-t border-white/[0.06]">
          {done ? (
            <>
              <span className="inline-flex items-center gap-1 text-[10px] text-green-400/75 font-mono">
                <CheckCircle2 className="w-3 h-3" />
                查看档案
              </span>
              <div className="text-right">
                <span className="text-xl font-black text-green-300 tabular-nums leading-none">
                  {score}
                </span>
                <span className="block text-[9px] text-white/25 font-mono mt-0.5">SCORE</span>
              </div>
            </>
          ) : inProgress ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-blue-300/80 font-mono">
                <Radar className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                调查中
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-400/60 group-hover:text-blue-300 transition-colors">
                继续游戏
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </>
          ) : variant === 'recommended' ? (
            <>
              <span className="inline-flex items-center gap-1 text-[10px] text-violet-300/80 font-mono">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                精选
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-400/60 group-hover:text-blue-300 transition-colors">
                立即挑战
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-blue-300/80 font-mono">
                <Radar className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                调查中
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-400/60 group-hover:text-blue-300 transition-colors">
                继续游戏
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

const CAROUSEL_VISIBLE = 3;

function CasesCarousel({
  items,
  variant,
}: {
  items: CaseCarouselItem[];
  variant: 'recommended' | 'played';
}) {
  const [slide, setSlide] = useState(0);
  const maxSlide = Math.max(0, items.length - CAROUSEL_VISIBLE);

  const go = (dir: -1 | 1) => {
    setSlide((s) => Math.min(maxSlide, Math.max(0, s + dir)));
  };

  return (
    <div className="relative">
      {items.length > CAROUSEL_VISIBLE && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={slide === 0}
            aria-label="上一组案件"
            className="absolute left-0 top-1/2 z-10 w-9 h-9 rounded-full border border-blue-500/25 bg-[#040d1a]/95 text-blue-300/80 flex items-center justify-center transition-all hover:border-blue-400/50 hover:text-blue-200 hover:shadow-[0_0_16px_rgba(30,144,255,0.25)] disabled:opacity-25 disabled:pointer-events-none -translate-y-1/2 -translate-x-[calc(100%+0.75rem)]"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => go(1)}
            disabled={slide >= maxSlide}
            aria-label="下一组案件"
            className="absolute right-0 top-1/2 z-10 w-9 h-9 rounded-full border border-blue-500/25 bg-[#040d1a]/95 text-blue-300/80 flex items-center justify-center transition-all hover:border-blue-400/50 hover:text-blue-200 hover:shadow-[0_0_16px_rgba(30,144,255,0.25)] disabled:opacity-25 disabled:pointer-events-none -translate-y-1/2 translate-x-[calc(100%+0.75rem)]"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      <div className="overflow-hidden">
        <div
          className="flex gap-4 transition-transform duration-500 ease-out"
          style={{
            transform: `translateX(calc(-${slide} * ((100% - 2rem) / ${CAROUSEL_VISIBLE} + 1rem)))`,
          }}
        >
          {items.map(({ caseData, index, done, inProgress, score }) => (
            <div key={caseData.id} className="shrink-0 w-[calc((100%-2rem)/3)]">
              <CaseCard
                caseData={caseData}
                index={index}
                variant={variant}
                done={done}
                inProgress={inProgress}
                score={score}
              />
            </div>
          ))}
        </div>
      </div>

      {items.length > CAROUSEL_VISIBLE && (
        <div className="flex justify-center gap-1.5 mt-4">
          {Array.from({ length: maxSlide + 1 }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`第 ${i + 1} 页`}
              onClick={() => setSlide(i)}
              className={`h-1 rounded-full transition-all ${
                i === slide ? 'w-5 bg-blue-400' : 'w-1.5 bg-white/20 hover:bg-white/35'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CasesSection({
  label,
  title,
  titleAccent,
  items,
  variant,
  delay = 0.45,
  loading = false,
}: {
  label: string;
  title: string;
  titleAccent: string;
  items: CaseCarouselItem[];
  variant: 'recommended' | 'played';
  delay?: number;
  loading?: boolean;
}) {
  if (loading || items.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="relative w-full mt-14 md:mt-20"
    >
      <div className="md:hidden flex items-center justify-center gap-3 mb-5">
        <div className="h-px w-10 bg-gradient-to-r from-transparent to-blue-500/40" />
        <div className="text-center">
          <p className="text-[10px] font-mono tracking-[0.35em] text-blue-400/50 mb-1">{label}</p>
          <h2 className="text-sm font-black tracking-[0.25em] text-white/90">
            {title}<span className="text-blue-400">{titleAccent}</span>
          </h2>
        </div>
        <div className="h-px w-10 bg-gradient-to-l from-transparent to-blue-500/40" />
      </div>

      <div className="hidden md:flex items-center justify-between gap-4 mb-6">
        <div className="min-w-0 text-left">
          <p className="text-[10px] font-mono tracking-[0.3em] text-blue-400/50 mb-1">{label}</p>
          <h2 className="text-lg font-black tracking-[0.18em] text-white/90">
            {title}<span className="text-blue-400">{titleAccent}</span>
          </h2>
        </div>
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border border-blue-500/20 bg-blue-500/5 shadow-[0_0_16px_rgba(30,144,255,0.1)]"
          aria-hidden
        >
          <FileSearch className="w-5 h-5 text-blue-400/70" />
        </div>
      </div>

      <div className="recent-cases-mobile-track md:hidden -mx-4 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 pl-4 pr-4 scroll-pl-4 scroll-pr-4">
        {items.map(({ caseData, index, done, inProgress, score }) => (
          <div key={caseData.id} className="snap-start shrink-0 w-[72vw] max-w-[268px]">
            <CaseCard
              caseData={caseData}
              index={index}
              variant={variant}
              done={done}
              inProgress={inProgress}
              score={score}
            />
          </div>
        ))}
      </div>
      <p className="md:hidden text-center text-[10px] text-white/25 font-mono mt-2 tracking-wider">
        左右滑动查看更多
      </p>

      <div className="hidden md:block overflow-visible">
        <CasesCarousel items={items} variant={variant} />
      </div>
    </motion.section>
  );
}

export function RecommendedCasesPanel() {
  const { recommended, recommendedLoading } = useHomeDashboard();

  return (
    <CasesSection
      label="FEATURED"
      title="推荐"
      titleAccent="案件"
      items={recommended}
      variant="recommended"
      delay={0.45}
      loading={recommendedLoading}
    />
  );
}

export function PlayedCasesPanel() {
  const { played, playedLoading } = useHomeDashboard();

  return (
    <CasesSection
      label="YOUR CASES"
      title="最近"
      titleAccent="游玩"
      items={played}
      variant="played"
      delay={0.55}
      loading={playedLoading}
    />
  );
}

/** @deprecated 使用 RecommendedCasesPanel + PlayedCasesPanel */
export function RecentCasesPanel() {
  return (
    <HomeDashboardProvider>
      <RecommendedCasesPanel />
      <PlayedCasesPanel />
    </HomeDashboardProvider>
  );
}
