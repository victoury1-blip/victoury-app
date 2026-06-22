import React, { useState, useEffect, useRef } from 'react';
import { X, Truck, CheckCircle2, XCircle, Loader2, Copy } from 'lucide-react';
import { cloudGet } from '../lib/cloudSettings';

const FALLBACK_CITIES = [
  { id: '1', name: 'Casablanca' }, { id: '2', name: 'Rabat' },
  { id: '3', name: 'Fès' }, { id: '4', name: 'Marrakech' },
  { id: '5', name: 'Agadir' }, { id: '6', name: 'Tanger' },
  { id: '7', name: 'Meknès' }, { id: '8', name: 'Oujda' },
  { id: '9', name: 'Tétouan' }, { id: '10', name: 'Safi' },
  { id: '11', name: 'Kénitra' }, { id: '12', name: 'El Jadida' },
  { id: '13', name: 'Béni Mellal' }, { id: '14', name: 'Témara' },
  { id: '15', name: 'Mohammedia' }, { id: '16', name: 'Nador' },
  { id: '17', name: 'Khouribga' }, { id: '18', name: 'Settat' },
  { id: '19', name: 'Berrechid' }, { id: '20', name: 'Dar Bouazza' },
  { id: '21', name: 'Boukkoura' }, { id: '22', name: 'Sala Al Jadida' },
  { id: '23', name: 'Tiznit' }, { id: '24', name: 'Larache' },
  { id: '25', name: 'Guercif' }, { id: '26', name: 'Sidi Slimane' },
  { id: '27', name: 'Ouarzazate' }, { id: '28', name: 'Errachidia' },
];

function getConfig() {
  try {
    return JSON.parse(localStorage.getItem('auzone_config') || '{}');
  } catch {
    return {};
  }
}

