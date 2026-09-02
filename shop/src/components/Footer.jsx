import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Phone, Truck, Wallet } from 'lucide-react';
import Wordmark from './Wordmark';

/* Glyphes WhatsApp et TikTok : absents de lucide-react, dessinés en SVG
   minimal plutôt que d'ajouter une dépendance pour deux icônes. */
function IconeWhatsApp({ size = 16, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} {...props}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.83 14.02c-.24.68-1.4 1.33-1.93 1.4-.5.08-1.11.11-1.79-.11-.41-.13-.94-.3-1.62-.6-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.08 1-2.37.26-.28.57-.35.76-.35h.55c.18 0 .41-.07.64.49.24.58.81 2 .88 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.47-.14.16-.29.36-.42.48-.14.14-.28.29-.12.56.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.28.14.44.12.6-.07.16-.19.68-.79.87-1.06.19-.28.37-.23.62-.14.26.09 1.63.77 1.91.91.28.14.47.21.53.33.07.12.07.68-.17 1.36Z"/>
    </svg>
  );
}
function IconeTikTok({ size = 16, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} {...props}>
      <path d="M16.6 2h-3.2v13.7a3.1 3.1 0 1 1-2.2-2.97V9.4a6.3 6.3 0 1 0 5.4 6.24V8.7a7.9 7.9 0 0 0 4.9 1.7V7.2a4.5 4.5 0 0 1-4.9-4.2V2Z"/>
    </svg>
  );
}

/* Pied de page — description, contact et mentions viennent de /store/theme.
   Les listes sont vides par défaut plutôt que pré-remplies d'une marque qui
   n'est pas la vôtre : rien n'apparaît tant que l'administration n'a rien réglé. */
export default function Footer({ telephone, theme, collections }) {
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

  // Une sélection propre à ce footer (/store/theme) prime ; sans elle, les
  // vraies catégories du site évitent une liste à retaper à la main.
  const categories = f.collections?.length
    ? f.collections
    : (collections || []).map(c => ({ label: c.name, url: `/product-category/${c.slug}/` }));

  const paiement = f.paiement || {};
  const badgesPaiement = [
    paiement.livraison !== false && { texte: 'Paiement à la livraison', Icone: Truck },
    paiement.virement && { texte: 'Virement bancaire', Icone: Wallet },
  ].filter(Boolean);

  const c = f.contacts || {};
  // Toujours affichées : même sans lien encore réglé, l'admin voit tout de
  // suite quelles icônes de contact restent à compléter dans /store/theme.
  const contacts = [
    { cle: 'whatsapp', Icone: IconeWhatsApp, href: c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/\D/g, '')}` : '' },
    { cle: 'appel', Icone: Phone, href: c.appel ? `tel:${c.appel}` : '' },
    { cle: 'instagram', Icone: Instagram, href: c.instagram },
    { cle: 'tiktok', Icone: IconeTikTok, href: c.tiktok },
    { cle: 'facebook', Icone: Facebook, href: c.facebook },
  ];

  return (
    <footer className="mt-20 border-t border-gray-100" style={{ background: f.couleurFond, color: f.couleurTexte }}>
      <div className="max-w-7xl mx-auto px-6 py-12 grid gap-8 sm:grid-cols-4">
        <div>
          <Wordmark className="text-lg" />
          {f.description && <p className="mt-3 text-xs opacity-70 leading-relaxed">{f.description}</p>}
          {badgesPaiement.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {badgesPaiement.map(({ texte, Icone }) => (
                <p key={texte} className="flex items-center gap-1.5 text-xs opacity-70">
                  <Icone size={13} /> {texte}
                </p>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-3">
            {contacts.map(({ cle, Icone, href }) => (
              href
                ? <a key={cle} href={href} target="_blank" rel="noreferrer" className="opacity-70 hover:opacity-100 transition-opacity"><Icone size={16} /></a>
                : <span key={cle} className="opacity-25" title="Lien non réglé dans /store/theme"><Icone size={16} /></span>
            ))}
          </div>
        </div>
        {liens('Collections', categories)}
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
