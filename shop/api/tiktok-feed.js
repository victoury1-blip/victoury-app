// Flux produits (CSV) pour le catalogue TikTok — la seule route qui décrit
// aux plateformes publicitaires quels produits existent, sous quelle forme.
//
// Le catalogue TikTok connecté au compte ("Auto-generated Catalog") était
// synchronisé depuis une source périmée (probablement l'ancien site
// WooCommerce) : il listait des articles supprimés depuis longtemps, et
// aucun des identifiants ne correspondait au `slug` que le pixel envoie
// comme `content_id` sur chaque évènement (AddToCart, Achat) — TikTok ne
// pouvait donc jamais relier un évènement à un produit du catalogue.
//
// Ce flux répare les deux à la fois : il n'est généré QUE depuis les
// produits réellement actifs sur ce site (mêmes données que la boutique),
// et son `id` est TOUJOURS le `slug` — la même valeur que `content_id` dans
// pixel.js/Commander.jsx/Produit.jsx/App.jsx. TikTok (Gestionnaire de
// catalogue → Produits → Ajouter des produits → Flux programmé) n'a qu'à
// pointer périodiquement vers cette URL pour rester à jour tout seul.

const SITE = 'https://victoury-maroc.com';

function echapperCsv(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Configuration serveur manquante' });

  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const [produitsRes, collectionsRes] = await Promise.all([
    fetch(
      `${url}/rest/v1/shop_products?select=slug,name,description,price,status,group_id,collection_id,` +
        `images:shop_product_images(url,position),sizes:shop_product_sizes(stock)` +
        `&status=eq.Actif&order=position.asc`,
      { headers },
    ),
    fetch(`${url}/rest/v1/shop_collections?select=id,name`, { headers }),
  ]);
  if (!produitsRes.ok) return res.status(502).json({ error: 'Lecture des produits impossible' });

  const produits = await produitsRes.json();
  const collections = collectionsRes.ok ? await collectionsRes.json() : [];
  const nomCollection = new Map(collections.map(c => [c.id, c.name]));

  const colonnes = [
    'id', 'title', 'description', 'availability', 'condition', 'price',
    'link', 'image_link', 'additional_image_link', 'brand', 'product_type', 'item_group_id',
  ];
  const lignes = [colonnes.join(',')];

  for (const p of produits) {
    if (!p.slug) continue; // pas d'id fiable, pas de ligne — mieux vaut absent qu'orphelin
    const images = (p.images || []).sort((a, b) => a.position - b.position);
    if (!images.length) continue; // TikTok refuse un produit sans image_link
    const enStock = (p.sizes || []).some(s => (s.stock || 0) > 0);
    const ligne = [
      p.slug,
      p.name || '',
      (p.description || p.name || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
      enStock ? 'in stock' : 'out of stock',
      'new',
      `${Number(p.price || 0).toFixed(2)} MAD`,
      `${SITE}/product/${p.slug}`,
      images[0].url,
      images[1]?.url || '',
      'VICTOURY',
      nomCollection.get(p.collection_id) || '',
      p.group_id || p.slug,
    ].map(echapperCsv);
    lignes.push(ligne.join(','));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  // Un cache court : le flux se veut à jour, mais éviter qu'une rafale de
  // requêtes du crawler TikTok ne recharge la base à chaque appel.
  res.setHeader('Cache-Control', 'public, max-age=900');
  return res.status(200).send(lignes.join('\n'));
}
