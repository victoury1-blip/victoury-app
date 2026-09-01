/* « Entourez un mot de *pour l'afficher en gras* » — un balisage minimal,
 * volontairement plus simple qu'un vrai Markdown : la personne qui rédige un
 * bandeau d'annonce n'a ni le temps ni l'envie d'apprendre une syntaxe, un
 * astérisque de chaque côté du mot suffit à comprendre l'effet.
 *
 * Découpe le texte en morceaux { texte, gras }, pour que l'appelant les rende
 * comme il l'entend (span, strong…) sans jamais injecter de HTML brut.
 */
export function decouperGras(texte) {
  const morceaux = [];
  const re = /\*([^*]+)\*/g;
  let dernier = 0, m;
  const s = String(texte || '');
  while ((m = re.exec(s))) {
    if (m.index > dernier) morceaux.push({ texte: s.slice(dernier, m.index), gras: false });
    morceaux.push({ texte: m[1], gras: true });
    dernier = re.lastIndex;
  }
  if (dernier < s.length) morceaux.push({ texte: s.slice(dernier), gras: false });
  return morceaux;
}
