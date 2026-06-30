'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { createClientSafe } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';

const PRESENCE_CHANNEL = 'online-detectives';

export default function OnlinePresence() {
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

  if (count === null) return null;

  return (
    <div
      className="flex items-center gap-1.5 text-[10px] font-mono text-green-400/70"
      title="当前在线侦探"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <Users className="w-3 h-3" />
      <span>{count} 在线</span>
    </div>
  );
}
