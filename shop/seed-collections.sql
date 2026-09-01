-- ============================================================
--  COLLECTIONS DE DÉPART
--
--  Celles de l'ancienne boutique WooCommerce. Le slug d'« Ensemble Sport » est
--  recopié EXACTEMENT de l'adresse confirmée sur le site actuel
--  (victoury-maroc.com/product-category/ensemble-sport/) : une annonce en
--  cours peut pointer dessus.
--
--  Les trois autres (Burkini, Robes, Soldes) suivent la même convention de
--  nommage WooCommerce. Avant de lancer une publicité vers l'une d'elles,
--  vérifier son adresse réelle sur l'ancien site et corriger le slug ici au
--  besoin — une seule ligne à changer.
--
--  À exécuter dans Supabase → SQL Editor, après schema.sql et storage.sql.
--  Peut être relancé sans risque : `on conflict` ne duplique rien.
-- ============================================================

insert into shop_collections (slug, name, position, is_active) values
  ('ensemble-sport', 'Ensemble Sport', 0, true),
  ('burkini',        'Burkini',        1, true),
  ('robes',          'Robes',          2, true),
  ('soldes',         'Soldes',         3, true)
on conflict (slug) do update set name = excluded.name, is_active = true;
