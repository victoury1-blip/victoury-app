import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/* Porte d'entrée de l'administration.
 *
 * Le même compte que l'application, mais PAS le même accès : ce projet
 * Supabase est partagé avec le CRM des commandes (livreurs compris), et un
 * compte simplement connecté ("authenticated") n'a plus le droit d'écrire
 * sur le catalogue de la boutique depuis la base de données (voir
 * shop_admins / is_shop_admin() dans schema.sql) — seuls les comptes ajoutés
 * à la table shop_admins le peuvent. Cet écran vérifie donc l'appartenance
 * à cette table, pas seulement une session active. */
export default function AdminAuth({ children }) {
  const [session, setSession] = useState(undefined);
  const [estAdmin, setEstAdmin] = useState(undefined);
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) { setEstAdmin(false); return; }
    setEstAdmin(undefined);
    supabase.from('shop_admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => setEstAdmin(!!data), () => setEstAdmin(false));
  }, [session]);

  const connecter = useCallback(async (e) => {
    e.preventDefault();
    setErreur(''); setEnvoi(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
    setEnvoi(false);
    if (error) setErreur('E-mail ou mot de passe incorrect.');
  }, [email, motDePasse]);

  if (session === undefined || (session && estAdmin === undefined)) return null;

  if (session && estAdmin === false) {
    return (
      <div className="min-h-screen grid place-items-center bg-sand px-4 text-center">
        <div>
          <p className="text-sm text-gray-600">Ce compte n'a pas accès à l'administration de la boutique.</p>
          <button onClick={() => supabase.auth.signOut()} className="mt-4 text-xs underline text-gray-400">
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center bg-sand px-4">
        <form onSubmit={connecter} className="bg-white p-8 w-full max-w-sm border border-gray-100">
          <h1 className="text-sm tracking-[0.2em] uppercase text-center">Administration</h1>
          <p className="mt-1 text-xs text-gray-400 text-center">Compte Victoury</p>
          <div className="mt-6 space-y-3">
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="E-mail"
              className="w-full border border-gray-200 px-3 py-2.5 text-sm" autoFocus />
            <input value={motDePasse} onChange={e => setMotDePasse(e.target.value)} type="password" placeholder="Mot de passe"
              className="w-full border border-gray-200 px-3 py-2.5 text-sm" />
          </div>
          {erreur && <p className="mt-3 text-xs text-red-600">{erreur}</p>}
          <button disabled={envoi} className="mt-5 w-full bg-ink text-white py-3 text-xs tracking-widest uppercase disabled:opacity-60">
            {envoi ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    );
  }

  return children;
}
