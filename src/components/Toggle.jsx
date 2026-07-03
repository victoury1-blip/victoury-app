import React from 'react';
import { Loader2 } from 'lucide-react';

/** Interrupteur on/off. Vert quand activé (validé), gris sinon. */
export default function Toggle({ checked, loading, onChange }) {
  return (
    <button
      onClick={() => !loading && onChange(!checked)}
      disabled={loading}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        loading ? 'bg-green-300 cursor-wait' : checked ? 'bg-green-500' : 'bg-gray-300'
      }`}
    >
      {loading
        ? <Loader2 size={11} className="absolute left-1/2 -translate-x-1/2 text-white animate-spin" />
        : <span
            className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
            style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
          />}
    </button>
  );
}
