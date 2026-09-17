import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, Minus, Plus, Banknote, RotateCcw, ShieldCheck } from 'lucide-react';
import { fmtPrix, totalPanier, lignesAvecRemise } from '../lib/pricing';
import { cleLigne } from '../lib/panier';
import { champsManquants } from '../lib/commande';
import { envoyerCommande } from '../lib/envoi';
import { localiserClient } from '../lib/geoloc';
import { verifierPromo } from '../lib/catalog';
import { trackPixel, trackTikTok, sha256, telephonePourMeta, envoyerCAPI, envoyerTikTokCAPI, idEvenement, cookiesFbPourMeta, cookieTtpPourTikTok, correspondanceAvancee } from '../lib/pixel';
import { useLang } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { miniature, surErreurMiniature } from '../lib/img';

// La couleur du thème (--ink, réglable dans /store/theme), pas le vert de la
// sélection de taille — un champ de saisie n'est pas un choix, il ne doit pas
// emprunter la couleur d'un autre geste.
const champ = 'w-full border-2 border-ink px-3 py-3 text-sm focus:outline-none transition-colors';

export default function Commander({ lignes, reglages, onQuantite, onRetirer, onVider }) {
  const { t: tr, lang } = useLang();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nom: '', telephone: '', ville: '', adresse: '', email: '' });
  const [promo, setPromo] = useState(null);
  const [code, setCode] = useState('');
  const [codeErreur, setCodeErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [manque, setManque] = useState([]);
  // Un seul enregistrement par visite : sans ça, chaque fois que le champ
  // téléphone perd le focus créerait une ligne de plus dans les paniers
  // abandonnés, pour la même personne qui hésite juste entre deux champs.
  const panierEnregistre = useRef(false);
  // Sur iPhone, quitter Safari (bouton Accueil, balayer l'appli, fermer
  // l'onglet) ne déclenche PAS toujours l'événement "blur" du champ
  // téléphone — surtout si le client tape le numéro puis quitte direct sans
  // toucher un autre champ. Le seul "blur" ratait alors systématiquement ce
  // cas. Ce ref donne aux évènements de fermeture de page un accès à l'état
  // le plus récent, sans dépendre de la fermeture (closure) au moment où
  // l'écouteur a été posé.
  const etatActuel = useRef({ form, lignes });
  useEffect(() => { etatActuel.current = { form, lignes }; });

  // Demandée dès l'arrivée sur la page, pas au clic sur "Valider" : elle a
  // ainsi le temps d'aboutir (permission + reverse-geocoding) avant que le
  // client ne finisse de remplir le formulaire. Un refus ou un échec ne
  // bloque jamais rien — geoGPS.current reste simplement null, et le
  // serveur retombe sur la géolocalisation par IP (voir api/commande.js).
  const geoGPS = useRef(null);
  useEffect(() => {
    // Réglable dans /store/reglages ("Localisation GPS") : coupé, la
    // demande d'autorisation du navigateur ne part jamais.
    if (reglages?.geoGPSActif === false) return;
    localiserClient().then(g => { geoGPS.current = g; });
  }, [reglages?.geoGPSActif]);

  const t = totalPanier(lignes, {
    paliers: reglages?.paliers, remises: reglages?.remises, promo, livraison: reglages?.livraison, seuilGratuit: reglages?.seuilGratuit,
  });
  const u = (k, v) => { setForm(f => ({ ...f, [k]: v })); setManque(m => m.filter(x => x !== k)); };

  // Une seule fois à l'arrivée sur la page : la publicité doit voir un panier
  // qui entre en commande, pas chaque changement de quantité qui le précède.
  useEffect(() => {
    const eventID = idEvenement('checkout');
    trackPixel('InitiateCheckout', {
      value: t.total, currency: 'MAD', num_items: t.articles,
      content_ids: lignes.map(l => l.slug), content_type: 'product',
    }, eventID);
    trackTikTok('InitiateCheckout', {
      contents: lignes.map(l => ({ content_id: l.slug, content_name: l.name, price: l.price, quantity: l.qty })),
      value: t.total, currency: 'MAD',
    });
    if (reglages?.tiktok?.enabled && reglages?.tiktok?.pixelId) {
      envoyerTikTokCAPI(reglages.tiktok.pixelId, [{
        event: 'InitiateCheckout', event_time: Math.floor(Date.now() / 1000), event_id: eventID,
        user: cookieTtpPourTikTok(),
        page: { url: window.location.href },
        properties: {
          contents: lignes.map(l => ({ content_id: l.slug, content_name: l.name, price: l.price, quantity: l.qty })),
          value: t.total, currency: 'MAD',
        },
      }], reglages.tiktok.testCode).catch(() => {});
    }
    // Doublon côté serveur du même évènement, avec le même event_id (Meta
    // déduplique) : un client (ou son ad-blocker) qui empêche le pixel
    // navigateur de charger laissait jusqu'ici cette étape — la plus proche
    // de l'achat après le panier — invisible à la publicité. Pas encore de
    // nom/téléphone à ce stade (le client vient d'arriver sur la page) :
    // seuls les cookies _fbp/_fbc et l'IP/user-agent (ajoutés côté serveur)
    // identifient cet évènement, mais ça suffit à ne pas le perdre.
    if (reglages?.pixel?.enabled && reglages?.pixel?.pixelId) {
      envoyerCAPI(reglages.pixel.pixelId, [{
        event_name: 'InitiateCheckout', event_time: Math.floor(Date.now() / 1000),
        event_id: eventID, action_source: 'website', event_source_url: window.location.href,
        user_data: cookiesFbPourMeta(),
        custom_data: { value: t.total, currency: 'MAD', num_items: t.articles },
      }], reglages.pixel.testCode).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dès que le téléphone est plausible : le client a une vraie intention
  // d'achat, qu'il valide ou non ensuite. Silencieux et non bloquant — un
  // souci d'écriture ici ne doit jamais gêner la commande elle-même.
  function noterPanierAbandonne(etat) {
    if (panierEnregistre.current) return;
    const { form: f, lignes: l } = etat || etatActuel.current;
    const chiffres = f.telephone.replace(/\D/g, '');
    if (chiffres.length < 9 || !l.length) return;
    panierEnregistre.current = true;
    supabase.from('shop_paniers_abandonnes').insert({
      nom: f.nom || null,
      telephone: f.telephone,
      lignes: l.map(x => ({ name: x.name, size: x.size, color: x.color, qty: x.qty, price: x.price })),
      total: totalPanier(l, {
        paliers: reglages?.paliers, remises: reglages?.remises, promo, livraison: reglages?.livraison, seuilGratuit: reglages?.seuilGratuit,
      }).total,
    }).then(() => {}, () => { panierEnregistre.current = false; });
  }

  // Filet de sécurité pour iOS : "pagehide" et l'onglet qui devient caché
  // sont les seuls signaux fiables sur Safari mobile quand l'appli est
  // quittée sans qu'aucun champ ne perde le focus au sens classique.
  useEffect(() => {
    const surFermeture = () => noterPanierAbandonne();
    const surVisibilite = () => { if (document.visibilityState === 'hidden') surFermeture(); };
    document.addEventListener('visibilitychange', surVisibilite);
    window.addEventListener('pagehide', surFermeture);
    return () => {
      document.removeEventListener('visibilitychange', surVisibilite);
      window.removeEventListener('pagehide', surFermeture);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function appliquerCode() {
    setCodeErreur('');
    if (!code.trim()) return;
    const p = await verifierPromo(code, t.sousTotal - t.remiseQuantite);
    if (!p) { setPromo(null); setCodeErreur('Code invalide ou expiré'); return; }
    setPromo(p);
  }

  // Un code appliqué avec un panier à 300 DH reste valable côté état même si
  // le client retire ensuite un article et retombe sous le minimum requis —
  // rien ne le revérifiait, et la remise restait affichée/appliquée à tort.
  const apresQuantite = t.sousTotal - t.remiseQuantite;
  useEffect(() => {
    if (!promo) return;
    verifierPromo(code, apresQuantite).then(p => {
      if (!p) { setPromo(null); setCodeErreur('Code désormais invalide pour ce panier'); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apresQuantite]);

  async function valider() {
    setErreur('');
    const m = champsManquants(form, lignes);
    if (m.length) { setManque(m); return; }
    setEnvoi(true);
    const r = await envoyerCommande(form, lignes, t.total, promo ? code : undefined, geoGPS.current);
    setEnvoi(false);
    if (!r.ok) { setErreur(r.error || 'Envoi impossible. Réessayez.'); return; }
    /* Un même identifiant des deux côtés : le pixel du navigateur (rapide, mais
       bloqué par les bloqueurs de pub) et le relais serveur (toujours reçu)
       envoient le MÊME achat, et Meta déduplique au lieu de le compter deux fois. */
    const eventID = idEvenement(r.id);
    // Réinjecte e-mail/téléphone dans le pixel navigateur (haché par le pixel
    // lui-même, jamais transmis en clair) juste avant l'évènement Purchase :
    // sans ça, le pixel n'associait cet achat à AUCUNE identité, seulement le
    // relais serveur ci-dessous le faisait — l'évènement navigateur (souvent
    // reçu plus vite que le relais) restait donc mal apparié chez Meta.
    correspondanceAvancee(reglages?.pixel?.pixelId, { email: form.email, telephone: form.telephone });
    trackPixel('Purchase', { value: t.total, currency: 'MAD', content_ids: lignes.map(l => l.slug), content_type: 'product' }, eventID);
    trackTikTok('CompletePayment', {
      contents: lignes.map(l => ({ content_id: l.slug, content_name: l.name, price: l.price, quantity: l.qty })),
      value: t.total, currency: 'MAD',
    });
    if (reglages?.pixel?.enabled && reglages?.pixel?.pixelId) {
      // Sans e-mail collecté (le formulaire n'en demande pas), le téléphone reste
      // le signal d'identification principal — mais le nom, la ville et les
      // cookies _fbp/_fbc du pixel navigateur donnent à Meta plusieurs signaux
      // supplémentaires pour rattacher l'achat à la bonne personne/session
      // publicitaire ("qualité de correspondance des évènements" dans le
      // Gestionnaire d'évènements). client_ip_address/client_user_agent sont
      // ajoutés côté serveur (api/meta-capi.js), qui seul connaît la vraie
      // adresse IP de l'appelant.
      const [prenom, ...reste] = String(form.nom || '').trim().split(/\s+/);
      const email = String(form.email || '').trim().toLowerCase();
      Promise.all([
        sha256(telephonePourMeta(form.telephone)),
        prenom ? sha256(prenom.toLowerCase()) : null,
        reste.length ? sha256(reste.join(' ').toLowerCase()) : null,
        form.ville ? sha256(form.ville.trim().toLowerCase()) : null,
        sha256(String(r.id)),
        email.includes('@') ? sha256(email) : null,
      ]).then(([ph, fn, ln, ct, externalId, em]) => envoyerCAPI(reglages.pixel.pixelId, [{
        event_name: 'Purchase', event_time: Math.floor(Date.now() / 1000),
        event_id: eventID, action_source: 'website', event_source_url: window.location.href,
        user_data: {
          ph: [ph], external_id: [externalId],
          ...(fn ? { fn: [fn] } : {}), ...(ln ? { ln: [ln] } : {}), ...(ct ? { ct: [ct] } : {}),
          ...(em ? { em: [em] } : {}),
          ...cookiesFbPourMeta(),
        },
        custom_data: { value: t.total, currency: 'MAD', order_id: r.id },
      }], reglages.pixel.testCode)).catch(() => {});
    }
    if (reglages?.tiktok?.enabled && reglages?.tiktok?.pixelId) {
      const emailTt = String(form.email || '').trim().toLowerCase();
      Promise.all([
        sha256(telephonePourMeta(form.telephone)),
        sha256(String(r.id)),
        emailTt.includes('@') ? sha256(emailTt) : null,
      ]).then(([phone, external_id, email]) => envoyerTikTokCAPI(reglages.tiktok.pixelId, [{
        event: 'CompletePayment', event_time: Math.floor(Date.now() / 1000), event_id: eventID,
        user: { phone, external_id, ...(email ? { email } : {}), ...cookieTtpPourTikTok() },
        page: { url: window.location.href },
        properties: {
          contents: lignes.map(l => ({ content_id: l.slug, content_name: l.name, price: l.price, quantity: l.qty })),
          value: t.total, currency: 'MAD',
        },
      }], reglages.tiktok.testCode)).catch(() => {});
    }
    onVider();
    // Le panier est vidé juste avant (onVider) : sans les transmettre ici,
    // la page de remerciement n'aurait plus aucun moyen de savoir ce qui a
    // été commandé pour l'afficher — re-questionner Supabase par id public
    // exposerait la commande de n'importe quel client à qui devine/partage
    // son numéro.
    navigate(`/merci/${r.id}`, { state: { form, lignes, total: t.total } });
  }

  if (!lignes.length) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <p className="text-sm text-gray-400">{tr('panierVide')}</p>
        <Link to="/" className="inline-block mt-6 border border-ink px-8 py-3 text-[11px] tracking-widest uppercase">
          {tr('retourBoutique')}
        </Link>
      </div>
    );
  }

  // Même donnée que le tiroir panier : la remise de chaque article, pas
  // seulement le total en bas — utile ici puisque la caisse a sa propre
  // vue du panier, indépendante du tiroir.
  const remisesEffectives = reglages?.remises?.length ? reglages.remises : (reglages?.paliers?.length ? [{ active: true, paliers: reglages.paliers }] : []);
  const lignesRemisees = lignesAvecRemise(lignes, remisesEffectives);

  const enErreur = (k) => manque.includes(k) ? 'border-red-400' : '';
  // La mise en page reste toujours LTR (voir i18n.jsx), mais un champ de
  // saisie n'est pas une grille d'icônes : un label et un texte arabes qui
  // démarrent collés à gauche se lisent à l'envers pour qui lit de droite à
  // gauche. L'alignement du texte suit la langue, indépendamment du sens de
  // la mise en page.
  const alignTexte = lang === 'ar' ? 'text-right' : 'text-left';
  const dirTexte = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-center text-sm text-ink font-medium">
        {tr('coordonnees')}
      </h1>

      <div className="mt-10 grid lg:grid-cols-2 gap-10">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm text-ink font-medium mb-1.5 ${alignTexte}`}>{tr('nomComplet')} <span className="text-red-500">*</span></label>
              <input value={form.nom} onChange={e => u('nom', e.target.value)} dir={dirTexte} className={`${champ} ${alignTexte} ${enErreur('nom')}`} />
            </div>
            <div>
              <label className={`block text-sm text-ink font-medium mb-1.5 ${alignTexte}`}>{tr('telephone')} <span className="text-red-500">*</span></label>
              <input value={form.telephone} onChange={e => u('telephone', e.target.value)}
                onBlur={() => { noterPanierAbandonne(); correspondanceAvancee(reglages?.pixel?.pixelId, { email: form.email, telephone: form.telephone }); }}
                inputMode="tel" placeholder="06 12 34 56 78" dir="ltr" className={`${champ} text-left ${enErreur('telephone')}`} />
              {manque.includes('telephone') && (
                <p className={`mt-1 text-[11px] text-red-500 ${alignTexte}`}>{lang === 'ar' ? 'رقم هاتف مغربي مكوّن من 10 أرقام' : 'Numéro marocain à 10 chiffres'}</p>
              )}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm text-ink font-medium mb-1.5 ${alignTexte}`}>{tr('ville')} <span className="text-red-500">*</span></label>
              <input value={form.ville} onChange={e => u('ville', e.target.value)} dir={dirTexte} className={`${champ} ${alignTexte} ${enErreur('ville')}`} />
            </div>
            <div>
              <label className={`block text-sm text-ink font-medium mb-1.5 ${alignTexte}`}>{tr('adresse')} <span className="text-red-500">*</span></label>
              <input value={form.adresse} onChange={e => u('adresse', e.target.value)} dir={dirTexte} className={`${champ} ${alignTexte} ${enErreur('adresse')}`} />
            </div>
          </div>
          <div>
            <label className={`block text-sm text-ink font-medium mb-1.5 ${alignTexte}`}>{tr('emailOptionnel')}</label>
            <input type="email" value={form.email} onChange={e => u('email', e.target.value)}
              placeholder="exemple@email.com" dir="ltr" className={`${champ} text-left`} />
          </div>

          <div className="border border-ink px-4 py-3 flex items-center justify-center gap-3">
            <span className="w-3 h-3 rounded-full bg-ink" />
            <span className="text-xs">{tr('paiementLivraison')}</span>
          </div>
        </div>

        <div className="bg-sand p-5">
          <div className="space-y-4">
            {lignesRemisees.map(l => (
              <div key={cleLigne(l)} className="flex gap-3">
                <div className="w-16 h-20 bg-white shrink-0">
                  {l.image && <img src={miniature(l.image)} onError={(e) => surErreurMiniature(e, l.image)} alt="" loading="lazy" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{l.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[l.color, l.size].filter(Boolean).join(' · ')}
                  </p>
                  {/* Même signal que le tiroir panier : rouge, quand une remise
                      par quantité s'applique à cette ligne précise. */}
                  {l.remiseDh > 0 && (
                    <span className="inline-block mt-1.5 bg-red-600 text-white text-[10px] font-medium px-2 py-1 rounded">
                      RÉDUCTION {l.remisePourcent}% (−{fmtPrix(l.remiseDh, lang)})
                    </span>
                  )}
                  {onQuantite && (
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => onQuantite(cleLigne(l), l.qty - 1)}
                        className="w-7 h-7 border border-gray-200 bg-white grid place-items-center" aria-label={tr('quantiteMinus')}>
                        <Minus size={12} />
                      </button>
                      <span className="text-sm w-6 text-center">{l.qty}</span>
                      <button onClick={() => onQuantite(cleLigne(l), l.qty + 1)}
                        className="w-7 h-7 border border-gray-200 bg-white grid place-items-center" aria-label={tr('quantitePlus')}>
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {l.remiseDh > 0 ? (
                    <>
                      <p className="text-sm font-medium text-red-600">{fmtPrix(l.price * l.qty - l.remiseDh, lang)}</p>
                      <p className="text-xs text-gray-400 line-through">{fmtPrix(l.price * l.qty, lang)}</p>
                    </>
                  ) : (
                    <p className="text-sm">{fmtPrix(l.price * l.qty, lang)}</p>
                  )}
                  <button onClick={() => onRetirer(cleLigne(l))} className="mt-1 text-gray-300 hover:text-red-500" aria-label={tr('retirer')}>
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">{tr('sousTotal')}</span><span>{fmtPrix(t.sousTotal, lang)}</span></div>
            {t.remiseQuantite > 0 && (
              <div className="flex justify-between text-green-700"><span>{tr('remise')}</span><span>−{fmtPrix(t.remiseQuantite, lang)}</span></div>
            )}
            {t.remisePromo > 0 && (
              <div className="flex justify-between text-green-700"><span>{tr('codePromo')}</span><span>−{fmtPrix(t.remisePromo, lang)}</span></div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">{lang === 'ar' ? 'التوصيل' : 'Livraison'}</span>
              <span>{t.livraison > 0 ? fmtPrix(t.livraison, lang) : (lang === 'ar' ? 'مجاني' : 'Gratuite')}</span>
            </div>
            {/* Le total en vert (pas juste en noir comme le reste) : la
                dernière chose que le client lit avant de valider, et un
                montant qui tranche visuellement se lit comme "un bon prix"
                plutôt que comme une grosse somme intimidante. */}
            <div className="flex justify-between pt-2 border-t border-gray-200 font-medium">
              <span>{lang === 'ar' ? 'المجموع الكلي' : 'Total'}</span>
              <span className="text-green-600 font-bold text-base">{fmtPrix(t.total, lang)}</span>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <input value={code} onChange={e => setCode(e.target.value)} placeholder={tr('codePromo')}
              className="flex-1 border border-gray-200 px-3 py-2.5 text-sm bg-white" />
            <button onClick={appliquerCode} className="px-4 bg-ink text-white text-[11px] tracking-widest uppercase">
              {tr('appliquer')}
            </button>
          </div>
          {codeErreur && <p className="mt-1 text-[11px] text-red-500">{codeErreur}</p>}

          {erreur && <p className="mt-4 text-xs text-red-600 bg-red-50 p-3">{erreur}</p>}

          <button onClick={valider} disabled={envoi}
            className="mt-5 w-full bg-ink text-white py-4 text-xs tracking-widest uppercase disabled:opacity-60">
            {envoi
              ? tr('envoiEnCours')
              : <>{tr('validerCommande')} — <span className="text-green-400 font-bold">{fmtPrix(t.total, lang)}</span></>}
          </button>

          {/* Rappel des garanties juste sous le bouton : c'est LA seconde
              d'hésitation avant de valider — le doute ("et si le produit ne
              me convient pas ?", "et si ça n'arrive jamais ?") se lève ici,
              pas plus haut dans la page où personne n'y pense encore. */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col items-center gap-1">
              <Banknote size={16} className="text-ink" />
              <span className="text-[10px] text-gray-500 leading-tight">{tr('paiementLivraison')}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <RotateCcw size={16} className="text-ink" />
              <span className="text-[10px] text-gray-500 leading-tight">
                {lang === 'ar' ? 'إمكانية التبديل خلال 3 أيام' : 'Échange possible sous 3 jours'}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ShieldCheck size={16} className="text-ink" />
              <span className="text-[10px] text-gray-500 leading-tight">
                {lang === 'ar' ? 'التحقق قبل الدفع' : 'Vérifiez avant de payer'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
