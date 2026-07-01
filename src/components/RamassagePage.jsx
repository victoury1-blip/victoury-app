import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QrCode, CheckCircle, Package, List, Trash2, X, ArrowLeft, Eye, Lock, FileText, Truck } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';

function ScannerPage({ orders, setOrders }) {
  const [manualInput, setManualInput] = useState('');
  const [bonsSession, setBonsSession] = useState({});
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

    scannedIdsRef.current.add(code);
    const livreur = order.recipient?.delivery || 'Sans livreur';
    playBeep();

    if (order.status !== 'expedier') {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'expedier' } : o));
    }

    setBonsSession(prev => {
      const existing = prev[livreur] || { colis: [], created_at: new Date().toISOString() };
      if (existing.colis.find(c => c.id === order.id)) return prev;
      return {
        ...prev,
        [livreur]: {
          ...existing,
          colis: [...existing.colis, {
            id: order.id,
            trackingNumber: order.trackingNumber || '',
            recipient: order.recipient?.name || 'Inconnu',
            phone: order.recipient?.phone || '',
            city: order.recipient?.city || '',
            price: order.price || 0,
            product: order.products?.[0]?.name || order.product?.name || '',
            time: new Date().toLocaleTimeString('fr-MA'),
          }],
        },
      };
    });

    showMessage(`${order.recipient?.name || code} ajouté au bon ${livreur}`);
  }, [orders, setOrders]);

  async function handleTraiter() {
    const input = manualInput.trim();
    if (!input) return;
    processScannedCode(input);
    setManualInput('');
  }

  useEffect(() => {
    if (!scanning) return;
    let html5Qr;
    const timer = setTimeout(async () => {
      try {
        html5Qr = new Html5Qrcode('qr-reader');
        scannerRef.current = html5Qr;
        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => processScannedCode(decodedText),
          () => {}
        );
      } catch {
        showMessage('Caméra inaccessible — utilisez la saisie manuelle ci-dessous', 'error');
        setScanning(false);
      }
    }, 100);
    return () => {
      clearTimeout(timer);
      if (html5Qr && html5Qr.isScanning) {
        html5Qr.stop().catch(() => {});
      }
    };
  }, [scanning, processScannedCode]);

  function stopScanner() {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  }

  function removeFromBon(livreur, colisId) {
    setBonsSession(prev => {
      const updated = { ...prev };
      const bon = updated[livreur];
      if (!bon) return prev;
      const newColis = bon.colis.filter(c => c.id !== colisId);
      scannedIdsRef.current.delete(colisId);
      if (newColis.length === 0) {
        delete updated[livreur];
      } else {
        updated[livreur] = { ...bon, colis: newColis };
      }
      return updated;
    });
  }

  async function saveBon(livreur) {
    const bonData = bonsSession[livreur];
    if (!bonData || bonData.colis.length === 0) return;

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const bon = {
      id: `BRA-${dateStr}-${rand}`,
      livreur,
      colis_ids: bonData.colis.map(c => c.id),
      colis_count: bonData.colis.length,
      status: 'en_cours',
      created_at: now.toISOString(),
      note: '',
    };

    const { error } = await supabase.from('bons_ramassage').insert(bon);
    if (error) {
      showMessage('Erreur: ' + error.message, 'error');
      return;
    }

    setBonsSession(prev => {
      const updated = { ...prev };
      delete updated[livreur];
      return updated;
    });
    bonData.colis.forEach(c => scannedIdsRef.current.delete(c.id));
    showMessage(`Bon ${bon.id} créé pour ${livreur} (${bon.colis_count} colis)`);
  }

  async function saveAllBons() {
    const livreurs = Object.keys(bonsSession);
    for (const livreur of livreurs) {
      await saveBon(livreur);
    }
  }

  const totalColis = Object.values(bonsSession).reduce((sum, b) => sum + b.colis.length, 0);
  const livreurKeys = Object.keys(bonsSession);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Scanner Bon de Ramassage</h1>
        <button
          onClick={() => navigate('/ramassage/bons')}
          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <List size={16} />
          Liste des Bons
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {message.text}
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
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <button
                  onClick={handleTraiter}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  <CheckCircle size={16} />
                  Traiter
                </button>
              </div>
            </div>
            {totalColis > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <p className="text-blue-700 font-semibold text-lg">{totalColis} colis</p>
                <p className="text-blue-600 text-xs">{livreurKeys.length} livreur{livreurKeys.length > 1 ? 's' : ''}</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {livreurKeys.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Truck size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">Scannez des colis pour créer des bons par livreur</p>
            </div>
          ) : (
            <>
              {livreurKeys.length > 1 && (
                <div className="flex justify-end">
                  <button
                    onClick={saveAllBons}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                  >
                    Enregistrer tous les bons ({livreurKeys.length})
                  </button>
                </div>
              )}
              {livreurKeys.map(livreur => {
                const bonData = bonsSession[livreur];
                return (
                  <div key={livreur} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck size={16} className="text-blue-600" />
                        <h3 className="font-semibold text-gray-700">{livreur}</h3>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{bonData.colis.length} colis</span>
                      </div>
                      <button
                        onClick={() => saveBon(livreur)}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium transition"
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
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Heure</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {bonData.colis.map(c => (
                            <tr key={c.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-blue-600 text-xs">{c.id}</td>
                              <td className="px-3 py-2 text-gray-700 text-xs">{c.recipient}</td>
                              <td className="px-3 py-2 text-gray-600 text-xs">{c.city}</td>
                              <td className="px-3 py-2 text-gray-700 text-xs font-medium">{c.price} DH</td>
                              <td className="px-3 py-2 text-gray-600 text-xs">{c.product}</td>
                              <td className="px-3 py-2 text-gray-400 text-xs">{c.time}</td>
                              <td className="px-3 py-2">
                                <button onClick={() => removeFromBon(livreur, c.id)} className="text-red-400 hover:text-red-600">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {scanning && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Scanner</h3>
              <button onClick={stopScanner} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <div id="qr-reader" className="rounded-lg overflow-hidden" />
              <button
                onClick={stopScanner}
                className="w-full mt-4 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium transition"
              >
                Arrêter le scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BonDetailPage({ orders }) {
  const [bon, setBon] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const bonId = location.pathname.split('/').pop();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('bons_ramassage')
        .select('*')
        .eq('id', decodeURIComponent(bonId))
        .single();
      if (data) setBon(data);
      setLoading(false);
    }
    load();
  }, [bonId]);

  if (loading) return <div className="p-6 flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
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
    } : { id, recipient: 'Inconnu', phone: '', city: '', price: 0, product: '', status: '' };
  });

  async function cloturerBon() {
    const { error } = await supabase
      .from('bons_ramassage')
      .update({ status: 'termine' })
      .eq('id', bon.id);
    if (!error) setBon(prev => ({ ...prev, status: 'termine' }));
  }

  const statusColors = { en_cours: 'bg-yellow-100 text-yellow-700', termine: 'bg-green-100 text-green-700', annule: 'bg-red-100 text-red-700' };
  const statusLabels = { en_cours: 'Ouvert', termine: 'Clôturé', annule: 'Annulé' };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Bon de Ramassage {bon.id}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/ramassage/bons')} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition">
            <ArrowLeft size={16} />
            Retour à la liste
          </button>
          {bon.status === 'en_cours' && (
            <button onClick={cloturerBon} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
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
          <div><span className="text-gray-500">Livreur:</span><p className="font-semibold text-gray-800">{bon.livreur || '-'}</p></div>
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
                  <td className="px-4 py-3 font-medium text-blue-600">{c.id}</td>
                  <td className="px-4 py-3 text-gray-700">{c.recipient}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{c.city}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{c.price} DH</td>
                  <td className="px-4 py-3 text-gray-600">{c.product}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{c.status || '-'}</span>
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

function BonsListPage() {
  const [bons, setBons] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('bons_ramassage')
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
    await supabase.from('bons_ramassage').delete().eq('id', id);
    setBons(prev => prev.filter(b => b.id !== id));
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Liste des Bons de Ramassage</h1>
        <button
          onClick={() => navigate('/ramassage/scanner')}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <QrCode size={16} />
          Scanner
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : bons.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">Aucun bon de ramassage</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-sm text-gray-600 font-medium">Bons de Ramassage ({bons.length})</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Référence</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Livreur</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Nb. Colis</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Statut</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bons.map(bon => (
                  <tr key={bon.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-blue-600">{bon.id}</td>
                    <td className="px-4 py-3 text-gray-700">{bon.livreur || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(bon.created_at).toLocaleString('fr-MA')}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{bon.colis_count} colis</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[bon.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[bon.status] || bon.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => navigate(`/ramassage/bon/${encodeURIComponent(bon.id)}`)} className="text-blue-500 hover:text-blue-700" title="Voir">
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

export default function RamassagePage({ orders = [], setOrders }) {
  const location = useLocation();

  if (location.pathname === '/ramassage/bons') return <BonsListPage />;
  if (location.pathname.startsWith('/ramassage/bon/')) return <BonDetailPage orders={orders} />;
  return <ScannerPage orders={orders} setOrders={setOrders} />;
}
