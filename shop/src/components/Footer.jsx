import React from 'react';
import { Link } from 'react-router-dom';
import Wordmark from './Wordmark';

const PAGES = [
  { slug: 'conditions-generales-de-vente', titre: 'Conditions générales de vente' },
  { slug: 'politique-de-livraison', titre: 'Politique de livraison' },
  { slug: 'politique-dechange', titre: "Politique d'échange" },
  { slug: 'politique-de-confidentialite', titre: 'Politique de confidentialité' },
];

export default function Footer({ telephone }) {
  return (
    <footer className="mt-20 border-t border-gray-100 bg-sand">
      <div className="max-w-7xl mx-auto px-6 py-12 grid gap-8 sm:grid-cols-3">
        <div>
          <Wordmark className="text-lg" />
          <p className="mt-3 text-xs text-gray-500 leading-relaxed">
            Ensembles sport, burkinis et robes.<br />Livraison partout au Maroc.
          </p>
        </div>
        <div>
          <h3 className="text-[11px] uppercase tracking-widest text-gray-400 mb-3">Informations</h3>
          <ul className="space-y-2">
            {PAGES.map(p => (
              <li key={p.slug}>
                <Link to={`/${p.slug}/`} className="text-xs text-gray-600 hover:text-ink">{p.titre}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-[11px] uppercase tracking-widest text-gray-400 mb-3">Contact</h3>
          {telephone && <a href={`tel:${telephone}`} className="text-xs text-gray-600 hover:text-ink">{telephone}</a>}
          <p className="mt-4 text-[11px] text-gray-400">© {new Date().getFullYear()} Victoury</p>
        </div>
      </div>
    </footer>
  );
}
