import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useStatuses } from '../contexts/StatusContext';

/**
 * Dark floating status picker — same look as the reference image.
 * Usage:
 *   <StatusDropdown
 *     value={currentStatus}          // string value key
 *     onChange={(val) => ...}        // called with new value
 *     onClose={() => ...}            // called to dismiss
 *     anchorRef={buttonRef}          // optional — positions relative to anchor
 *   />
 */
export default function StatusDropdown({ value, onChange, onClose, anchorRef, context }) {
  const { statuses } = useStatuses();
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  /* Position below anchor if provided */
  useEffect(() => {
    if (anchorRef?.current && ref.current) {
      const r = anchorRef.current.getBoundingClientRect();
      const dh = ref.current.offsetHeight;
      const dw = ref.current.offsetWidth;
      let top = r.bottom + 4;
      let left = r.left;
      if (top + dh > window.innerHeight) top = r.top - dh - 4;
      if (left + dw > window.innerWidth) left = window.innerWidth - dw - 8;
      setPos({ top, left });
    }
  }, [anchorRef]);

  /* Close on outside click */
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  /* Close on Escape */
  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose?.(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const sorted = [...statuses]
    .filter(s => context === 'colis' ? s.showInColis !== false : s.showInCommandes !== false)
    .sort((a, b) => a.order - b.order);

  return (
    <div
      ref={ref}
      className="fixed z-[9999] bg-[#2d2d3a] border border-[#3f3f52] rounded-lg shadow-2xl overflow-hidden"
      style={anchorRef ? { top: pos.top, left: pos.left, minWidth: 220, maxHeight: 340, overflowY: 'auto' } : {
        position: 'relative', minWidth: 220, maxHeight: 340, overflowY: 'auto',
      }}
    >
      {sorted.map((s) => {
        const isActive = s.value === value;
        return (
          <button
            key={s.value}
            onClick={() => { onChange(s.value); onClose?.(); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors
              ${isActive ? 'bg-[#3a3a50] text-white' : 'text-gray-200 hover:bg-[#38384a]'}`}
          >
            <span className="w-4 flex-shrink-0">
              {isActive && <Check size={13} className="text-white" />}
            </span>
            <span>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
