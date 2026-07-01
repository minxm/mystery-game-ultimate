'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { pullAndMergeCloudData } from '@/lib/cloud-sync';

interface CloudSyncContextValue {
  syncing: boolean;
  lastSyncedAt: number | null;
  refresh: () => Promise<void>;
}

const CloudSyncContext = createContext<CloudSyncContextValue>({
  syncing: false,
  lastSyncedAt: null,
  refresh: async () => {},
});

export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, isConfigured } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const refresh = async () => {
    if (!user || !isConfigured) return;
    setSyncing(true);
    try {
      const ok = await pullAndMergeCloudData();
      if (ok) setLastSyncedAt(Date.now());
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (loading || !isConfigured || !user) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading, isConfigured]);

  return (
    <CloudSyncContext.Provider value={{ syncing, lastSyncedAt, refresh }}>
      {children}
    </CloudSyncContext.Provider>
  );
}

export function useCloudSync() {
  return useContext(CloudSyncContext);
}
