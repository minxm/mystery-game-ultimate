'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClientSafe } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { useAuth } from '@/components/AuthProvider';

const PRESENCE_CHANNEL = 'online-detectives';

export interface OnlinePresenceUser {
  name: string;
  count: number;
}

interface OnlinePresenceContextValue {
  count: number | null;
  users: OnlinePresenceUser[];
}

const OnlinePresenceContext = createContext<OnlinePresenceContextValue>({
  count: null,
  users: [],
});

function resolvePresenceName(user: User | null): string {
  if (!user) return '游客';
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    '侦探'
  );
}

function parsePresenceUsers(state: Record<string, unknown[]>): OnlinePresenceUser[] {
  const byUserId = new Map<string, OnlinePresenceUser>();
  let guestCount = 0;

  for (const presences of Object.values(state)) {
    if (!Array.isArray(presences)) continue;
    for (const raw of presences) {
      const presence = raw as { user_id?: string | null; name?: string };
      const name = presence.name?.trim() || '游客';
      if (presence.user_id) {
        byUserId.set(presence.user_id, { name, count: 1 });
      } else {
        guestCount++;
      }
    }
  }

  const users = [...byUserId.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  if (guestCount > 0) {
    users.push({ name: '游客', count: guestCount });
  }
  return users;
}

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [users, setUsers] = useState<OnlinePresenceUser[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = createClientSafe();
    if (!supabase) return;

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: crypto.randomUUID() } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        const onlineUsers = parsePresenceUsers(state);
        setUsers(onlineUsers);
        setCount(onlineUsers.reduce((sum, item) => sum + item.count, 0));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user?.id ?? null,
            name: resolvePresenceName(user),
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <OnlinePresenceContext.Provider value={{ count, users }}>
      {children}
    </OnlinePresenceContext.Provider>
  );
}

export function useOnlinePresence() {
  return useContext(OnlinePresenceContext);
}

/** @deprecated 使用 useOnlinePresence */
export function useOnlineCount() {
  return useContext(OnlinePresenceContext).count;
}
