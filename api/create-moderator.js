// Crée (ou met à jour le mot de passe d') un compte de connexion Supabase pour
// un modérateur. Sans ceci, ajouter un modérateur dans l'app n'enregistre que
// ses permissions, pas son compte -> il ne peut pas se connecter.
//
// Requiert la clé service-role dans les variables d'environnement Vercel :
//   SUPABASE_SERVICE_ROLE_KEY  (Supabase → Project Settings → API → service_role)
//
// Sécurité : l'appelant doit être authentifié (admin connecté) — vérifié via _auth.

import { isAdmin, adminEmails } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  // ADMIN uniquement : cet endpoint utilise la clé service-role et peut donc
  // CRÉER un compte ou RÉINITIALISER le mot de passe d'un compte existant.
  // Un simple jeton valide ne suffit pas : sinon n'importe quel modérateur
  // pourrait redéfinir le mot de passe du propriétaire et prendre le contrôle.
  if (!(await isAdmin(req))) {
    return res.status(403).json({
      error: adminEmails().length
        ? 'Réservé aux administrateurs'
        : "ADMIN_EMAILS non configurée sur le serveur (Vercel → Environment Variables)",
    });
  }

  const SUPA_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPA_URL || !SERVICE_KEY) {
    return res.status(500).json({
      error: "SUPABASE_SERVICE_ROLE_KEY manquante — ajoutez-la dans Vercel (Settings → Environment Variables) puis redéployez.",
    });
  }

  const { email, password } = req.body || {};
  if (!email || !password || String(password).length < 6) {
    return res.status(400).json({ error: 'Email et mot de passe (≥ 6 caractères) requis' });
  }

  const adminHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

  try {
    // 1) Tenter de créer le compte (email déjà confirmé pour permettre la connexion directe).
    const createRes = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (createRes.ok) return res.status(200).json({ ok: true, created: true });

    // 2) Déjà existant → retrouver l'id et mettre à jour le mot de passe.
    const listRes = await fetch(`${SUPA_URL}/auth/v1/admin/users?per_page=200`, { headers: adminHeaders });
    if (!listRes.ok) {
      // On ne renvoie PAS le corps distant (fuite d'informations internes).
      return res.status(500).json({ error: `Supabase admin: erreur ${listRes.status}` });
    }
    const data = await listRes.json();
    const users = data?.users || data || [];
    const found = users.find(u => (u.email || '').toLowerCase() === String(email).toLowerCase());
    if (!found) {
      return res.status(500).json({ error: 'Création impossible' });
    }
    const updRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${found.id}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ password, email_confirm: true }),
    });
    if (!updRes.ok) {
      return res.status(500).json({ error: `Mise à jour du mot de passe: erreur ${updRes.status}` });
    }
    return res.status(200).json({ ok: true, updated: true });
  } catch (e) {
    console.error('create-moderator:', e?.message || e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
