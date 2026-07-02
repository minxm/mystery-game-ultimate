'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

type BackButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  fallbackHref?: string;
};

/** 返回上一页；无历史记录时回退到 fallbackHref（默认首页） */
export default function BackButton({
  fallbackHref = '/',
  onClick,
  ...props
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back();
      } else {
        router.push(fallbackHref);
      }
    },
    [fallbackHref, onClick, router]
  );

  return <button type="button" {...props} onClick={handleClick} />;
}
