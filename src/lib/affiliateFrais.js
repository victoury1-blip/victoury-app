/* Mémoire des frais de livraison par ville, côté affiliation.
 *
 * Les plateformes d'affiliation ne renvoient le tarif d'une ville que par appel
 * séparé, jamais avec la commande. Ce qui est saisi ou récupéré une fois est
 * donc retenu ici, et reproposé pour la même ville les fois suivantes.
 *
 * Ces fonctions vivaient dans la page Affiliations, hors de portée du rapport de
 * profit : celui-ci ne lisait que le frais figé sur la commande à l'envoi. Une
 * commande passée autrement — ou envoyée sans que le tarif soit renseigné —
 * comptait donc une livraison à zéro, et son bénéfice était surestimé d'autant.
 */
import { platKey } from './affiliatePlatforms';

export const cityFraisKey = (plat) => platKey(plat, 'city_frais');

/** Clé de ville insensible à la casse et aux accents. */
export const cityKey = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function getCityFraisMap(plat) {
  try { return JSON.parse(localStorage.getItem(cityFraisKey(plat)) || '{}'); } catch { return {}; }
}

export function rememberCityFrais(cityName, frais, plat) {
  const k = cityKey(cityName); const f = parseFloat(frais);
  if (!k || !f) return;
  try { const m = getCityFraisMap(plat); m[k] = f; localStorage.setItem(cityFraisKey(plat), JSON.stringify(m)); } catch { /* quota */ }
}

/** Tarif retenu pour cette ville, en texte (vide si inconnu). */
export function recallCityFrais(cityName, plat) {
  const v = getCityFraisMap(plat)[cityKey(cityName)];
  return v != null ? String(v) : '';
}

export function setCityFraisValue(cityName, val, plat) {
  const k = cityKey(cityName); if (!k) return;
  try {
    const m = getCityFraisMap(plat); const f = parseFloat(val);
    if (val === '' || isNaN(f)) delete m[k]; else m[k] = f;
    localStorage.setItem(cityFraisKey(plat), JSON.stringify(m));
  } catch { /* quota */ }
}

/* Frais d'une commande d'affiliation : celui figé à l'envoi, sinon celui retenu
   pour sa ville. Renvoie null quand aucun des deux n'est connu — « inconnu »
   n'est pas « gratuit », et le confondre gonfle le bénéfice affiché. */
export function fraisAffilie(order, plat) {
  const fige = parseFloat(order?.chicFrais);
  if (Number.isFinite(fige) && fige > 0) return fige;
  const memo = parseFloat(recallCityFrais(order?.recipient?.city, plat));
  return Number.isFinite(memo) && memo > 0 ? memo : null;
}
