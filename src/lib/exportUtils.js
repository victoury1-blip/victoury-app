export async function exportToExcel(orders, filename = 'commandes') {
  const XLSX = await import('xlsx');
  const data = orders.map(o => ({
    'ID': o.id,
    'Client': o.recipient?.name || '',
    'Téléphone': o.recipient?.phone || '',
    'Ville': o.recipient?.city || '',
    'Adresse': o.recipient?.address || '',
    'Produit': (o.products || [o.product]).map(p => p?.name || '').filter(Boolean).join(', '),
    'Prix': o.price || 0,
    'Statut': o.status || '',
    'Date ajout': o.dateAdded || '',
    'Livreur': o.recipient?.delivery || '',
    'Note': o.note || '',
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Commandes');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(orders, filename = 'commandes') {
  const html = `<html><head><meta charset="utf-8"><title>${filename}</title>
    <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#1E3A5F;color:white}tr:nth-child(even){background:#f9f9f9}.header{text-align:center;margin-bottom:20px}h1{color:#1E3A5F;font-size:18px}</style>
  </head><body>
    <div class="header"><h1>VICTOURY - ${filename}</h1><p>${new Date().toLocaleDateString('fr-FR')}</p></div>
    <table><thead><tr><th>ID</th><th>Client</th><th>Téléphone</th><th>Ville</th><th>Produit</th><th>Prix</th><th>Statut</th><th>Date</th></tr></thead>
    <tbody>${orders.map(o => `<tr><td>${o.id}</td><td>${o.recipient?.name||''}</td><td>${o.recipient?.phone||''}</td><td>${o.recipient?.city||''}</td><td>${(o.products||[o.product]).map(p=>p?.name||'').filter(Boolean).join(', ')}</td><td>${o.price||0} DH</td><td>${o.status||''}</td><td>${o.dateAdded||''}</td></tr>`).join('')}
    </tbody></table></body></html>`;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.print();
}
