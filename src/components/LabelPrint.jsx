import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function getShopConfig() {
  try { return JSON.parse(localStorage.getItem('victoury_shop_config') || '{}'); } catch { return {}; }
}

function generateQRCodeSVG(text, size = 120) {
  const modules = [];
  const seed = text.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const grid = 21;
  const cellSize = size / grid;

  const addFinder = (ox, oy) => {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++)
        if (y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4))
          modules.push({ x: ox + x, y: oy + y });
  };
  addFinder(0, 0);
  addFinder(grid - 7, 0);
  addFinder(0, grid - 7);

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

function buildLabelHTML(order, config) {
  const shopName = config.shopName || 'VICTOURY';
  const shopPhone = config.shopPhone || '';
  const shopNote = config.labelNote || '';
  const qrData = order.trackingNumber || order.id;
  const prods = order.products?.length ? order.products : [order.product];
  const echange = order.echange ? 'echange\\\\' : '';
  const date = order.dateAdded?.split(' ')[0] || new Date().toLocaleDateString('fr-MA');

  const logoHtml = config.logo
    ? `<img src="${config.logo}" alt="" style="height:80px;object-fit:contain" />`
    : `<span style="font-weight:900;font-size:22px;letter-spacing:1px">${shopName}</span>`;

  const noteHtml = (order.noteLivraison || order.note || shopNote)
    ? `<div style="padding:4px 12px;border-bottom:1px solid #000"><span style="color:#dc2626;font-weight:700;font-size:13px">Note: </span><span style="font-size:12px;color:#333">${order.noteLivraison || order.note || ''}</span></div>`
    : '';

  const shopNoteHtml = shopNote
    ? `<div style="padding:6px 12px;border-bottom:1px solid #000;font-size:11px;color:#333;line-height:1.4">${shopNote}</div>`
    : '';

  const prodsHtml = prods.filter(Boolean).map(p =>
    `<div style="font-size:13px;color:#333">- ${p.name || ''}${p.color ? ' ' + p.color : ''}${p.size ? ' - ' + p.size : ''} (x${p.qty || 1})</div>`
  ).join('');

  return `<div class="label-page" style="width:378px;border:2px solid #000;font-family:'Poppins',sans-serif;padding:0;background:#fff">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:2px solid #000">
      <div style="display:flex;align-items:center;gap:8px">${logoHtml}</div>
      ${shopPhone ? `<div style="text-align:right;line-height:1.3"><span style="font-size:11px;font-weight:bold;color:#333">Service après-vente</span><br><span style="font-size:13px;color:#333">${shopPhone}</span></div>` : ''}
    </div>
    ${noteHtml}
    <div style="display:flex;border-bottom:1px solid #000">
      <div style="flex:1;padding:10px 12px;font-size:13px;line-height:1.7">
        <div><strong>Code</strong> <span style="margin-left:40px">:${order.trackingNumber || order.id}</span></div>
        <div><strong>Destinataire</strong> <span style="margin-left:8px">:${echange}${order.recipient?.name || ''}</span></div>
        <div><strong>Téléphone</strong> <span style="margin-left:18px">:${order.recipient?.phone || ''}</span></div>
        <div><strong>Adresse</strong> <span style="margin-left:30px">:${order.recipient?.address || ''}</span></div>
        <div style="margin-top:6px"><strong>Ville</strong> <span style="margin-left:48px">:${order.recipient?.city || ''}</span></div>
        <div><strong>Date d'envoi</strong> <span style="margin-left:4px">:${date}</span></div>
      </div>
      <div style="width:120px;display:flex;align-items:center;justify-content:center;border-left:1px solid #000;padding:8px">
        ${generateQRCodeSVG(qrData, 100)}
      </div>
    </div>
    ${shopNoteHtml}
    <div style="padding:10px 12px;display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-weight:900;font-size:14px;margin-bottom:4px">PRODUITS :</div>
        ${prodsHtml}
      </div>
      <div style="font-weight:900;font-size:28px;white-space:nowrap">Prix: ${Number(order.price || 0).toLocaleString('fr-MA')}</div>
    </div>
    <div style="border-top:1px solid #000;padding:6px 12px;text-align:center;font-size:11px;color:#555;font-style:italic;line-height:1.4">
      Merci pour votre confiance ! Nous sommes ravis de vous compter parmi nos clients.
    </div>
  </div>`;
}

export async function openLabelPage(orders) {
  let config = getShopConfig();
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'victoury_shop_config').single();
    if (data?.value && Object.keys(data.value).length > 0) {
      config = data.value;
      localStorage.setItem('victoury_shop_config', JSON.stringify(config));
    }
  } catch {}

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
  document.body.appendChild(container);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(link);
  await new Promise(r => setTimeout(r, 500));

  const labelEls = [];
  for (const order of orders) {
    const div = document.createElement('div');
    div.innerHTML = buildLabelHTML(order, config);
    div.style.cssText = 'margin-bottom:10px;';
    container.appendChild(div);
    labelEls.push(div.firstElementChild);
  }

  await new Promise(r => setTimeout(r, 300));

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 100] });

  for (let i = 0; i < labelEls.length; i++) {
    if (i > 0) pdf.addPage([100, 100]);
    const canvas = await html2canvas(labelEls[i], { scale: 2, useCORS: true, backgroundColor: '#fff' });
    const imgData = canvas.toDataURL('image/png');
    const ratio = canvas.height / canvas.width;
    const w = 96;
    const h = w * ratio;
    pdf.addImage(imgData, 'PNG', 2, 2, w, Math.min(h, 96));
  }

  document.body.removeChild(container);
  link.remove();

  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  pdf.save(`etiquettes_commandes_${ts}.pdf`);
}
