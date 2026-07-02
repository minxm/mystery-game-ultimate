'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function scrollWindowToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/** 路由切换时滚到页面顶部（含首页进入游戏页） */
export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    scrollWindowToTop();
  }, [pathname]);

  return null;
}

export { scrollWindowToTop };
