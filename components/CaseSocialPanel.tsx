'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Heart, Flag, Share2, Send, Loader2, Copy, Check, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import type { CaseData } from '@/lib/types';
import {
  buildShareMessage,
  copyText,
  isWeChatBrowser,
  shareToWeChat,
  systemShare,
} from '@/lib/share-utils';

interface Comment {
  id: string;
  userId: string;
  displayName: string;
  content: string;
  createdAt: string;
}

interface CaseSocialPanelProps {
  caseId: string;
  caseTitle?: string;
  caseData?: CaseData;
}

export default function CaseSocialPanel({ caseId, caseTitle, caseData }: CaseSocialPanelProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [favorited, setFavorited] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [wechatSharing, setWechatSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const displayTitle = caseTitle ?? '神秘案件';

  useEffect(() => {
    fetch(`/api/social?caseId=${encodeURIComponent(caseId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setComments(data.comments ?? []);
          setFavorited(data.favorited ?? false);
        }
      })
      .finally(() => setLoading(false));
  }, [caseId]);

  const postAction = async (action: string, extra: Record<string, string> = {}) => {
    if (!user) {
      alert('请先登录');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, caseId, ...extra }),
      });
      const data = await res.json();
      return data;
    } finally {
      setSubmitting(false);
    }
  };

  const handleComment = async () => {
    if (!newComment.trim()) return;
    const data = await postAction('comment', { content: newComment.trim() });
    if (data?.success) {
      setNewComment('');
      const refreshed = await fetch(`/api/social?caseId=${encodeURIComponent(caseId)}`);
      const json = await refreshed.json();
      if (json.success) setComments(json.comments);
    }
  };

  const handleFavorite = async () => {
    if (!user) {
      alert('请先登录');
      return;
    }
    setFavoriting(true);
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'favorite', caseId }),
      });
      const data = await res.json();
      if (data?.success) setFavorited(data.favorited);
    } finally {
      setFavoriting(false);
    }
  };

  const markCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!user) {
      alert('请先登录后分享');
      return;
    }
    setSharing(true);
    setCopied(false);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, caseData }),
      });
      const data = await res.json();
      if (!data.success || !data.shareUrl) {
        alert(data.error || '分享失败，请稍后重试');
        return;
      }

      setShareUrl(data.shareUrl);
      setShowSharePanel(true);
    } finally {
      setSharing(false);
    }
  };

  const handleWeChatShare = async () => {
    if (!shareUrl) return;
    setWechatSharing(true);
    try {
      const ok = await shareToWeChat(displayTitle, shareUrl);
      if (!ok) {
        alert('复制失败，请手动复制下方链接');
        return;
      }
      markCopied();
      if (isWeChatBrowser()) {
        alert('分享文案已复制！请点击右上角 ··· → 转发给朋友');
      } else {
        alert('已复制分享文案并尝试打开微信，请在聊天窗口长按粘贴发送');
      }
    } finally {
      setWechatSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    const message = buildShareMessage(displayTitle, shareUrl);
    const ok = await copyText(message);
    if (ok) {
      markCopied();
    } else {
      alert('复制失败，请手动选中下方链接复制');
    }
  };

  const handleSystemShare = async () => {
    if (!shareUrl) return;
    const result = await systemShare(shareUrl);
    if (result === 'unavailable') {
      const ok = await copyText(buildShareMessage(displayTitle, shareUrl));
      if (ok) {
        markCopied();
        alert('当前环境不支持系统分享，已复制分享文案');
      }
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    const data = await postAction('report', { reason: reportReason });
    if (data?.success) {
      setShowReport(false);
      setReportReason('');
      alert('举报已提交，感谢反馈');
    }
  };

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-400/30 text-cyan-400 text-sm hover:bg-cyan-400/10 transition disabled:opacity-50"
        >
          {sharing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
          {sharing ? '生成链接中…' : '分享挑战'}
        </button>
        <button
          onClick={handleFavorite}
          disabled={favoriting}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition disabled:opacity-50 ${
            favorited
              ? 'border-pink-400/50 text-pink-400 bg-pink-400/10'
              : 'border-white/10 text-white/60 hover:border-pink-400/30'
          }`}
        >
          {favoriting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
          )}
          {favoriting ? '处理中…' : '收藏'}
        </button>
        <button
          onClick={() => setShowReport(!showReport)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/40 text-sm hover:border-orange-400/30 transition"
        >
          <Flag className="w-4 h-4" /> 举报
        </button>
      </div>

      <AnimatePresence>
        {showSharePanel && shareUrl && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-white/80">选择分享方式</p>
              <button
                type="button"
                onClick={() => setShowSharePanel(false)}
                className="text-white/40 hover:text-white/70 transition"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-cyan-400/70 font-mono break-all leading-relaxed">
              {buildShareMessage(displayTitle, shareUrl)}
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleWeChatShare}
                disabled={wechatSharing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#07c160] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {wechatSharing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8.5 7.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm7 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zM12 2C6.48 2 2 5.58 2 10c0 2.37 1.22 4.47 3.1 5.87L4.5 19.5l3.64-1.82C9.28 18.16 10.6 18.25 12 18.25c5.52 0 10-3.58 10-8.25S17.52 2 12 2z" />
                  </svg>
                )}
                分享到微信
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-400/30 text-cyan-400 text-sm hover:bg-cyan-400/10 transition"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" /> 已复制
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> 复制文案
                  </>
                )}
              </button>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  type="button"
                  onClick={handleSystemShare}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/60 text-sm hover:bg-white/5 transition"
                >
                  <Share2 className="w-4 h-4" /> 更多方式
                </button>
              )}
            </div>

            <p className="text-xs text-white/40 leading-relaxed">
              推荐使用「分享到微信」：会自动复制文案并打开微信，在聊天窗口粘贴即可发送。
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReport && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <input
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="举报原因..."
              className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white"
            />
            <button
              onClick={handleReport}
              className="text-xs text-orange-400 hover:underline"
            >
              提交举报
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-t border-white/5 pt-4">
        <h3 className="text-sm text-white/60 flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4" /> 评论 ({comments.length})
        </h3>

        {user && (
          <div className="flex gap-2 mb-4">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="写下你的推理心得..."
              maxLength={500}
              className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white"
            />
            <button
              onClick={handleComment}
              disabled={submitting || !newComment.trim()}
              className="px-3 py-2 rounded-lg bg-blue-600/80 text-white disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        ) : comments.length === 0 ? (
          <p className="text-xs text-white/30">暂无评论，来做第一个留言的侦探</p>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="text-sm py-2 border-b border-white/5">
                <span className="text-blue-400/80">{c.displayName}</span>
                <span className="text-white/30 text-xs ml-2">
                  {new Date(c.createdAt).toLocaleDateString('zh-CN')}
                </span>
                <p className="text-white/60 mt-0.5">{c.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
