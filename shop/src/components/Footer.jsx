import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Phone, Truck, Wallet } from 'lucide-react';
import Wordmark from './Wordmark';
import { IconeWhatsApp, IconeTikTok } from './icons';

/* Pied de page — description, contact et mentions viennent de /store/theme.
   Les listes sont vides par défaut plutôt que pré-remplies d'une marque qui
   n'est pas la vôtre : rien n'apparaît tant que l'administration n'a rien réglé. */
export default function Footer({ theme, collections }) {
  const f = theme?.footer || {};
  const liens = (titre, items) => items?.length > 0 && (
    <div className="text-center">
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
  // suite quelles icônes restent à compléter dans /store/theme.
  // Deux groupes distincts : les réseaux sociaux (Suivez-nous) et les moyens
  // de contact direct (Contact) — pas mêlés dans une même rangée.
  const reseaux = [
    { cle: 'instagram', Icone: Instagram, href: c.instagram },
    { cle: 'tiktok', Icone: IconeTikTok, href: c.tiktok },
    { cle: 'facebook', Icone: Facebook, href: c.facebook },
  ];
  const contactsDirects = [
    { cle: 'whatsapp', Icone: IconeWhatsApp, href: c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/\D/g, '')}` : '' },
    { cle: 'appel', Icone: Phone, href: c.appel ? `tel:${c.appel}` : '' },
  ];
  const rangeeIcones = (items) => (
    <div className="flex justify-center gap-4">
      {items.map(({ cle, Icone, href }) => (
        href
          ? <a key={cle} href={href} target="_blank" rel="noreferrer" className="opacity-70 hover:opacity-100 transition-opacity"><Icone size={16} /></a>
          : <span key={cle} className="opacity-25" title="Lien non réglé dans /store/theme"><Icone size={16} /></span>
      ))}
    </div>
  );

  return (
    <footer className="mt-20 border-t border-gray-100" style={{ background: f.couleurFond, color: f.couleurTexte }}>
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 gap-8 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1 text-center flex flex-col items-center">
          <Wordmark className="text-lg" />
          {f.description && <p className="mt-3 text-xs opacity-70 leading-relaxed max-w-xs">{f.description}</p>}
          {badgesPaiement.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {badgesPaiement.map(({ texte, Icone }) => (
                <p key={texte} className="flex items-center justify-center gap-1.5 text-xs opacity-70">
                  <Icone size={13} /> {texte}
                </p>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-8">
            <div>
              <h3 className="text-[11px] uppercase tracking-widest text-gray-400 mb-3">Suivez-nous</h3>
              {rangeeIcones(reseaux)}
            </div>
            <div>
              <h3 className="text-[11px] uppercase tracking-widest text-gray-400 mb-3">Contact</h3>
              {rangeeIcones(contactsDirects)}
            </div>
          </div>
        </div>
        {liens('Collections', categories)}
        {liens('Mentions légales', f.mentions)}
      </div>
      <div className="border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] opacity-50 text-center sm:text-left">
            © {new Date().getFullYear()} <strong className="font-semibold">VICTOURY</strong> — Tous droits réservés.
          </p>
          {/* Libellés textuels plutôt que des logos de marque copiés — le
              message ("on accepte ces moyens de paiement") passe pareil sans
              reproduire des marques déposées. */}
          <div className="flex items-center gap-2">
            {['Visa', 'Mastercard', 'PayPal', 'Paiement à la livraison'].map(m => (
              <span key={m} className="text-[10px] font-medium border border-gray-300 rounded px-2 py-1 opacity-60">{m}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
