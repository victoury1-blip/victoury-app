import React, { useMemo, useState } from 'react';

/* Coordonnées (lat, lng) des principales villes marocaines pour la carte. */
const CITY_COORDS = {
  casablanca: [33.57, -7.59], casa: [33.57, -7.59], rabat: [34.02, -6.84],
  sale: [34.05, -6.79], marrakech: [31.63, -8.0], marrakesh: [31.63, -8.0],
  fes: [34.03, -5.0], meknes: [33.9, -5.55], tanger: [35.76, -5.83],
  tetouan: [35.57, -5.37], agadir: [30.42, -9.6], oujda: [34.68, -1.91],
  kenitra: [34.26, -6.58], nador: [35.17, -2.93], safi: [32.3, -9.24],
  'el jadida': [33.25, -8.51], jadida: [33.25, -8.51], 'beni mellal': [32.34, -6.35],
  khouribga: [32.88, -6.91], settat: [33.0, -7.62], berrechid: [33.27, -7.58],
  taza: [34.21, -4.01], larache: [35.19, -6.15], 'ksar el kebir': [35.0, -5.9],
  guelmim: [28.99, -10.06], errachidia: [31.93, -4.42], ouarzazate: [30.92, -6.89],
  tiznit: [29.7, -9.73], essaouira: [31.51, -9.77], berkane: [34.92, -2.32],
  khemisset: [33.82, -6.07], taourirt: [34.41, -2.9], mohammedia: [33.69, -7.38],
  temara: [33.93, -6.91], laayoune: [27.15, -13.2], 'al hoceima': [35.25, -3.94],
  hoceima: [35.25, -3.94], chefchaouen: [35.17, -5.27], ifrane: [33.53, -5.11],
  midelt: [32.68, -4.73], azrou: [33.44, -5.22], 'sidi kacem': [34.22, -5.71],
  'sidi slimane': [34.26, -5.93], youssoufia: [32.25, -8.53],
  'kelaa des sraghna': [32.05, -7.41], taroudant: [30.47, -8.88],
  'oulad teima': [30.39, -9.21], inezgane: [30.36, -9.54],
  'fkih ben salah': [32.5, -6.69], skhirate: [33.85, -7.03], skhirat: [33.85, -7.03],
  bouskoura: [33.45, -7.65], 'had soualem': [33.42, -7.86], martil: [35.62, -5.28],
  fnideq: [35.85, -5.36], mdiq: [35.68, -5.32], driouch: [34.98, -3.39],
  guercif: [34.23, -3.35], jerada: [34.31, -2.16], zagora: [30.33, -5.84],
  tinghir: [31.51, -5.53], azilal: [31.96, -6.57], demnate: [31.73, -7.0],
  benslimane: [33.61, -7.12], 'ben guerir': [32.23, -7.95], dakhla: [23.68, -15.95],
  ourika: [31.36, -7.79], amizmiz: [31.22, -8.24], chichaoua: [31.54, -8.76],
  'souk sebt': [32.3, -6.7], 'oued zem': [32.86, -6.57], boujdour: [26.13, -14.48],
  'sidi ifni': [29.38, -10.17], tantan: [28.44, -11.1], 'tan tan': [28.44, -11.1],
  taounate: [34.54, -4.64], sefrou: [33.83, -4.84], 'moulay yacoub': [34.09, -5.18],
  ouazzane: [34.79, -5.58], 'souk el arbaa': [34.68, -5.99], 'ain harrouda': [33.64, -7.45],
  bouznika: [33.79, -7.16], 'dar bouazza': [33.52, -7.82], mediouna: [33.45, -7.51],
  tit_mellil: [33.55, -7.48], nouaceur: [33.37, -7.58], 'ain chock': [33.54, -7.59],
};

/* Contour approximatif du Maroc (lng, lat) — schématique, pas frontière officielle. */
const OUTLINE = [
  [-5.3, 35.9], [-6.0, 35.8], [-6.3, 35.0], [-6.7, 34.2], [-7.4, 33.7],
  [-8.5, 33.2], [-9.3, 32.3], [-9.8, 31.5], [-9.7, 30.4], [-10.0, 29.5],
  [-10.3, 28.6], [-11.5, 28.1], [-13.2, 27.7], [-8.67, 27.66], [-8.67, 28.7],
  [-7.6, 29.4], [-6.5, 29.8], [-5.5, 29.6], [-4.8, 30.5], [-3.6, 31.1],
  [-3.8, 31.7], [-2.9, 32.1], [-1.2, 32.1], [-1.1, 32.7], [-1.75, 33.7],
  [-1.7, 34.7], [-2.2, 35.1], [-3.0, 35.3], [-3.9, 35.25], [-4.6, 35.2],
];

const normCity = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

