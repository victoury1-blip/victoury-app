import React, { useState, useEffect, useCallback } from 'react';
import {
  Store, Settings, Search, ChevronDown, ChevronRight, RefreshCw,
  Download, Loader2, AlertCircle, CheckCircle2, Check, Package, ShoppingCart,
  Send,
} from 'lucide-react';
import {
  getChicConfig, saveChicConfig, fetchChicOrders, fetchChicProducts,
  fetchChicCounts, fetchChicProductDetails, createChicOrder, stripHtml,
  discoverChicApi, diagnoseChicProduct,
} from '../lib/chicAffiliate';
import { loadProducts, saveProducts } from '../data/products';

/* ── Status badge ── */
function StatusBadge({ raw }) {
  const text = stripHtml(raw).trim();
  const lower = text.toLowerCase();
  let color = 'bg-gray-100 text-gray-700';
  if (lower.includes('livré') || lower.includes('delivered')) color = 'bg-green-100 text-green-700';
  else if (lower.includes('confirmé') || lower.includes('confirmed')) color = 'bg-blue-100 text-blue-700';
  else if (lower.includes('annulé') || lower.includes('cancel')) color = 'bg-red-100 text-red-700';
  else if (lower.includes('expédié') || lower.includes('shipped') || lower.includes('en cours')) color = 'bg-yellow-100 text-yellow-700';
  else if (lower.includes('retour') || lower.includes('return')) color = 'bg-orange-100 text-orange-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${color}`}>{text || '—'}</span>;
}

