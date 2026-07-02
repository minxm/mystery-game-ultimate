'use client';

interface ListPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** 列表 / 弹框内分页 */
export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  className = '',
}: ListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  return (
    <div
      className={`flex items-center justify-between px-4 py-3 border-t border-white/[0.06] ${className}`}
    >
      <span className="text-[10px] font-mono text-white/35 tracking-wider">
        第 {page} / {totalPages} 页 · 共 {total} 条
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 rounded-lg border border-cyan-500/20 text-xs text-cyan-400/80 hover:border-cyan-400/40 hover:text-cyan-300 disabled:opacity-30 disabled:pointer-events-none transition"
        >
          上一页
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 rounded-lg border border-cyan-500/20 text-xs text-cyan-400/80 hover:border-cyan-400/40 hover:text-cyan-300 disabled:opacity-30 disabled:pointer-events-none transition"
        >
          下一页
        </button>
      </div>
    </div>
  );
}

export function paginateSlice<T>(items: T[], page: number, pageSize: number): T[] {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export const MODAL_LIST_PAGE_SIZE = 10;
