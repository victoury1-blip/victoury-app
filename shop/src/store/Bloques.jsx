import React, { useEffect, useState } from 'react';
import { ShieldOff, Unlock, Globe, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FUSEAU } from '../lib/fuseau';

/* IP et téléphones bloqués (posés depuis « Commandes »), au même endroit,
 * avec les commandes qui ont mené au blocage — pour vérifier qu'on n'a pas
 * bloqué une vraie cliente, et débloquer d'un clic.
 * Attention : au Maroc beaucoup de clients 4G sortent par la MÊME IP
 * (opérateur) ; une IP bloquée ferme le site entier à tous ceux-là. */

const fmtDate = (d) => d ? new Date(d).toLocaleString('fr-FR', { timeZone: FUSEAU, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const cle9 = (t) => String(t || '').replace(/\D/g, '').slice(-9);

function Commandes({ liste }) {
  if (!liste?.length) return <p className="text-[11px] text-gray-400 mt-1">Aucune commande trouvée pour celui-ci.</p>;
  return (
    <ul className="mt-1.5 space-y-0.5">
      {liste.slice(0, 6).map(o => (
        <li key={o.id} className="text-[11px] text-gray-500 break-words">
          <span className="font-mono text-gray-400">{o.id}</span> · {o.recipient?.name || '—'} · {o.recipient?.phone || ''} · {o.recipient?.city || ''} · <span className="text-gray-400">{fmtDate(o.created_at)}</span>
        </li>
      ))}
      {liste.length > 6 && <li className="text-[11px] text-gray-400">+ {liste.length - 6} autre(s)</li>}
    </ul>
  );
}

export default function Bloques() {
  const [ips, setIps] = useState(null);
  const [tels, setTels] = useState(null);
  const [commandes, setCommandes] = useState([]);
  const [erreur, setErreur] = useState('');

  async function charger() {
    setErreur('');
    const [ri, rt, rc] = await Promise.all([
      supabase.from('shop_ip_bloquees').select('*').order('created_at', { ascending: false }),
      supabase.from('shop_telephones_bloquees').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('id, recipient, created_at').like('id', 'VS-%').order('created_at', { ascending: false }).limit(3000),
    ]);
    if (ri.error || rt.error) setErreur((ri.error || rt.error).message);
    setIps(ri.data || []);
    setTels(rt.data || []);
    setCommandes(rc.data || []);
  }
  useEffect(() => { charger(); }, []);

  async function debloquer(table, colonne, valeur) {
    if (!window.confirm(`Débloquer ${valeur} ?`)) return;
    const { error } = await supabase.from(table).delete().eq(colonne, valeur);
    if (error) { setErreur(error.message); return; }
    if (table === 'shop_ip_bloquees') setIps(l => l.filter(x => x.ip !== valeur));
    else setTels(l => l.filter(x => x.telephone !== valeur));
  }

  const parIp = (ip) => commandes.filter(o => o.recipient?.ip === ip);
  const parTel = (t) => commandes.filter(o => cle9(o.recipient?.phone) === cle9(t));

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><ShieldOff size={20} className="text-red-600" /> Bloqués</h1>
      <p className="text-sm text-gray-500 mt-1">Les IP et téléphones bloqués depuis « Commandes », avec leurs commandes. Débloquez ceux qui sont de vraies clientes.</p>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 leading-relaxed">
        ⚠️ Une <b>IP bloquée ferme tout le site</b> à cette adresse. Avec la 4G (Inwi, Orange, Maroc Telecom), beaucoup de clientes
        partagent la même IP : bloquer une IP peut bloquer des clientes innocentes. Préférez bloquer le <b>téléphone</b>.
      </div>

      {erreur && <p className="mt-4 text-xs text-red-700 bg-red-50 p-3 rounded-lg">{erreur}</p>}

      <h2 className="mt-6 text-sm font-semibold text-gray-700 flex items-center gap-2"><Globe size={15} /> IP bloquées {ips && <span className="text-gray-400">({ips.length})</span>}</h2>
      {ips === null ? <div className="mt-3 h-16 rounded-xl bg-gray-100 animate-pulse" /> : ips.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">Aucune IP bloquée.</p>
      ) : (
        <div className="mt-3 bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {ips.map(x => (
            <div key={x.ip} className="p-4 flex flex-wrap sm:flex-nowrap items-start gap-3">
              <div className="flex-1 min-w-0 basis-full sm:basis-auto">
                <p className="text-sm font-mono font-semibold text-gray-800 break-all">{x.ip}</p>
                <p className="text-[11px] text-gray-400">Bloquée le {fmtDate(x.created_at)}{x.raison ? ` · ${x.raison}` : ''}</p>
                <Commandes liste={parIp(x.ip)} />
              </div>
              <button onClick={() => debloquer('shop_ip_bloquees', 'ip', x.ip)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-gray-900 text-white hover:bg-gray-700 shrink-0">
                <Unlock size={13} /> Débloquer
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-8 text-sm font-semibold text-gray-700 flex items-center gap-2"><Phone size={15} /> Téléphones bloqués {tels && <span className="text-gray-400">({tels.length})</span>}</h2>
      {tels === null ? <div className="mt-3 h-16 rounded-xl bg-gray-100 animate-pulse" /> : tels.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">Aucun téléphone bloqué.</p>
      ) : (
        <div className="mt-3 bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {tels.map(x => (
            <div key={x.telephone} className="p-4 flex flex-wrap sm:flex-nowrap items-start gap-3">
              <div className="flex-1 min-w-0 basis-full sm:basis-auto">
                <p className="text-sm font-mono font-semibold text-gray-800">{x.telephone}</p>
                <p className="text-[11px] text-gray-400">Bloqué le {fmtDate(x.created_at)}{x.raison ? ` · ${x.raison}` : ''}</p>
                <Commandes liste={parTel(x.telephone)} />
              </div>
              <button onClick={() => debloquer('shop_telephones_bloquees', 'telephone', x.telephone)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-gray-900 text-white hover:bg-gray-700 shrink-0">
                <Unlock size={13} /> Débloquer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
