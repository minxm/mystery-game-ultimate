'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogIn, LogOut, User as UserIcon, X } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function AuthButton() {
  const {
    user,
    loading,
    isConfigured,
    signInWithEmail,
    signInWithOAuth,
    signOut,
    authCallbackError,
    clearAuthCallbackError,
  } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailExpanded, setEmailExpanded] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (authCallbackError) {
      setShowModal(true);
      setEmailExpanded(true);
      setMessage(authCallbackError);
      clearAuthCallbackError();
    }
  }, [authCallbackError, clearAuthCallbackError]);

  const closeModal = () => {
    setShowModal(false);
    setEmail('');
    setMessage('');
    setSubmitting(false);
    setEmailExpanded(false);
  };

  const handleEmailLogin = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    setMessage('');
    const { error } = await signInWithEmail(email.trim());
    setSubmitting(false);
    setMessage(error ? `登录失败：${error}` : '请查收邮件中的登录链接');
  };

  // 服务端与客户端首屏保持一致，避免 hydration 不匹配
  if (!mounted || loading) {
    return (
      <div className="h-8 w-8 shrink-0 rounded-lg border border-white/10 animate-pulse" />
    );
  }

  if (!isConfigured) return null;

  const btnBase =
    'flex items-center justify-center gap-1.5 h-8 min-w-8 px-2 sm:px-2.5 rounded-lg text-[11px] font-medium transition-colors shrink-0';

  if (user) {
    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      '侦探';
    const initial = [...name.trim()][0]?.toUpperCase() ?? '?';

    return (
      <div
        className="flex h-8 shrink-0 items-stretch overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03]"
        title={user.email ?? name}
      >
        <div className="flex min-w-0 items-center gap-1.5 px-1.5 sm:px-2">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-500/15 text-[10px] font-semibold text-blue-300/90 ring-1 ring-blue-500/20"
            aria-hidden
          >
            {initial}
          </span>
          <span className="hidden sm:inline max-w-[56px] truncate text-[11px] font-medium text-white/70">
            {name}
          </span>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="flex items-center justify-center gap-1 border-l border-white/[0.06] px-2 sm:px-2.5 text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/90"
          title="退出登录"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap text-[11px] font-medium">退出</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={`${btnBase} text-blue-300/90 hover:bg-blue-500/10 border border-blue-500/25`}
        title="登录"
      >
        <LogIn className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline whitespace-nowrap">登录</span>
      </button>

      {showModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={closeModal}
          >
            <div
              className="relative my-auto w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a1628] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeModal}
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

                <div className="space-y-2.5">
                  {!emailExpanded ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEmailExpanded(true);
                        setMessage('');
                      }}
                      className="w-full py-2.5 rounded-xl text-sm font-medium border border-white/10 hover:bg-white/5 transition-colors"
                    >
                      使用邮箱登录
                    </button>
                  ) : (
                    <>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="邮箱 Magic Link"
                        disabled={submitting}
                        autoFocus
                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
                      />
                      {email.trim() && (
                        <button
                          type="button"
                          onClick={handleEmailLogin}
                          disabled={submitting}
                          className="w-full py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
                        >
                          {submitting ? '发送中…' : '发送登录链接'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {message && (
                <p className={`mt-3 text-xs text-center ${message.startsWith('登录失败') ? 'text-red-300/90' : 'text-blue-300/80'}`}>
                  {message}
                </p>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
