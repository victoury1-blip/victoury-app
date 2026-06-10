import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, Mail, Lock, RefreshCw } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'reset' | 'reset_sent'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError('Email ou mot de passe incorrect');
  }

  async function handleReset(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://app.victoury-maroc.com',
    });
    setLoading(false);
    if (err) { setError('Erreur lors de l\'envoi. Vérifiez l\'email.'); return; }
    setMode('reset_sent');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-white font-black text-xl">V</span>
          </div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">VICTOURY</h1>
          <p className="text-gray-500 text-sm mt-1">Système de Gestion</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Login form */}
          {mode === 'login' && (
            <>
              <h2 className="text-lg font-bold text-gray-800 mb-6 text-center">Connexion</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="vous@victoury.com"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPwd ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    />
                    <button type="button" onClick={() => setShowPwd(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading && <RefreshCw size={14} className="animate-spin" />}
                  {loading ? 'Connexion...' : 'Se connecter'}
                </button>
              </form>

              <button onClick={() => { setMode('reset'); setError(''); }}
                className="w-full mt-4 text-center text-sm text-blue-600 hover:text-blue-700 hover:underline">
                Mot de passe oublié ?
              </button>
            </>
          )}

          {/* Reset password form */}
          {mode === 'reset' && (
            <>
              <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">Réinitialisation</h2>
              <p className="text-gray-500 text-xs text-center mb-6">Entrez votre email pour recevoir un lien de réinitialisation</p>
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="vous@victoury.com"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading && <RefreshCw size={14} className="animate-spin" />}
                  {loading ? 'Envoi...' : 'Envoyer le lien'}
                </button>
              </form>

              <button onClick={() => { setMode('login'); setError(''); }}
                className="w-full mt-4 text-center text-sm text-gray-500 hover:text-gray-700 hover:underline">
                ← Retour à la connexion
              </button>
            </>
          )}

          {/* Reset sent confirmation */}
          {mode === 'reset_sent' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail size={24} className="text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">Email envoyé !</h2>
              <p className="text-gray-500 text-sm mb-6">Vérifiez votre boîte mail <span className="font-semibold text-gray-700">{email}</span> et cliquez sur le lien.</p>
              <button onClick={() => { setMode('login'); setError(''); }}
                className="text-sm text-blue-600 hover:underline">
                ← Retour à la connexion
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">© {new Date().getFullYear()} Victoury. Tous droits réservés.</p>
      </div>
    </div>
  );
}
