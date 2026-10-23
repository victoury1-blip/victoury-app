import { describe, it, expect } from 'vitest';
import { nettoyerCommentaire, derniereEtape } from '../lib/ozonEtape';

describe('dernière étape Ozon', () => {
  it('nettoie le commentaire', () => {
    expect(nettoyerCommentaire('| Commentaire: Distribué par ramasseur / En Agence')).toBe('Distribué par ramasseur / En Agence');
    expect(nettoyerCommentaire('&lt;b&gt;Reçu&lt;/b&gt; par Agence')).toBe('Reçu par Agence');
  });

  it('prend la ligne la plus récente', () => {
    const e = derniereEtape([
      { STATUT: 'Retourné', TIME_STR: '2026-10-10 18:06', COMMENT: '| Commentaire: Retour Client Préparé' },
      { STATUT: 'Retourné', TIME_STR: '2026-10-11 12:07', COMMENT: '| Commentaire: Distribué par ramasseur / En Agence' },
      { STATUT: 'Expédié', TIME_STR: '2026-09-26 10:00', COMMENT: '' },
    ]);
    expect(e).toEqual({ statut: 'Retourné', commentaire: 'Distribué par ramasseur / En Agence', date: '2026-10-11 12:07' });
  });

  it('accepte un historique en objet et ignore « pas de commentaire »', () => {
    const e = derniereEtape({ a: { STATUT: 'Livré', TIME_STR: '2026-10-01 10:00', COMMENT: 'Pas de commentaire fourni' } });
    expect(e.commentaire).toBe('');
    expect(derniereEtape([])).toBeNull();
  });
});
