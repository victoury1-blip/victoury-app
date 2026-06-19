import React, { useRef, useEffect } from 'react';
import { X, Printer } from 'lucide-react';

function getShopConfig() {
  try { return JSON.parse(localStorage.getItem('victoury_shop_config') || '{}'); } catch { return {}; }
}

function generateQRCodeSVG(text, size = 120) {
  // Simple QR-like data matrix using SVG pattern
  const modules = [];
  const seed = text.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const grid = 21;
  const cellSize = size / grid;

  // Fixed patterns (position markers)
  const addFinder = (ox, oy) => {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++)
        if (y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4))
          modules.push({ x: ox + x, y: oy + y });
  };
  addFinder(0, 0);
  addFinder(grid - 7, 0);
  addFinder(0, grid - 7);

  // Data area
  let hash = seed;
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const inFinder = (x < 8 && y < 8) || (x >= grid - 8 && y < 8) || (x < 8 && y >= grid - 8);
      if (inFinder) continue;
      hash = (hash * 1103515245 + 12345) & 0x7fffffff;
      if (hash % 3 !== 0) modules.push({ x, y });
    }
  }

  const rects = modules.map(m =>
    `<rect x="${m.x * cellSize}" y="${m.y * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="white"/>
    ${rects}
  </svg>`;
}

function LabelContent({ order, config }) {
  const shopName = config.shopName || 'VICTOURY';
  const shopPhone = config.shopPhone || '';
  const shopNote = config.labelNote || '';
  const qrData = order.trackingNumber || order.id;
  const prods = order.products?.length ? order.products : [order.product];
  const prodText = prods.filter(Boolean).map(p =>
    `- ${p.name || ''}${p.color ? ' ' + p.color : ''}${p.size ? ' - ' + p.size : ''} (x${p.qty || 1})`
  ).join('\n');

  const echange = order.echange ? 'echange\\' : '';
  const date = order.dateAdded?.split(' ')[0] || new Date().toLocaleDateString('fr-MA');

  return (
    <div className="label-page" style={{ width: '100mm', minHeight: '140mm', border: '2px solid #000', fontFamily: 'Arial, sans-serif', padding: 0, margin: '0 auto', background: '#fff', pageBreakAfter: 'always' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '2px solid #000' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {config.logo && <img src={config.logo} alt="" style={{ height: '28px', objectFit: 'contain' }} />}
          <span style={{ fontWeight: 900, fontSize: '22px', letterSpacing: '1px' }}>{shopName}</span>
        </div>
        {shopPhone && <span style={{ fontSize: '13px', color: '#333' }}>Sav: {shopPhone}</span>}
      </div>

      {/* Note */}
      {(order.noteLivraison || order.note || shopNote) && (
        <div style={{ padding: '4px 12px', borderBottom: '1px solid #000' }}>
          <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '13px' }}>Note: </span>
          <span style={{ fontSize: '12px', color: '#333' }}>{order.noteLivraison || order.note || ''}</span>
        </div>
      )}

      {/* Main info + QR */}
      <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
        <div style={{ flex: 1, padding: '10px 12px', fontSize: '13px', lineHeight: '1.7' }}>
          <div><strong>Code</strong> <span style={{ marginLeft: '40px' }}>:{order.trackingNumber || order.id}</span></div>
          <div><strong>Destinataire</strong> <span style={{ marginLeft: '8px' }}>:{echange}{order.recipient?.name || ''}</span></div>
          <div><strong>Téléphone</strong> <span style={{ marginLeft: '18px' }}>:{order.recipient?.phone || ''}</span></div>
          <div><strong>Adresse</strong> <span style={{ marginLeft: '30px' }}>:{order.recipient?.address || ''}</span></div>
          <div style={{ marginTop: '6px' }}><strong>Ville</strong> <span style={{ marginLeft: '48px' }}>:{order.recipient?.city || ''}</span></div>
          <div><strong>Date d'envoi</strong> <span style={{ marginLeft: '4px' }}>:{date}</span></div>
        </div>
        <div style={{ width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #000', padding: '8px' }}>
          <div dangerouslySetInnerHTML={{ __html: generateQRCodeSVG(qrData, 100) }} />
        </div>
      </div>

      {/* Shop note */}
      {shopNote && (
        <div style={{ padding: '6px 12px', borderBottom: '1px solid #000', fontSize: '11px', color: '#333', lineHeight: '1.4' }}>
          {shopNote}
        </div>
      )}

      {/* Products + Price */}
      <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '14px', marginBottom: '4px' }}>PRODUITS :</div>
          {prods.filter(Boolean).map((p, i) => (
            <div key={i} style={{ fontSize: '13px', color: '#333' }}>
              - {p.name || ''}{p.color ? ' ' + p.color : ''}{p.size ? ' - ' + p.size : ''} (x{p.qty || 1})
            </div>
          ))}
        </div>
        <div style={{ fontWeight: 900, fontSize: '28px', whiteSpace: 'nowrap' }}>
          Prix: {Number(order.price || 0).toLocaleString('fr-MA')}
        </div>
      </div>
    </div>
  );
}

export default function LabelPrint({ orders, onClose }) {
  const config = getShopConfig();
  const printRef = useRef(null);

  function handlePrint() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Popup bloqué. Autorisez les popups.'); return; }
    printWindow.document.write(`
      <html><head><title>Étiquettes</title>
      <style>
        @page { size: 100mm auto; margin: 0; }
        body { margin: 0; padding: 0; }
        .label-page { page-break-after: always; }
        .label-page:last-child { page-break-after: avoid; }
      </style>
      </head><body>${printRef.current.innerHTML}</body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">Étiquettes ({orders.length})</h2>
            <p className="text-xs text-gray-400">Aperçu avant impression</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
              <Printer size={14} /> Imprimer
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={16} className="text-gray-400" /></button>
          </div>
        </div>
        {/* Preview */}
        <div className="flex-1 overflow-auto p-6 bg-gray-100">
          <div ref={printRef} className="space-y-6">
            {orders.map(o => <LabelContent key={o.id} order={o} config={config} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
