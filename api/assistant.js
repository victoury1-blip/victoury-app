// Assistant IA Victoury : répond en darija aux questions sur les données du
// magasin. Le client envoie un « digest » (statistiques agrégées calculées
// côté client) + la question ; on interroge Claude et on renvoie la réponse.
// Nécessite ANTHROPIC_API_KEY dans les variables d'environnement Vercel.

import Anthropic from '@anthropic-ai/sdk';
import { isAuthenticated } from './_auth.js';

const SYSTEM = `Tu es l'assistant intelligent de "Victoury", une boutique e-commerce marocaine de vêtements avec livraison à domicile (COD).
Tu reçois un résumé JSON des données réelles du magasin (commandes, statuts, CA, villes, produits, livreurs, périodes).
Réponds à la question du gérant en DARIJA MAROCAINE (arabe marocain, alphabet arabe), de façon courte, chiffrée et directe.
Règles :
- Base-toi UNIQUEMENT sur les données fournies. Si une info n'y est pas, dis-le clairement.
- Donne les chiffres exacts (totaux, pourcentages, DH) quand ils existent.
- Sois concret : si on te demande un conseil, propose une action précise basée sur les chiffres.
- Les statuts : livre=تسلّم, refuse=مرفوض, annule=ملغى, retour_recu=رجع, reporter=مأجل, en_attente=فالانتظار, confirme=مأكد, nouveau=جديد.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  if (!(await isAuthenticated(req))) return res.status(401).json({ error: 'Non autorisé' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY manquante — ajoutez-la dans Vercel (Settings → Environment Variables), puis redéployez.",
    });
  }

  const { question, digest } = req.body || {};
  if (!question || typeof question !== 'string' || question.length > 2000) {
    return res.status(400).json({ error: 'Question invalide' });
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Données du magasin (JSON):\n${JSON.stringify(digest || {}, null, 0).slice(0, 60000)}\n\nQuestion: ${question}`,
        },
      ],
    });
    if (response.stop_reason === 'refusal') {
      return res.status(200).json({ answer: 'ما قدرتش نجاوب على هاد السؤال. جرب صيغة أخرى.' });
    }
    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    return res.status(200).json({ answer: text || '—' });
  } catch (e) {
    const msg = e?.status === 401 ? 'Clé API invalide' : (e?.message || 'Erreur inconnue');
    return res.status(500).json({ error: `Assistant indisponible: ${msg}` });
  }
}
