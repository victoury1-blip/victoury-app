import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { fmtPrix } from '../lib/pricing';
import { chargerProduit, chargerCouleurs } from '../lib/catalog';

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

export default function Produit({ onAjouter }) {
  const { slug } = useParams();
  const [produit, setProduit] = useState(null);
  const [couleurs, setCouleurs] = useState([]);
  const [taille, setTaille] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setChargement(true); setTaille('');
    chargerProduit(slug)
      .then(async p => {
        setProduit(p);
        setCouleurs(p?.group_id ? await chargerCouleurs(p.group_id) : []);
      })
      .catch(() => setProduit(null))
      .finally(() => setChargement(false));
    window.scrollTo(0, 0);
  }, [slug]);

  if (chargement) return <div className="max-w-7xl mx-auto px-6 py-24 animate-pulse"><div className="h-96 bg-gray-100" /></div>;
  if (!produit) return <p className="max-w-7xl mx-auto px-6 py-24 text-center text-sm text-gray-400">Ce produit n'existe plus.</p>;

  const dispo = (produit.sizes || []).filter(s => s.stock > 0);
  const promo = produit.compare_at > produit.price;
  const stockTaille = dispo.find(s => s.size === taille)?.stock;

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
          {promo && <span className="ml-3 text-sm text-gray-400 line-through">{fmtPrix(produit.compare_at)}</span>}
        </p>

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
          <p className="text-[11px] tracking-widest uppercase text-gray-500">Taille</p>
          {/* Seules les tailles en stock sont proposées : montrer une pointure
              épuisée pour la refuser ensuite fait perdre le client deux fois. */}
          <div className="flex flex-wrap gap-2 mt-3">
            {dispo.length === 0 && <p className="text-sm text-gray-400">Momentanément épuisé</p>}
            {dispo.map(s => (
              <button key={s.size} onClick={() => setTaille(s.size)}
                className={`min-w-[3rem] px-3 py-2.5 text-sm border transition-colors
                  ${taille === s.size ? 'border-ink bg-ink text-white' : 'border-gray-200 hover:border-gray-400'}`}>
                {s.size}
              </button>
            ))}
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
    </div>
  );
}
