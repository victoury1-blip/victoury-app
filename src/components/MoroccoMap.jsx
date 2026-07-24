import React, { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/* Coordonnées (lat, lng) des principales villes marocaines. */
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
  nouaceur: [33.37, -7.58], boumia: [32.72, -5.1], midar: [34.94, -3.53],
  imzouren: [35.15, -3.85], zaio: [34.94, -2.73], berkan: [34.92, -2.32],
  temsia: [30.37, -9.42], biougra: [30.21, -9.37], 'ait melloul': [30.33, -9.5],
  ksissi: [32.79, -6.19], 'sidi bennour': [32.65, -8.43], boujad: [32.76, -6.4],
  'beni ansar': [35.26, -2.93], 'sidi yahya': [34.3, -6.3],
};

/* Alias arabe → clé latine (les villes de la feuille sont souvent en arabe). */
const ARABIC = {
  'الدار البيضاء': 'casablanca', 'دار البيضاء': 'casablanca', 'كازا': 'casablanca',
  'الرباط': 'rabat', 'سلا': 'sale', 'مراكش': 'marrakech', 'فاس': 'fes',
  'مكناس': 'meknes', 'طنجة': 'tanger', 'تطوان': 'tetouan', 'اكادير': 'agadir',
  'أكادير': 'agadir', 'وجدة': 'oujda', 'القنيطرة': 'kenitra', 'قنيطرة': 'kenitra',
  'الناظور': 'nador', 'ناظور': 'nador', 'اسفي': 'safi', 'آسفي': 'safi',
  'الجديدة': 'el jadida', 'بني ملال': 'beni mellal', 'خريبكة': 'khouribga',
  'سطات': 'settat', 'برشيد': 'berrechid', 'تازة': 'taza', 'العرائش': 'larache',
  'كلميم': 'guelmim', 'الرشيدية': 'errachidia', 'ورزازات': 'ouarzazate',
  'تزنيت': 'tiznit', 'الصويرة': 'essaouira', 'بركان': 'berkane',
  'الخميسات': 'khemisset', 'تاوريرت': 'taourirt', 'المحمدية': 'mohammedia',
  'تمارة': 'temara', 'العيون': 'laayoune', 'الحسيمة': 'al hoceima',
  'شفشاون': 'chefchaouen', 'إفران': 'ifrane', 'ميدلت': 'midelt', 'أزرو': 'azrou',
  'تارودانت': 'taroudant', 'الداخلة': 'dakhla', 'زاكورة': 'zagora',
  'تنغير': 'tinghir', 'أزيلال': 'azilal', 'وزان': 'ouazzane', 'صفرو': 'sefrou',
  'تاونات': 'taounate', 'بوعرفة': 'boumia', 'بومية': 'boumia', 'مرتيل': 'martil',
  'الفنيدق': 'fnideq', 'المضيق': 'mdiq', 'الدريوش': 'driouch', 'جرسيف': 'guercif',
  'سيدي قاسم': 'sidi kacem', 'سيدي سليمان': 'sidi slimane', 'اليوسفية': 'youssoufia',
  'ايت ملول': 'ait melloul', 'انزكان': 'inezgane', 'الفقيه بن صالح': 'fkih ben salah',
  'سيدي بنور': 'sidi bennour', 'بنسليمان': 'benslimane', 'الخميس': 'ain harrouda',
};

const normCity = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

function findCoords(city) {
  const raw = String(city || '').trim();
  if (ARABIC[raw]) return CITY_COORDS[ARABIC[raw]];
  // recherche arabe partielle
  for (const [ar, key] of Object.entries(ARABIC)) {
    if (raw.includes(ar)) return CITY_COORDS[key];
  }
  const n = normCity(city);
  if (!n) return null;
  if (CITY_COORDS[n]) return CITY_COORDS[n];
  for (const [key, c] of Object.entries(CITY_COORDS)) {
    if (n.includes(key) || key.includes(n)) return c;
  }
  return null;
}

function heatColor(refusePct) {
  if (refusePct === null) return '#64748b';
  if (refusePct <= 15) return '#16a34a';
  if (refusePct <= 30) return '#eab308';
  if (refusePct <= 50) return '#f97316';
  return '#dc2626';
}

export default function MoroccoMap({ orders = [] }) {
  const { cities, unmatched } = useMemo(() => {
    const m = new Map();
    const un = new Map();
    for (const o of orders) {
      const raw = o.recipient?.city;
      if (!raw) continue;
      const coords = findCoords(raw);
      if (!coords) { const k = String(raw).trim(); un.set(k, (un.get(k) || 0) + 1); continue; }
      const id = `${coords[0]},${coords[1]}`;
      const c = m.get(id) || { name: normCity(raw), coords, total: 0, livre: 0, refuse: 0, ca: 0 };
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
      c.r = 8 + Math.sqrt(c.total / maxTotal) * 28; // rayon en pixels (constant au zoom)
    });
    return { cities: list, unmatched: [...un.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6) };
  }, [orders]);

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
      <p className="text-xs text-gray-400 mb-3">Taille du cercle = volume · couleur = taux de refus · molette/pincer pour zoomer, glisser pour déplacer</p>
      {cities.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Aucune ville reconnue</div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-gray-200">
          <MapContainer center={[31.8, -7.0]} zoom={6} scrollWheelZoom style={{ height: 520, width: '100%', background: '#eef2f7' }}>
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {cities.map(c => (
              <CircleMarker
                key={c.name}
                center={c.coords}
                radius={c.r}
                pathOptions={{ color: heatColor(c.refusePct), fillColor: heatColor(c.refusePct), fillOpacity: 0.55, weight: 1.5 }}
              >
                <Tooltip direction="top" offset={[0, -4]}>
                  <div className="text-xs">
                    <p className="font-bold capitalize text-sm mb-0.5">{c.name}</p>
                    <p>📦 {c.total} commandes</p>
                    <p style={{ color: '#16a34a' }}>✅ {c.livre} livrées · {Math.round(c.ca).toLocaleString('fr-MA')} DH</p>
                    <p style={{ color: '#dc2626' }}>❌ {c.refuse} refus/retours{c.refusePct !== null ? ` (${c.refusePct}%)` : ''}</p>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}
      {unmatched.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-2" dir="auto">
          Villes non localisées : {unmatched.map(([n, c]) => `${n} (${c})`).join(', ')}
        </p>
      )}
    </div>
  );
}
