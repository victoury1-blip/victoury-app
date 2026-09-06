import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Search, ShoppingBag, Menu, X } from 'lucide-react';
import Wordmark from './Wordmark';
import { useLang } from '../lib/i18n';

/* Position du logo : réglable depuis /store/theme.
 *   gauche — logo et navigation côte à côte, icônes à droite (le plus courant).
 *   centre — logo au milieu, navigation en second rang, icônes à droite.
 *   droite — l'inverse de « gauche » : logo et navigation à droite, icônes à gauche.
 * Un seul composant plutôt que trois mises en page séparées : la logique de
 * recherche, panier et menu mobile ne doit exister qu'à un seul endroit. */
function Header({ collections = [], nbArticles = 0, onOuvrirPanier, logoUrl, logoPosition = 'gauche' }) {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const { lang, setLang, t } = useLang();
  // Une collection « Soldes » se distingue en rouge, comme sur l'ancien site —
  // c'est le seul lien de la barre qui doit sauter aux yeux.
  const estSoldes = (c) => /soldes?/i.test(c.slug || c.name || '');

  const Logo = (
    <Link to="/" className="shrink-0">
      {/* Un logo déposé remplace le texte ; sans lui, le nom en capitales
          reste net à toute taille — jamais de logo cassé ou flou. */}
      {logoUrl ? <img src={logoUrl} alt="Victoury" className="h-8 sm:h-9 w-auto object-contain" /> : <Wordmark className="text-xl sm:text-2xl" />}
    </Link>
  );

  // Bandeau catégories plein-largeur, fond gris — comme l'ancien site : une
  // seconde ligne clairement séparée du logo/panier, pas mêlée à eux.
  const BarreCategories = collections.length > 0 && (
    <div className="bg-gray-100 border-b border-gray-200">
      {/* Sur mobile la ligne défile plutôt que de passer à la ligne : un
          bandeau sur deux rangs mangerait trop de hauteur d'écran. */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-center gap-6 sm:gap-10 py-2.5 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {collections.map(c => (
          <NavLink key={c.slug} to={`/product-category/${c.slug}/`}
            className={({ isActive }) => `shrink-0 text-[12px] font-semibold tracking-widest uppercase transition-colors ${
              estSoldes(c) ? 'text-red-600 hover:text-red-700' : isActive ? 'text-ink' : 'text-gray-700 hover:text-ink'
            }`}>
            {c.name}
          </NavLink>
        ))}
      </nav>
    </div>
  );

  // Bouton FR/AR : bascule manuelle uniquement, pas de détection automatique
  // du téléphone du client — juste le choix qu'il retient d'une visite à l'autre.
  // Un seul drapeau (celui de la langue absente) laissait deviner qu'il se
  // passe quelque chose au clic, sans dire clairement "il y a un choix de
  // langue ici". Les deux drapeaux côte à côte, celui de la langue active
  // visiblement enfoncé/coloré, se lisent comme un vrai sélecteur — pas un
  // bouton mystère.
  const BoutonLangue = (
    <div className="flex items-center gap-0.5 border border-gray-200 rounded overflow-hidden">
      <button onClick={() => setLang('fr')} aria-label="Français" title="Français"
        className={`px-1.5 py-1 text-base leading-none transition-colors ${lang === 'fr' ? 'bg-gray-100' : 'opacity-40 hover:opacity-75'}`}>
        🇫🇷
      </button>
      <button onClick={() => setLang('ar')} aria-label="العربية" title="العربية"
        className={`px-1.5 py-1 text-base leading-none transition-colors ${lang === 'ar' ? 'bg-gray-100' : 'opacity-40 hover:opacity-75'}`}>
        🇲🇦
      </button>
    </div>
  );

  const Icones = (
    <div className="flex items-center gap-1">
      {BoutonLangue}
      <Link to="/recherche" className="p-2 text-gray-600 hover:text-ink" aria-label={t('rechercher')}>
        <Search size={19} />
      </Link>
      {/* Le compteur porte un libellé lisible : « 2 » seul ne dit rien à
          qui n'a pas l'icône sous les yeux. */}
      <button onClick={onOuvrirPanier} className="relative p-2 text-gray-600 hover:text-ink"
        aria-label={`${t('votrePanier')}, ${nbArticles}`}>
        <ShoppingBag size={19} />
        {nbArticles > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-ink text-white text-[10px] font-semibold
                           w-4 h-4 rounded-full grid place-items-center">{nbArticles}</span>
        )}
      </button>
    </div>
  );

  const MenuMobile = (
    <button onClick={() => setMenuOuvert(v => !v)} className="lg:hidden p-2 -ml-2" aria-label="Menu">
      {menuOuvert ? <X size={20} /> : <Menu size={20} />}
    </button>
  );

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {logoPosition === 'centre' ? (
          <div className="flex items-center h-16">
            {MenuMobile}
            <div className="flex-1 flex justify-center">{Logo}</div>
            {Icones}
          </div>
        ) : logoPosition === 'droite' ? (
          <div className="flex items-center gap-4 h-16">
            {MenuMobile}
            {Icones}
            <div className="ml-auto">{Logo}</div>
          </div>
        ) : (
          <div className="flex items-center gap-4 h-16">
            {MenuMobile}
            {Logo}
            <div className="ml-auto">{Icones}</div>
          </div>
        )}
      </div>

      {BarreCategories}

      {menuOuvert && (
        <nav className="lg:hidden border-t border-gray-100 bg-white">
          {collections.map(c => (
            <NavLink key={c.slug} to={`/product-category/${c.slug}/`} onClick={() => setMenuOuvert(false)}
              className={`block px-6 py-3.5 text-sm tracking-widest uppercase border-b border-gray-50 ${estSoldes(c) ? 'text-red-600' : 'text-gray-700'}`}>
              {c.name}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}

// Sticky, monté une seule fois, mais l'ancêtre (Vitrine) se re-rend à chaque
// ajout au panier — sans memo, tout son contenu (barre catégories, menu
// mobile) recalculait pour rien à chaque clic "Ajouter au panier".
export default React.memo(Header);
