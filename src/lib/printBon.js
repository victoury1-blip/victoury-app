import { esc } from './htmlUtils';

function getShopName() {
  try { return JSON.parse(localStorage.getItem('victoury_shop_config') || '{}').shopName || 'VICTOURY'; }
  catch { return 'VICTOURY'; }
}

/**
 * Ouvre une fenêtre d'impression pour un bon (ramassage ou retour).
 * bon: { id, livreur, status, created_at, colis_count }
 * colis: [{ id, trackingNumber, recipient, phone, city, price, product, status? }]
 * type: 'ramassage' | 'retour'
 */
export function printBon(bon, colis, type = 'ramassage') {
  const title = type === 'retour' ? 'Bon de Retour' : 'Bon de Ramassage';
  const total = colis.reduce((s, c) => s + (Number(c.price) || 0), 0);

  const rows = colis.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(c.trackingNumber || c.id)}</td>
      <td>${esc(c.recipient || '')}</td>
      <td>${esc(c.phone || '')}</td>
      <td>${esc(c.city || '')}</td>
      <td>${esc(c.product || '')}</td>
      <td style="text-align:right">${Number(c.price) || 0} DH</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${title} ${esc(bon.id)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; padding: 24px; color: #111; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
  .shop { font-size: 22px; font-weight: 900; letter-spacing: 1px; }
  .title { font-size: 16px; font-weight: 700; text-align: right; }
  .meta { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 16px; }
  .meta div span { color: #666; font-size: 11px; display: block; }
  .meta div b { font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
  th { background: #f0f0f0; font-size: 11px; text-transform: uppercase; }
  tfoot td { font-weight: 700; }
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; gap: 40px; }
  .sig { flex: 1; text-align: center; }
  .sig .line { border-top: 1px solid #000; margin-top: 60px; padding-top: 6px; font-size: 12px; color: #444; }
  @media print { body { padding: 8px; } }
</style>
</head>
<body>
  <div class="header">
    <div class="shop">${esc(getShopName())}</div>
    <div class="title">${title}<br /><span style="font-size:13px;font-weight:400">${esc(bon.id)}</span></div>
  </div>
  <div class="meta">
    <div><span>Société / Livreur</span><b>${esc(bon.livreur || '-')}</b></div>
    <div><span>Date</span><b>${new Date(bon.created_at).toLocaleString('fr-MA')}</b></div>
    <div><span>Nombre de colis</span><b>${colis.length}</b></div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Tracking / ID</th><th>Client</th><th>Téléphone</th><th>Ville</th><th>Produit</th><th style="text-align:right">Montant</th></tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="6" style="text-align:right">Total</td><td style="text-align:right">${total} DH</td></tr>
    </tfoot>
  </table>
  <div class="signatures">
    <div class="sig"><div class="line">Signature ${esc(getShopName())}</div></div>
    <div class="sig"><div class="line">Signature ${esc(bon.livreur || 'Livreur')}</div></div>
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
