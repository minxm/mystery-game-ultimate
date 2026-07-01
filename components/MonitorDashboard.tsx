'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Activity,
  ChevronLeft,
  Loader2,
  Zap,
  Clock,
  Database,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import ParticleBackground from '@/components/ParticleBackground';
import OnlinePresence from '@/components/OnlinePresence';
import { refreshMonitorStats, type MonitorStatsPayload } from '@/app/monitor/actions';

interface MonitorDashboardProps {
  initialStats: MonitorStatsPayload;
  accessDenied?: boolean;
}

export default function MonitorDashboard({ initialStats, accessDenied }: MonitorDashboardProps) {
  const [stats, setStats] = useState<MonitorStatsPayload>(initialStats);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(() => new Date());

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const result = await refreshMonitorStats();
      if (result.success && result.stats) {
        setStats(result.stats);
        setLastUpdate(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accessDenied) return;
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats, accessDenied]);

  const statCards = [
    { label: '排队生成', value: stats.pendingJobs, icon: Activity, color: 'text-orange-400' },
    { label: '近1h AI 调用', value: stats.aiCallsLastHour, icon: Zap, color: 'text-cyan-400' },
    { label: '平均耗时', value: `${stats.avgLatencyMs}ms`, icon: Clock, color: 'text-blue-400' },
    {
      label: '近1h Token',
      value: stats.tokensLastHour.toLocaleString(),
      icon: Database,
      color: 'text-purple-400',
    },
  ];

  if (accessDenied) {
    return (
      <div className="min-h-screen relative page-shell flex items-center justify-center">
        <ParticleBackground />
        <div className="relative z-10 text-center px-4">
          <p className="text-white/70 mb-4">无权访问监控页</p>
          <p className="text-xs text-white/40 mb-6">
            生产环境请配置 ADMIN_USER_IDS 并使用管理员账号登录
          </p>
          <Link href="/" className="text-blue-400 hover:underline text-sm">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative page-shell">
      <ParticleBackground />
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-blue-400/70 hover:text-blue-400">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <Activity className="w-7 h-7 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">实时监控</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchStats}
              disabled={loading}
              className="p-2 rounded-lg border border-white/10 hover:border-blue-400/30 transition disabled:opacity-50"
              title="刷新"
            >
              <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <p className="text-xs text-white/30 mb-4 font-mono">
          最后更新：{lastUpdate.toLocaleTimeString('zh-CN')}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <OnlinePresence variant="card" />
          {statCards.map((card) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-4"
            >
              <card.icon className={`w-5 h-5 ${card.color} mb-2`} />
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="text-xs text-white/40 mt-1">{card.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-panel p-5">
            <h2 className="text-sm font-medium text-white/70 mb-4 flex items-center gap-2">
              <Database className="w-4 h-4" /> 案件库存
            </h2>
            {stats.inventory.length === 0 ? (
              <p className="text-white/40 text-sm">暂无库存数据（需执行数据库迁移）</p>
            ) : (
              <div className="space-y-2">
                {stats.inventory.map((inv) => (
                  <div
                    key={inv.difficulty}
                    className="flex justify-between text-sm py-2 border-b border-white/5"
                  >
                    <span className="text-white/60 capitalize">{inv.difficulty}</span>
                    <span className="text-cyan-400">
                      可用 {inv.available} / 已领 {inv.claimed}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel p-5">
            <h2 className="text-sm font-medium text-white/70 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" /> 近期 AI 错误
            </h2>
            {stats.recentErrors.length === 0 ? (
              <p className="text-white/40 text-sm">暂无错误记录</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {stats.recentErrors.map((err, i) => (
                  <div key={i} className="text-xs py-2 border-b border-white/5">
                    <span className="text-orange-400">{err.operation}</span>
                    <span className="text-white/30 mx-1">·</span>
                    <span className="text-white/50">{err.model}</span>
                    <p className="text-white/40 mt-1 truncate">{err.errorMessage}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
