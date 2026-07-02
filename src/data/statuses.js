export const ALL_STATUSES = [
  { id: 1,  value: 'a_voir',          label: 'À Voir',                   slug: 'a-voir',               color: '#F59E0B', isDefault: false, order: 1,  showInCommandes: true,  showInColis: true  },
  { id: 2,  value: 'confirme',         label: 'Confirmé',                 slug: 'confirme',             color: '#22C55E', isDefault: false, order: 2,  showInCommandes: true,  showInColis: true  },
  { id: 6,  value: 'injoignable',      label: 'Injoignable',              slug: 'injoignable',          color: '#EF4444', isDefault: false, order: 6,  showInCommandes: true,  showInColis: true  },
  { id: 7,  value: 'interesse',        label: 'Intéressé',                slug: 'interesse',            color: '#06B6D4', isDefault: false, order: 7,  showInCommandes: true,  showInColis: false },
  { id: 8,  value: 'livre',            label: 'Livré',                    slug: 'livre',                color: '#10B981', isDefault: false, order: 8,  showInCommandes: true,  showInColis: true  },
  { id: 9,  value: 'manque_stock',     label: 'Manque de Stock',          slug: 'manque-de-stock',      color: '#D97706', isDefault: false, order: 9,  showInCommandes: true,  showInColis: false },
  { id: 10, value: 'pas_rep_1',        label: 'Pas de Réponse 1',         slug: 'pas-de-reponse-1',     color: '#FB923C', isDefault: false, order: 10, showInCommandes: true,  showInColis: false },
  { id: 12, value: 'annule',           label: 'Annulé',                   slug: 'annule',               color: '#DC2626', isDefault: false, order: 12, showInCommandes: true,  showInColis: true  },
  { id: 13, value: 'en_attente',       label: 'En Attente',               slug: 'en-attente',           color: '#0EA5E9', isDefault: false, order: 13, showInCommandes: true,  showInColis: false },
  { id: 14, value: 'photo_whatsapp',   label: 'Photo WhatsApp',           slug: 'photo-whatsapp',       color: '#F43F5E', isDefault: false, order: 14, showInCommandes: true,  showInColis: false },
  { id: 15, value: 'refuse',           label: 'Refusé',                   slug: 'refuse',               color: '#EF4444', isDefault: false, order: 15, showInCommandes: true,  showInColis: true  },
  { id: 16, value: 'reporter',         label: 'Reporté',                  slug: 'reporter',             color: '#A855F7', isDefault: false, order: 16, showInCommandes: true,  showInColis: false },
  { id: 18, value: 'pas_reponse',      label: 'Pas de Réponse',           slug: 'pas-de-reponse',       color: '#FB923C', isDefault: false, order: 18, showInCommandes: true,  showInColis: false },
  { id: 19, value: 'pas_rep_2',        label: 'Pas de Réponse 2 Fois',    slug: 'pas-de-reponse-2',     color: '#F97316', isDefault: false, order: 19, showInCommandes: true,  showInColis: false },
  { id: 20, value: 'pas_rep_3',        label: 'Pas de Réponse 3 Fois',    slug: 'pas-de-reponse-3',     color: '#EA580C', isDefault: false, order: 20, showInCommandes: true,  showInColis: false },
  { id: 21, value: 'pas_rep_4',        label: 'Pas de Réponse 4 Fois',    slug: 'pas-de-reponse-4',     color: '#C2410C', isDefault: false, order: 21, showInCommandes: true,  showInColis: false },
  { id: 22, value: 'pas_rep_5',        label: 'Pas de Réponse 5 Fois',    slug: 'pas-de-reponse-5',     color: '#B91C1C', isDefault: false, order: 22, showInCommandes: true,  showInColis: false },
  { id: 23, value: 'black_liste',      label: 'Black Liste',              slug: 'black-liste',          color: '#111827', isDefault: false, order: 23, showInCommandes: true,  showInColis: false },
  { id: 24, value: 'nouveau',          label: 'Nouveau',                  slug: 'nouveau',              color: '#6366F1', isDefault: true,  order: 24, showInCommandes: true,  showInColis: true  },
  { id: 25, value: 'att_ramassage',    label: 'En Attente Ramassage',     slug: 'att-ramassage',        color: '#22C55E', isDefault: false, order: 25, showInCommandes: true,  showInColis: true  },
  { id: 26, value: 'expedier',         label: 'Expédié',                  slug: 'expedier',             color: '#0EA5E9', isDefault: false, order: 26, showInCommandes: true,  showInColis: true  },
  { id: 27, value: 'recu_livreur',     label: 'Reçu Par Livreur',         slug: 'recu-livreur',         color: '#14B8A6', isDefault: false, order: 27, showInCommandes: true,  showInColis: true  },
  { id: 28, value: 'change',           label: 'Changé',                   slug: 'change',               color: '#8B5CF6', isDefault: false, order: 28, showInCommandes: true,  showInColis: true  },
  { id: 29, value: 'pas_rep_lv',       label: 'Pas de Réponse LV',        slug: 'pas-rep-lv',           color: '#EA580C', isDefault: false, order: 29, showInCommandes: false, showInColis: true  },
  { id: 30, value: 'pret_retour',      label: 'Prêt Pour le Retour',      slug: 'pret-retour',          color: '#6B7280', isDefault: false, order: 30, showInCommandes: false, showInColis: true  },
  { id: 31, value: 'dem_suivi',        label: 'Demande de Suivi',         slug: 'dem-suivi',            color: '#06B6D4', isDefault: false, order: 31, showInCommandes: true,  showInColis: false },
  { id: 32, value: 'en_suivi',         label: 'En Suivi',                 slug: 'en-suivi',             color: '#A855F7', isDefault: false, order: 32, showInCommandes: false, showInColis: true  },
  { id: 33, value: 'retour_recu',     label: 'Retour Reçu',              slug: 'retour-recu',          color: '#6B7280', isDefault: false, order: 33, showInCommandes: false, showInColis: true  },
  { id: 34, value: 'echange_recu',    label: 'Échange Reçu',             slug: 'echange-recu',         color: '#F59E0B', isDefault: false, order: 34, showInCommandes: false, showInColis: true  },
];

export function getStatusByValue(value) {
  return ALL_STATUSES.find((s) => s.value === value) || ALL_STATUSES[0];
}

const STORAGE_KEY = 'victoury_statuses';

export function loadStatuses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved) && saved.length > 0) {
        return saved.map(s => ({
          showInCommandes: true,
          showInColis: true,
          ...s,
        }));
      }
    }
  } catch {}
  return ALL_STATUSES;
}

export function saveStatuses(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  import('../lib/cloudSettings').then(({ cloudSet }) => cloudSet(STORAGE_KEY, list));
}

/** Get live status config (from localStorage if saved, else fallback to ALL_STATUSES) */
export function getLiveStatus(value) {
  const list = loadStatuses();
  return list.find(s => s.value === value) || list.find(s => s.label.toLowerCase() === (value || '').toLowerCase()) || { label: value, color: '#6B7280' };
}
