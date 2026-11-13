import { supabase } from './supabase';

/* Photos des bons du fournisseur (prix d'achat, nom du fournisseur…) :
 * bucket PRIVÉ « fournisseur » — lisible seulement par l'équipe connectée,
 * via des liens signés temporaires. Jamais dans « boutique », qui est public.
 * Création du bucket : sql/fournisseur_photos.sql. */
export const BUCKET_FOURNISSEUR = 'fournisseur';

/** Photo de téléphone (souvent 3–8 Mo) ramenée à 1600 px max, JPEG 0,8. */
export async function compresserImage(fichier, max = 1600, qualite = 0.8) {
  if (!fichier?.type?.startsWith('image/') || fichier.type === 'image/gif') return fichier;
  try {
    const bitmap = await createImageBitmap(fichier);
    const echelle = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * echelle);
    canvas.height = Math.round(bitmap.height * echelle);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', qualite));
    return blob && blob.size < fichier.size ? blob : fichier;
  } catch { return fichier; }
}

/** Envoie une photo (ou un PDF) du bon ; renvoie ce qu'il faut garder sur la facture. */
export async function envoyerPhotoBon(factureId, fichier) {
  const estPdf = fichier.type === 'application/pdf';
  const contenu = estPdf ? fichier : await compresserImage(fichier);
  const ext = estPdf ? 'pdf' : (contenu.type === 'image/jpeg' ? 'jpg' : (fichier.name?.split('.').pop() || 'jpg'));
  const chemin = `${factureId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET_FOURNISSEUR)
    .upload(chemin, contenu, { contentType: contenu.type || fichier.type || 'image/jpeg', upsert: false });
  if (error) throw error;
  return { path: chemin, nom: fichier.name || 'photo', type: estPdf ? 'pdf' : 'image', at: new Date().toISOString() };
}

/** Liens temporaires (1 h) pour afficher les photos : { chemin: url }. */
export async function liensPhotosBon(chemins) {
  if (!chemins?.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET_FOURNISSEUR).createSignedUrls(chemins, 3600);
  if (error) throw error;
  return Object.fromEntries((data || []).filter(d => d.signedUrl).map(d => [d.path, d.signedUrl]));
}

export async function supprimerPhotoBon(chemin) {
  const { error } = await supabase.storage.from(BUCKET_FOURNISSEUR).remove([chemin]);
  if (error) throw error;
}

/** 'JJ/MM/AAAA' (date des factures) ↔ 'AAAA-MM-JJ' (champ date du navigateur). */
export const versIso = (fr) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(fr || ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (/^\d{4}-\d{2}-\d{2}$/.test(String(fr || '')) ? fr : '');
};
export const versFr = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};
