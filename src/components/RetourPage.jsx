import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { useLocation, useNavigate } from 'react-router-dom';
import { QrCode, CheckCircle, Package, List, Trash2, X, ArrowLeft, Eye, Lock, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';


function ScannerRetourPage({ orders, setOrders }) {
  const [manualInput, setManualInput] = useState('');
  const [colisRetour, setColisRetour] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState(null);
  const scannerRef = useRef(null);
  const scannedIdsRef = useRef(new Set());
  const navigate = useNavigate();

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }

  function playError() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(150, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }

  function showMessage(text, type = 'success') {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }

  const processScannedCode = useCallback((code) => {
    if (scannedIdsRef.current.has(code)) {
      playError();
      showMessage(`⚠️ Code ${code} déjà scanné !`, 'error');
      return;
    }

    const order = orders.find(o => o.id === code || o.trackingNumber === code);
    if (!order) {
      playError();
      showMessage(`Code ${code} non trouvé`, 'error');
      return;
    }

    const ACCEPTED = new Set(['retour', 'annule', 'echange', 'refuse']);
    if (!ACCEPTED.has(order.status)) {
      playError();
      showMessage(`${order.recipient?.name || code} — statut "${order.status}" non accepté en retour`, 'error');
      return;
    }

    scannedIdsRef.current.add(code);
    playBeep();

    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, recu: true } : o));
    supabase.from('orders').update({ recu: true }).eq('id', order.id).then(() => {});

    setColisRetour(prev => {
      if (prev.find(c => c.id === order.id)) return prev;
      return [...prev, {
        id: order.id,
        trackingNumber: order.trackingNumber || '',
        recipient: order.recipient?.name || 'Inconnu',
        phone: order.recipient?.phone || '',
        city: order.recipient?.city || '',
        price: order.price || 0,
        product: order.products?.[0]?.name || order.product?.name || '',
        time: new Date().toLocaleTimeString('fr-MA'),
        status: order.status,
      }];
    });

    showMessage(`${order.recipient?.name || code} — reçu ✓ (${order.status})`);
  }, [orders, setOrders]);

  async function handleTraiter() {
    const input = manualInput.trim();
    if (!input) return;
    processScannedCode(input);
    setManualInput('');
  }

  const processScannedCodeRef = useRef(processScannedCode);
  useEffect(() => { processScannedCodeRef.current = processScannedCode; }, [processScannedCode]);

  useEffect(() => {
    if (!scanning) return;
    let stream, intervalId, stopped = false;

    async function start() {
      const video = document.getElementById('retour-scanner-video');
      if (!video || stopped) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        video.srcObject = stream;
        await video.play();
        await new Promise(r => setTimeout(r, 800));
        if (stopped) return;

        if (!('BarcodeDetector' in window)) {
          showMessage('BarcodeDetector non disponible', 'error');
          setScanning(false);
          return;
        }

        const detector = new window.BarcodeDetector({
          formats: ['qr_code', 'code_128', 'ean_13', 'code_39', 'aztec', 'data_matrix', 'pdf417'],
        });

        intervalId = setInterval(async () => {
          if (stopped || video.readyState < 2 || !video.videoWidth) return;
          try {
            const barcodes = await detector.detect(video);
            if (barcodes.length > 0 && !stopped) {
              stopped = true;
              clearInterval(intervalId);
              processScannedCodeRef.current(barcodes[0].rawValue);
            }
          } catch {}
        }, 200);
      } catch (err) {
        if (stopped) return;
        const msg = String(err?.message || err || '');
        const reason = msg.includes('NotAllowed') || err?.name === 'NotAllowedError'
          ? 'Permission caméra refusée — Paramètres → Apps → Chrome → Autorisations → Caméra'
          : msg.includes('NotFound') ? 'Aucune caméra détectée'
          : msg.includes('NotReadable') ? 'Caméra occupée par une autre app'
          : `Erreur caméra: ${msg || 'inconnue'}`;
        showMessage(reason, 'error');
        setScanning(false);
      }
    }

    const timer = setTimeout(start, 100);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(intervalId);
      try { stream?.getTracks().forEach(t => t.stop()); } catch {}
      const v = document.getElementById('retour-scanner-video');
      if (v) v.srcObject = null;
    };
  }, [scanning]);

  function stopScanner() {
    setScanning(false);
  }

  function removeFromList(colisId) {
    setColisRetour(prev => prev.filter(c => c.id !== colisId));
    scannedIdsRef.current.delete(colisId);
  }

  async function saveBonRetour() {
    if (colisRetour.length === 0) return;

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const bon = {
      id: `BRT-${dateStr}-${rand}`,
      colis_ids: colisRetour.map(c => c.id),
      colis_count: colisRetour.length,
      status: 'en_cours',
      created_at: now.toISOString(),
      note: '',
    };

    const { error } = await supabase.from('bons_retour').insert(bon);
    if (error) {
      showMessage('Erreur: ' + error.message, 'error');
      return;
    }

    setColisRetour([]);
    scannedIdsRef.current.clear();
    showMessage(`Bon ${bon.id} créé (${bon.colis_count} colis)`);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Scanner Bon de Retour</h1>
        <button
          onClick={() => navigate('/retour/bons')}
          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <List size={16} />
          Liste des Bons
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          <div className="flex items-start justify-between gap-3">
            <span>{message.text}</span>
            {message.type === 'error' && message.text.includes('Permission') && (
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => { setMessage(null); setScanning(true); }} className="text-xs font-bold underline hover:no-underline whitespace-nowrap">
                  Réessayer
                </button>
                <button onClick={() => window.location.reload()} className="text-xs font-bold underline hover:no-underline whitespace-nowrap">
                  Recharger
                </button>
              </div>
            )}
          </div>
          {message.type === 'error' && message.text.includes('Permission') && (
            <div className="mt-2 text-xs opacity-80 space-y-0.5">
              <p className="font-semibold">Pour activer la caméra :</p>
              <p>📱 Paramètres Android → Apps → <strong>VICTOURY</strong> → Autorisations → Caméra → Autoriser</p>
              <p>Ou dans Chrome → ⋮ → Paramètres du site → Caméra → Autoriser</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-700">Scanner</h2>
          </div>
          <div className="p-4 space-y-4">
            <button
              onClick={() => setScanning(true)}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition w-full justify-center"
            >
              <QrCode size={18} />
              Scanner QR Code
            </button>
            <div>
              <p className="text-sm text-gray-500 mb-2">Ou saisir manuellement :</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTraiter()}
                  placeholder="ID commande ou tracking"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <button
                  onClick={handleTraiter}
                  className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  <CheckCircle size={16} />
                  Traiter
                </button>
              </div>
            </div>
            {colisRetour.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <p className="text-orange-700 font-semibold text-lg">{colisRetour.length} colis</p>
                <p className="text-orange-600 text-xs">prêts pour le bon de retour</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {colisRetour.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <RotateCcw size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">Scannez des colis retournés pour créer un bon de retour</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw size={16} className="text-orange-600" />
                  <h3 className="font-semibold text-gray-700">Colis retournés</h3>
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">{colisRetour.length} colis</span>
                </div>
                <button
                  onClick={saveBonRetour}
                  className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg font-medium transition"
                >
                  Enregistrer le bon
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">ID</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Client</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Ville</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Montant</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Produit</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Ancien statut</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Heure</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {colisRetour.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-orange-600 text-xs">{c.trackingNumber || c.id}</td>
                        <td className="px-3 py-2 text-gray-700 text-xs">{c.recipient}</td>
                        <td className="px-3 py-2 text-gray-600 text-xs">{c.city}</td>
                        <td className="px-3 py-2 text-gray-700 text-xs font-medium">{c.price} DH</td>
                        <td className="px-3 py-2 text-gray-600 text-xs">{c.product}</td>
                        <td className="px-3 py-2"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{c.previousStatus}</span></td>
                        <td className="px-3 py-2 text-gray-400 text-xs">{c.time}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => removeFromList(c.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {scanning && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <QrCode size={16} className="text-gray-600" /> Scanner un colis
              </h3>
              <button onClick={stopScanner} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={18} />
              </button>
            </div>
            <div className="relative bg-black overflow-hidden" style={{ height: 300 }}>
              <video id="retour-scanner-video" className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-48 h-48">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br" />
                  <div className="absolute left-0 right-0 h-0.5 bg-red-400 opacity-80 animate-scan-line" style={{ top: '50%' }} />
                </div>
              </div>
              <p className="absolute bottom-2 left-0 right-0 text-center text-white text-xs opacity-70 pointer-events-none">Pointez vers le code-barres</p>
            </div>
            <div className="p-4 flex gap-2">
              <button
                onClick={stopScanner}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition"
              >
                Arrêter la caméra
              </button>
              <button
                onClick={stopScanner}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BonRetourDetailPage({ orders }) {
  const [bon, setBon] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const bonId = location.pathname.split('/').pop();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('bons_retour')
        .select('*')
        .eq('id', decodeURIComponent(bonId))
        .single();
      if (data) setBon(data);
      setLoading(false);
    }
    load();
  }, [bonId]);

  if (loading) return <div className="p-6 flex justify-center py-12"><div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!bon) return <div className="p-6"><p className="text-gray-500">Bon non trouvé</p></div>;

  const colisDetails = (bon.colis_ids || []).map(id => {
    const order = orders.find(o => o.id === id);
    return order ? {
      id: order.id,
      trackingNumber: order.trackingNumber || '',
      recipient: order.recipient?.name || 'Inconnu',
      phone: order.recipient?.phone || '',
      city: order.recipient?.city || '',
      price: order.price || 0,
      product: order.products?.[0]?.name || order.product?.name || '',
      status: order.status,
    } : { id, trackingNumber: '', recipient: 'Inconnu', phone: '', city: '', price: 0, product: '', status: '' };
  });

  async function cloturerBon() {
    const { error } = await supabase
      .from('bons_retour')
      .update({ status: 'termine' })
      .eq('id', bon.id);
    if (!error) setBon(prev => ({ ...prev, status: 'termine' }));
  }

  const statusColors = { en_cours: 'bg-yellow-100 text-yellow-700', termine: 'bg-green-100 text-green-700', annule: 'bg-red-100 text-red-700' };
  const statusLabels = { en_cours: 'Ouvert', termine: 'Clôturé', annule: 'Annulé' };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Bon de Retour {bon.id}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/retour/bons')} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition">
            <ArrowLeft size={16} />
            Retour à la liste
          </button>
          {bon.status === 'en_cours' && (
            <button onClick={cloturerBon} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              <Lock size={16} />
              Clôturer
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-700">Informations du bon</h2>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">Référence:</span><p className="font-semibold text-gray-800">{bon.id}</p></div>
          <div><span className="text-gray-500">Nb. Colis:</span><p className="font-semibold text-gray-800">{bon.colis_count}</p></div>
          <div><span className="text-gray-500">Date:</span><p className="font-semibold text-gray-800">{new Date(bon.created_at).toLocaleString('fr-MA')}</p></div>
          <div><span className="text-gray-500">Statut:</span><p><span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[bon.status] || 'bg-gray-100 text-gray-600'}`}>{statusLabels[bon.status] || bon.status}</span></p></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-700">Colis dans ce bon ({colisDetails.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">ID Commande</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Téléphone</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Ville</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Montant</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Produit</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {colisDetails.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-orange-600">{c.trackingNumber || c.id}</td>
                  <td className="px-4 py-3 text-gray-700">{c.recipient}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{c.city}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{c.price} DH</td>
                  <td className="px-4 py-3 text-gray-600">{c.product}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{c.status || '-'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BonsRetourListPage() {
  const [bons, setBons] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('bons_retour')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setBons(data);
      setLoading(false);
    }
    load();
  }, []);

  const statusColors = { en_cours: 'bg-yellow-100 text-yellow-700', termine: 'bg-green-100 text-green-700', annule: 'bg-red-100 text-red-700' };
  const statusLabels = { en_cours: 'Ouvert', termine: 'Clôturé', annule: 'Annulé' };

  async function deleteBon(id) {
    if (!confirm('Supprimer ce bon ?')) return;
    await supabase.from('bons_retour').delete().eq('id', id);
    setBons(prev => prev.filter(b => b.id !== id));
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Liste des Bons de Retour</h1>
        <button
          onClick={() => navigate('/retour/scanner')}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <QrCode size={16} />
          Scanner
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : bons.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">Aucun bon de retour</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-sm text-gray-600 font-medium">Bons de Retour ({bons.length})</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Référence</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Nb. Colis</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Statut</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bons.map(bon => (
                  <tr key={bon.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-orange-600">{bon.id}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(bon.created_at).toLocaleString('fr-MA')}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{bon.colis_count} colis</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[bon.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[bon.status] || bon.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => navigate(`/retour/bon/${encodeURIComponent(bon.id)}`)} className="text-orange-500 hover:text-orange-700" title="Voir">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => deleteBon(bon.id)} className="text-red-400 hover:text-red-600" title="Supprimer">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RetourPage({ orders = [], setOrders }) {
  const location = useLocation();

  if (location.pathname === '/retour/bons') return <BonsRetourListPage />;
  if (location.pathname.startsWith('/retour/bon/')) return <BonRetourDetailPage orders={orders} />;
  return <ScannerRetourPage orders={orders} setOrders={setOrders} />;
}
