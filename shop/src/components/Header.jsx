import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Search, ShoppingBag, Menu, X } from 'lucide-react';
import Wordmark from './Wordmark';

/* Position du logo : réglable depuis /store/theme.
 *   gauche — logo et navigation côte à côte, icônes à droite (le plus courant).
 *   centre — logo au milieu, navigation en second rang, icônes à droite.
 *   droite — l'inverse de « gauche » : logo et navigation à droite, icônes à gauche.
 * Un seul composant plutôt que trois mises en page séparées : la logique de
 * recherche, panier et menu mobile ne doit exister qu'à un seul endroit. */
export default function Header({ collections = [], nbArticles = 0, onOuvrirPanier, logoUrl, logoPosition = 'gauche' }) {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const lien = ({ isActive }) =>
    `text-[13px] tracking-widest uppercase transition-colors ${isActive ? 'text-ink' : 'text-gray-500 hover:text-ink'}`;

  const Logo = (
    <Link to="/" className="shrink-0">
      {/* Un logo déposé remplace le texte ; sans lui, le nom en capitales
          reste net à toute taille — jamais de logo cassé ou flou. */}
      {logoUrl ? <img src={logoUrl} alt="Victoury" className="h-8 sm:h-9 w-auto object-contain" /> : <Wordmark className="text-xl sm:text-2xl" />}
    </Link>
  );

  const Nav = (
    <nav className="hidden lg:flex items-center gap-7">
      {collections.map(c => (
        <NavLink key={c.slug} to={`/product-category/${c.slug}/`} className={lien}>{c.name}</NavLink>
      ))}
    </nav>
  );

  const Icones = (
    <div className="flex items-center gap-1">
      <Link to="/recherche" className="p-2 text-gray-600 hover:text-ink" aria-label="Rechercher">
        <Search size={19} />
      </Link>
      {/* Le compteur porte un libellé lisible : « 2 » seul ne dit rien à
          qui n'a pas l'icône sous les yeux. */}
      <button onClick={onOuvrirPanier} className="relative p-2 text-gray-600 hover:text-ink"
        aria-label={`Panier, ${nbArticles} article${nbArticles > 1 ? 's' : ''}`}>
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
          <div className="py-2.5">
            <div className="flex items-center h-11">
              {MenuMobile}
              <div className="flex-1 flex justify-center">{Logo}</div>
              {Icones}
            </div>
            <div className="hidden lg:flex justify-center pb-2">{Nav}</div>
          </div>
        ) : logoPosition === 'droite' ? (
          <div className="flex items-center gap-4 h-16">
            {MenuMobile}
            {Icones}
            <div className="ml-auto flex items-center gap-8">{Nav}{Logo}</div>
          </div>
        ) : (
          <div className="flex items-center gap-4 h-16">
            {MenuMobile}
            {Logo}
            <div className="ml-8">{Nav}</div>
            <div className="ml-auto">{Icones}</div>
          </div>
        )}
      </div>

      {menuOuvert && (
        <nav className="lg:hidden border-t border-gray-100 bg-white">
          {collections.map(c => (
            <NavLink key={c.slug} to={`/product-category/${c.slug}/`} onClick={() => setMenuOuvert(false)}
              className="block px-6 py-3.5 text-sm tracking-widest uppercase text-gray-700 border-b border-gray-50">
              {c.name}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
