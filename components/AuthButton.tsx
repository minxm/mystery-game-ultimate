'use client';

import { useState } from 'react';
import { LogIn, LogOut, User as UserIcon, X } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function AuthButton() {
  const { user, loading, isConfigured, signInWithEmail, signInWithOAuth, signOut } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isConfigured) return null;

  const handleEmailLogin = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    setMessage('');
    const { error } = await signInWithEmail(email.trim());
    setSubmitting(false);
    setMessage(error ? `登录失败：${error}` : '请查收邮件中的登录链接');
  };

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full border border-white/10 animate-pulse" />
    );
  }

  if (user) {
    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      '侦探';

    return (
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline text-xs text-white/50 max-w-[100px] truncate">
          {name}
        </span>
        <button
          type="button"
          onClick={() => signOut()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors"
          title="退出登录"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">退出</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-blue-500/30 text-blue-300/80 hover:bg-blue-500/10 transition-colors"
      >
        <LogIn className="w-3.5 h-3.5" />
        登录
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a1628] p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-5">
              <UserIcon className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white">侦探登录</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              登录后可同步进度、参与排行榜
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => signInWithOAuth('github')}
                className="w-full py-2.5 rounded-xl text-sm font-medium border border-white/10 hover:bg-white/5 transition-colors"
              >
                使用 GitHub 登录
              </button>
              <button
                type="button"
                onClick={() => signInWithOAuth('google')}
                className="w-full py-2.5 rounded-xl text-sm font-medium border border-white/10 hover:bg-white/5 transition-colors"
              >
                使用 Google 登录
              </button>

              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] text-white/30">或</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="邮箱 Magic Link"
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
              />
              <button
                type="button"
                onClick={handleEmailLogin}
                disabled={submitting || !email.trim()}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {submitting ? '发送中…' : '发送登录链接'}
              </button>
            </div>

            {message && (
              <p className="mt-3 text-xs text-center text-blue-300/80">{message}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
