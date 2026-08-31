import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { isAffiliateSource, isAffiliateStatus, platformOfSource } from '../lib/affiliatePlatforms';
import { fraisAffilie } from '../lib/affiliateFrais';
import { TrendingUp, RefreshCw, ShoppingBag, Percent, Truck, DollarSign, Download, Plus, Trash2, Receipt, Package, Store } from 'lucide-react';
import useProducts from '../hooks/useProducts';
import { loadFactures } from '../data/factures';
import { cloudGet, cloudSet } from '../lib/cloudSettings';

function fmt(n) { return Number(n || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pct(val, total) { return total ? ((val / total) * 100).toFixed(1) : '0.0'; }

const EXPENSE_CATS = [
  { value: 'facebook', label: 'Facebook Ads', color: 'text-blue-600', bg: 'bg-blue-50' },
  { value: 'tiktok', label: 'TikTok Ads', color: 'text-pink-600', bg: 'bg-pink-50' },
  { value: 'livraison', label: 'Frais Livraison extra', color: 'text-orange-600', bg: 'bg-orange-50' },
  { value: 'autres', label: 'Autres dépenses', color: 'text-gray-600', bg: 'bg-gray-100' },
];

function KpiCard({ label, value, unit = 'MAD', subtitle, color, icon: Icon, progress, onClick }) {
  return (
    <div onClick={onClick}
      className={`bg-white border-l-4 ${color.border} rounded-xl p-5 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
        <Icon size={13} className={color.icon} /> {label}
        {onClick && <span className="ml-auto text-[10px] font-bold text-gray-400 normal-case">détail ›</span>}
      </div>
      <div className={`text-2xl font-black mt-2 ${color.text}`}>{fmt(value)} <span className="text-sm font-semibold">{unit}</span></div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color.bar}`} style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
        </div>
      )}
    </div>
  );
}

