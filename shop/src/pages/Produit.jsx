import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import { fmtPrix, ordinal } from '../lib/pricing';
import { chargerProduit, chargerCouleurs, chargerProduitsLies } from '../lib/catalog';
import { paliersEffectifs } from '../lib/remises';
import { trackPixel } from '../lib/pixel';
import CarteProduit from '../components/CarteProduit';

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
  const { slug } = useParams();
  const [produit, setProduit] = useState(null);
  const [couleurs, setCouleurs] = useState([]);
  const [taille, setTaille] = useState('');
  const [chargement, setChargement] = useState(true);
  const [produitsLies, setProduitsLies] = useState([]);

  useEffect(() => {
    setChargement(true); setTaille('');
    chargerProduit(slug)
      .then(async p => {
        setProduit(p);
        // La première taille disponible est déjà choisie : le client qui ne
        // regarde même pas cette ligne peut quand même ajouter au panier, et
        // celui qui veut une autre taille n'a qu'à cliquer dessus.
        setTaille(p?.sizes?.find(s => s.stock > 0)?.size || '');
        const cs = p?.group_id ? await chargerCouleurs(p.group_id) : [];
        // La couleur actuellement affichée ressort en tête des pastilles —
        // les « autres » couleurs viennent après, jamais avant elle.
        setCouleurs(p ? [...cs].sort((a, b) => (a.slug === p.slug ? -1 : b.slug === p.slug ? 1 : 0)) : cs);
        setProduitsLies(p ? await chargerProduitsLies(p.collection_id, p.id) : []);
        if (p) trackPixel('ViewContent', {
          content_name: p.name, content_ids: [p.slug], content_type: 'product',
          value: p.price, currency: 'MAD',
        });
      })
      .catch(() => setProduit(null))
      .finally(() => setChargement(false));
    window.scrollTo(0, 0);
  }, [slug]);

  if (chargement) return <div className="max-w-7xl mx-auto px-6 py-24 animate-pulse"><div className="h-96 bg-gray-100" /></div>;
  if (!produit) return <p className="max-w-7xl mx-auto px-6 py-24 text-center text-sm text-gray-400">Ce produit n'existe plus.</p>;

  // Toutes les tailles sont montrées : une pointure absente laisse croire
  // qu'elle n'a jamais existé, quand elle est seulement épuisée pour l'instant.
  // Le client la voit, comprend qu'elle reviendra, et choisit parmi les autres.
  const tailles = produit.sizes || [];
  const promo = produit.compare_at > produit.price;
  // Règles globales + celles ciblant justement la collection de ce produit.
  const paliers = paliersEffectifs(remises, produit.collection_id);
  const stockTaille = tailles.find(s => s.size === taille)?.stock;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-2 gap-10">
      <div className="space-y-2">
        {(produit.images?.length ? produit.images : [{ url: '' }]).map((img, i) => (
          <div key={i} className="bg-sand aspect-square overflow-hidden">
            {img.url
              ? <img src={img.url} alt={img.alt || produit.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full grid place-items-center text-gray-300 text-xs">Photo à venir</div>}
          </div>
        ))}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <h1 className="text-xl tracking-wide">{produit.name}</h1>
        <p className="mt-2">
          <span className="text-lg">{fmtPrix(produit.price)}</span>
          {/* Le prix barré doit sauter aux yeux : c'est lui qui vend la
              réduction, un gris discret le rendait presque invisible. */}
          {promo && <span className="ml-3 text-sm text-red-500 line-through">{fmtPrix(produit.compare_at)}</span>}
        </p>
        {paliers?.length > 0 && (
          <p className="mt-2 inline-flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-medium px-2.5 py-1 rounded-full">
            −{paliers[0].pourcent}% dès le {ordinal(paliers[0].rang)} article
          </p>
        )}

        {couleurs.length > 1 && (
          <div className="mt-6">
            <p className="text-[11px] tracking-widest uppercase text-gray-500">
              Couleur : <span className="text-ink">{produit.color_name}</span>
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {couleurs.map(c => (
                <Link key={c.id} to={`/product/${c.slug}/`} title={c.color_name} aria-label={c.color_name}
                  className={`w-7 h-7 rounded-full border-2 ${c.slug === produit.slug ? 'border-ink' : 'border-gray-200'}`}
                  style={{ background: c.color_hex || '#e5e5e5' }} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          {/* Le client marocain lit son marché en arabe : l'étiquette de la
              taille — champ décisif, mal choisi il fait retourner le colis —
              est celle qui a le plus à gagner à être dans sa langue. */}
          <p dir="rtl" lang="ar" className="text-[13px] tracking-normal text-ink font-medium">اختر القياس</p>
          {/* Réglable depuis /store/theme : la grille convient à un choix
              court (S…XL), la liste à un choix long comme des pointures. */}
          <div className={theme?.produitAffichageTailles === 'liste' ? 'flex flex-col gap-2 mt-3 max-w-xs' : 'flex flex-wrap gap-2 mt-3'}>
            {tailles.length === 0 && <p className="text-sm text-gray-400">Momentanément épuisé</p>}
            {tailles.map(s => {
              const epuisee = !(s.stock > 0);
              const liste = theme?.produitAffichageTailles === 'liste';
              return (
                <button key={s.size} type="button" disabled={epuisee}
                  onClick={() => setTaille(s.size)}
                  title={epuisee ? 'Épuisé' : undefined}
                  className={`${liste ? 'w-full flex items-center justify-between' : 'min-w-[3rem]'} px-3 py-2.5 text-sm border transition-colors relative
                    ${epuisee
                      ? 'border-gray-200 text-ink cursor-not-allowed'
                      : taille === s.size ? 'border-green-600 bg-green-600 text-white' : 'border-gray-200 hover:border-gray-400'}`}>
                  {s.size}
                  {liste && epuisee && <span className="text-xs text-red-500">Épuisé</span>}
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
            stock: stockTaille,
          })}
          className="mt-7 w-full bg-ink text-white py-4 text-xs tracking-widest uppercase
                     disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
          {taille ? 'Ajouter au panier' : 'Choisissez une taille'}
        </button>

        {produit.description && <p className="mt-6 text-sm text-gray-600 leading-relaxed">{produit.description}</p>}
        <div className="mt-8">
          <Accordeon titre="Détails du produit">{produit.details}</Accordeon>
          <Accordeon titre="Livraison">Livraison partout au Maroc. Paiement à la livraison.</Accordeon>
        </div>
      </div>

      {produitsLies.length > 0 && (
        <div className="col-span-full mt-6 border-t border-gray-100 pt-10">
          <h2 className="text-sm tracking-[0.2em] uppercase text-gray-500">Produits similaires</h2>
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
            {produitsLies.map(p => <CarteProduit key={p.id} produit={p} remises={remises} />)}
          </div>
        </div>
      )}
    </div>
  );
}
