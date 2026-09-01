import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';

export default function Merci() {
  const { id } = useParams();
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <div className="w-14 h-14 rounded-full bg-ink text-white grid place-items-center mx-auto"><Check size={26} /></div>
      <h1 className="mt-6 text-lg tracking-[0.2em] uppercase">Commande enregistrée</h1>
      <p className="mt-3 text-sm text-gray-600">
        Merci ! Nous vous appelons très vite pour confirmer votre commande.
      </p>
      {/* Le numéro sert au client au téléphone : sans lui, il faut chercher par nom. */}
      {id && <p className="mt-4 text-xs text-gray-400">Numéro de commande : <span className="font-mono">{id}</span></p>}
      <Link to="/" className="inline-block mt-8 border border-ink px-8 py-3 text-[11px] tracking-widest uppercase">
        Continuer mes achats
      </Link>
    </div>
  );
}
