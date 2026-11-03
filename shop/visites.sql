-- ============================================================
--  STATISTIQUES DE VISITES DE LA BOUTIQUE (sans Google Analytics)
--
--  Une ligne par visite (une par onglet et par jour) et une par « ajout au
--  panier ». Écriture publique, limitée et sans donnée personnelle (un
--  identifiant aléatoire du navigateur) ; lecture réservée aux admins, via
--  shop_stats_visites() qui renvoie directement les totaux.
--
--  À exécuter UNE FOIS dans Supabase → SQL Editor → New query → Run.
--  Sans danger si on le relance.
-- ============================================================
create table if not exists shop_visites (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  visiteur   text not null,
  type       text not null,
  source     text,
  page       text,
  produit    text,
  appareil   text
);
-- Mise à jour (v2) : appareil + étapes « produit » et « checkout ».
alter table shop_visites add column if not exists appareil text;
create index if not exists shop_visites_date_idx on shop_visites(created_at);
alter table shop_visites enable row level security;

drop policy if exists "creation depuis la boutique" on shop_visites;
create policy "creation depuis la boutique" on shop_visites
  for insert to anon, authenticated
  with check (
    type in ('visite', 'produit', 'panier', 'checkout')
    and length(visiteur) between 8 and 64
    and coalesce(length(source), 0) <= 40
    and coalesce(length(page), 0) <= 200
    and coalesce(length(produit), 0) <= 200
    and coalesce(length(appareil), 0) <= 20
  );

drop policy if exists "lecture admin boutique" on shop_visites;
create policy "lecture admin boutique" on shop_visites
  for select to authenticated using (is_shop_admin());

-- Totaux d'une période, jours à l'heure du Maroc.
create or replace function shop_stats_visites(p_debut timestamptz, p_fin timestamptz)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with v as (
    select *, (created_at at time zone 'Africa/Casablanca')::date as jour
    from shop_visites
    where created_at >= p_debut and created_at < p_fin
  )
  select case when not is_shop_admin() then null else json_build_object(
    'sessions',  (select count(*) from v where type = 'visite'),
    'visiteurs', (select count(distinct visiteur) from v where type = 'visite'),
    'paniers',   (select count(*) from v where type = 'panier'),
    'par_jour',  coalesce((select json_agg(x order by x.jour) from (
                   select jour,
                          count(*) filter (where type = 'visite') as sessions,
                          count(*) filter (where type = 'panier') as paniers
                   from v group by jour) x), '[]'::json),
    'par_source', coalesce((select json_agg(x order by x.sessions desc) from (
                   select coalesce(source, 'Direct') as source, count(*) as sessions
                   from v where type = 'visite' group by 1) x), '[]'::json),
    'produits',  coalesce((select json_agg(x order by x.ajouts desc) from (
                   select produit, count(*) as ajouts
                   from v where type = 'panier' and produit is not null
                   group by produit order by count(*) desc limit 8) x), '[]'::json),
    -- Entonnoir : visiteurs DIFFÉRENTS arrivés à chaque étape.
    'entonnoir', json_build_object(
      'visite',   (select count(distinct visiteur) from v where type = 'visite'),
      'produit',  (select count(distinct visiteur) from v where type = 'produit'),
      'panier',   (select count(distinct visiteur) from v where type = 'panier'),
      'checkout', (select count(distinct visiteur) from v where type = 'checkout')),
    'appareils', coalesce((select json_agg(x order by x.sessions desc) from (
                   select coalesce(appareil, 'inconnu') as appareil, count(*) as sessions
                   from v where type = 'visite' group by 1) x), '[]'::json)
  ) end;
$$;
grant execute on function shop_stats_visites(timestamptz, timestamptz) to authenticated;
