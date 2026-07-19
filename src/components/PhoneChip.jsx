import { useState } from 'react';
import ContactModal from './ContactModal';

const PHONE_COLOR_DEFAULTS = { livreBg: '#047857', livreText: '#ffffff', knownBg: '#fbbf24', knownText: '#111827' };

export function getPhoneColors() {
  try { return { ...PHONE_COLOR_DEFAULTS, ...JSON.parse(localStorage.getItem('phone_colors') || '{}') }; } catch { return PHONE_COLOR_DEFAULTS; }
}

export function normalizePhone(p) {
  let s = (p || '').replace(/[\s\-\.\+]/g, '').replace(/^(00212|212)/, '0');
  // Google Sheets stocke le téléphone comme un nombre et supprime le 0 initial
  // (ex: 0709015213 → 709015213). On le rétablit pour les numéros marocains.
  if (/^[5-7]\d{8}$/.test(s)) s = '0' + s;
  return s;
}

export default function PhoneChip({ phone, allOrders }) {
  const [open, setOpen] = useState(false);
  if (!phone) return null;
  const np = normalizePhone(phone);
  const history = allOrders ? allOrders.filter(o => normalizePhone(o.recipient?.phone) === np) : [];
  const hasLivre = history.some(o => o.status === 'livre');
  const isKnown = history.length > 1;
  const pc = getPhoneColors();
  const style = !isKnown ? {} : hasLivre ? { backgroundColor: pc.livreBg, color: pc.livreText } : { backgroundColor: pc.knownBg, color: pc.knownText };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mt-1 text-sm font-bold hover:underline active:opacity-70 ${isKnown ? 'px-2 py-0.5 rounded' : 'text-gray-900'}`}
        style={style}
      >
        {np}
      </button>
      {open && <ContactModal phone={np} onClose={() => setOpen(false)} />}
    </>
  );
}
