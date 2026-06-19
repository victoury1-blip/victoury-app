import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QrCode, Search, CheckCircle, Package, List, Clock, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

function ScannerPage({ orders, setOrders }) {
  const [manualInput, setManualInput] = useState('');
  const [scanHistory, setScanHistory] = useState([]);
  const [bonsEnCours, setBonsEnCours] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    loadBonsEnCours();
  }, []);

  async function loadBonsEnCours() {
    const { data } = await supabase
      .from('bons_ramassage')
      .select('*')
      .eq('status', 'en_cours')
      .order('created_at', { ascending: false });
    if (data) setBonsEnCours(data);
  }

  function showMessage(text, type = 'success') {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleTraiter() {
    const input = manualInput.trim();
    if (!input) return;

    const order = orders.find(o => o.id === input || o.trackingNumber === input);
    if (!order) {
      showMessage('Commande introuvable: ' + input, 'error');
      return;
    }

    const entry = {
      id: order.id,
      recipient: order.recipient?.name || 'Inconnu',
      city: order.recipient?.city || '',
      time: new Date().toLocaleTimeString('fr-MA'),
      status: 'scanné',
    };
    setScanHistory(prev => [entry, ...prev]);

    if (order.status !== 'att_ramassage') {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'att_ramassage' } : o));
    }

    showMessage(`Commande ${order.id} ajoutée au ramassage`);
    setManualInput('');
  }

  async function startScanner() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setScanning(true);
    } catch {
      showMessage('Impossible d\'accéder à la caméra', 'error');
    }
  }

  function stopScanner() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }

  async function createBon() {
    if (scanHistory.length === 0) {
      showMessage('Aucun colis scanné', 'error');
      return;
    }

    const bon = {
      id: `BON-${Date.now()}`,
      colis_ids: scanHistory.map(s => s.id),
      colis_count: scanHistory.length,
      status: 'en_cours',
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('bons_ramassage').insert(bon);
    if (error) {
      showMessage('Erreur: ' + error.message, 'error');
      return;
    }

    setBonsEnCours(prev => [bon, ...prev]);
    setScanHistory([]);
    showMessage(`Bon ${bon.id} créé avec ${bon.colis_count} colis`);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Scanner Bon de Ramassage</h1>
        <button
          onClick={() => window.location.hash = '#bons'}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Scanner */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-700">Scanner</h2>
          </div>
          <div className="p-4 space-y-4">
            <button
              onClick={startScanner}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
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
                  placeholder="ID commande ou code de suivi"
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
          </div>
        </div>

        {/* Historique des scans */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Historique des scans</h2>
            {scanHistory.length > 0 && (
              <button
                onClick={createBon}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition"
              >
                Créer Bon ({scanHistory.length})
              </button>
            )}
          </div>
          <div className="p-4">
            {scanHistory.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Aucun scan effectué</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {scanHistory.map((scan, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{scan.id}</span>
                      <span className="text-xs text-gray-500 ml-2">{scan.recipient} — {scan.city}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{scan.time}</span>
                      <button onClick={() => setScanHistory(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bons de ramassage en cours */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-700">Bons de ramassage en cours</h2>
        </div>
        <div className="p-4">
          {bonsEnCours.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Aucun bon de ramassage en cours</p>
          ) : (
            <div className="space-y-3">
              {bonsEnCours.map(bon => (
                <div key={bon.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Package size={18} className="text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{bon.id}</p>
                      <p className="text-xs text-gray-500">{bon.colis_count} colis • {new Date(bon.created_at).toLocaleDateString('fr-MA')}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full">En cours</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scanner Modal */}
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
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video ref={videoRef} className="w-full aspect-[3/4] object-cover" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-white rounded-tl-lg" style={{borderWidth: '3px'}} />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-white rounded-tr-lg" style={{borderWidth: '3px'}} />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-white rounded-bl-lg" style={{borderWidth: '3px'}} />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-white rounded-br-lg" style={{borderWidth: '3px'}} />
                  </div>
                </div>
              </div>
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

  const statusColors = {
    en_cours: 'bg-yellow-100 text-yellow-700',
    termine: 'bg-green-100 text-green-700',
    annule: 'bg-red-100 text-red-700',
  };

  const statusLabels = {
    en_cours: 'En cours',
    termine: 'Terminé',
    annule: 'Annulé',
  };

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
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">ID Bon</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nb Colis</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bons.map(bon => (
                <tr key={bon.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{bon.id}</td>
                  <td className="px-4 py-3 text-gray-600">{bon.colis_count}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(bon.created_at).toLocaleDateString('fr-MA')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[bon.status] || 'bg-gray-100 text-gray-600'}`}>
                      {statusLabels[bon.status] || bon.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function RamassagePage({ orders = [], setOrders }) {
  const location = useLocation();
  const isBonsList = location.pathname === '/ramassage/bons';

  if (isBonsList) return <BonsListPage />;
  return <ScannerPage orders={orders} setOrders={setOrders} />;
}
