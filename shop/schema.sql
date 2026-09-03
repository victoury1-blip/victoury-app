-- ============================================================
--  BOUTIQUE VICTOURY — schéma
--
--  La boutique a son PROPRE catalogue : une fiche de vente n'a rien d'une
--  fiche de stock. Il lui faut des photos, un texte, une couleur, une
--  collection, une adresse lisible — et une panne de la boutique ne doit
--  jamais atteindre l'application des commandes.
--
--  Un seul point commun, et c'est le bon : la commande passée sur le site
--  s'écrit DIRECTEMENT dans la table `orders` de l'application. Elle apparaît
--  aussitôt dans « À Confirmer », avec son livreur, sa facture et son profit.
--  Aucun intermédiaire à synchroniser — c'est précisément ce qui tombait en
--  panne avec WooCommerce.
--
--  À exécuter dans Supabase → SQL Editor.
-- ============================================================

-- ─────────────────────────────────────────────
--  Collections (MOCASSIN, SANDALES, …)
-- ─────────────────────────────────────────────
create table if not exists shop_collections (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  image_url   text,
  position    int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
--  Groupes de produits
--
--  Chaque couleur est un produit à part entière — c'est ainsi qu'on la
--  photographie et qu'on la vend. Le groupe les relie pour que la fiche
--  affiche les pastilles de couleur.
-- ─────────────────────────────────────────────
create table if not exists shop_groups (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
--  Produits
-- ─────────────────────────────────────────────
create table if not exists shop_products (
  id            uuid primary key default gen_random_uuid(),
  -- L'adresse publique. Une annonce en cours pointe dessus : la changer
  -- casserait la publicité qui tourne.
  slug          text unique not null,
  name          text not null,
  description   text,
  details       text,
  price         numeric(10,2) not null default 0,
  compare_at    numeric(10,2),
  collection_id uuid references shop_collections(id) on delete set null,
  group_id      uuid references shop_groups(id) on delete set null,
  color_name    text,
  color_hex     text,
  gender        text not null default 'Unisexe',
  -- 'Actif' | 'Archivé' | 'Brouillon' : seul un produit actif est vendable.
  status        text not null default 'Actif',
  position      int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists shop_products_collection_idx on shop_products(collection_id);
create index if not exists shop_products_group_idx      on shop_products(group_id);
create index if not exists shop_products_status_idx     on shop_products(status);

-- ─────────────────────────────────────────────
--  Photos
-- ─────────────────────────────────────────────
create table if not exists shop_product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references shop_products(id) on delete cascade,
  url        text not null,
  alt        text,
  position   int  not null default 0
);
create index if not exists shop_product_images_product_idx on shop_product_images(product_id);

-- ─────────────────────────────────────────────
--  Tailles et stock
--
--  Le stock est porté par la TAILLE, pas par le produit : une pointure épuisée
--  doit disparaître de la fiche sans retirer les autres.
-- ─────────────────────────────────────────────
create table if not exists shop_product_sizes (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references shop_products(id) on delete cascade,
  size       text not null,
  stock      int  not null default 0,
  position   int  not null default 0,
  unique (product_id, size)
);
create index if not exists shop_product_sizes_product_idx on shop_product_sizes(product_id);

-- ─────────────────────────────────────────────
--  Pages statiques (CGV, livraison, confidentialité…)
-- ─────────────────────────────────────────────
create table if not exists shop_pages (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  title      text not null,
  body       text,
  published  boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
--  Codes promo
-- ─────────────────────────────────────────────
create table if not exists shop_promo_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  -- 'percent' | 'amount'
  kind       text not null default 'percent',
  value      numeric(10,2) not null default 0,
  min_total  numeric(10,2) not null default 0,
  max_uses   int,
  used_count int not null default 0,
  expires_at timestamptz,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
--  Réglages de la boutique
--
--  Bandeau d'annonce, page d'accueil, remises par quantité, pixel, livraison.
--  En JSON : ces réglages changent souvent et n'ont pas à faire migrer le
--  schéma à chaque fois.
-- ─────────────────────────────────────────────
create table if not exists shop_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
--  SÉCURITÉ
--
--  Le site est public : n'importe qui peut lire le catalogue et passer une
--  commande. Personne, en revanche, ne doit pouvoir LIRE les commandes ni
--  toucher au catalogue sans être connecté.
-- ============================================================
alter table shop_collections    enable row level security;
alter table shop_groups         enable row level security;
alter table shop_products       enable row level security;
alter table shop_product_images enable row level security;
alter table shop_product_sizes  enable row level security;
alter table shop_pages          enable row level security;
alter table shop_promo_codes    enable row level security;
alter table shop_settings       enable row level security;

-- Lecture publique : uniquement ce qui est destiné à être vu.
create policy "lecture publique collections" on shop_collections
  for select using (is_active);
create policy "lecture publique groupes" on shop_groups
  for select using (is_active);
create policy "lecture publique produits" on shop_products
  for select using (status = 'Actif');
-- Photos et tailles suivent leur produit : sans cette condition, celles d'un
-- produit archivé resteraient visibles.
create policy "lecture publique photos" on shop_product_images
  for select using (exists (
    select 1 from shop_products p where p.id = product_id and p.status = 'Actif'
  ));
create policy "lecture publique tailles" on shop_product_sizes
  for select using (exists (
    select 1 from shop_products p where p.id = product_id and p.status = 'Actif'
  ));
create policy "lecture publique pages" on shop_pages
  for select using (published);
create policy "lecture publique reglages" on shop_settings
  for select using (true);
-- Les codes promo ne se listent PAS : les exposer reviendrait à les distribuer.
-- Leur vérification passe par la fonction ci-dessous.

-- Écriture : réservée à un compte connecté (l'administration du magasin).
do $$
declare t text;
begin
  foreach t in array array[
    'shop_collections','shop_groups','shop_products','shop_product_images',
    'shop_product_sizes','shop_pages','shop_promo_codes','shop_settings'
  ] loop
    execute format(
      'create policy "ecriture authentifiee" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────
--  Vérification d'un code promo
--
--  Une fonction plutôt qu'une lecture directe : elle répond « ce code vaut
--  tant », sans jamais laisser personne parcourir la liste des codes.
-- ─────────────────────────────────────────────
create or replace function shop_check_promo(p_code text, p_total numeric)
returns table (kind text, value numeric)
language sql
security definer
set search_path = public
as $$
  select c.kind, c.value
  from shop_promo_codes c
  where upper(c.code) = upper(trim(p_code))
    and c.is_active
    and (c.expires_at is null or c.expires_at > now())
    and (c.max_uses is null or c.used_count < c.max_uses)
    and p_total >= c.min_total
  limit 1;
$$;
grant execute on function shop_check_promo(text, numeric) to anon, authenticated;

-- ============================================================
--  COMMANDES
--
--  Le site écrit dans la table `orders` de l'application — c'est tout
--  l'intérêt : la vente arrive directement dans « À Confirmer ».
--
--  Un visiteur peut UNIQUEMENT créer une commande neuve, et rien d'autre :
--  ni la lire, ni la modifier, ni fixer son statut. Sans ces conditions,
--  l'insertion publique laisserait écrire n'importe quoi dans la table.
--
--  Les numéros VIxxxxx sont ceux de la série de l'application (voir
--  src/lib/victId.js) — le site les reprend plutôt que sa propre série,
--  pour que l'équipe garde une seule suite de numéros au téléphone avec le
--  transporteur. VS- reste accepté en secours (panne réseau, base
--  momentanément indisponible côté fonction shop_next_vi_id ci-dessous).
-- ============================================================
create policy "creation depuis la boutique" on orders
  for insert to anon
  with check (
    status = 'nouveau'
    and validated is not true
    and is_deleted is not true
    and price >= 0
    and (id like 'VS-%' or id ~ '^VI[0-9]{5,}$')
  );

-- ─────────────────────────────────────────────
--  Prochain numéro de la série VIxxxxx
--
--  Le site a besoin de savoir où en est la série pour continuer à numéroter
--  à sa suite — mais un visiteur ne doit jamais pouvoir LIRE la table
--  `orders` (noms, téléphones, adresses de toutes les clientes). Une
--  fonction qui ne répond QUE le prochain numéro, comme shop_check_promo
--  ci-dessus ne répond que la valeur d'un code.
-- ─────────────────────────────────────────────
create or replace function shop_next_vi_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  max_a_confirmer int := 0;
  n int;
  candidat text;
begin
  select coalesce(max(
    greatest(
      coalesce((regexp_match(id, '^VI([0-9]+)$'))[1]::int, 0),
      coalesce((regexp_match(tracking_number, '^VI([0-9]+)$'))[1]::int, 0)
    )
  ), 0)
  into max_a_confirmer
  from orders
  where status = 'nouveau';

  n := max_a_confirmer + 1;
  loop
    candidat := 'VI' || lpad(n::text, 5, '0');
    exit when not exists (
      select 1 from orders where id = candidat or tracking_number = candidat
    );
    n := n + 1;
  end loop;

  return candidat;
end;
$$;
grant execute on function shop_next_vi_id() to anon;