async function getConfigRemote() {
  const remote = await cloudGet('auzone_config');
  return remote || {};
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300';
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';

export default function OzoneModal({ order, onClose, onSuccess }) {
  const cfg = getConfig();

  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [citySearch, setCitySearch] = useState('');
  const [cityDropOpen, setCityDropOpen] = useState(false);
  const cityRef = useRef(null);

  useEffect(() => {
    if (!cityDropOpen) return;
    function handleClick(e) { if (cityRef.current && !cityRef.current.contains(e.target)) setCityDropOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [cityDropOpen]);

  /* Load config from Supabase if not in localStorage (new device) */
  useEffect(() => {
    if (!cfg.apiKey) {
      getConfigRemote().then(remote => {
        if (remote?.apiKey) {
          setForm(p => ({ ...p, customerId: remote.customerId || '', apiKey: remote.apiKey }));
        }
      });
    }
  }, []);


  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [tracking, setTracking] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    customerId: cfg.customerId || '',
    apiKey: cfg.apiKey || '',
    receiver: order.recipient.name || '',
    phone: order.recipient.phone || '',
    cityId: '',
    address: `${order.recipient.address || ''} ${order.recipient.city || ''}`.trim(),
    price: String(order.price || ''),
    note: order.noteLivraison || order.note || '',
    open: '1',
    fragile: '0',
    replace: order.echange ? '1' : '0',
    stock: '0',
    nature: (() => {
      const prods = order.products?.length ? order.products : (order.product ? [order.product] : []);
      return prods.map(p => `${p.name || ''}${p.size ? ' - ' + p.size : ''}${p.qty && p.qty > 1 ? ' (x' + p.qty + ')' : ''}`).join(' | ').trim();
    })(),
  });

  const [phoneHistory, setPhoneHistory] = useState(null);
  const [phoneHistoryLoading, setPhoneHistoryLoading] = useState(false);

  useEffect(() => {
    const phone = (form.phone || '').replace(/\s+/g, '');
    const cid = form.customerId || cfg.customerId;
    const key = form.apiKey || cfg.apiKey;
    if (!phone || phone.length < 10 || !cid || !key) { setPhoneHistory(null); return; }
    setPhoneHistoryLoading(true);
    const ctrl = new AbortController();
    (async () => {
      try {
        const endpoints = [
          `https://api.ozonexpress.ma/customers/${cid}/${key}/check-phone/${phone}`,
          `https://api.ozonexpress.ma/customers/${cid}/${key}/check-phone?phone=${phone}`,
          `https://api.ozonexpress.ma/customers/${cid}/${key}/get-parcels?phone=${phone}`,
        ];
        let found = false;
        for (const url of endpoints) {
          if (ctrl.signal.aborted) return;
          try {
            const res = await fetch(url, { signal: ctrl.signal });
            if (!res.ok) continue;
            const raw = await res.json();
            console.log('[Ozone phone check]', url, JSON.stringify(raw));
            const data = raw['CHECK-PHONE'] || raw['check-phone'] || raw;

            // Try to extract delivery/return counts from various response shapes
            let delivered = 0, returned = 0, exists = false;

            if (Array.isArray(data)) {
              // Response is a list of parcels — count by status
              exists = data.length > 0;
              for (const p of data) {
                const st = (p.status || p.STATUS || p.statut || '').toString().toLowerCase();
                if (st.includes('livr') || st.includes('deliver')) delivered++;
                else if (st.includes('retour') || st.includes('return') || st.includes('refus')) returned++;
              }
            } else if (typeof data === 'object' && data !== null) {
              // Check for parcels array nested in response
              const parcels = data.parcels || data.PARCELS || data.data || data.colis;
              if (Array.isArray(parcels)) {
                exists = parcels.length > 0;
                for (const p of parcels) {
                  const st = (p.status || p.STATUS || p.statut || '').toString().toLowerCase();
                  if (st.includes('livr') || st.includes('deliver')) delivered++;
                  else if (st.includes('retour') || st.includes('return') || st.includes('refus')) returned++;
                }
              } else {
                // Direct count fields
                delivered = parseInt(data['DELIVERED'] || data['delivered'] || data['livré'] || data['livre'] || '0', 10);
                returned = parseInt(data['RETURNED'] || data['returned'] || data['retourné'] || data['retourne'] || '0', 10);
                exists = (data['RESULT'] === 'FOUND' || data['RESULT'] === 'EXISTS' || data['exists'] === true || delivered > 0 || returned > 0);
                if (!exists && data['message']) {
                  const msg = data['message'].toLowerCase();
                  if (msg.includes('existe') || msg.includes('found')) {
                    exists = true;
                    const livMatch = msg.match(/livr[ée]*\s*:\s*(\d+)/i);
                    const retMatch = msg.match(/retourn[ée]*\s*:\s*(\d+)/i);
                    if (livMatch) delivered = parseInt(livMatch[1], 10);
                    if (retMatch) returned = parseInt(retMatch[1], 10);
                  }
                }
              }
            }

            if (exists || delivered > 0 || returned > 0) {
              setPhoneHistory({ exists: true, delivered, returned, total: delivered + returned, raw: data });
              found = true;
              break;
            }
            // If this endpoint returned data but no history, check if it's a valid "not found" response
            if (data && (data['RESULT'] === 'NOT_FOUND' || data['message']?.toLowerCase().includes('nouveau') || data['message']?.toLowerCase().includes('new'))) {
              setPhoneHistory({ exists: false, delivered: 0, returned: 0, total: 0, raw: data });
              found = true;
              break;
            }
          } catch (innerErr) {
            if (innerErr.name === 'AbortError') return;
            continue;
          }
        }
        if (!found) setPhoneHistory(null);
      } catch (e) {
        if (e.name !== 'AbortError') setPhoneHistory(null);
      } finally {
        setPhoneHistoryLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [form.phone, form.customerId, form.apiKey]);

  function parseCities(data) {
    if (!data) return [];
    /* handle: array OR { cities: [...] } OR { data: [...] } */
    const arr = Array.isArray(data) ? data
      : Array.isArray(data.cities) ? data.cities
      : Array.isArray(data.data) ? data.data
      : Object.values(data).find(Array.isArray) || [];
    return arr.map((c) => ({
      id: String(c.id || c.ID || c.city_id || c.CITY_ID || ''),
      name: c.name || c.NAME || c.city_name || c.CITY_NAME || '',
    })).filter((c) => c.id && c.name);
  }

  function autoMatchCity(list) {
    if (!list.length) return;
    const orderCity = (order.recipient.city || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const match = list.find((c) => {
      const cn = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return cn === orderCity || cn.includes(orderCity) || orderCity.includes(cn);
    });
    if (match) setForm((p) => ({ ...p, cityId: match.id }));
  }

  useEffect(() => {
    /* 1. Use cities saved from LivraisonPage (real IDs from Ozon API) */
    const stored = (() => { try { return JSON.parse(localStorage.getItem('frais_1') || '[]'); } catch { return []; } })();
    if (Array.isArray(stored) && stored.length > 0) {
      const list = stored.map((c) => ({ id: c.id, name: c.ville }));
      setCities(list); autoMatchCity(list); setCitiesLoading(false); return;
    }
    /* 1b. Try Supabase if not in localStorage */
    cloudGet('frais_1').then(remote => {
      if (Array.isArray(remote) && remote.length > 0) {
        const list = remote.map((c) => ({ id: c.id, name: c.ville }));
        localStorage.setItem('frais_1', JSON.stringify(remote));
        setCities(list); autoMatchCity(list); setCitiesLoading(false);
        return;
      }
    });

    /* 2. Fetch directly from Ozon public cities API */
    (async () => {
      try {
        const res = await fetch('https://api.ozonexpress.ma/cities');
        const raw = await res.json();
        const parsed = parseCities(raw);
        if (parsed.length > 0) {
          setCities(parsed);
          autoMatchCity(parsed);
          setCitiesLoading(false);
          return;
        }
      } catch {}
      /* 3. Fallback */
      setCities(FALLBACK_CITIES);
      autoMatchCity(FALLBACK_CITIES);
      setCitiesLoading(false);
    })();
  }, []);

  function f(field, val) { setForm((p) => ({ ...p, [field]: val })); }

  async function sendParcel() {
    if (!form.customerId || !form.apiKey) {
      setErrorMsg('Veuillez configurer votre ID Client et Clé API dans Paramètres.');
      setStatus('error');
      return;
    }
    if (!form.receiver || !form.phone || !form.cityId || !form.address || !form.price) {
      setErrorMsg('Tous les champs obligatoires doivent être remplis.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    const url = `https://api.ozonexpress.ma/customers/${form.customerId}/${form.apiKey}/add-parcel`;
    const body = new FormData();
    body.append('parcel-receiver', form.receiver);
    body.append('parcel-phone', form.phone);
    body.append('parcel-city', form.cityId);
    body.append('parcel-address', form.address);
    body.append('parcel-price', form.price);
    body.append('parcel-stock', form.stock);
    if (form.stock === '1') {
      /* API requires product data for stock parcels */
      body.append('parcel-products', JSON.stringify([{
        name: (order.products?.[0]?.name || order.product?.name || 'Produit') ,
        quantity: String(order.products?.[0]?.quantity || order.product?.quantity || 1),
      }]));
    }
    body.append('parcel-open', form.open);
    body.append('parcel-fragile', form.fragile);
    body.append('parcel-replace', form.replace);
    if (form.nature) {
      body.append('parcel-designation', form.nature);
      body.append('parcel-nature', form.nature);
    }
    if (form.note) {
      body.append('parcel-note', form.note);
      body.append('parcel-comment', form.note);
    }
    body.append('tracking-number', order.trackingNumber || order.id);

    try {
      const res = await fetch(url, { method: 'POST', body });
      const raw = await res.json();

      /* Ozon Express wraps the response: { "ADD-PARCEL": { "RESULT": "SUCCESS", "TRACKING-NUMBER": "..." } } */
      const data = raw['ADD-PARCEL'] || raw;
      const result = (data['RESULT'] || '').toUpperCase();
      const msg   = data['MESSAGE'] || data['message'] || '';
      const tn    = data['TRACKING-NUMBER'] || data['tracking-number'] || order.id;

      const isSuccess = result === 'SUCCESS'
        || msg.toLowerCase().includes('added')
        || msg.toLowerCase().includes('success');

      if (isSuccess) {
        setTracking({ number: tn, city: data['CITY_NAME'] || form.cityId, price: data['PRICE'], ...data });
        setStatus('success');
        onSuccess && onSuccess(order.id, tn);
        /* Auto-close after 2.5 s */
        setTimeout(() => onClose && onClose(), 2500);
      } else {
        setErrorMsg(msg || JSON.stringify(data).slice(0, 150));
        setStatus('error');
      }
    } catch (err) {
      setErrorMsg('Erreur réseau — Vérifiez vos identifiants et l\'URL API.');
      setStatus('error');
    }
  }

  function copyTracking() {
    navigator.clipboard.writeText(tracking?.number || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const cityName = cities.find((c) => c.id === form.cityId)?.name || '';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
              <Truck size={18} className="text-orange-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Envoyer à Ozon Express</h2>
              <p className="text-xs text-gray-400">{order.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Success State */}
        {status === 'success' && tracking && (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Colis créé avec succès !</h3>
            <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 w-full">
              <p className="text-xs text-gray-500 mb-1">Numéro de suivi</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl font-black text-green-700 font-mono">{tracking.number}</span>
                <button onClick={copyTracking} className="p-1.5 rounded bg-green-200 text-green-700 hover:bg-green-300">
                  <Copy size={13} />
                </button>
              </div>
              {copied && <p className="text-xs text-green-600 mt-1">Copié !</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 w-full text-sm">
              {tracking.CITY_NAME && (
                <div className="bg-gray-50 rounded-lg p-3 text-left">
                  <p className="text-xs text-gray-400">Ville</p>
                  <p className="font-semibold text-gray-700">{tracking.CITY_NAME}</p>
                </div>
              )}
              {tracking.PRICE && (
                <div className="bg-gray-50 rounded-lg p-3 text-left">
                  <p className="text-xs text-gray-400">Prix colis</p>
                  <p className="font-semibold text-gray-700">{tracking.PRICE} MAD</p>
                </div>
              )}
              {tracking['DELIVERED-PRICE'] && (
                <div className="bg-gray-50 rounded-lg p-3 text-left">
                  <p className="text-xs text-gray-400">Frais livraison</p>
                  <p className="font-semibold text-gray-700">{tracking['DELIVERED-PRICE']} MAD</p>
                </div>
              )}
              {tracking['RETURNED-PRICE'] && (
                <div className="bg-gray-50 rounded-lg p-3 text-left">
                  <p className="text-xs text-gray-400">Frais retour</p>
                  <p className="font-semibold text-gray-700">{tracking['RETURNED-PRICE']} MAD</p>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Form */}
        {status !== 'success' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

              {/* API credentials */}
              {(form.customerId && form.apiKey) ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block shrink-0" />
                  <span>API Ozon configurée — ID: <span className="font-mono text-gray-600">{form.customerId}</span></span>
                  <button type="button" onClick={() => f('customerId', '')} className="ml-auto text-blue-500 hover:underline text-xs shrink-0">Modifier</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex gap-2 text-xs text-amber-700">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>Clés API non configurées. Remplissez ci-dessous ou allez dans <strong>Paramètres</strong>.</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>ID Client <span className="text-red-500">*</span></label>
                      <input value={form.customerId} onChange={(e) => f('customerId', e.target.value)} className={inputCls} placeholder="ex: 12345" />
                    </div>
                    <div>
                      <label className={labelCls}>Clé API <span className="text-red-500">*</span></label>
                      <input value={form.apiKey} onChange={(e) => f('apiKey', e.target.value)} className={inputCls} placeholder="votre-cle-api" type="password" />
                    </div>
                  </div>
                </div>
              )}

              {/* Recipient */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nom du destinataire <span className="text-red-500">*</span></label>
                  <input value={form.receiver} onChange={(e) => f('receiver', e.target.value)}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Téléphone <span className="text-red-500">*</span></label>
                  <input value={form.phone} onChange={(e) => f('phone', e.target.value)}
                    className={inputCls} />
                </div>
              </div>


              <div ref={cityRef} className="relative">
                <label className={labelCls}>
                  Ville <span className="text-red-500">*</span>
                  {citiesLoading
                    ? <span className="text-orange-500 font-normal ml-1 inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Chargement...</span>
                    : <span className="text-gray-400 font-normal ml-1">({cities.length} villes)</span>}
                </label>
                <input
                  value={citySearch || cityName}
                  onChange={(e) => { setCitySearch(e.target.value); setCityDropOpen(true); f('cityId', ''); }}
                  onFocus={() => { setCitySearch(''); setCityDropOpen(true); }}
                  placeholder="Rechercher une ville..."
                  className={inputCls}
                  disabled={citiesLoading}
                />
                {cityDropOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {cities
                      .filter(c => !citySearch || c.name.toLowerCase().includes(citySearch.toLowerCase()))
                      .slice(0, 50)
                      .map(c => (
                        <div key={c.id}
                          onMouseDown={() => { f('cityId', c.id); setCitySearch(''); setCityDropOpen(false); }}
                          className="px-3 py-2 text-sm text-gray-700 cursor-pointer hover:bg-orange-50 hover:text-orange-700">
                          {c.name}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Adresse <span className="text-red-500">*</span></label>
                <input value={form.address} onChange={(e) => f('address', e.target.value)} className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Prix (MAD) <span className="text-red-500">*</span></label>
                  <input type="number" value={form.price} onChange={(e) => f('price', e.target.value)}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Type de colis</label>
                  <select value={form.stock} onChange={(e) => f('stock', e.target.value)} className={inputCls}>
                    <option value="0">Normal</option>
                    <option value="1">Stock</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Ouverture</label>
                  <select value={form.open} onChange={(e) => f('open', e.target.value)} className={inputCls}>
                    <option value="1">Ouvrir</option>
                    <option value="2">Ne pas ouvrir</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Fragile</label>
                  <select value={form.fragile} onChange={(e) => f('fragile', e.target.value)} className={inputCls}>
                    <option value="0">Non</option>
                    <option value="1">Oui</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Échange</label>
                  <select value={form.replace} onChange={(e) => f('replace', e.target.value)} className={inputCls}>
                    <option value="0">Non</option>
                    <option value="1">Oui</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Nature du produit</label>
                <input value={form.nature} onChange={(e) => f('nature', e.target.value)}
                  className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Commentaire (autre tél, date livraison...)</label>
                <input value={form.note} onChange={(e) => f('note', e.target.value)}
                  placeholder="Ex: 0612345678, Livrer le soir..." className={inputCls} />
              </div>

              {status === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex gap-2 text-xs text-red-700">
                  <XCircle size={13} className="mt-0.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50 rounded-b-xl">
              <div className="text-xs text-gray-400">
                {form.cityId && cityName && <span>Ville: <strong>{cityName}</strong></span>}
              </div>
              <div className="flex gap-3">
                <button onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100">
                  Annuler
                </button>
                <button
                  onClick={sendParcel}
                  disabled={status === 'loading'}
                  className="px-5 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-60 flex items-center gap-2 transition-colors"
                >
                  {status === 'loading'
                    ? <><Loader2 size={14} className="animate-spin" /> Envoi en cours...</>
                    : <><Truck size={14} /> Envoyer le colis</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
