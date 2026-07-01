'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Heart, Flag, Share2, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

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
}

export default function CaseSocialPanel({ caseId, caseTitle }: CaseSocialPanelProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [favorited, setFavorited] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');

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
    const data = await postAction('favorite');
    if (data?.success) setFavorited(data.favorited);
  };

  const handleShare = async () => {
    if (!user) {
      alert('请先登录后分享');
      return;
    }
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId }),
    });
    const data = await res.json();
    if (data.success && data.shareUrl) {
      setShareUrl(data.shareUrl);
      const text = `来挑战这个推理案件「${caseTitle ?? '神秘案件'}」！`;
      if (navigator.share) {
        await navigator.share({ title: text, url: data.shareUrl }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(data.shareUrl);
        alert('分享链接已复制，适合发小红书挑战同款案件');
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-400/30 text-cyan-400 text-sm hover:bg-cyan-400/10 transition"
        >
          <Share2 className="w-4 h-4" /> 分享挑战
        </button>
        <button
          onClick={handleFavorite}
          disabled={submitting}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition ${
            favorited
              ? 'border-pink-400/50 text-pink-400 bg-pink-400/10'
              : 'border-white/10 text-white/60 hover:border-pink-400/30'
          }`}
        >
          <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} /> 收藏
        </button>
        <button
          onClick={() => setShowReport(!showReport)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/40 text-sm hover:border-orange-400/30 transition"
        >
          <Flag className="w-4 h-4" /> 举报
        </button>
      </div>

      {shareUrl && (
        <p className="text-xs text-cyan-400/70 font-mono break-all">{shareUrl}</p>
      )}

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
