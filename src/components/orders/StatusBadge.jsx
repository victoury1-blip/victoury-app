import React from 'react';
import { Clock } from 'lucide-react';
import { useStatuses } from '../../contexts/StatusContext';

export function isLight(hex) {
  if (!hex || hex.length < 7) return true;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

export default function StatusBadge({ status, reportDate }) {
  const { getLive } = useStatuses();
  const live = getLive(status);
  const color = live.color || '#6B7280';
  const light = isLight(color);
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="px-2.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
        style={{ backgroundColor: color, color: light ? '#111' : '#fff' }}
      >
        {live.label || status}
      </span>
      {reportDate && status === 'reporter' && (
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <Clock size={10} /> {reportDate}
        </span>
      )}
    </div>
  );
}
