import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PER_PAGE_OPTIONS = [10, 20, 50, 100, 200];

export default function Pagination({ total, page, perPage, onPageChange, onPerPageChange }) {
  const [open, setOpen] = useState(false);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safeP = Math.min(page, totalPages);

  return (
    <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-2 bg-white border-t border-gray-200 text-sm text-gray-600">
      <span className="text-xs text-gray-500">
        Page {safeP} sur {totalPages} ({total} au total)
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(safeP - 1)}
          disabled={safeP <= 1}
          className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
        </button>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={safeP}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            if (v >= 1 && v <= totalPages) onPageChange(v);
          }}
          className="w-12 text-center border border-gray-200 rounded py-1 text-sm"
        />
        <button
          onClick={() => onPageChange(safeP + 1)}
          disabled={safeP >= totalPages}
          className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </button>
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-xs font-medium"
          >
            {perPage} par page
          </button>
          {open && (
            <div className="absolute bottom-full right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[130px]">
              {PER_PAGE_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => { onPerPageChange(n); onPageChange(1); setOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${n === perPage ? 'font-bold text-blue-600' : 'text-gray-700'}`}
                >
                  {n} par page
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function paginate(items, page, perPage) {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}
