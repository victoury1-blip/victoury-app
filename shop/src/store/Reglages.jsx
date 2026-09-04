import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { enregistrerReglages } from '../lib/admin';
import { REGLAGES_DEFAUT } from '../lib/catalog';
import { jouerSonCommande } from '../lib/sonCommande';
import { activerPushCommande, pushDisponible } from '../lib/pushNotif';

const champ = 'w-full border border-gray-200 px-3 py-2.5 text-sm bg-white';
const label = 'block text-xs font-medium text-gray-500 mb-1.5';

export default function Reglages() {
  const [r, setR] = useState(REGLAGES_DEFAUT);
  const [enregistrement, setEnregistrement] = useState(false);
  const [ok, setOk] = useState(false);
  // Chrome refuse d'afficher la demande d'autorisation "Notifications" si
  // elle part d'un chargement de page — seul un clic explicite fonctionne à
  // coup sûr. D'où ce bouton, plutôt que de compter uniquement sur le
  // premier contact avec l'admin (qui peut lui-même être passé inaperçu).
  const [permissionNotif, setPermissionNotif] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [activationPush, setActivationPush] = useState(null); // { ok, raison } | null

  // Comme un simple Notification.requestPermission(), MAIS enregistre en plus
  // un abonnement Push : c'est lui qui permet à la notification d'arriver
  // téléphone verrouillé ou onglet fermé, pas seulement pendant qu'on est
  // dans l'administration.
  async function activer() {
    if (pushDisponible()) {
      const r = await activerPushCommande();
      setActivationPush(r);
      setPermissionNotif(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
    } else {
      const p = await Notification.requestPermission();
      setPermissionNotif(p);
    }
  }

  useEffect(() => {
    supabase.from('shop_settings').select('value').eq('key', 'boutique').maybeSingle()
      .then(({ data }) => { if (data?.value) setR({ ...REGLAGES_DEFAUT, ...data.value }); });
  }, []);

  const u = (k, v) => setR(x => ({ ...x, [k]: v }));

  async function enregistrer() {
    setEnregistrement(true);
    // `paliers` n'est plus réglé ici : il se déduit désormais des remises
    // actives de /store/remises, et ne doit pas être réécrit depuis cette page.
    const { paliers, ...sansPaliers } = r;
    const propre = {
      ...sansPaliers,
      livraison: parseFloat(r.livraison) || 0,
      seuilGratuit: r.seuilGratuit ? parseFloat(r.seuilGratuit) : null,
    };
    await enregistrerReglages(propre);
    setEnregistrement(false);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium">Réglages</h1>

      {/* Le logo, le favicon et le bandeau d'annonce ont leur propre page
          (/store/theme), les remises par quantité aussi (/store/remises) —
          avec, pour les deux, un aperçu en temps réel. */}
      <div className="mt-5 space-y-6">
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-xs tracking-widest uppercase text-gray-500 mb-3">Livraison & contact</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Frais de livraison (DH)</label>
              <input value={r.livraison} onChange={e => u('livraison', e.target.value)} type="number" min="0" className={champ} />
              <p className="mt-1 text-[11px] text-gray-400">0 = toujours gratuite</p>
            </div>
            <div>
              {/* Le seuil se compare au montant après remises, pas au sous-total
                  affiché : un code promo peut donc faire réapparaître des frais. */}
              <label className={label}>Livraison gratuite dès (DH)</label>
              <input value={r.seuilGratuit ?? ''} onChange={e => u('seuilGratuit', e.target.value)} type="number" min="0"
                placeholder="Laisser vide = jamais offerte" className={champ} />
            </div>
            <div>
              <label className={label}>Téléphone</label>
              <input value={r.telephone} onChange={e => u('telephone', e.target.value)} className={champ} />
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-xs tracking-widest uppercase text-gray-500 mb-3">Sauvegarde Google Sheets</h2>
          <p className="text-xs text-gray-400 mb-3">
            Chaque commande est aussi envoyée vers une feuille Google Sheets dès qu'elle est enregistrée —
            un filet de secours consultable même si l'application ou Supabase a un souci.
          </p>
          <label className={label}>URL du Web App (Google Apps Script)</label>
          <input value={r.sheetWebhookUrl} onChange={e => u('sheetWebhookUrl', e.target.value)}
            placeholder="https://script.google.com/macros/s/…/exec" className={champ} />
          <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
            Dans votre feuille Google Sheets : Extensions → Apps Script, collez le script fourni par
            l'équipe, Déployer → Nouveau déploiement → Application Web (accès : Tout le monde), puis
            collez l'URL obtenue ici. Laissez vide pour désactiver.
          </p>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-xs tracking-widest uppercase text-gray-500 mb-3">Notifications de commande</h2>
          <p className="text-xs text-gray-400 mb-3">
            Un son et une notification à chaque nouvelle commande du site pendant qu'on est dans
            l'administration — et, si le navigateur le permet, une vraie notification qui arrive même
            l'onglet fermé ou le téléphone verrouillé.
          </p>
          <div className="flex items-center gap-3 mb-1">
            {permissionNotif === 'granted' && <span className="text-xs text-green-600 font-medium">✓ Notifications autorisées</span>}
            {permissionNotif === 'denied' && (
              <span className="text-xs text-red-500">
                Bloquées par le navigateur — à réautoriser dans les réglages du site (icône 🔒 à côté de l'adresse).
              </span>
            )}
            {permissionNotif === 'default' && (
              <button type="button" onClick={activer}
                className="text-xs text-white bg-ink px-3 py-2">Activer les notifications</button>
            )}
            {permissionNotif === 'unsupported' && <span className="text-xs text-gray-400">Non supporté par ce navigateur</span>}
          </div>
          {/* Cet appareil peut être autorisé (permissionNotif granted) sans que
              l'abonnement push ait pu s'enregistrer (clé VAPID absente, ou pas
              encore configurée) — le distinguer évite de croire à tort que le
              push "écran verrouillé" est actif. */}
          {permissionNotif === 'granted' && pushDisponible() && (
            <p className="text-[11px] text-gray-400 mb-4">
              {activationPush === null
                ? <button type="button" onClick={activer} className="underline">Activer aussi hors de l'administration (écran verrouillé)</button>
                : activationPush.ok
                  ? '✓ Reçoit aussi les notifications écran verrouillé / onglet fermé, sur cet appareil.'
                  : `Notification "en direct" seulement (push indisponible : ${activationPush.raison}).`}
            </p>
          )}
          {permissionNotif === 'granted' && !pushDisponible() && (
            <p className="text-[11px] text-gray-400 mb-4">
              Notification "en direct" seulement — le push écran verrouillé n'est pas encore configuré sur ce site.
            </p>
          )}
          <p className="text-xs text-gray-500 mb-3">
            Par défaut, un carillon simple pour le son — déposez votre propre fichier pour le remplacer.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 text-xs tracking-wide uppercase cursor-pointer">
              Choisir un fichier
              <input type="file" accept="audio/*" hidden onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                const lecteur = new FileReader();
                lecteur.onload = ev => u('sonCommandeUrl', ev.target.result);
                lecteur.readAsDataURL(f);
              }} />
            </label>
            {r.sonCommandeUrl && (
              <>
                <button type="button" onClick={() => jouerSonCommande(r.sonCommandeUrl)}
                  className="text-xs text-gray-600 border border-gray-200 px-3 py-2 hover:border-gray-400">Tester</button>
                <button type="button" onClick={() => u('sonCommandeUrl', '')}
                  className="text-xs text-red-500 hover:underline">Retirer</button>
              </>
            )}
          </div>
        </section>

      </div>
      {/* Le Meta Pixel a sa propre page : /store/meta-pixel — il y a plus qu'un
          identifiant à régler, et le jeton d'accès n'a rien à faire ici. */}

      <div className="mt-5 flex items-center gap-3">
        <button onClick={enregistrer} disabled={enregistrement} className="bg-ink text-white px-6 py-3 text-xs tracking-widest uppercase disabled:opacity-60">
          {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {ok && <span className="text-xs text-green-600">Enregistré</span>}
      </div>
    </div>
  );
}
