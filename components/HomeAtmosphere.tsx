'use client';

import { motion } from 'framer-motion';

/** 首页纯 CSS 悬疑氛围层 — 无位图，柯南风电光蓝 + 暗角探照灯 */
export default function HomeAtmosphere() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#030a14]">
      {/* 基底渐变 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(30,144,255,0.18) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 85% 90%, rgba(0,102,204,0.12) 0%, transparent 50%), radial-gradient(ellipse 40% 30% at 10% 80%, rgba(230,57,70,0.06) 0%, transparent 45%), #040d1a',
        }}
      />

      {/* 旋转探照灯 */}
      <div className="absolute top-[-40%] left-1/2 -translate-x-1/2 w-[140vmax] h-[140vmax] home-spotlight-spin opacity-30">
        <div
          className="w-full h-full"
          style={{
            background:
              'conic-gradient(from 200deg at 50% 50%, transparent 0deg, rgba(30,144,255,0.35) 25deg, transparent 55deg, rgba(0,212,255,0.15) 90deg, transparent 120deg)',
          }}
        />
      </div>

      {/* 透视网格地面 */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[45vh] home-grid-floor opacity-[0.14]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(30,144,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(30,144,255,0.35) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          transform: 'perspective(500px) rotateX(68deg)',
          transformOrigin: 'bottom center',
          maskImage: 'linear-gradient(to top, black 20%, transparent 85%)',
        }}
      />

      {/* 城市剪影 */}
      <svg
        className="absolute bottom-0 left-0 w-full h-32 md:h-40 opacity-[0.22]"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          fill="rgba(30,144,255,0.35)"
          d="M0,120 L0,80 L40,75 L60,50 L90,70 L120,40 L150,65 L180,30 L220,55 L260,25 L300,50 L340,35 L380,60 L420,20 L460,45 L500,15 L540,40 L580,25 L620,55 L660,30 L700,50 L740,20 L780,45 L820,30 L860,55 L900,25 L940,50 L980,35 L1020,60 L1060,40 L1100,55 L1140,30 L1200,50 L1200,120 Z"
        />
      </svg>

      {/* 暗角 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 45%, transparent 30%, rgba(3,10,20,0.75) 100%)',
        }}
      />

      <div className="absolute inset-0 mystery-scanlines opacity-[0.035]" />

      {/* 顶部红线点缀（柯南领结暗示） */}
      <div className="absolute top-[18%] left-[12%] w-16 h-px bg-gradient-to-r from-transparent via-danger-500/60 to-transparent home-beam-drift" />
      <div className="absolute top-[22%] right-[15%] w-24 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent home-beam-drift-reverse" />
    </div>
  );
}

/** SVG 放大镜 — 透明底、电光蓝光晕 */
export function HeroMagnifierIcon() {
  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 16, delay: 0.15 }}
      className="relative w-28 h-28 md:w-36 md:h-36 shrink-0"
    >
      <div
        className="absolute inset-0 rounded-full blur-3xl animate-pulse-slow"
        style={{ background: 'radial-gradient(circle, rgba(30,144,255,0.5) 0%, transparent 68%)' }}
      />
      <motion.div
        className="absolute inset-[6%] rounded-full border border-blue-400/25"
        animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ boxShadow: '0 0 40px rgba(30,144,255,0.35), inset 0 0 24px rgba(0,212,255,0.12)' }}
      />
      <svg
        viewBox="0 0 120 120"
        className="relative z-10 w-full h-full drop-shadow-[0_0_22px_rgba(30,144,255,0.65)]"
        aria-hidden
      >
        <defs>
          <linearGradient id="lensGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#1e90ff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0066cc" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="handleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1a3560" />
            <stop offset="50%" stopColor="#2a5080" />
            <stop offset="100%" stopColor="#0f2545" />
          </linearGradient>
        </defs>
        {/* 镜框 */}
        <circle cx="48" cy="48" r="34" fill="rgba(10,24,48,0.35)" stroke="url(#lensGrad)" strokeWidth="3.5" />
        <circle cx="48" cy="48" r="26" fill="none" stroke="rgba(0,212,255,0.25)" strokeWidth="1" />
        {/* 镜片高光 */}
        <path
          d="M 30 38 Q 48 28 62 42"
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* 手柄 */}
        <rect x="72" y="68" width="14" height="36" rx="4" fill="url(#handleGrad)" transform="rotate(45 79 86)" />
        <rect x="72" y="68" width="14" height="36" rx="4" fill="none" stroke="rgba(30,144,255,0.4)" strokeWidth="1" transform="rotate(45 79 86)" />
      </svg>
    </motion.div>
  );
}
