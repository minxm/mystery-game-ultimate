'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClientSafe } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';

const PRESENCE_CHANNEL = 'online-detectives';

const OnlineCountContext = createContext<number | null>(null);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = createClientSafe();
    if (!supabase) return;

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: crypto.randomUUID() } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <OnlineCountContext.Provider value={count}>{children}</OnlineCountContext.Provider>
  );
}

export function useOnlineCount() {
  return useContext(OnlineCountContext);
}
