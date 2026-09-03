import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Phone } from 'lucide-react';
import Wordmark from './Wordmark';
import { IconeWhatsApp, IconeTikTok, IconeVisa, IconeMastercard, IconePayPal } from './icons';
import { numeroWhatsApp } from '../lib/commande';
import { useLang } from '../lib/i18n';

/* Pied de page — description, contact et mentions viennent de /store/theme.
   Les listes sont vides par défaut plutôt que pré-remplies d'une marque qui
   n'est pas la vôtre : rien n'apparaît tant que l'administration n'a rien réglé. */
export default function Footer({ theme, collections }) {
  const { t } = useLang();
  const f = theme?.footer || {};
  const liens = (titre, items) => items?.length > 0 && (
    <div className="text-center">
      <h3 className="text-[13px] uppercase tracking-widest text-gray-400 mb-3 font-medium">{titre}</h3>
      <ul className="space-y-2.5">
        {items.map((it, i) => (
          <li key={i}>
            {/^https?:\/\//.test(it.url)
              ? <a href={it.url} target="_blank" rel="noreferrer" className="text-[15px] text-gray-600 hover:text-ink">{it.label}</a>
              : <Link to={it.url} className="text-[15px] text-gray-600 hover:text-ink">{it.label}</Link>}
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

  const c = f.contacts || {};
  // Toujours affichées : même sans lien encore réglé, l'admin voit tout de
  // suite quelles icônes restent à compléter dans /store/theme.
  // Deux groupes distincts : les réseaux sociaux (Suivez-nous) et les moyens
  // de contact direct (Contact) — pas mêlés dans une même rangée.
  // Couleurs de marque plutôt que la couleur du thème — ce sont des logos
  // reconnaissables, les rendre monochromes les rend juste plus durs à repérer.
  const reseaux = [
    { cle: 'instagram', Icone: Instagram, href: c.instagram, couleur: '#E4405F' },
    { cle: 'tiktok', Icone: IconeTikTok, href: c.tiktok, couleur: '#25F4EE' },
    { cle: 'facebook', Icone: Facebook, href: c.facebook, couleur: '#1877F2' },
  ];
  const contactsDirects = [
    { cle: 'whatsapp', Icone: IconeWhatsApp, href: numeroWhatsApp(c.whatsapp) ? `https://wa.me/${numeroWhatsApp(c.whatsapp)}` : '', couleur: '#25D366' },
    { cle: 'appel', Icone: Phone, href: c.appel ? `tel:${c.appel}` : '', couleur: '#34B7F1' },
  ];
  const rangeeIcones = (items) => (
    <div className="flex justify-center gap-6">
      {items.map(({ cle, Icone, href, couleur }) => (
        href
          ? <a key={cle} href={href} target="_blank" rel="noreferrer" style={{ color: couleur }} className="opacity-90 hover:opacity-100 transition-opacity"><Icone size={23} /></a>
          : <span key={cle} style={{ color: couleur }} className="opacity-30" title="Lien non réglé dans /store/theme"><Icone size={23} /></span>
      ))}
    </div>
  );

  return (
    <footer className="mt-16 border-t border-gray-100" style={{ background: f.couleurFond, color: f.couleurTexte }}>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-10 grid grid-cols-2 gap-8 sm:gap-14 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1 text-center flex flex-col items-center">
          {/* Le même logo qu'en haut de page — un texte "VICTOURY" générique
              ici contredirait le logo déposé dans /store/theme. Le fichier
              déposé est un texte noir sur fond blanc (pensé pour un header
              clair) : sur ce pied de page sombre, il est inversé (le fond
              blanc devient noir, le texte noir devient blanc) puis fondu en
              mode "screen" — sur un fond noir, cela revient à effacer le
              carré blanc et ne garder que le texte, sans image détourée. */}
          {theme?.logoUrl
            ? <img src={theme.logoUrl} alt="Victoury" className="h-9 w-auto object-contain"
                style={{ filter: 'invert(1)', mixBlendMode: 'screen' }} />
            : <Wordmark className="text-[28px]" style={{ color: '#fff' }} />}
          {f.description && <p className="mt-4 text-[15px] opacity-70 leading-relaxed max-w-xs">{f.description}</p>}
          <div className="mt-6 flex gap-10 sm:gap-12">
            <div>
              <h3 className="text-[13px] uppercase tracking-widest text-gray-400 mb-3 font-medium">{t('suivezNous')}</h3>
              {rangeeIcones(reseaux)}
            </div>
            <div>
              <h3 className="text-[13px] uppercase tracking-widest text-gray-400 mb-3 font-medium">{t('contact')}</h3>
              {rangeeIcones(contactsDirects)}
            </div>
          </div>
        </div>
        {liens(t('collections'), categories)}
        {liens(t('mentionsLegales'), f.mentions)}
      </div>
      <div className="border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs opacity-50 text-center sm:text-left">
            © {new Date().getFullYear()} <strong className="font-semibold">VICTOURY</strong> — Tous droits réservés.
          </p>
          {/* Repères reconnaissables (silhouette Mastercard, "P" PayPal, VISA
              en italique) plutôt qu'une reproduction exacte des logos déposés
              — le message ("on accepte ces moyens") passe pareil. */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="border border-gray-300 rounded px-3 py-1.5 bg-white"><IconeVisa /></span>
            <span className="border border-gray-300 rounded px-3 py-1.5 bg-white"><IconeMastercard /></span>
            <span className="border border-gray-300 rounded px-3 py-1.5 bg-white"><IconePayPal /></span>
            <span className="text-xs font-medium border border-gray-300 rounded px-3 py-1.5 opacity-60">{t('paiementLivraison')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