function findCoords(city) {
  const n = normCity(city);
  if (!n) return null;
  if (CITY_COORDS[n]) return CITY_COORDS[n];
  for (const [key, c] of Object.entries(CITY_COORDS)) {
    if (n.includes(key) || key.includes(n)) return c;
  }
  return null;
}

/* Projection lat/lng → coordonnées SVG. Cadre : Maroc principal. */
const BOUNDS = { latMin: 27.3, latMax: 36.2, lngMin: -13.6, lngMax: -0.8 };
const W = 520, H = 560;
const px = (lng) => ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * W;
const py = (lat) => H - ((Math.max(BOUNDS.latMin, Math.min(BOUNDS.latMax, lat)) - BOUNDS.latMin) / (BOUNDS.latMax - BOUNDS.latMin)) * H;

/* Couleur selon le taux de refus : vert (bon) → orange → rouge (mauvais). */
function heatColor(refusePct) {
  if (refusePct === null) return '#94a3b8';
  if (refusePct <= 15) return '#16a34a';
  if (refusePct <= 30) return '#eab308';
  if (refusePct <= 50) return '#f97316';
  return '#dc2626';
}

export default function MoroccoMap({ orders = [] }) {
  const [hover, setHover] = useState(null);

  const { cities, unmatched } = useMemo(() => {
    const m = new Map();
    const un = new Map();
    for (const o of orders) {
      const raw = o.recipient?.city;
      if (!raw) continue;
      const coords = findCoords(raw);
      const key = normCity(raw);
      if (!coords) { un.set(key, (un.get(key) || 0) + 1); continue; }
      const id = `${coords[0]},${coords[1]}`;
      const c = m.get(id) || { name: key, coords, total: 0, livre: 0, refuse: 0, ca: 0 };
      c.total++;
      if (o.status === 'livre') { c.livre++; c.ca += parseFloat(o.price) || 0; }
      if (['refuse', 'annule', 'retour_recu'].includes(o.status)) c.refuse++;
      m.set(id, c);
    }
    const list = [...m.values()].sort((a, b) => b.total - a.total);
    const maxTotal = list[0]?.total || 1;
    list.forEach(c => {
      const done = c.livre + c.refuse;
      c.refusePct = done >= 3 ? Math.round((c.refuse / done) * 100) : null;
      c.r = 6 + Math.sqrt(c.total / maxTotal) * 22;
    });
    return { cities: list, unmatched: [...un.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5) };
  }, [orders]);

  const outlinePath = OUTLINE.map(([lng, lat], i) => `${i === 0 ? 'M' : 'L'}${px(lng).toFixed(1)},${py(lat).toFixed(1)}`).join(' ') + ' Z';

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="text-base font-semibold text-gray-700">🗺️ Carte du Maroc — ventes & refus</h2>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#16a34a' }} /> Refus ≤15%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#eab308' }} /> ≤30%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#f97316' }} /> ≤50%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#dc2626' }} /> &gt;50%</span>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-3">Taille du cercle = volume de commandes · couleur = taux de refus/retour</p>
      {cities.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Aucune ville reconnue</div>
      ) : (
        <div className="relative flex justify-center">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-lg" role="img" aria-label="Carte des ventes par ville au Maroc">
            <path d={outlinePath} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round" />
            {cities.map(c => (
              <g key={c.name}
                 onMouseEnter={() => setHover(c)} onMouseLeave={() => setHover(null)}
                 style={{ cursor: 'pointer' }}>
                <circle cx={px(c.coords[1])} cy={py(c.coords[0])} r={c.r}
                        fill={heatColor(c.refusePct)} fillOpacity="0.55"
                        stroke={heatColor(c.refusePct)} strokeWidth="1.5" />
                {c.total >= 5 && (
                  <text x={px(c.coords[1])} y={py(c.coords[0]) - c.r - 4}
                        textAnchor="middle" fontSize="11" fontWeight="600" fill="#334155"
                        style={{ textTransform: 'capitalize' }}>
                    {c.name}
                  </text>
                )}
              </g>
            ))}
          </svg>
          {hover && (
            <div className="absolute top-2 left-2 bg-gray-900 text-white rounded-xl px-3.5 py-2.5 text-xs shadow-lg pointer-events-none">
              <p className="font-bold text-sm capitalize mb-1">{hover.name}</p>
              <p>📦 {hover.total} commandes</p>
              <p className="text-green-300">✅ {hover.livre} livrées · {Math.round(hover.ca).toLocaleString('fr-MA')} DH</p>
              <p className="text-red-300">❌ {hover.refuse} refus/retours{hover.refusePct !== null ? ` (${hover.refusePct}%)` : ''}</p>
            </div>
          )}
        </div>
      )}
      {unmatched.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-2">
          Villes non localisées : {unmatched.map(([n, c]) => `${n} (${c})`).join(', ')}
        </p>
      )}
    </div>
  );
}
