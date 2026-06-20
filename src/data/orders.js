export const mockOrders = [
  {
    id: "VICT001",
    recipient: {
      name: "Client Test",
      address: "Hay Riad Rue 5 N�12",
      city: "Rabat",
      phone: "0612345678",
      delivery: null,
    },
    product: { name: "ENSEMBLE SPORTE REFF 1", size: "L", qty: 1, stock: 12 },
    products: [{ name: "ENSEMBLE SPORTE REFF 1", size: "L", quantity: 1 }],
    price: 350.00,
    status: "nouveau",
    note: "",
    dateAdded: "06/06/2026 18:00",
    dateUpdated: "06/06/2026 18:00",
    validated: false,
  },
];

export const statusConfig = {
  nouveau:        { label: "Nouveau",               bg: "bg-blue-100",    text: "text-blue-700",    border: "border-blue-300",    color: "#6366F1" },
  reporter:       { label: "Reporté",               bg: "bg-orange-100",  text: "text-orange-700",  border: "border-orange-300",  color: "#F97316" },
  confirme:       { label: "Confirmé",              bg: "bg-green-100",   text: "text-green-700",   border: "border-green-300",   color: "#22C55E" },
  en_suivi:       { label: "En Suivi",              bg: "bg-purple-100",  text: "text-purple-700",  border: "border-purple-300",  color: "#A855F7" },
  annule:         { label: "Annulé",                bg: "bg-red-100",     text: "text-red-700",     border: "border-red-300",     color: "#EF4444" },
  att_ramassage:  { label: "En Attente Ramassage",  bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-300",   color: "#F59E0B" },
  expedier:       { label: "Expédié",               bg: "bg-sky-100",     text: "text-sky-700",     border: "border-sky-300",     color: "#0EA5E9" },
  recu_livreur:   { label: "Reçu Par Livreur",      bg: "bg-teal-100",    text: "text-teal-700",    border: "border-teal-300",    color: "#14B8A6" },
  livre:          { label: "Livré",                 bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300", color: "#10B981" },
  change:         { label: "Changé",                bg: "bg-violet-100",  text: "text-violet-700",  border: "border-violet-300",  color: "#8B5CF6" },
  refuse:         { label: "Refusé",                bg: "bg-rose-100",    text: "text-rose-700",    border: "border-rose-300",    color: "#F43F5E" },
  pas_rep_lv:     { label: "Pas de Réponse LV",     bg: "bg-orange-100",  text: "text-orange-600",  border: "border-orange-300",  color: "#EA580C" },
  pret_retour:    { label: "Prêt Pour le Retour",   bg: "bg-gray-100",    text: "text-gray-700",    border: "border-gray-300",    color: "#6B7280" },
  dem_suivi:      { label: "Demande de Suivi",      bg: "bg-cyan-100",    text: "text-cyan-700",    border: "border-cyan-300",    color: "#06B6D4" },
  injoignable:    { label: "Injoignable",           bg: "bg-slate-100",   text: "text-slate-600",   border: "border-slate-300",   color: "#64748B" },
  manque_stock:   { label: "Manque de Stock",       bg: "bg-yellow-100",  text: "text-yellow-700",  border: "border-yellow-300",  color: "#D97706" },
};

export const COLIS_STATUSES = [
  'att_ramassage', 'dem_suivi', 'expedier', 'injoignable', 'recu_livreur',
  'livre', 'manque_stock', 'pas_rep_lv', 'change', 'en_suivi',
  'refuse', 'reporter', 'annule', 'pret_retour',
];
