'use client';

import { motion } from 'framer-motion';

export type DetectiveStatAccent = 'cyan' | 'blue' | 'amber' | 'violet' | 'rose';

export interface DetectiveStatItem {
  label: string;
  value: string | number;
  accent?: DetectiveStatAccent;
  code?: string;
}

const ACCENT: Record<
  DetectiveStatAccent,
  { value: string; glow: string; bar: string; index: string }
> = {
  cyan: {
    value: 'text-cyan-300',
    glow: 'drop-shadow-[0_0_10px_rgba(34,211,238,0.45)]',
    bar: 'from-cyan-400/70 via-cyan-300/30',
    index: 'text-cyan-400/40',
  },
  blue: {
    value: 'text-blue-300',
    glow: 'drop-shadow-[0_0_10px_rgba(96,165,250,0.45)]',
    bar: 'from-blue-400/70 via-blue-300/30',
    index: 'text-blue-400/40',
  },
  amber: {
    value: 'text-amber-300',
    glow: 'drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]',
    bar: 'from-amber-400/70 via-amber-300/30',
    index: 'text-amber-400/40',
  },
  violet: {
    value: 'text-violet-300',
    glow: 'drop-shadow-[0_0_10px_rgba(167,139,250,0.4)]',
    bar: 'from-violet-400/70 via-violet-300/30',
    index: 'text-violet-400/40',
  },
  rose: {
    value: 'text-rose-300',
    glow: 'drop-shadow-[0_0_10px_rgba(251,113,133,0.4)]',
    bar: 'from-rose-400/70 via-rose-300/30',
    index: 'text-rose-400/40',
  },
};

interface DetectiveStatStripProps {
  items: DetectiveStatItem[];
  className?: string;
  columns?: 2 | 3 | 4;
}

function StatCell({
  item,
  index,
  accentKey,
}: {
  item: DetectiveStatItem;
  index: number;
  accentKey: DetectiveStatAccent;
}) {
  const theme = ACCENT[accentKey];
  const code = item.code ?? String(index + 1).padStart(2, '0');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      className="group relative flex flex-col items-center justify-center px-2 py-2.5 sm:py-3 min-h-[52px]"
    >
      <span className={`text-[8px] font-mono tracking-[0.35em] mb-1 ${theme.index}`}>
        {code}
      </span>

      <span
        className={`detective-stat-cell__value text-lg sm:text-xl font-black tabular-nums leading-none ${theme.value} ${theme.glow}`}
        style={{ animationDelay: `${index * 0.5}s` }}
      >
        {item.value}
      </span>

      <span className="mt-1 text-[9px] font-mono text-white/38 tracking-[0.22em] uppercase">
        {item.label}
      </span>

      <div
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-0 group-hover:w-10 h-px bg-gradient-to-r from-transparent ${theme.bar} to-transparent transition-all duration-500`}
      />
    </motion.div>
  );
}

export default function DetectiveStatStrip({
  items,
  className = '',
  columns,
}: DetectiveStatStripProps) {
  const colCount = columns ?? (items.length <= 3 ? 3 : 4);
  const gridClass =
    colCount === 4
      ? 'grid grid-cols-2 sm:grid-cols-4'
      : colCount === 3
        ? 'grid grid-cols-3'
        : 'grid grid-cols-2';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className={`detective-stats-hud mb-6 ${className}`}
    >
      <div className="detective-stats-hud__inner">
        <div className="detective-stats-hud__scan" />
        <span className="detective-stats-hud__corner detective-stats-hud__corner--tl" />
        <span className="detective-stats-hud__corner detective-stats-hud__corner--br" />

        <div className="detective-stats-hud__badge">
          <span className="detective-stats-hud__dot" />
          <span className="text-[8px] font-mono text-white/28 tracking-[0.35em] uppercase">
            Detective File
          </span>
        </div>

        <div
          className={`relative z-[1] pt-5 ${gridClass} divide-x divide-white/[0.06]`}
        >
          {items.map((item, i) => (
            <StatCell
              key={`${item.label}-${i}`}
              item={item}
              index={i}
              accentKey={item.accent ?? 'cyan'}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
