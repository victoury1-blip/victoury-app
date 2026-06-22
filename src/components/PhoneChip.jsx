import { useState } from 'react';
import ContactModal from './ContactModal';

const PHONE_COLOR_DEFAULTS = { livreBg: '#047857', livreText: '#ffffff', knownBg: '#fbbf24', knownText: '#111827' };

export function getPhoneColors() {
  try { return { ...PHONE_COLOR_DEFAULTS, ...JSON.parse(localStorage.getItem('phone_colors') || '{}') }; } catch { return PHONE_COLOR_DEFAULTS; }
}

export function normalizePhone(p) {
  return (p || '').replace(/[\s\-\+]/g, '').replace(/^00212/, '0').replace(/^212/, '0');
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
        {phone}
      </button>
      {open && <ContactModal phone={phone} onClose={() => setOpen(false)} />}
    </>
  );
}
