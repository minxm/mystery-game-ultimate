'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { History, Trophy, Activity, Heart, Home } from 'lucide-react';
import AuthButton from './AuthButton';
import { useAuth } from './AuthProvider';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { inflight } from '@/lib/inflight';

const NAV_ITEMS = [
  { href: '/', label: '首页', icon: Home, exact: true },
  { href: '/history', label: '历史', icon: History },
  { href: '/favorites', label: '收藏', icon: Heart },
  { href: '/leaderboard', label: '排行', icon: Trophy },
  { href: '/monitor', label: '监控', icon: Activity, adminOnly: true },
] as const;

function isNavActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClass(active: boolean) {
  return [
    'flex items-center justify-center gap-1.5 h-8 min-w-8 px-2 sm:px-2.5 rounded-lg',
    'text-[11px] font-medium transition-colors shrink-0',
    active
      ? 'text-blue-300 bg-blue-500/10 border border-blue-500/25'
      : 'text-white/45 hover:text-white/90 hover:bg-white/[0.06] border border-transparent',
  ].join(' ');
}

export default function AppHeader() {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    void inflight(`admin-status:${user?.id ?? 'guest'}`, () =>
      authenticatedFetch('/api/admin/status').then((res) => res.json())
    )
      .then((data) => {
        if (!cancelled) setIsAdmin(Boolean(data.isAdmin));
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => !('adminOnly' in item && item.adminOnly) || isAdmin),
    [isAdmin]
  );

  return (
    <header className="relative z-20 border-b border-white/[0.06] bg-[#040d1a]/70 backdrop-blur-md">
      <div className="container mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
        <Link
          href="/"
          prefetch={false}
          className="shrink-0 font-mono text-[10px] tracking-[0.2em] sm:tracking-[0.35em] text-blue-400/50 uppercase hover:text-blue-400/70 transition-colors"
        >
          <span className="sm:hidden">D·OS</span>
          <span className="hidden sm:inline">Detective OS</span>
        </Link>

        <nav
          className="flex items-center flex-nowrap shrink-0 gap-0.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-0.5 sm:gap-1 sm:p-1"
          aria-label="主导航"
        >
          {navItems.map((item) => {
            const { href, label, icon: Icon } = item;
            const exact = 'exact' in item && item.exact;
            const active = isNavActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className={navLinkClass(active)}
                title={label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">{label}</span>
              </Link>
            );
          })}

          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
