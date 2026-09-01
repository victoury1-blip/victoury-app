import React from 'react';
import { Link } from 'react-router-dom';
import Wordmark from './Wordmark';

/* Pied de page — description, liens de collections, réseaux sociaux et
   mentions légales viennent tous de /store/theme. Les listes sont vides par
   défaut plutôt que pré-remplies d'une marque qui n'est pas la vôtre : rien
   n'apparaît tant que l'administration n'a rien réglé. */
export default function Footer({ telephone, theme }) {
  const f = theme?.footer || {};
  const liens = (titre, items) => items?.length > 0 && (
    <div>
      <h3 className="text-[11px] uppercase tracking-widest text-gray-400 mb-3">{titre}</h3>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i}>
            {/^https?:\/\//.test(it.url)
              ? <a href={it.url} target="_blank" rel="noreferrer" className="text-xs text-gray-600 hover:text-ink">{it.label}</a>
              : <Link to={it.url} className="text-xs text-gray-600 hover:text-ink">{it.label}</Link>}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <footer className="mt-20 border-t border-gray-100" style={{ background: f.couleurFond, color: f.couleurTexte }}>
      <div className="max-w-7xl mx-auto px-6 py-12 grid gap-8 sm:grid-cols-4">
        <div>
          <Wordmark className="text-lg" />
          {f.description && <p className="mt-3 text-xs opacity-70 leading-relaxed">{f.description}</p>}
        </div>
        {liens('Collections', f.collections)}
        {liens('Suivez-nous', f.reseaux)}
        {liens('Mentions légales', f.mentions)}
        {telephone && (
          <div>
            <h3 className="text-[11px] uppercase tracking-widest text-gray-400 mb-3">Contact</h3>
            <a href={`tel:${telephone}`} className="text-xs opacity-70 hover:opacity-100">{telephone}</a>
          </div>
        )}
      </div>
      <p className="text-center text-[11px] opacity-40 pb-6">© {new Date().getFullYear()} Victoury</p>
    </footer>
  );
}
