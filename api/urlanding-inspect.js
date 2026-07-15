/* Inspecteur de landing page urlanding : récupère le HTML + les bundles JS
   liés, puis extrait les endpoints POST / chemins de commande et les noms de
   champs du formulaire. Sert à découvrir comment urlanding envoie une commande
   (vers son propre backend, qui relaie ensuite à Chic Affiliate).
   Ouvre dans le navigateur :
   /api/urlanding-inspect?url=https://victory2online.urlanding.com/ */
export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  if (!/^https:\/\/([a-z0-9-]+\.)*urlanding\.com\//i.test(url)) {
    return res.status(400).json({ error: 'Seuls les liens urlanding.com sont autorisés' });
  }

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
  const found = { endpoints: new Set(), orderPaths: new Set(), fields: new Set(), tokens: new Set(), scripts: [] };

  const collect = (text) => {
    if (!text) return;
    // URLs absolues ou chemins vers order/store/checkout/lead/api/commande
    const re = /["'`](https?:\/\/[^"'`]*?(?:order|store|checkout|lead|api|commande|parcel)[^"'`]*|\/[a-z0-9._\/-]*(?:order|store|checkout|lead|api|commande|parcel)[a-z0-9._\/?=-]*)["'`]/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      const u = m[1];
      if (/order|store|checkout|lead|commande|parcel/i.test(u)) found.orderPaths.add(u);
      else found.endpoints.add(u);
    }
    // noms de champs probables
    const fre = /["'](name|phone|telephone|tele|ville|city|address|adresse|quantity|quantite|qty|product_id|productId|variant|size|taille|color|couleur|price|prix|recipient|nom|comment)["']\s*:/gi;
    while ((m = fre.exec(text)) !== null) found.fields.add(m[1]);
    // tokens/ids inline
    const tre = /["'](?:api_?key|apiKey|token|store_?id|shop_?id|product_?id|landing_?id|_token)["']\s*:\s*["']?([A-Za-z0-9_\-]{6,})/gi;
    while ((m = tre.exec(text)) !== null) found.tokens.add(m[0].slice(0, 80));
  };

  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
    const html = await r.text();
    collect(html);

    // bundles JS liés
    const srcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
    const origin = new URL(url).origin;
    const abs = srcs.map(s => s.startsWith('http') ? s : s.startsWith('//') ? `https:${s}` : `${origin}${s.startsWith('/') ? '' : '/'}${s}`);
    // limite raisonnable
    for (const js of abs.slice(0, 12)) {
      try {
        const jr = await fetch(js, { headers: { 'User-Agent': UA } });
        const jt = await jr.text();
        collect(jt);
        found.scripts.push({ src: js, size: jt.length });
      } catch { found.scripts.push({ src: js, error: true }); }
    }

    return res.status(200).json({
      url,
      htmlStatus: r.status,
      orderPaths: [...found.orderPaths],
      endpoints: [...found.endpoints].slice(0, 60),
      fields: [...found.fields],
      tokens: [...found.tokens],
      scripts: found.scripts,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
