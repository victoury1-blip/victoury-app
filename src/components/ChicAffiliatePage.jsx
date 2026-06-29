import React, { useState, useEffect, useCallback } from 'react';
import {
  Store, Settings, Search, ChevronDown, ChevronRight, RefreshCw,
  Download, Loader2, AlertCircle, CheckCircle2, Check, Package, ShoppingCart,
  Send,
} from 'lucide-react';
import {
  getChicConfig, saveChicConfig, fetchChicOrders, fetchChicProducts,
  fetchChicCounts, fetchChicProductDetails, createChicOrder, stripHtml,
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
  const [config, setConfig] = useState(() => getChicConfig() || { xsrfToken: '', sessionCookie: '' });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

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
          <button
            onClick={testConnection}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Tester la connexion
          </button>
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
      const prods = JSON.parse(localStorage.getItem('victoury_products') || '[]');
      return new Set(prods.filter(p => p.chicId).map(p => p.chicId));
    } catch { return new Set(); }
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChicProducts();
      setProducts(data.data || []);
      setTotal(data.recordsTotal || 0);
      if (data.html && data.data?.length === 0) {
        setError('Produits non détectés — vérifiez la connexion');
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
      if (p.chicId) {
        const already = existing.find(x => x.chicId === p.chicId);
        if (already) {
          alert('Produit déjà importé');
          return;
        }
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
      alert(`✅ Produit importé avec ${allImages.length} images, ${details.colors.length} couleurs, ${sizes.length} tailles !`);
    } catch (e) {
      alert('Erreur: ' + e.message);
    } finally {
      setImporting(null);
    }
  }

  const filtered = products.filter(p =>
    !search || (p.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg"><AlertCircle size={14} className="inline mr-1" />{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-600" /></div>
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
                        {p.chicId && importedIds.has(p.chicId) ? (
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
                    {p.chicId && importedIds.has(p.chicId) ? (
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
        <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-600" /></div>
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
export default function ChicAffiliatePage() {
  const [tab, setTab] = useState('products');

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

      {/* Config */}
      <ConfigPanel />

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
          onClick={() => setTab('send')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition ${tab === 'send' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <Send size={14} /> Envoyer
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {tab === 'products' ? <ProductsTab /> : tab === 'orders' ? <OrdersTab /> : <SendOrderTab />}
      </div>
    </div>
  );
}
