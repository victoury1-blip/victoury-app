import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { chargerPage } from '../lib/catalog';
import { useLang } from '../lib/i18n';

export default function PageStatique() {
  const { slug } = useParams();
  const { lang } = useLang();
  const [page, setPage] = useState(undefined);
  useEffect(() => {
    chargerPage(slug).then(setPage).catch(() => setPage(null));
    window.scrollTo(0, 0);
  }, [slug]);

  if (page === undefined) return <div className="max-w-3xl mx-auto px-6 py-24 animate-pulse"><div className="h-64 bg-gray-100" /></div>;
  if (!page) return <p className="max-w-3xl mx-auto px-6 py-24 text-center text-sm text-gray-400">Cette page n'existe pas.</p>;

  // Une page pas encore traduite (title_ar/body_ar vides) retombe sur son
  // contenu français plutôt que d'afficher un titre ou un corps vide.
  const titre = (lang === 'ar' && page.title_ar) || page.title;
  const corps = (lang === 'ar' && page.body_ar) || page.body;

  return (
    <article className="max-w-3xl mx-auto px-6 py-14">
      <h1 className="text-lg tracking-[0.2em] uppercase">{titre}</h1>
      <div className="mt-8 text-sm text-gray-700 leading-relaxed whitespace-pre-line">{corps}</div>
    </article>
  );
}