/* ── Config Panel ── */
function ConfigPanel({ onTest }) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(() => getChicConfig() || { xsrfToken: '', sessionCookie: '', apiKey: '' });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [apiResults, setApiResults] = useState(null);
  const [apiTesting, setApiTesting] = useState(false);
  const [diagId, setDiagId] = useState('');
  const [diagResult, setDiagResult] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);

  async function runDiag() {
    if (!diagId.trim()) return;
    save(config);
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const d = await diagnoseChicProduct(diagId.trim());
      setDiagResult(d);
    } catch (e) {
      setDiagResult({ error: e.message });
    } finally {
      setDiagLoading(false);
    }
  }

  async function testApiKey() {
    save(config);
    setApiTesting(true);
    setApiResults(null);
    try {
      const results = await discoverChicApi();
      setApiResults(results);
    } catch (e) {
      setApiResults([{ path: '—', status: 0, sample: e.message }]);
    } finally {
      setApiTesting(false);
    }
  }

  function save(c) {
    setConfig(c);
    saveChicConfig(c);
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      save(config);
      const data = await fetchChicCounts();
      setTestResult({ ok: true, msg: `Connexion réussie — ${JSON.stringify(data)}` });
      onTest?.(true);
    } catch (e) {
      setTestResult({ ok: false, msg: e.message });
      onTest?.(false);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition rounded-xl"
      >
        <Settings size={16} className="text-gray-400" />
        <span>Configuration Chic Affiliate</span>
        {open ? <ChevronDown size={14} className="ml-auto" /> : <ChevronRight size={14} className="ml-auto" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            Ouvrez chic-affiliate.com &rarr; F12 &rarr; Application &rarr; Cookies &rarr; copiez XSRF-TOKEN et laravel_session
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">XSRF-TOKEN</label>
            <input
              type="text"
              value={config.xsrfToken}
              onChange={e => save({ ...config, xsrfToken: e.target.value })}
              placeholder="Collez le XSRF-TOKEN ici"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Laravel Session</label>
            <input
              type="text"
              value={config.sessionCookie}
              onChange={e => save({ ...config, sessionCookie: e.target.value })}
              placeholder="Collez le laravel_session ici"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Clé API (profil Chic → «&nbsp;Clé API&nbsp;», commence par CHIC_)</label>
            <input
              type="text"
              value={config.apiKey || ''}
              onChange={e => save({ ...config, apiKey: e.target.value.trim() })}
              placeholder="CHIC_xxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={testConnection}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Tester la connexion
            </button>
            <button
              onClick={testApiKey}
              disabled={apiTesting || !(config.apiKey || '').trim()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            >
              {apiTesting ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Tester la Clé API
            </button>
          </div>
          {apiResults && (
            <div className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-2 space-y-1 max-h-64 overflow-y-auto font-mono">
              {apiResults.map(r => (
                <div key={r.path} className={r.status >= 200 && r.status < 300 ? 'text-green-700 font-bold' : r.status === 401 || r.status === 403 ? 'text-orange-600' : 'text-gray-400'}>
                  [{r.status}] {r.path} — {r.sample}
                </div>
              ))}
              <p className="text-gray-500 pt-1 font-sans">Vert = endpoint fonctionnel · Orange = existe mais refuse la clé · Gris = introuvable</p>
            </div>
          )}

          {/* Diagnostic produit : voir ce que le parseur lit (tailles/couleurs) */}
          <div className="border-t border-gray-100 pt-3">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Diagnostic produit (ID Chic, ex : 203)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={diagId}
                onChange={e => setDiagId(e.target.value)}
                placeholder="203"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button
                onClick={runDiag}
                disabled={diagLoading || !diagId.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
              >
                {diagLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Diagnostiquer
              </button>
            </div>
            {diagResult && (
              <pre className="mt-2 text-[11px] bg-gray-900 text-green-300 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-72 overflow-y-auto">
{JSON.stringify(diagResult, null, 2)}
              </pre>
            )}
          </div>
          {testResult && (
            <div className={`text-xs p-2 rounded-lg ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {testResult.ok ? <CheckCircle2 size={12} className="inline mr-1" /> : <AlertCircle size={12} className="inline mr-1" />}
              {testResult.msg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Products Tab ── */
function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [importedIds, setImportedIds] = useState(() => {
    try {
      const prods = loadProducts();
      return new Set(prods.filter(p => p.source === 'chic-affiliate').map(p => p.chicId || p.name?.toLowerCase()));
    } catch { return new Set(); }
  });
  const [importedNames, setImportedNames] = useState(() => {
    try {
      const prods = loadProducts();
      return new Set(prods.filter(p => p.source === 'chic-affiliate').map(p => p.name?.toLowerCase()).filter(Boolean));
    } catch { return new Set(); }
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChicProducts();
      const chicList = data.data || [];
      setProducts(chicList);
      setTotal(data.recordsTotal || 0);
      if (data.html && chicList.length === 0) {
        setError('Produits non détectés — vérifiez la connexion');
      }
      if (chicList.length > 0) {
        const stored = loadProducts();
        let changed = false;
        const updated = stored.map(p => {
          if (p.source === 'chic-affiliate' && !p.chicId && p.name) {
            const norm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
            const match = chicList.find(c => norm(c.name) === norm(p.name))
              || chicList.find(c => norm(c.name).includes(norm(p.name)) || norm(p.name).includes(norm(c.name)));
            if (match?.chicId) {
              changed = true;
              return { ...p, chicId: match.chicId, ref: `CHIC-${match.chicId}` };
            }
          }
          return p;
        });
        if (changed) saveProducts(updated);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const [importing, setImporting] = useState(null);

  async function importProduct(p) {
    try {
      const existing = loadProducts();
      const already = existing.find(x =>
        (p.chicId && x.chicId === p.chicId) ||
        (p.name && x.source === 'chic-affiliate' && x.name?.toLowerCase() === p.name.toLowerCase())
      );
      if (already) {
        if (!importingAllRef.current) alert('Produit déjà importé');
        return;
      }
      setImporting(p.chicId || p.name);

      let details = { sizes: [], colors: [], images: [], description: '' };
      if (p.chicId) {
        try {
          details = await fetchChicProductDetails(p.chicId);
        } catch {}
      }

      const sale = parseFloat((p.salePrice || '0').toString().replace(/[^\d.]/g, ''));
      const purchase = parseFloat((p.resellerPrice || '0').toString().replace(/[^\d.]/g, ''));

      const sizes = details.sizes.length > 0 ? details.sizes : ['S', 'M', 'L', 'XL'];
      const variations = sizes.map(t => ({ taille: t, stock: 10, prix: sale, compareAt: sale, ajust: 0 }));

      const allImages = details.images.length > 0 ? details.images : (p.image ? [p.image] : []);

      const newProd = {
        id: p.chicId ? `CHIC-${p.chicId}` : `CHIC-${Date.now()}`,
        ref: p.chicId ? `CHIC-${p.chicId}` : `CHIC-${Date.now()}`,
        chicId: p.chicId,
        name: p.name || '',
        image: allImages[0] || p.image || null,
        images: allImages,
        colors: details.colors,
        description: details.description,
        statut: 'Active',
        boutique: 'Chic Affiliate',
        shopifyId: '',
        prix: sale,
        compareAt: sale,
        etiquette: '',
        source: 'chic-affiliate',
        purchasePrice: purchase,
        stock_quantity: 10,
        variations,
      };
      const updated = [newProd, ...existing];
      saveProducts(updated);
      if (p.chicId) setImportedIds(prev => new Set([...prev, p.chicId]));
      if (p.name) setImportedNames(prev => new Set([...prev, p.name.toLowerCase()]));
      if (!importingAllRef.current) alert(`✅ Produit importé avec ${allImages.length} images, ${details.colors.length} couleurs, ${sizes.length} tailles !`);
    } catch (e) {
      alert('Erreur: ' + e.message);
    } finally {
      setImporting(null);
    }
  }

  const [importingAll, setImportingAll] = useState(false);
  const importingAllRef = React.useRef(false);
  const [importProgress, setImportProgress] = useState('');

  async function importAll() {
    const notImported = filtered.filter(p => !isImported(p));
    if (notImported.length === 0) { alert('Tous les produits sont déjà importés !'); return; }
    if (!window.confirm(`Importer ${notImported.length} produits ?`)) return;

    setImportingAll(true);
    importingAllRef.current = true;
    let success = 0, fail = 0;
    for (let i = 0; i < notImported.length; i++) {
      const p = notImported[i];
      setImportProgress(`${i + 1}/${notImported.length}: ${p.name || '...'}`);
      try {
        await importProduct(p);
        success++;
      } catch {
        fail++;
      }
    }
    setImportingAll(false);
    importingAllRef.current = false;
    setImportProgress('');
    alert(`✅ ${success} produits importés${fail ? `, ${fail} erreurs` : ''} !`);
  }

  const filtered = products.filter(p =>
    !search || (p.name || '').toLowerCase().includes(search.toLowerCase())
  );

  function isImported(p) {
    if (p.chicId && importedIds.has(p.chicId)) return true;
    if (p.name && importedNames.has(p.name.toLowerCase())) return true;
    return false;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const notImportedCount = filtered.filter(p => !isImported(p)).length;

  return (
    <div className="space-y-4">
      {/* Search + Import All */}
      <div className="flex gap-2">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>
      {notImportedCount > 0 && (
        <button
          onClick={importAll}
          disabled={importingAll}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition whitespace-nowrap disabled:opacity-50"
        >
          {importingAll ? <><Loader2 size={14} className="animate-spin" /> {importProgress}</> : <><Download size={14} /> Importer Tout ({notImportedCount})</>}
        </button>
      )}
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg"><AlertCircle size={14} className="inline mr-1" />{error}</div>}

      {loading ? (
        <div className="flex flex-col gap-2 py-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 w-full bg-gray-200 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2">Image</th>
                  <th className="px-3 py-2">Nom</th>
                  <th className="px-3 py-2">Prix Vente</th>
                  <th className="px-3 py-2">Prix Revendeur</th>
                  <th className="px-3 py-2">Bénéfice</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const sale = parseFloat((p.salePrice || p.sale_price || '0').toString().replace(/[^\d.]/g, ''));
                  const purchase = parseFloat((p.resellerPrice || p.purchase_price || '0').toString().replace(/[^\d.]/g, ''));
                  const profit = sale - purchase;
                  return (
                    <tr key={p.id || i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">
                        {p.image ? <img src={p.image} alt={p.name} referrerPolicy="no-referrer" className="w-12 h-12 object-cover rounded-lg" onError={e => { e.target.onerror = null; e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }} /> : null}
                        <div className="w-12 h-12 bg-gray-100 rounded-lg items-center justify-center" style={{ display: p.image ? 'none' : 'flex' }}><Package size={16} className="text-gray-400" /></div>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800">{p.name || '—'}</td>
                      <td className="px-3 py-2">{sale.toFixed(2)} Dhs</td>
                      <td className="px-3 py-2">{purchase.toFixed(2)} Dhs</td>
                      <td className="px-3 py-2 text-green-600 font-medium">{profit.toFixed(2)} Dhs</td>
                      <td className="px-3 py-2">
                        {isImported(p) ? (
                          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-lg font-medium">
                            <Check size={12} /> Importé
                          </span>
                        ) : (
                          <button
                            onClick={() => importProduct(p)}
                            disabled={importing === (p.chicId || p.name)}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                          >
                            {importing === (p.chicId || p.name) ? <><Loader2 size={12} className="animate-spin" /> Chargement...</> : <><Download size={12} /> Importer</>}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Aucun produit</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((p, i) => {
              const sale = parseFloat((p.salePrice || p.sale_price || '0').toString().replace(/[^\d.]/g, ''));
              const purchase = parseFloat((p.resellerPrice || p.purchase_price || '0').toString().replace(/[^\d.]/g, ''));
              const profit = sale - purchase;
              return (
                <div key={p.id || i} className="bg-white border border-gray-200 rounded-lg p-3 flex gap-3">
                  {p.image ? <img src={p.image} alt={p.name} referrerPolicy="no-referrer" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" onError={e => { e.target.onerror = null; e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }} /> : null}
                  <div className="w-16 h-16 bg-gray-100 rounded-lg items-center justify-center flex-shrink-0" style={{ display: p.image ? 'none' : 'flex' }}><Package size={20} className="text-gray-400" /></div>
                  <div className="flex-1 space-y-1">
                    <div className="font-medium text-gray-800 text-sm">{p.name || '—'}</div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Vente: {sale.toFixed(2)} Dhs</span>
                      <span>Achat: {purchase.toFixed(2)} Dhs</span>
                      <span className="text-green-600 font-medium">+{profit.toFixed(2)}</span>
                    </div>
                    {isImported(p) ? (
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-lg font-medium w-fit">
                        <Check size={12} /> Importé
                      </span>
                    ) : (
                      <button
                        onClick={() => importProduct(p)}
                        disabled={importing === (p.chicId || p.name)}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {importing === (p.chicId || p.name) ? <><Loader2 size={12} className="animate-spin" /> Chargement...</> : <><Download size={12} /> Importer</>}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!filtered.length && <p className="text-center py-8 text-gray-400 text-sm">Aucun produit</p>}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500">{total} produits au total</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Préc.</button>
                <span className="text-xs text-gray-600 px-2">{page + 1}/{totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Suiv.</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Orders Tab ── */
function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(async (start = 0) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChicOrders(startDate, endDate, start, PAGE_SIZE);
      setOrders(data.data || []);
      setTotal(data.recordsTotal || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { load(page * PAGE_SIZE); }, [page, load]);

  function importOrder(o) {
    try {
      const existing = JSON.parse(localStorage.getItem('victoury_products') || '[]');
      const productName = o.product?.name || 'Produit Chic';
      const newOrder = {
        id: `CHIC-${o.id}`,
        recipient: {
          name: o.Recipient || '',
          phone: o.Recipient_phone || '',
          city: o.ville || '',
          address: '',
          delivery: null,
        },
        product: {
          name: productName,
          size: o.size || '',
          color: '',
          qty: o.quantity || 1,
          stock: 0,
        },
        price: parseFloat(stripHtml(o.sale_price || '0')),
        status: 'nouveau',
        note: o.comment || '',
        dateAdded: new Date(o.created_at).toLocaleString('fr-MA'),
        dateUpdated: new Date().toLocaleString('fr-MA'),
        validated: false,
        source: 'chic-affiliate',
      };
      // Dispatch to parent app via custom event
      window.dispatchEvent(new CustomEvent('chic-import-order', { detail: newOrder }));
      alert(`Commande #${o.id} importée`);
    } catch (e) {
      alert('Erreur: ' + e.message);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Date filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Date début</label>
          <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(0); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Date fin</label>
          <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(0); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <button onClick={() => { setPage(0); load(0); }} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
          <RefreshCw size={14} /> Charger
        </button>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg"><AlertCircle size={14} className="inline mr-1" />{error}</div>}

      {loading ? (
        <div className="flex flex-col gap-2 py-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 w-full bg-gray-200 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2">N&#176;</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Téléphone</th>
                  <th className="px-3 py-2">Ville</th>
                  <th className="px-3 py-2">Produit</th>
                  <th className="px-3 py-2">Taille</th>
                  <th className="px-3 py-2">Prix</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{o.id}</td>
                    <td className="px-3 py-2">{o.Recipient || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{o.Recipient_phone || '—'}</td>
                    <td className="px-3 py-2">{o.ville || '—'}</td>
                    <td className="px-3 py-2">{o.product?.name || '—'}</td>
                    <td className="px-3 py-2">{o.size || '—'}</td>
                    <td className="px-3 py-2">{stripHtml(o.sale_price || '')} </td>
                    <td className="px-3 py-2"><StatusBadge raw={o.status} /></td>
                    <td className="px-3 py-2 text-xs text-gray-500">{o.created_at ? new Date(o.created_at).toLocaleDateString('fr-MA') : '—'}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => importOrder(o)} className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition">
                        <Download size={12} /> Importer
                      </button>
                    </td>
                  </tr>
                ))}
                {!orders.length && (
                  <tr><td colSpan={10} className="text-center py-8 text-gray-400">Aucune commande</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {orders.map(o => (
              <div key={o.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-500">#{o.id}</span>
                  <StatusBadge raw={o.status} />
                </div>
                <div className="font-medium text-sm text-gray-800">{o.Recipient || '—'}</div>
                <div className="text-xs text-gray-600 flex flex-wrap gap-x-3">
                  <span>{o.Recipient_phone}</span>
                  <span>{o.product?.name || '—'}</span>
                  <span>{o.size || ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">{stripHtml(o.sale_price || '')}</span>
                  <button onClick={() => importOrder(o)} className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition">
                    <Download size={12} /> Importer
                  </button>
                </div>
              </div>
            ))}
            {!orders.length && <p className="text-center py-8 text-gray-400 text-sm">Aucune commande</p>}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500">{total} commandes au total</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Préc.</button>
                <span className="text-xs text-gray-600 px-2">{page + 1}/{totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Suiv.</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Commandes du site (victoury-maroc.com) sur des produits Chic ──
   Ces commandes arrivent avec le statut chic_nouveau (routées hors « À Confirmer »
   par App.jsx) et s'envoient à Chic Affiliate en un clic : produit, taille,
   couleur et ville sont résolus automatiquement. */
function SiteOrdersTab({ orders = [], setOrders }) {
  const [sending, setSending] = useState(null); /* order id en cours d'envoi */
  const [result, setResult] = useState(null);   /* { id, ok, msg } */

  const siteOrders = orders.filter(o => o.status === 'chic_nouveau' || o.status === 'chic_envoye');
  const norm = s => (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();

  /* Retire la ou les variantes accolées au nom (« - S », « - Bleu », « / M »,
     « – 3XL ») pour matcher le nom de base du produit importé. */
  const baseName = (name) => {
    let n = norm(name);
    // coupe tout ce qui suit le premier séparateur de variante
    n = n.split(/\s*[-–—/|]\s*/)[0];
    // retire une taille/couleur résiduelle en fin
    n = n.replace(/\b(xs|s|m|l|x{1,3}l|[2-6]\s?xl|noir|blanc|rouge|vert|bleu|rose|jaune|gris|beige|marron|orange|violet)\b\s*$/i, '');
    return n.trim();
  };

  function findChicProduct(order) {
    const prods = loadProducts().filter(p => p.source === 'chic-affiliate' && p.chicId);
    const names = [order.product?.name, ...(order.products || []).map(p => p.name)].filter(Boolean);
    for (const name of names) {
      const full = norm(name);
      const base = baseName(name);
      const hit = prods.find(p => norm(p.name) === full)
        || prods.find(p => norm(p.name) === base)
        || prods.find(p => { const pn = norm(p.name); return pn.includes(base) || base.includes(pn); })
        || prods.find(p => { const pn = baseName(p.name); return pn && (pn === base || pn.includes(base) || base.includes(pn)); });
      if (hit) return hit;
    }
    return null;
  }

  async function sendToChic(order) {
    setSending(order.id);
    setResult(null);
    try {
      const chicProd = findChicProduct(order);
      if (!chicProd) throw new Error('Produit Chic introuvable — importez-le d\'abord dans l\'onglet Produits');

      const details = await fetchChicProductDetails(chicProd.chicId);
      if (!details?.token) throw new Error('Impossible de charger le produit sur Chic (reconnectez-vous)');

      /* Ville : correspondance par nom (sans accents) */
      const cityName = norm(order.recipient?.city);
      const city = (details.cities || []).find(c => norm(c.name) === cityName)
        || (details.cities || []).find(c => norm(c.name).includes(cityName) || cityName.includes(norm(c.name)));
      if (!city) throw new Error(`Ville "${order.recipient?.city || '—'}" introuvable chez Chic — envoyez via l'onglet Envoyer`);

      /* Taille : celle de la commande si dispo chez Chic, sinon la première */
      const wantedSize = (order.product?.size || (order.products || [])[0]?.size || '').toUpperCase().trim();
      const size = (details.sizes || []).find(s => s.toUpperCase() === wantedSize) || details.sizes?.[0] || '';

      /* Couleur : par libellé si connu, sinon la première */
      const wantedColor = norm(order.product?.color || (order.products || [])[0]?.color);
      const colorMatch = (details.colors || []).find(c => wantedColor && norm(c.label) === wantedColor);
      const color = (colorMatch || details.colors?.[0])?.id || '';

      const qty = order.product?.qty || 1;

      await createChicOrder({
        token: details.token,
        productId: details.productId,
        size, color,
        quantity: qty,
        recipientPrice: order.price || '',
        recipient: order.recipient?.name || '',
        phone: order.recipient?.phone || '',
        villeId: city.id,
        fraisLivraison: '',
        address: order.recipient?.address || order.recipient?.city || '',
        comment: order.note || '',
      });

      setOrders?.(prev => prev.map(o => o.id === order.id
        ? { ...o, status: 'chic_envoye', dateUpdated: new Date().toLocaleString('fr-MA'), manuallyModified: true }
        : o));
      setResult({ id: order.id, ok: true, msg: `Commande ${order.id} envoyée à Chic Affiliate ✅` });
    } catch (e) {
      setResult({ id: order.id, ok: false, msg: e.message });
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-4">
      {result && (
        <div className={`text-sm p-3 rounded-lg ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {result.ok ? <CheckCircle2 size={14} className="inline mr-1" /> : <AlertCircle size={14} className="inline mr-1" />}
          {result.msg}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
              <th className="px-3 py-2">N°</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Téléphone</th>
              <th className="px-3 py-2">Ville</th>
              <th className="px-3 py-2">Produit</th>
              <th className="px-3 py-2">Taille</th>
              <th className="px-3 py-2">Prix</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {siteOrders.map(o => (
              <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{o.id}</td>
                <td className="px-3 py-2">{o.recipient?.name || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{o.recipient?.phone || '—'}</td>
                <td className="px-3 py-2">{o.recipient?.city || '—'}</td>
                <td className="px-3 py-2">{o.product?.name || '—'}</td>
                <td className="px-3 py-2">{o.product?.size || '—'}</td>
                <td className="px-3 py-2 font-semibold">{(o.price || 0).toFixed(2)} DH</td>
                <td className="px-3 py-2">
                  {o.status === 'chic_envoye'
                    ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Envoyée</span>
                    : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Nouvelle</span>}
                </td>
                <td className="px-3 py-2">
                  {o.status !== 'chic_envoye' && (
                    <button
                      onClick={() => sendToChic(o)}
                      disabled={sending === o.id}
                      className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                    >
                      {sending === o.id ? <><Loader2 size={12} className="animate-spin" /> Envoi...</> : <><Send size={12} /> Envoyer à Chic</>}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!siteOrders.length && (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">Aucune commande du site sur des produits Chic</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {siteOrders.map(o => (
          <div key={o.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-gray-500">{o.id}</span>
              {o.status === 'chic_envoye'
                ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Envoyée</span>
                : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Nouvelle</span>}
            </div>
            <div className="font-medium text-sm text-gray-800">{o.recipient?.name || '—'}</div>
            <div className="text-xs text-gray-600 flex flex-wrap gap-x-3">
              <span>{o.recipient?.phone}</span>
              <span>{o.recipient?.city}</span>
              <span>{o.product?.name} {o.product?.size ? `/ ${o.product.size}` : ''}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">{(o.price || 0).toFixed(2)} DH</span>
              {o.status !== 'chic_envoye' && (
                <button
                  onClick={() => sendToChic(o)}
                  disabled={sending === o.id}
                  className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {sending === o.id ? <><Loader2 size={12} className="animate-spin" /> Envoi...</> : <><Send size={12} /> Envoyer à Chic</>}
                </button>
              )}
            </div>
          </div>
        ))}
        {!siteOrders.length && <p className="text-center py-8 text-gray-400 text-sm">Aucune commande du site sur des produits Chic</p>}
      </div>
    </div>
  );
}

/* ── Send Order to Chic ── */
function SendOrderTab() {
  const [chicProducts, setChicProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [details, setDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [form, setForm] = useState({
    size: '', color: '', quantity: '1', recipientPrice: '',
    recipient: '', phone: '', villeId: '', fraisLivraison: '',
    address: '', comment: '',
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const prods = JSON.parse(localStorage.getItem('victoury_products') || '[]');
    setChicProducts(prods.filter(p => p.source === 'chic-affiliate' && p.chicId));
  }, []);

  async function loadProductDetails(chicId) {
    if (!chicId) { setDetails(null); return; }
    setLoadingDetails(true);
    try {
      const d = await fetchChicProductDetails(chicId);
      setDetails(d);
      setForm(f => ({ ...f, size: d.sizes?.[0] || '', color: d.colors?.[0]?.id || '' }));
    } catch (e) {
      setDetails(null);
      alert('Erreur: ' + e.message);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!details?.token) { alert('Chargez d\'abord un produit'); return; }
    if (!form.recipient || !form.phone || !form.villeId || !form.address) {
      alert('Remplissez tous les champs obligatoires'); return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await createChicOrder({
        token: details.token,
        productId: details.productId,
        ...form,
      });
      setResult({ ok: true, msg: 'Commande envoyée avec succès à Chic Affiliate!' });
      setForm(f => ({ ...f, recipient: '', phone: '', address: '', comment: '' }));
    } catch (err) {
      setResult({ ok: false, msg: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Produit Chic *</label>
        <select
          value={selectedProduct}
          onChange={e => { setSelectedProduct(e.target.value); loadProductDetails(e.target.value); }}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">— Sélectionnez un produit importé —</option>
          {chicProducts.map(p => (
            <option key={p.chicId} value={p.chicId}>{p.name} ({p.salePrice} Dhs)</option>
          ))}
        </select>
        {chicProducts.length === 0 && (
          <p className="text-xs text-orange-600 mt-1">Aucun produit Chic importé. Importez d'abord depuis l'onglet Produits.</p>
        )}
      </div>

      {loadingDetails && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={14} className="animate-spin" /> Chargement des options...</div>}

      {details && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {details.sizes?.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Taille</label>
                <div className="flex gap-1 flex-wrap">
                  {details.sizes.map(s => (
                    <button key={s} type="button" onClick={() => setForm(f => ({ ...f, size: s }))}
                      className={`px-3 py-1 text-xs rounded-lg border ${form.size === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}
            {details.colors?.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Couleur</label>
                <div className="flex gap-1 flex-wrap">
                  {details.colors.map(c => (
                    <button key={c.id} type="button" onClick={() => setForm(f => ({ ...f, color: c.id }))}
                      className={`px-3 py-1 text-xs rounded-lg border ${form.color === c.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                    >{c.label || `#${c.id}`}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Quantité *</label>
              <input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Prix de Vente</label>
              <input type="text" value={form.recipientPrice} onChange={e => setForm(f => ({ ...f, recipientPrice: e.target.value }))}
                placeholder={chicProducts.find(p => p.chicId === selectedProduct)?.salePrice?.toString() || ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 border-t pt-3">Informations client</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nom du client *</label>
              <input type="text" value={form.recipient} onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Téléphone *</label>
              <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 border-t pt-3">Livraison</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Ville *</label>
              <select value={form.villeId} onChange={e => setForm(f => ({ ...f, villeId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">— Sélectionnez —</option>
                {(details.cities || []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Frais de livraison</label>
              <input type="text" value={form.fraisLivraison} onChange={e => setForm(f => ({ ...f, fraisLivraison: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Adresse de livraison *</label>
            <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Commentaire</label>
            <textarea value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
              rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <button type="submit" disabled={sending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Envoyer à Chic Affiliate
          </button>

          {result && (
            <div className={`text-sm p-3 rounded-lg ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {result.ok ? <CheckCircle2 size={14} className="inline mr-1" /> : <AlertCircle size={14} className="inline mr-1" />}
              {result.msg}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function ChicAffiliatePage({ orders = [], setOrders }) {
  const [tab, setTab] = useState('products');
  const [sessionExpired, setSessionExpired] = useState(false);
  const siteCount = orders.filter(o => o.status === 'chic_nouveau').length;

  useEffect(() => {
    const onExpired = () => setSessionExpired(true);
    window.addEventListener('chic-session-expired', onExpired);
    return () => window.removeEventListener('chic-session-expired', onExpired);
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <Store size={20} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Chic Affiliate</h1>
          <p className="text-xs text-gray-500">Gestion des produits et commandes chic-affiliate.com</p>
        </div>
      </div>

      {/* Bannière de reconnexion (cookies Chic expirés) */}
      {sessionExpired && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-red-700">Session Chic Affiliate expirée</p>
            <p className="text-red-600 mt-0.5 text-xs leading-relaxed">
              Les cookies de connexion ont expiré. Ouvrez <b>chic-affiliate.com</b> (connecté) →
              F12 → Application → Cookies → recopiez <b>XSRF-TOKEN</b> et <b>laravel_session</b>
              dans « Configuration Chic Affiliate » ci-dessous, puis « Tester la connexion ».
            </p>
          </div>
          <button onClick={() => setSessionExpired(false)} className="text-red-400 hover:text-red-600 text-xs font-medium shrink-0">Masquer</button>
        </div>
      )}

      {/* Config */}
      <ConfigPanel onTest={(ok) => { if (ok) setSessionExpired(false); }} />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('products')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition ${tab === 'products' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <Package size={14} /> Produits
        </button>
        <button
          onClick={() => setTab('orders')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition ${tab === 'orders' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <ShoppingCart size={14} /> Commandes
        </button>
        <button
          onClick={() => setTab('site')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition ${tab === 'site' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <ShoppingCart size={14} /> Commandes Site
          {siteCount > 0 && (
            <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">{siteCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab('send')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition ${tab === 'send' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <Send size={14} /> Envoyer
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {tab === 'products' ? <ProductsTab />
          : tab === 'orders' ? <OrdersTab />
          : tab === 'site' ? <SiteOrdersTab orders={orders} setOrders={setOrders} />
          : <SendOrderTab />}
      </div>
    </div>
  );
}