export default function ProfitPage({ orders = [], setOrders }) {
  const today = new Date();
  // Format LOCAL aaaa-mm-jj : toISOString() décale d'un jour en UTC+1 (minuit
  // local du 1er sérialisé « 30 du mois précédent »), ce qui excluait le
  // dernier jour du mois des calculs.
  const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const firstDay = localIso(new Date(today.getFullYear(), today.getMonth(), 1));
  const lastDay  = localIso(new Date(today.getFullYear(), today.getMonth() + 1, 0));

  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo,   setDateTo]   = useState(lastDay);
  const [applied,  setApplied]  = useState({ dateFrom: firstDay, dateTo: lastDay });
  const [activePreset, setActivePreset] = useState('mois');
  const [showCost, setShowCost] = useState(false);
  // Prix d'achat MANUELS par nom de produit (override, saisis depuis le détail Coût d'Achat).
  const [manualCost, setManualCost] = useState(() => {
    try { return JSON.parse(localStorage.getItem('victoury_product_cost') || '{}'); } catch { return {}; }
  });
  /* Le prix saisi est partagé, pas propre à l'appareil.
   *
   * La fusion donnait le dernier mot au stockage local : un prix corrigé sur le
   * téléphone restait masqué sur l'ordinateur par l'ancienne valeur, et les deux
   * appareils affichaient durablement deux coûts d'achat — donc deux profits.
   * Toute saisie partant aussitôt dans le cloud, celui-ci fait foi ; seules les
   * clés qu'il ne connaît pas encore sont conservées. */
  useEffect(() => {
    cloudGet('victoury_product_cost').then(r => {
      if (r && typeof r === 'object') {
        setManualCost(prev => {
          const merged = { ...prev, ...r };
          try { localStorage.setItem('victoury_product_cost', JSON.stringify(merged)); } catch { /* quota */ }
          return merged;
        });
      }
    });
  }, []);
  /* Corriger la quantité d'une ligne, depuis le détail du coût.
   *
   * Le coût d'achat vaut prix unitaire × quantité. Quand une commande de deux
   * articles n'en déclarait qu'un, la tentation était de doubler le PRIX
   * unitaire pour retomber sur le bon total — mais ce prix est celui du produit,
   * partagé par toutes ses commandes : la correction en faussait aussitôt
   * quatre autres. C'est la quantité qu'il fallait atteindre, et elle n'était
   * modifiable que commande par commande, ailleurs.
   *
   * Le prix unitaire reste donc ce qu'il est — ce que coûte une pièce — et la
   * quantité se corrige ici, là où l'écart se voit. */
  function setProductQty(orderId, index, value) {
    const qty = Math.max(1, Math.min(parseInt(value, 10) || 1, 999));
    if (!setOrders) return;
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      // Une commande sans tableau `products` n'en porte qu'un, dans `product` :
      // on normalise avant d'écrire, sinon la correction se perdrait.
      const prods = o.products?.length ? o.products : (o.product ? [o.product] : []);
      if (!prods[index]) return o;
      const products = prods.map((p, i) => (i === index ? { ...p, qty } : p));
      return {
        ...o,
        products,
        product: index === 0 ? { ...(o.product || {}), ...products[0] } : o.product,
      };
    }));
  }

  function setProductCost(name, value) {
    const key = (name || '').trim().toLowerCase();
    if (!key) return;
    // Persistance hors de l'updater : celui-ci doit rester pur (React peut le
    // ré-exécuter, ce qui enverrait deux écritures cloud concurrentes).
    const next = { ...manualCost };
    const v = parseFloat(value);
    if (value === '' || isNaN(v)) delete next[key]; else next[key] = v;
    localStorage.setItem('victoury_product_cost', JSON.stringify(next));
    cloudSet('victoury_product_cost', next);
    setManualCost(next);
  }

  const [adTransfers, setAdTransfers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ad_transfers') || '[]'); } catch { return []; }
  });
  const [newTransfer, setNewTransfer] = useState({ label: '', amount: '', category: 'facebook' });
  const [showAdModal, setShowAdModal] = useState(false);

  const [factures, setFactures] = useState(() => loadFactures());

  useEffect(() => {
    cloudGet('ad_transfers').then(remote => {
      if (Array.isArray(remote) && remote.length) {
        setAdTransfers(prev => {
          const remoteIds = new Set(remote.map(t => t.id));
          const localOnly = prev.filter(t => !remoteIds.has(t.id));
          const merged = [...remote, ...localOnly];
          localStorage.setItem('ad_transfers', JSON.stringify(merged));
          if (localOnly.length) cloudSet('ad_transfers', merged);
          return merged;
        });
      }
    });
    cloudGet('victoury_factures').then(data => {
      if (!Array.isArray(data)) return;
      // Dédoublonnage par id/ref : une facture dupliquée par la synchro cloud
      // doublait le chiffre d'affaires affiché.
      const seen = new Set();
      setFactures(data.filter(f => {
        const k = f?.id || f?.ref;
        if (!k) return true;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }));
    });
  }, []);

  function saveAdTransfers(list) {
    setAdTransfers(list);
    localStorage.setItem('ad_transfers', JSON.stringify(list));
    cloudSet('ad_transfers', list);
  }

  function addTransfer() {
    if (!newTransfer.amount) return;
    saveAdTransfers([...adTransfers, {
      id: Date.now(),
      label: newTransfer.label || EXPENSE_CATS.find(c => c.value === newTransfer.category)?.label || 'Dépense',
      amount: parseFloat(newTransfer.amount) || 0,
      category: newTransfer.category || 'facebook',
      date: new Date().toISOString().slice(0, 10),
    }]);
    setNewTransfer({ label: '', amount: '', category: 'facebook' });
  }

  function removeTransfer(id) { saveAdTransfers(adTransfers.filter(t => t.id !== id)); }

  function apply() { setApplied({ dateFrom, dateTo }); setActivePreset(null); }
  function reset() {
    setDateFrom(firstDay); setDateTo(lastDay);
    setApplied({ dateFrom: firstDay, dateTo: lastDay });
    setActivePreset('mois');
  }
  const iso = localIso; // format local, pas UTC (voir plus haut)
  function setPreset(type) {
    const n = new Date();
    let from, to;
    if (type === 'semaine') {
      const day = (n.getDay() + 6) % 7; // lundi = 0
      from = new Date(n); from.setDate(n.getDate() - day);
      to = new Date(from); to.setDate(from.getDate() + 6);
    } else if (type === 'mois') {
      from = new Date(n.getFullYear(), n.getMonth(), 1);
      to = new Date(n.getFullYear(), n.getMonth() + 1, 0);
    } else { // année
      from = new Date(n.getFullYear(), 0, 1);
      to = new Date(n.getFullYear(), 11, 31);
    }
    const f = iso(from), t = iso(to);
    setDateFrom(f); setDateTo(t); setApplied({ dateFrom: f, dateTo: t });
    setActivePreset(type);
  }
  const presetCls = (type) => activePreset === type
    ? 'px-3 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white border border-blue-600'
    : 'px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50';

  const { products: stockProducts } = useProducts();

  /* La commande tombe-t-elle dans la période choisie ? Partagée par toute la
     page : définie au fond d'un calcul, elle n'était pas appliquée au bloc des
     ventes d'affiliation, qui affichait alors un total de toujours. */
  const inPeriodOrder = useCallback((o) => {
    let d = null;
    if (o.createdAt) { const t = new Date(o.createdAt); if (!isNaN(t)) d = t; }
    if (!d) {
      const m = String(o.dateAdded || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) d = new Date(+m[3], +m[2] - 1, +m[1]);
      else { const m2 = String(o.dateAdded || '').match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if (m2) d = new Date(+m2[1], +m2[2] - 1, +m2[3]); }
    }
    if (!d) return false;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return key >= applied.dateFrom && key <= applied.dateTo;
  }, [applied.dateFrom, applied.dateTo]);

  // Get all colis from factures, within the period
  const allFactureColis = useMemo(() => {
    const colis = [];
    for (const f of factures) {
      // Parse facture date (DD/MM/YYYY HH:MM format)
      let fDate = '';
      if (f.dateCreation) {
        const parts = f.dateCreation.split(' ')[0].split('/');
        if (parts.length === 3) fDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      if (fDate && (fDate < applied.dateFrom || fDate > applied.dateTo)) continue;
      for (const c of (f.colis || [])) {
        colis.push({ ...c, factureRef: f.ref, factureId: f.id, livreur: f.livreur, factureDateCreation: f.dateCreation });
      }
    }
    // Commandes terminées (livré/refusé/échange) SANS facture, dans la période :
    // sans elles, un mois où rien n'a encore été facturé affiche 0 partout
    // (typiquement les commandes importées de Google Sheets). Frais de
    // livraison inconnus hors facture → 0, la facture reste la référence.
    const invoicedIds = new Set();
    for (const f of factures) for (const c of (f.colis || [])) invoicedIds.add(c.orderId);
    const inPeriod = inPeriodOrder;
    for (const o of orders) {
      if (!['livre', 'refuse', 'change'].includes(o.status)) continue;
      if (invoicedIds.has(o.id)) continue;
      if (!inPeriod(o)) continue;
      colis.push({
        orderId: o.id,
        recipient: o.recipient?.name || '',
        city: o.recipient?.city || '',
        product: o.products?.[0]?.name || o.product?.name || '',
        prix: parseFloat(o.price) || 0,
        status: o.status,
        fraisLivraison: 0,
        factureRef: '— sans facture',
      });
    }
    // Un même colis peut figurer dans deux factures (ré-édition, doublon de
    // synchro) : sans dédoublonnage, son chiffre d'affaires est compté deux fois.
    const seen = new Set();
    return colis.filter(c => {
      const k = c.orderId;
      if (!k) return true;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [factures, orders, applied, inPeriodOrder]);

  const livresColis = allFactureColis.filter(c => c.status === 'livre');
  const refuseColis = allFactureColis.filter(c => c.status === 'refuse');
  const changeColis = allFactureColis.filter(c => c.status === 'change');
  // Échange inclus dans le tableau : on lui compte SEULEMENT ses frais (pas de coût
  // d'achat car le produit est échangé, et pas de nouveau chiffre d'affaires).
  const tableColis = allFactureColis.filter(c => c.status === 'livre' || c.status === 'refuse' || c.status === 'change');

  // Match each colis to its order for product cost calculation
  const orderMap = useMemo(() => new Map(orders.map(o => [o.id, o])), [orders]);

  /* Une commande marquée ÉCHANGE ne coûte rien de plus : la marchandise a déjà
     été payée sur la commande d'origine. Lui compter le prix d'achat une
     seconde fois affichait des marges négatives sur des échanges livrés
     (30 encaissés, 100 de coût, −70 de « perte » qui n'existe pas).
     La règle vit ici, et non dans le tableau : les totaux, l'export CSV et le
     détail du coût d'achat en dépendent tous. */
  const isEchange = (colis) => colis.echange ?? !!orderMap.get(colis.orderId)?.echange;

  function getProductCost(colis) {
    const order = orderMap.get(colis.orderId);
    if (!order || order.echange || colis.echange) return 0;
    const prods = order.products?.length ? order.products : [order.product];
    let cost = 0;
    for (const p of prods) {
      if (!p?.name) continue;
      const pn = (p.name || '').trim().toLowerCase();
      // Prix manuel saisi = priorité (override) — permet de corriger/compléter.
      if (manualCost[pn] != null) { cost += manualCost[pn] * (p.qty || 1); continue; }
      const pnWords = pn.split(/\s+/).filter(w => w.length > 2);
      const sp = stockProducts.find(s => (s.name || '').trim().toLowerCase() === pn)
        || stockProducts.find(s => pn.includes((s.name || '').trim().toLowerCase()) || (s.name || '').trim().toLowerCase().includes(pn))
        || stockProducts.find(s => {
          const sn = (s.name || '').trim().toLowerCase();
          const snWords = sn.split(/\s+/).filter(w => w.length > 2);
          const common = pnWords.filter(w => snWords.some(sw => sw.includes(w) || w.includes(sw)));
          return common.length >= 2;
        });
      if (sp) {
        const unitCost = parseFloat(sp.prixAchat || sp.purchasePrice || 0);
        if (unitCost) cost += unitCost * (p.qty || 1);
      }
    }
    return cost;
  }

  // Détail du calcul du coût d'achat pour un colis (pour vérification).
  function getProductCostDetail(colis) {
    const order = orderMap.get(colis.orderId);
    const prods = order?.products?.length ? order.products : [order?.product].filter(Boolean);
    const items = [];
    // Même règle que getProductCost : un échange n'a pas de coût d'achat.
    if (order?.echange) {
      return (prods || []).filter(p => p?.name).map(p => ({
        name: p.name, matched: 'Échange — déjà payé', manual: false,
        unitCost: 0, qty: p.qty || 1, cost: 0, echange: true,
      }));
    }
    for (const [idx, p] of (prods || []).entries()) {
      if (!p?.name) continue;
      const pn = (p.name || '').trim().toLowerCase();
      const pnWords = pn.split(/\s+/).filter(w => w.length > 2);
      const sp = stockProducts.find(s => (s.name || '').trim().toLowerCase() === pn)
        || stockProducts.find(s => pn.includes((s.name || '').trim().toLowerCase()) || (s.name || '').trim().toLowerCase().includes(pn))
        || stockProducts.find(s => {
          const sn = (s.name || '').trim().toLowerCase();
          const snWords = sn.split(/\s+/).filter(w => w.length > 2);
          return pnWords.filter(w => snWords.some(sw => sw.includes(w) || w.includes(sw))).length >= 2;
        });
      const isManual = manualCost[pn] != null;
      const unitCost = isManual ? manualCost[pn] : (sp ? (parseFloat(sp.prixAchat || sp.purchasePrice || 0) || 0) : 0);
      const qty = p.qty || 1;
      // `index` : la ligne exacte de la commande, pour pouvoir corriger sa quantité.
      items.push({ index: idx, name: p.name, matched: isManual ? 'Prix manuel' : (sp?.name || null), manual: isManual, unitCost, qty, cost: unitCost * qty });
    }
    return items;
  }

  // Calculations
  const ca = livresColis.reduce((s, c) => s + (c.prix || 0), 0);
  const coutAchat = livresColis.reduce((s, c) => s + getProductCost(c), 0);
  const fraisLiv = allFactureColis.reduce((s, c) => s + (c.fraisLivraison || 0), 0);
  const sousTotal = ca - coutAchat - fraisLiv;

  /* ── Colis livrés facturés à 0 DH de livraison ──
   *
   * Aucune livraison n'est gratuite. Quand la ville d'une commande n'a pas de
   * tarif chez le livreur, le calcul retombait silencieusement sur 0 : la
   * facture était créée, le colis passait, et le profit affiché était plus haut
   * que le vrai — sans le moindre signe. Autant de fois que de villes non
   * tarifées.
   *
   * On les compte ici, et on chiffre l'écart au tarif habituel : un chiffre
   * faux qui s'annonce vaut mieux qu'un chiffre faux qui se tait. */
  const fraisManquants = useMemo(() => {
    /* Seuls les colis réellement portés jusqu'au client : une commande annulée
       ou refusée peut légitimement ne rien coûter, une livraison jamais. */
    const porte = (c) => c.status === 'livre' || c.status === 'change';
    const sansFrais = allFactureColis.filter(c => porte(c) && !(c.fraisLivraison > 0));
    if (!sansFrais.length) return null;
    const payes = allFactureColis.filter(porte).map(c => c.fraisLivraison || 0).filter(v => v > 0);
    // Tarif de référence : la médiane des frais réellement facturés, insensible
    // aux quelques villes très chères ou très proches.
    const tries = [...payes].sort((a, b) => a - b);
    const median = tries.length ? tries[Math.floor(tries.length / 2)] : 0;
    const villes = [...new Set(sansFrais.map(c => c.city).filter(Boolean))];
    /* Nommer les colis, pas seulement les villes : c'est le colis qu'il faut
       retrouver dans sa facture pour corriger le montant à la main. */
    const colis = sansFrais.map(c => ({ id: c.orderId, city: c.city || '—', facture: c.factureRef || '' }));
    return { count: sansFrais.length, median, ecart: median * sansFrais.length, villes, colis };
  }, [allFactureColis]);
  const inPeriod = (d) => (!applied.dateFrom || d >= applied.dateFrom) && (!applied.dateTo || d <= applied.dateTo);
  // La publicité doit couvrir la MÊME période que le chiffre d'affaires, sinon le
  // profit du mois est amputé de toutes les dépenses des mois précédents.
  /* Dépenses de la PÉRIODE. Le détail par catégorie s'en déduit : calculé sur
     la totalité des dépenses, il annonçait des montants supérieurs au total
     affiché juste au-dessus — 2 645 + 200 pour un total de 2 245. */
  const pubDeLaPeriode = adTransfers.filter(t => inPeriod(String(t.date || '')));
  const totalPub = pubDeLaPeriode.reduce((s, t) => s + (t.amount || 0), 0);
  const pubParCategorie = (cat) => pubDeLaPeriode
    .filter(x => (x.category || 'facebook') === cat)
    .reduce((s, x) => s + (x.amount || 0), 0);
  const profitNet = sousTotal - totalPub;

  /* ── Indicateurs publicitaires ──
     Ce que la publicité doit être jugée dessus : non pas les commandes reçues,
     mais celles réellement encaissées. Ces chiffres étaient à reconstituer à la
     main entre plusieurs pages, donc jamais regardés. */
  const adKpis = useMemo(() => {
    /* Date de CRÉATION, et non de mise à jour : une commande se rattache à la
       dépense publicitaire du jour où elle est arrivée. */
    const dayOf = (o) => {
      if (o.createdAt) { const t = new Date(o.createdAt); if (!isNaN(t)) return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; }
      const m = String(o.dateAdded || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
    };
    const inRange = (d) => d && (!applied.dateFrom || d >= applied.dateFrom) && (!applied.dateTo || d <= applied.dateTo);
    const list = (orders || []).filter(o => inRange(dayOf(o)));
    const total = list.length;
    const livre = list.filter(o => o.status === 'livre' || o.status === 'echange_recu').length;
    /* Toutes les issues sans encaissement, y compris celles qui n'arrivent jamais
       jusqu'au colis (annulée, injoignable) : les ignorer flatterait le taux. */
    const perdu = list.filter(o => ['annule', 'injoignable', 'refuse', 'pas_reponse', 'black_liste'].includes(o.status)).length;
    const enCours = total - livre - perdu;
    return { total, livre, perdu, enCours };
  }, [orders, applied]);

  /* Coût par commande LIVRÉE, et retour sur dépense calculé sur l'argent
     réellement encaissé — pas sur les commandes passées. */
  const cpaReel = adKpis.livre ? totalPub / adKpis.livre : 0;
  const roasReel = totalPub ? ca / totalPub : 0;

  const totalRefuse = allFactureColis.filter(c => c.status === 'refuse').length;
  const totalLivre = livresColis.length;

  const chicProducts = stockProducts.filter(p => isAffiliateSource(p.source));
  // Matching par nom de base (ignore les variantes « - L », « - Noir »…).
  const cNorm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const cBase = s => cNorm(s).split(/\s*[-–—/|]\s*/)[0].trim();
  const chicMatch = (pname) => {
    const b = cBase(pname); if (!b) return null;
    return chicProducts.find(cp => cBase(cp.name) === b)
      || (b.length > 2 ? chicProducts.find(cp => cBase(cp.name).includes(b) || b.includes(cBase(cp.name))) : null);
  };
  /* Profit Chic = commandes livrées/facturées (ventes réalisées).
   *
   * Bornées à la période choisie, comme tout le reste de la page : elles ne
   * l'étaient pas, et le bloc annonçait le total de TOUTES les ventes Chic sous
   * un titre affichant le mois en cours. Un chiffre qui ne bougeait jamais quand
   * on changeait de période. */
  const chicOrdersList = orders.filter(o => {
    if (!isAffiliateStatus(o.status, 'livre', 'facture')) return false;
    if (!inPeriodOrder(o)) return false;
    const prods = o.products?.length ? o.products : [o.product];
    return prods.some(p => chicMatch(p?.name));
  });
  const chicCA = chicOrdersList.reduce((s, o) => s + (o.price || 0), 0);
  const chicCost = chicOrdersList.reduce((s, o) => {
    // Échange : marchandise déjà payée sur la commande d'origine.
    if (o.echange) return s;
    const prods = o.products?.length ? o.products : [o.product];
    let cost = 0;
    for (const p of prods) {
      const sp = chicMatch(p?.name);
      if (sp) cost += (parseFloat(sp.purchasePrice) || 0) * (p.qty || 1);
    }
    return s + cost;
  }, 0);
  /* Frais de livraison Chic. Le montant figé sur la commande à l'envoi ne suffit
     pas : une commande passée autrement, ou envoyée sans que le tarif soit
     renseigné, n'en porte aucun. À défaut, on reprend celui retenu pour sa ville
     — c'est déjà ce que fait la page Affiliations. Ce qui reste introuvable est
     compté comme INCONNU, jamais comme gratuit : un zéro silencieux gonflerait
     le bénéfice affiché. */
  const chicFraisParCommande = chicOrdersList.map(o => fraisAffilie(o, platformOfSource(o.source)?.key));
  const chicFrais = chicFraisParCommande.reduce((s, f) => s + (f || 0), 0);
  const chicFraisInconnus = chicFraisParCommande.filter(f => f == null).length;
  const chicProfit = chicCA - chicCost - chicFrais;

  const selCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300';

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-auto">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 px-6 sm:px-8 py-7 text-white">
        <div className="flex items-center gap-3 mb-1">
          <TrendingUp size={24} />
          <h1 className="text-xl sm:text-2xl font-black">Rapport de Profit</h1>
        </div>
        <p className="text-blue-200 text-sm">Analyse détaillée de la rentabilité</p>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-4 sm:px-6 py-4 flex flex-wrap items-end gap-3 sm:gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Période :</label>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setActivePreset(null); }} className={selCls} />
            <span className="text-gray-400 text-sm">–</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setActivePreset(null); }} className={selCls} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPreset('semaine')} className={presetCls('semaine')}>Cette semaine</button>
          <button onClick={() => setPreset('mois')} className={presetCls('mois')}>Ce mois</button>
          <button onClick={() => setPreset('annee')} className={presetCls('annee')}>Cette année</button>
          <button onClick={apply} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-900">Filtrer</button>
          <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
            <RefreshCw size={13} /> Réinitialiser
          </button>
          <button onClick={() => {
            const rows = [['Facture','ID Colis','Client','Ville','Statut','Prix Vente','Coût Achat','Frais Liv.','Marge'].join(',')];
            const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
            tableColis.forEach(c => {
              // Même logique que le tableau affiché : refusé ET échange n'ont
              // ni CA ni coût d'achat — seule la marge = -frais de livraison.
              const isR = c.status === 'refuse';
              const isC = c.status === 'change';
              const noCost = isR || isC;
              const pa = noCost ? 0 : getProductCost(c); const fl = c.fraisLivraison||0;
              const m = noCost ? -fl : (c.prix||0) - pa - fl;
              const statut = isR ? 'Refusé' : isC ? 'Échange' : isEchange(c) ? 'Livré (échange)' : 'Livré';
              rows.push([esc(c.factureRef), esc(c.orderId), esc(c.recipient||''), esc(c.city||''), statut, noCost?0:c.prix||0, pa.toFixed(2), fl, m.toFixed(2)].join(','));
            });
            rows.push('');
            EXPENSE_CATS.forEach(cat => {
              const t = pubParCategorie(cat.value);
              if (t) rows.push(`${cat.label},${t.toFixed(2)}`);
            });
            rows.push(`Total Dépenses,${totalPub.toFixed(2)}`); rows.push(`Profit Net,${profitNet.toFixed(2)}`);
            const blob = new Blob(['﻿'+rows.join('\n')], {type:'text/csv;charset=utf-8'});
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = `profit_${applied.dateFrom}_${applied.dateTo}.csv`; a.click();
          }} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">
            <Download size={13} /> Exporter
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 space-y-6">
        {/* Le profit affiché est faux tant que des colis sont facturés 0 DH de
            livraison : autant le dire en haut de page, chiffré. */}
        {fraisManquants && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none">⚠️</span>
              <div className="text-sm text-amber-900">
                <b>{fraisManquants.count} colis facturés sans frais de livraison.</b>{' '}
                Aucune livraison n’est gratuite : leur ville n’a pas de tarif chez le livreur,
                et le calcul est retombé sur 0.
                {fraisManquants.median > 0 && (
                  <> Au tarif habituel ({fmt(fraisManquants.median)} DH), le profit affiché est
                    surestimé d’environ <b>{fmt(fraisManquants.ecart)} DH</b>.</>
                )}
                {fraisManquants.villes.length > 0 && (
                  <div className="mt-1 text-xs text-amber-800">
                    Villes concernées : {fraisManquants.villes.slice(0, 12).join(', ')}
                    {fraisManquants.villes.length > 12 && ` … (+${fraisManquants.villes.length - 12})`}
                  </div>
                )}
                {/* Le colis à ouvrir, nommément : sans son code, il faut le
                    chercher facture par facture. */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {fraisManquants.colis.slice(0, 40).map((c, i) => (
                    <span key={`${c.id}-${i}`} className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white/70 px-2 py-0.5 text-[11px]">
                      <b className="font-mono text-amber-900">{c.id}</b>
                      <span className="text-amber-700">{c.city}</span>
                      {c.facture && <span className="text-amber-500">· {c.facture}</span>}
                    </span>
                  ))}
                  {fraisManquants.colis.length > 40 && (
                    <span className="text-[11px] text-amber-700">… (+{fraisManquants.colis.length - 40})</span>
                  )}
                </div>
                <div className="mt-1.5 text-xs text-amber-700">
                  👉 Ouvre la facture indiquée, « Rouvrir » si elle est clôturée, et saisis les frais dans la colonne <b>Frais</b>.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Chiffre d'Affaires" value={ca} icon={ShoppingBag}
            subtitle={`${totalLivre} livrée${totalLivre > 1 ? 's' : ''} | ${totalRefuse} refusée${totalRefuse > 1 ? 's' : ''}`}
            color={{ border: 'border-blue-500', icon: 'text-blue-500', text: 'text-blue-700', bar: 'bg-blue-500' }} />
          <KpiCard label="Coût d'Achat" value={coutAchat} icon={Package}
            subtitle={`${pct(coutAchat, ca)}% du CA`} onClick={() => setShowCost(true)}
            color={{ border: 'border-red-400', icon: 'text-red-500', text: 'text-red-600', bar: 'bg-red-400' }} />
          <KpiCard label="Frais Livraison" value={fraisLiv} icon={Truck}
            subtitle={`${allFactureColis.length} colis au total`}
            color={{ border: 'border-orange-400', icon: 'text-orange-500', text: 'text-orange-600', bar: 'bg-orange-400' }} />
          <KpiCard label="Profit Net" value={profitNet} icon={DollarSign}
            subtitle={`${pct(profitNet, ca)}% du CA (après pub)`} progress={Math.max(0, parseFloat(pct(profitNet, ca)))}
            color={{ border: 'border-teal-500', icon: 'text-teal-500', text: profitNet >= 0 ? 'text-teal-700' : 'text-red-600', bar: 'bg-teal-500' }} />
        </div>

        {/* Indicateurs publicitaires — à comparer d'une période à l'autre. */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-blue-600" />
            <h3 className="font-bold text-gray-800 text-sm">Indicateurs publicitaires</h3>
            <span className="text-[11px] text-gray-400">— {applied.dateFrom} → {applied.dateTo}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Commandes reçues</div>
              <div className="text-lg font-black text-gray-800">{adKpis.total}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Livrées</div>
              <div className="text-lg font-black text-green-700">
                {adKpis.livre} <span className="text-xs font-semibold">({pct(adKpis.livre, adKpis.total)}%)</span>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Perdues</div>
              <div className="text-lg font-black text-red-600">
                {adKpis.perdu} <span className="text-xs font-semibold">({pct(adKpis.perdu, adKpis.total)}%)</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">annulé · injoignable · refusé</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Coût par livraison</div>
              <div className="text-lg font-black text-orange-600">{fmt(cpaReel)} <span className="text-xs font-semibold">DH</span></div>
              <div className="text-[10px] text-gray-500 mt-0.5">pub ÷ livrées</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">ROAS réel</div>
              <div className={`text-lg font-black ${roasReel >= 2 ? 'text-blue-700' : 'text-red-600'}`}>{roasReel.toFixed(2)}×</div>
              <div className="text-[10px] text-gray-500 mt-0.5">CA encaissé ÷ pub</div>
            </div>
          </div>
          {adKpis.enCours > 0 && (
            <p className="text-[11px] text-gray-500 mt-2">
              {adKpis.enCours} commande(s) encore en cours sur cette période : les taux se
              stabiliseront une fois leur sort connu.
            </p>
          )}
        </div>

        {/* Chic Affiliate Summary */}
        {chicOrdersList.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-700 mb-1 text-sm flex items-center gap-2">
              <Store size={14} className="text-indigo-600" /> Profit Chic Affiliate
              <span className="text-[11px] font-normal text-gray-400">— {applied.dateFrom} → {applied.dateTo}</span>
            </h2>
            {/* Ces ventes suivent leur propre circuit et n'entrent dans aucune
                facture : elles sont donc absentes du profit net. Le dire, plutôt
                que de laisser deux bénéfices côte à côte sans lien apparent. */}
            <p className="text-[11px] text-gray-500 mb-3">
              Compté à part : ces ventes ne passent pas par les factures, elles ne sont pas incluses dans le <b>Profit Net</b> ci-dessus.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div className="bg-indigo-50 rounded-xl p-3">
                <div className="text-[10px] font-semibold text-gray-500 uppercase">Commandes</div>
                <div className="text-lg font-black text-indigo-700">{chicOrdersList.length}</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="text-[10px] font-semibold text-gray-500 uppercase">Ventes</div>
                <div className="text-lg font-black text-blue-700">{fmt(chicCA)}</div>
              </div>
              <div className="bg-red-50 rounded-xl p-3">
                <div className="text-[10px] font-semibold text-gray-500 uppercase">Coût Revendeur</div>
                <div className="text-lg font-black text-red-600">{fmt(chicCost)}</div>
              </div>
              {/* Un frais introuvable n'est pas un frais nul : le signaler, sinon
                  le bénéfice affiché est trop haut sans que rien ne le dise. */}
              <div className={`rounded-xl p-3 ${chicFraisInconnus ? 'bg-amber-100' : 'bg-orange-50'}`}>
                <div className="text-[10px] font-semibold text-gray-500 uppercase">Frais Livraison</div>
                <div className={`text-lg font-black ${chicFraisInconnus ? 'text-amber-700' : 'text-orange-600'}`}>{fmt(chicFrais)}</div>
                {chicFraisInconnus > 0 && (
                  <div className="text-[10px] text-amber-800 mt-0.5">
                    ⚠ {chicFraisInconnus} commande{chicFraisInconnus > 1 ? 's' : ''} sans tarif connu
                  </div>
                )}
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <div className="text-[10px] font-semibold text-gray-500 uppercase">Bénéfice net</div>
                <div className={`text-lg font-black ${chicProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(chicProfit)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Formula breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-700 mb-4 text-sm">Détail du calcul</h2>

          {/* Step 1: CA - Achat - Livraison = Sous-total */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center text-center">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Prix de vente</div>
              <div className="text-lg font-black text-blue-700">{fmt(ca)}</div>
            </div>
            <div className="text-gray-400 font-bold text-xl hidden sm:flex items-center justify-center">−</div>
            <div className="bg-red-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Coût d'achat</div>
              <div className="text-lg font-black text-red-600">{fmt(coutAchat)}</div>
            </div>
            <div className="text-gray-400 font-bold text-xl hidden sm:flex items-center justify-center">−</div>
            <div className="bg-orange-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Frais livraison</div>
              <div className="text-lg font-black text-orange-600">{fmt(fraisLiv)}</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 my-4 text-sm text-gray-500">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="font-bold">= Sous-total: <span className={sousTotal >= 0 ? 'text-green-700' : 'text-red-600'}>{fmt(sousTotal)} MAD</span></span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Step 2: Sous-total - Pub = Profit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center text-center">
            <div className="bg-green-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Sous-total</div>
              <div className="text-lg font-black text-green-700">{fmt(sousTotal)}</div>
            </div>
            <div className="text-gray-400 font-bold text-xl hidden sm:flex items-center justify-center">−</div>
            <div className="bg-purple-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Total Dépenses</div>
              <div className="text-lg font-black text-purple-600">{fmt(totalPub)}</div>
              <div className="flex flex-wrap justify-center gap-1 mt-2">
                {EXPENSE_CATS.map(cat => {
                  const t = pubParCategorie(cat.value);
                  if (!t) return null;
                  return <span key={cat.value} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cat.bg} ${cat.color}`}>{cat.label}: {fmt(t)}</span>;
                })}
              </div>
              <button onClick={() => setShowAdModal(true)} className="text-[10px] text-purple-600 hover:underline mt-2">Gérer les dépenses →</button>
            </div>
          </div>

          {/* Result */}
          <div className="mt-4 bg-gradient-to-r from-teal-50 to-green-50 rounded-xl p-5 text-center border border-teal-200">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Profit Net Final</div>
            <div className={`text-3xl font-black ${profitNet >= 0 ? 'text-teal-700' : 'text-red-600'}`}>{fmt(profitNet)} <span className="text-sm font-semibold">MAD</span></div>
            <div className="text-xs text-gray-500 mt-1">{pct(profitNet, ca)}% du chiffre d'affaires</div>
          </div>
        </div>

        {/* Info about cost source */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          💡 <strong>Coût d'achat :</strong> calculé depuis le <strong>prix d'achat</strong> dans Stock (pour chaque produit × quantité).
        </div>

        {/* Orders table from factures */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-700 text-sm">Commandes des factures ({livresColis.length} livrées · {refuseColis.length} refusées · {changeColis.length} échanges)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Facture','ID Colis','Client','Ville','Statut','Produit','Prix Vente','Coût Achat','Frais Liv.','Marge'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tableColis.length === 0 && (
                  <tr><td colSpan={10} className="py-10 text-center text-gray-400 text-sm">Aucune commande dans les factures de cette période</td></tr>
                )}
                {tableColis.map((c, i) => {
                  const isRefuse = c.status === 'refuse';
                  const isChange = c.status === 'change';
                  const noCost = isRefuse || isChange; // échange : pas de coût d'achat, pas de CA
                  // Commande marquée échange mais livrée : l'encaissement est réel,
                  // seul le coût d'achat disparaît (marchandise déjà payée).
                  const echangeLivre = !noCost && isEchange(c);
                  const pv = c.prix || 0;
                  const pa = noCost ? 0 : getProductCost(c);
                  const fl = c.fraisLivraison || 0;
                  const marge = noCost ? -(fl) : pv - pa - fl;
                  const order = orderMap.get(c.orderId);
                  const prodName = c.product || order?.product?.name || '—';
                  // Un 0 n'est anormal que sur un colis réellement livré ou échangé.
                  const fraisAbsent = fl <= 0 && (c.status === 'livre' || isChange);
                  return (
                    <tr key={`${c.orderId}-${i}`} className={`hover:bg-gray-50 ${isRefuse ? 'bg-red-50/50' : isChange ? 'bg-amber-50/50' : ''}`} title={fraisAbsent ? 'Aucun tarif pour cette ville — frais comptés à 0, le profit de cette ligne est surestimé' : undefined}>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{c.factureRef}</td>
                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-blue-600">{c.orderId}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-700">{c.recipient || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{c.city || order?.recipient?.city || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isRefuse ? 'bg-red-100 text-red-600' : isChange ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {isRefuse ? 'Refusé' : isChange ? 'Échange' : echangeLivre ? 'Livré (échange)' : 'Livré'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[150px] truncate">
                        {prodName}
                        {order?.products?.length > 1 && <span className="text-[10px] text-gray-400 ml-1">(+{order.products.length - 1})</span>}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-gray-800">{noCost ? '—' : fmt(pv)}</td>
                      <td className="px-4 py-2.5 text-red-500 text-xs font-semibold">{noCost || echangeLivre ? '—' : fmt(pa)}</td>
                      {/* Un 0 de frais est une donnée manquante, pas une livraison
                          gratuite : il doit se voir dans la colonne. */}
                      <td className={`px-4 py-2.5 text-xs font-semibold ${fraisAbsent ? 'text-amber-700 bg-amber-100/70' : 'text-orange-500'}`}>
                        {fraisAbsent ? '⚠ 0,00' : fmt(fl)}
                      </td>
                      <td className={`px-4 py-2.5 font-bold text-xs ${marge >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(marge)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {tableColis.length > 0 && (
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-xs font-bold text-gray-600">TOTAL ({livresColis.length} livrées · {refuseColis.length} refusées · {changeColis.length} échanges)</td>
                    <td className="px-4 py-3 font-black text-gray-800">{fmt(ca)}</td>
                    <td className="px-4 py-3 font-bold text-red-500">{fmt(coutAchat)}</td>
                    <td className="px-4 py-3 font-bold text-orange-500">{fmt(fraisLiv)}</td>
                    <td className={`px-4 py-3 font-black ${sousTotal >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(sousTotal)}</td>
                  </tr>
                  <tr className="border-t border-gray-300">
                    <td colSpan={9} className="px-4 py-2 text-xs font-bold text-gray-500 text-right">Dépenses :</td>
                    <td className="px-4 py-2 font-bold text-purple-600 text-xs">−{fmt(totalPub)}</td>
                  </tr>
                  <tr className="bg-teal-50">
                    <td colSpan={9} className="px-4 py-3 text-sm font-black text-gray-700 text-right">PROFIT NET :</td>
                    <td className={`px-4 py-3 font-black text-sm ${profitNet >= 0 ? 'text-teal-700' : 'text-red-600'}`}>{fmt(profitNet)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Détail Coût d'Achat — vérification par produit */}
      {showCost && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowCost(false)}>
          <div className="fixed inset-0 bg-black/40" />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-red-500" />
                <h2 className="font-bold text-gray-900">Détail du Coût d'Achat</h2>
                <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">{fmt(coutAchat)} MAD</span>
              </div>
              <button onClick={() => setShowCost(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <div className="overflow-auto p-3">
              <p className="text-xs text-gray-500 px-2 pb-2">
                Le coût d'achat vient du <b>Prix d'achat</b> (Stock) × quantité, pour les commandes livrées.
                Les lignes <span className="text-red-600 font-semibold">rouges</span> n'ont aucun prix trouvé.
                {/* Les deux cases ne jouent pas le même rôle, et les confondre coûte
                    cher : doubler un prix unitaire pour rattraper UNE commande
                    fausse aussitôt toutes les autres du même produit. */}
                <br />👉 <b>« Prix achat U. »</b> = ce que coûte <b>une pièce</b>. Il vaut pour <b>tous</b> les colis du même produit — ne le change que si le prix d'achat a vraiment changé.
                <br />👉 <b>« Qté »</b> = le nombre de pièces <b>de cette commande</b>. C'est elle qu'il faut corriger quand un total ne tombe pas juste (400 DH pour 2 ensembles → Qté 2, prix unitaire inchangé).
                <br />Entrée pour valider ; tout est enregistré aussitôt.
              </p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                    <th className="px-2 py-2 text-left">Colis</th>
                    <th className="px-2 py-2 text-left">Produit (commande)</th>
                    <th className="px-2 py-2 text-left">Produit Stock associé</th>
                    <th className="px-2 py-2 text-right">Prix Vente</th>
                    <th className="px-2 py-2 text-right">Prix achat U.</th>
                    <th className="px-2 py-2 text-center">Qté</th>
                    <th className="px-2 py-2 text-right">Coût</th>
                  </tr>
                </thead>
                <tbody>
                  {livresColis.flatMap((c) => getProductCostDetail(c).map((it, j) => (
                    <tr key={`${c.orderId}-${j}`} className={`border-b border-gray-50 ${it.echange ? 'bg-amber-50/50' : it.unitCost === 0 ? 'bg-red-50/60' : it.manual ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-2 py-2 font-mono font-bold text-blue-600">{j === 0 ? c.orderId : ''}</td>
                      <td className="px-2 py-2 text-gray-700">{it.name}</td>
                      <td className={`px-2 py-2 ${it.echange ? 'text-amber-700 font-semibold' : it.manual ? 'text-blue-600 font-semibold' : it.matched ? 'text-gray-600' : 'text-red-600 font-semibold'}`}>{it.matched || '⚠ non trouvé'}</td>
                      <td className="px-2 py-2 text-right font-semibold text-gray-800">{j === 0 ? `${fmt(c.prix)}` : ''}</td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number" min="0" step="0.01"
                          defaultValue={it.unitCost || ''}
                          onBlur={(e) => setProductCost(it.name, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                          placeholder="0.00"
                          className="w-20 border border-gray-200 rounded px-1.5 py-1 text-right text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </td>
                      {/* Modifiable : c'est la quantité, et non le prix unitaire,
                          qu'il faut corriger quand le coût d'une commande ne
                          tombe pas juste. */}
                      <td className="px-2 py-2 text-center">
                        {setOrders && !it.echange ? (
                          <input
                            type="number" min="1" step="1"
                            defaultValue={it.qty}
                            onBlur={(e) => setProductQty(c.orderId, it.index, e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                            title="Nombre de pièces sur cette commande"
                            className="w-14 border border-gray-200 rounded px-1.5 py-1 text-center text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                        ) : it.qty}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold text-red-600">{fmt(it.cost)}</td>
                    </tr>
                  )))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td className="px-2 py-2" colSpan={6}>TOTAL Coût d'Achat</td>
                    <td className="px-2 py-2 text-right text-red-600">{fmt(coutAchat)} MAD</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ad Transfers Modal */}
      {showAdModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowAdModal(false)}>
          <div className="fixed inset-0 bg-black/40" />
          <div className="relative bg-white rounded-t-xl sm:rounded-xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-xl z-10">
              <h2 className="text-lg font-bold text-gray-800">Gestion des dépenses</h2>
              <button onClick={() => setShowAdModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 text-xl">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500">Ajoutez vos dépenses par catégorie. Le total sera déduit du sous-total pour calculer le profit net.</p>

              {EXPENSE_CATS.map(cat => {
                const items = adTransfers.filter(t => (t.category || 'facebook') === cat.value);
                if (!items.length) return null;
                const catTotal = items.reduce((s, t) => s + (t.amount || 0), 0);
                return (
                  <div key={cat.value}>
                    <div className={`text-xs font-bold ${cat.color} mb-1`}>{cat.label}</div>
                    <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                      {items.map(t => (
                        <div key={t.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                          <div>
                            <div className="text-sm font-semibold text-gray-800">{t.label}</div>
                            <div className="text-xs text-gray-400">{t.date}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-black ${cat.color}`}>{fmt(t.amount)} MAD</span>
                            <button onClick={() => removeTransfer(t.id)} className="p-1 rounded bg-red-50 text-red-500 hover:bg-red-100">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className={`px-4 py-2 ${cat.bg} flex items-center justify-between`}>
                        <span className="text-xs font-bold text-gray-600">Sous-total</span>
                        <span className={`font-black ${cat.color}`}>{fmt(catTotal)} MAD</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {adTransfers.length > 0 && (
                <div className="px-4 py-2.5 bg-purple-50 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600">TOTAL DÉPENSES</span>
                  <span className="font-black text-purple-700">{fmt(totalPub)} MAD</span>
                </div>
              )}

              <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-600 flex items-center gap-1"><Plus size={12} /> Nouvelle dépense</p>
                <select value={newTransfer.category} onChange={e => setNewTransfer(p => ({ ...p, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                  {EXPENSE_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input value={newTransfer.label} onChange={e => setNewTransfer(p => ({ ...p, label: e.target.value }))}
                  placeholder="Description (ex: Facebook Ads Juin)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                <input type="number" value={newTransfer.amount} onChange={e => setNewTransfer(p => ({ ...p, amount: e.target.value }))}
                  placeholder="Montant en MAD" min={0} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                <button onClick={addTransfer} disabled={!newTransfer.amount}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-40 transition">
                  <Plus size={14} /> Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
