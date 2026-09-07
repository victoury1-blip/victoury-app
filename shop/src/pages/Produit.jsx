import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { fmtPrix } from '../lib/pricing';
import { chargerProduit, chargerCouleurs, chargerProduitsLies } from '../lib/catalog';
import { paliersEffectifs } from '../lib/remises';
import { trackPixel } from '../lib/pixel';
import CarteProduit from '../components/CarteProduit';
import BoutonFavori from '../components/BoutonFavori';
import { useLang } from '../lib/i18n';

function Accordeon({ titre, children }) {
  const [ouvert, setOuvert] = useState(false);
  if (!children) return null;
  return (
    <div className="border-t border-gray-100">
      <button onClick={() => setOuvert(v => !v)}
        className="w-full flex items-center justify-between py-4 text-xs tracking-widest uppercase">
        {titre}
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${ouvert ? 'rotate-180' : ''}`} />
      </button>
      {ouvert && <div className="pb-5 text-sm text-gray-600 leading-relaxed whitespace-pre-line">{children}</div>}
    </div>
  );
}

export default function Produit({ onAjouter, theme, remises }) {
  const { t, remisePalier } = useLang();
  const { slug } = useParams();
  const [produit, setProduit] = useState(null);
  const [couleurs, setCouleurs] = useState([]);
  const [taille, setTaille] = useState('');
  const [chargement, setChargement] = useState(true);
  const [produitsLies, setProduitsLies] = useState([]);
  // Suggestion "achetés ensemble" : coché par défaut, le client n'a qu'à
  // décocher s'il ne veut que l'article courant — plus rapide que de devoir
  // ouvrir une seconde fiche et refaire tout le parcours d'ajout au panier.
  const [inclurePartenaire, setInclurePartenaire] = useState(true);
  const [tailleBundle, setTailleBundle] = useState('');
  const [photoActive, setPhotoActive] = useState(0);
  const carouselRef = useRef(null);

  // Rien n'indiquait qu'il y avait d'autres photos à côté du swipe au doigt —
  // les flèches le rendent visible, et servent aussi de clic direct pour qui
  // ne pense pas à glisser. Vignette cliquée = même mécanisme.
  function irVersPhoto(i, total) {
    const cible = Math.max(0, Math.min(total - 1, i));
    setPhotoActive(cible);
    const largeur = carouselRef.current?.clientWidth;
    if (largeur) carouselRef.current.scrollTo({ left: cible * largeur, behavior: 'smooth' });
  }

  useEffect(() => {
    setChargement(true); setTaille('');
    chargerProduit(slug)
      .then(async p => {
        setProduit(p);
        // La première taille disponible est déjà choisie : le client qui ne
        // regarde même pas cette ligne peut quand même ajouter au panier, et
        // celui qui veut une autre taille n'a qu'à cliquer dessus.
        setTaille(p?.sizes?.find(s => s.stock > 0)?.size || '');
        setPhotoActive(0);
        const cs = p?.group_id ? await chargerCouleurs(p.group_id) : [];
        setCouleurs(cs);
        const lies = p ? await chargerProduitsLies(p.collection_id, p.id) : [];
        setProduitsLies(lies);
        setInclurePartenaire(true);
        setTailleBundle(lies[0]?.sizes?.find(s => s.stock > 0)?.size || '');
        if (p) trackPixel('ViewContent', {
          content_name: p.name, content_ids: [p.slug], content_type: 'product',
          value: p.price, currency: 'MAD',
        });
      })
      .catch(() => setProduit(null))
      .finally(() => setChargement(false));
    window.scrollTo(0, 0);
  }, [slug]);

  // Changer de couleur ne doit PAS recharger la page : c'est un choix au même
  // titre que la taille, pas une nouvelle fiche à part. On met juste à jour
  // l'affichage avec les données de l'autre couleur (déjà connues via les
  // pastilles) et on aligne l'adresse SANS navigation React Router — sinon
  // l'effet ci-dessus se redéclenche et redonne le flash "page qui recharge"
  // que ce changement doit justement éviter.
  const [changementCouleur, setChangementCouleur] = useState(false);
  async function choisirCouleur(c) {
    if (!c || c.slug === produit?.slug || changementCouleur) return;
    setChangementCouleur(true);
    try {
      const p = await chargerProduit(c.slug);
      if (!p) return;
      setProduit(p);
      setTaille(p.sizes?.find(s => s.stock > 0)?.size || '');
      setPhotoActive(0);
      window.history.replaceState(null, '', `/product/${c.slug}/`);
    } finally {
      setChangementCouleur(false);
    }
  }

  if (chargement) return <div className="max-w-7xl mx-auto px-6 py-24 animate-pulse"><div className="h-96 bg-gray-100" /></div>;
  if (!produit) return <p className="max-w-7xl mx-auto px-6 py-24 text-center text-sm text-gray-400">{t('produitIntrouvable')}</p>;

  // Toutes les tailles sont montrées : une pointure absente laisse croire
  // qu'elle n'a jamais existé, quand elle est seulement épuisée pour l'instant.
  // Le client la voit, comprend qu'elle reviendra, et choisit parmi les autres.
  const tailles = produit.sizes || [];
  const photos = produit.images?.length ? produit.images : [{ url: '' }];
  const promo = produit.compare_at > produit.price;
  // Règles globales + celles ciblant justement la collection de ce produit.
  const paliers = paliersEffectifs(remises, produit.collection_id);
  const stockTaille = tailles.find(s => s.size === taille)?.stock;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-2 gap-10">
      {/* Même carousel (une photo à la fois, flèches + vignettes) sur mobile
          ET sur bureau — l'empilement vertical de toutes les photos sur
          grand écran donnait une colonne bien plus haute que le reste de la
          fiche, sans rien montrer de plus qu'un défilement. */}
      <div>
        <div className="relative">
          <div
            ref={carouselRef}
            onScroll={(e) => {
              const largeur = e.currentTarget.clientWidth;
              if (largeur > 0) setPhotoActive(Math.round(e.currentTarget.scrollLeft / largeur));
            }}
            className="flex overflow-x-auto snap-x snap-mandatory gap-2
                      [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {photos.map((img, i) => (
              <div key={i} className="bg-sand aspect-square overflow-hidden shrink-0 w-full snap-center">
                {img.url
                  ? <img src={img.url} alt={img.alt || produit.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full grid place-items-center text-gray-300 text-xs">{t('photoAVenir')}</div>}
              </div>
            ))}
          </div>
          {photos.length > 1 && (
            <>
              {photoActive > 0 && (
                <button onClick={() => irVersPhoto(photoActive - 1, photos.length)} aria-label="Photo précédente"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow grid place-items-center text-ink">
                  <ChevronLeft size={18} />
                </button>
              )}
              {photoActive < photos.length - 1 && (
                <button onClick={() => irVersPhoto(photoActive + 1, photos.length)} aria-label="Photo suivante"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow grid place-items-center text-ink">
                  <ChevronRight size={18} />
                </button>
              )}
            </>
          )}
        </div>
        {/* Vignettes cliquables sous la photo : passé quelques photos, des
            points ne disent plus laquelle est laquelle, la vignette montre
            directement l'image visée. */}
        {photos.length > 1 && (
          <div className="flex gap-1.5 mt-2.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {photos.map((img, i) => (
              <button key={i} onClick={() => irVersPhoto(i, photos.length)} aria-label={`Photo ${i + 1}`}
                className={`shrink-0 w-12 h-12 bg-sand overflow-hidden border-2 transition-colors ${
                  i === photoActive ? 'border-ink' : 'border-transparent'
                }`}>
                {img.url && <img src={img.url} alt="" className="w-full h-full object-cover" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl tracking-wide">{produit.name}</h1>
          <BoutonFavori slug={produit.slug} className="shrink-0 mt-1 text-gray-400 hover:text-red-500" />
        </div>
        {produit.is_bestseller && (
          <p className="mt-2 inline-flex items-center bg-ink text-white text-xs font-medium px-2.5 py-1 rounded-full">
            {t('meilleureVente')}
          </p>
        )}
        <p className="mt-2">
          <span className="text-lg">{fmtPrix(produit.price)}</span>
          {/* Le prix barré doit sauter aux yeux : c'est lui qui vend la
              réduction, un gris discret le rendait presque invisible. */}
          {promo && <span className="ml-3 text-sm text-red-500 line-through">{fmtPrix(produit.compare_at)}</span>}
        </p>
        {paliers?.length > 0 && (
          <p className="mt-2 inline-flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-medium px-2.5 py-1 rounded-full">
            {remisePalier(paliers[0].pourcent, paliers[0].rang)}
          </p>
        )}

        {couleurs.length > 1 && (
          <div className="mt-6">
            <p className="text-[11px] tracking-widest uppercase text-gray-500">
              {t('couleur')} : <span className="text-ink">{produit.color_name}</span>
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {couleurs.map(c => (
                <button key={c.id} type="button" onClick={() => choisirCouleur(c)} disabled={changementCouleur}
                  title={c.color_name} aria-label={c.color_name}
                  className={`w-7 h-7 rounded-full border-2 disabled:opacity-60 ${c.slug === produit.slug ? 'border-ink' : 'border-gray-200'}`}
                  style={{ background: c.color_hex || '#e5e5e5' }} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <p className="text-[13px] tracking-normal text-ink font-medium">{t('tailleLabel')}</p>
          {/* Réglable depuis /store/theme : la grille convient à un choix
              court (S…XL), la liste à un choix long comme des pointures. */}
          <div className={theme?.produitAffichageTailles === 'liste' ? 'flex flex-col gap-2 mt-3 max-w-xs' : 'flex flex-wrap gap-2 mt-3'}>
            {tailles.length === 0 && <p className="text-sm text-gray-400">{t('epuise')}</p>}
            {tailles.map(s => {
              const epuisee = !(s.stock > 0);
              const liste = theme?.produitAffichageTailles === 'liste';
              return (
                <button key={s.size} type="button" disabled={epuisee}
                  onClick={() => setTaille(s.size)}
                  title={epuisee ? t('epuise') : undefined}
                  className={`${liste ? 'w-full flex items-center justify-between' : 'min-w-[3rem]'} px-3 py-2.5 text-sm border transition-colors relative
                    ${epuisee
                      ? 'border-gray-200 text-ink cursor-not-allowed'
                      : taille === s.size ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white' : 'border-gray-200 hover:border-gray-400'}`}>
                  {s.size}
                  {liste && epuisee && <span className="text-xs text-red-500">{t('epuise')}</span>}
                  {/* Une croix au-dessus du chiffre : le chiffre reste lisible,
                      la croix rouge dit à elle seule qu'il n'est pas disponible. */}
                  {!liste && epuisee && (
                    <X aria-hidden size={28} strokeWidth={1.5}
                      className="pointer-events-none absolute inset-0 m-auto text-red-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button
          disabled={!taille}
          onClick={() => onAjouter({
            slug: produit.slug, name: produit.name, price: produit.price,
            size: taille, color: produit.color_name, image: produit.images?.[0]?.url,
            stock: stockTaille, collectionId: produit.collection_id,
          })}
          className="mt-7 w-full bg-ink text-white py-4 text-xs tracking-widest uppercase
                     disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
          {taille ? t('ajouterPanier') : t('choisirTaille')}
        </button>

        {/* Suggestion "achetés ensemble" : un seul autre article de la même
            collection, pas une liste — l'objectif est un ajout rapide, pas
            un second parcours de choix. Si la remise par quantité (paliers)
            s'applique à cette collection, le total tient déjà compte du prix
            réduit du 2e article, pour ne pas annoncer un total inexact. */}
        {produit.sizes?.some(s => s.stock > 0) && produitsLies[0] && (
          <div className="mt-7 border border-gray-200 rounded-xl p-4">
            <p className="text-[11px] tracking-widest uppercase text-gray-500">{t('achetezEnsemble')}</p>
            <div className="mt-3 flex items-center gap-3">
              <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                <input type="checkbox" checked={inclurePartenaire}
                  onChange={e => setInclurePartenaire(e.target.checked)} className="w-4 h-4 shrink-0" />
                <div className="w-12 h-14 bg-sand shrink-0 overflow-hidden rounded">
                  {produitsLies[0].images?.[0]?.url && (
                    <img src={produitsLies[0].images[0].url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{produitsLies[0].name}</p>
                  <p className="text-xs text-gray-500">{fmtPrix(produitsLies[0].price)}</p>
                </div>
              </label>
            </div>
            <button type="button" disabled={!taille || (inclurePartenaire && !tailleBundle)}
              onClick={() => {
                onAjouter({
                  slug: produit.slug, name: produit.name, price: produit.price,
                  size: taille, color: produit.color_name, image: produit.images?.[0]?.url,
                  stock: stockTaille, collectionId: produit.collection_id,
                });
                if (inclurePartenaire) {
                  const partenaire = produitsLies[0];
                  onAjouter({
                    slug: partenaire.slug, name: partenaire.name, price: partenaire.price,
                    size: tailleBundle, color: partenaire.color_name, image: partenaire.images?.[0]?.url,
                    stock: partenaire.sizes?.find(s => s.size === tailleBundle)?.stock, collectionId: partenaire.collection_id,
                  });
                }
              }}
              className="mt-3 w-full border border-ink text-ink py-3 text-xs tracking-widest uppercase
                         disabled:border-gray-200 disabled:text-gray-400 transition-colors">
              {t('ajouterLaSelection')} — {fmtPrix(produit.price + (inclurePartenaire ? produitsLies[0].price : 0))}
            </button>
          </div>
        )}

        {produit.description && <p className="mt-6 text-sm text-gray-600 leading-relaxed">{produit.description}</p>}
        <div className="mt-8">
          <Accordeon titre={t('detailsProduit')}>{produit.details}</Accordeon>
          <Accordeon titre={t('livraisonTitre')}>{t('livraisonTexte')}</Accordeon>
        </div>
      </div>

      {produitsLies.length > 0 && (
        <div className="col-span-full mt-6 border-t border-gray-100 pt-10">
          <h2 className="text-sm tracking-[0.2em] uppercase text-gray-500">{t('produitsSimilaires')}</h2>
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
            {produitsLies.map(p => <CarteProduit key={p.id} produit={p} remises={remises} />)}
          </div>
        </div>
      )}
    </div>
  );
}
