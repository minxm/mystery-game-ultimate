'use client';

/** 全站轻量悬疑氛围背景（非首页 hero 位图） */
export default function MysteryBackdrop() {
  return (
    <div className="fixed inset-0 -z-20 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% -20%, rgba(30,144,255,0.12) 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(0,102,204,0.08) 0%, transparent 50%), #040d1a',
        }}
      />
      <div className="absolute inset-0 mystery-scanlines opacity-[0.04]" />
    </div>
  );
}
