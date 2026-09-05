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

-- ─────────────────────────────────────────────
--  Décrément du stock à la commande
--
--  Une fonction plutôt qu'un UPDATE direct : un visiteur n'a normalement
--  aucun droit d'écriture sur shop_product_sizes (RLS "ecriture
--  authentifiee" plus haut) — seule cette baisse précise, jamais négative,
--  lui est ouverte, à l'image de shop_check_promo pour les codes promo.
-- ─────────────────────────────────────────────
create or replace function shop_decrement_stock(p_slug text, p_size text, p_qty int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update shop_product_sizes s
  set stock = greatest(0, s.stock - p_qty)
  from shop_products p
  where s.product_id = p.id and p.slug = p_slug and s.size = p_size;
end;
$$;
grant execute on function shop_decrement_stock(text, text, int) to anon;

-- ============================================================
--  COMMANDES
--
--  Le site écrit dans la table `orders` de l'application — c'est tout
--  l'intérêt : la vente arrive directement dans « À Confirmer ».
--
--  Un visiteur peut UNIQUEMENT créer une commande neuve, et rien d'autre :
--  ni la lire, ni la modifier, ni fixer son statut. Sans ces conditions,
--  l'insertion publique laisserait écrire n'importe quoi dans la table.
-- ============================================================
create policy "creation depuis la boutique" on orders
  for insert to anon
  with check (
    status = 'nouveau'
    and validated is not true
    and is_deleted is not true
    and price >= 0
    and id like 'VS-%'          -- préfixe réservé aux commandes du site
  );

-- ============================================================
--  NOTIFICATIONS PUSH (nouvelle commande, tél. verrouillé / onglet fermé)
--
--  La notification système (Notification API) posée depuis /store ne
--  fonctionne QUE si l'onglet reste ouvert — un vrai push qui arrive même
--  téléphone verrouillé demande un abonnement Push (endpoint + clés) et un
--  serveur qui l'utilise pour réveiller le navigateur. Un abonnement par
--  appareil connecté (pas par utilisateur) : chaque téléphone/PC qui a
--  autorisé les notifications a le sien.
-- ============================================================
create table if not exists shop_push_subscriptions (
  endpoint   text primary key,
  keys       jsonb not null,
  created_at timestamptz not null default now()
);
alter table shop_push_subscriptions enable row level security;
-- Écriture (s'abonner/se désabonner) réservée à l'administration, comme le
-- reste du catalogue. Pas de lecture publique : ces endpoints ne regardent
-- que le serveur qui envoie les push (accès via la clé de service).
create policy "ecriture authentifiee" on shop_push_subscriptions
  for all to authenticated using (true) with check (true);

-- ============================================================
--  PANIERS ABANDONNÉS
--
--  Dès que le client a tapé son téléphone à la caisse mais n'a pas validé —
--  pour pouvoir le relancer sur WhatsApp. Écriture publique (comme les
--  commandes), mais lecture réservée à l'administration : personne d'autre
--  ne doit pouvoir lister les téléphones des visiteurs.
-- ============================================================
create table if not exists shop_paniers_abandonnes (
  id         uuid primary key default gen_random_uuid(),
  nom        text,
  telephone  text not null,
  lignes     jsonb not null default '[]'::jsonb,
  total      numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists shop_paniers_abandonnes_tel_idx on shop_paniers_abandonnes(telephone);
alter table shop_paniers_abandonnes enable row level security;
-- "anon" ET "authenticated" : un membre de l'équipe qui teste la caisse
-- alors qu'il est connecté à /store dans le même navigateur envoie ses
-- requêtes en tant qu'utilisateur authentifié, pas visiteur anonyme — une
-- policy limitée à "anon" seul le bloquerait (403) sans que rien ne semble
-- cassé côté client.
create policy "creation depuis la boutique" on shop_paniers_abandonnes
  for insert to anon, authenticated with check (telephone is not null and length(telephone) >= 8);
create policy "lecture authentifiee" on shop_paniers_abandonnes
  for select to authenticated using (true);
create policy "suppression authentifiee" on shop_paniers_abandonnes
  for delete to authenticated using (true);

-- ============================================================
--  ADMINISTRATEURS DE LA BOUTIQUE
--
--  Ce projet Supabase est PARTAGÉ avec l'application de gestion des
--  commandes (CRM) — livreurs compris. "to authenticated" sur les policies
--  d'écriture ci-dessus voulait dire « un compte déjà connecté au système »,
--  pas « un compte qui a le droit d'administrer la boutique » : un compte
--  livreur, une fois connecté, pouvait modifier catalogue/prix/codes promo
--  au même titre qu'un vrai administrateur. Cette table restreint
--  l'écriture aux seuls comptes qu'on y ajoute explicitement.
-- ============================================================
create table if not exists shop_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);
alter table shop_admins enable row level security;

-- Fonction SECURITY DEFINER : elle contourne RLS en interne, donc une
-- policy qui l'appelle ne se relit jamais elle-même. Doit être créée AVANT
-- la policy de lecture ci-dessous qui s'en sert (une policy qui vérifiait
-- shop_admins par une sous-requête directe sur shop_admins plantait
-- silencieusement).
create or replace function is_shop_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from shop_admins where user_id = auth.uid());
$$;
grant execute on function is_shop_admin() to authenticated;

-- Un administrateur peut voir la liste (utile pour /store/reglages plus
-- tard) ; personne ne peut s'y ajouter tout seul depuis le client.
create policy "lecture par un admin" on shop_admins
  for select to authenticated using (is_shop_admin());

-- Remplace "to authenticated using (true)" par une vraie vérification de
-- rôle sur toutes les tables du catalogue/réglages + les abonnements push.
do $$
declare t text;
begin
  foreach t in array array[
    'shop_collections','shop_groups','shop_products','shop_product_images',
    'shop_product_sizes','shop_pages','shop_promo_codes','shop_settings',
    'shop_push_subscriptions'
  ] loop
    execute format('drop policy if exists "ecriture authentifiee" on %I', t);
    execute format(
      'create policy "ecriture admin boutique" on %I for all to authenticated using (is_shop_admin()) with check (is_shop_admin())', t);
  end loop;
end $$;

-- Les paniers abandonnés contiennent des téléphones de visiteurs — leur
-- lecture/suppression doit suivre la même règle que le reste de l'admin.
drop policy if exists "lecture authentifiee" on shop_paniers_abandonnes;
drop policy if exists "suppression authentifiee" on shop_paniers_abandonnes;
create policy "lecture admin boutique" on shop_paniers_abandonnes
  for select to authenticated using (is_shop_admin());
create policy "suppression admin boutique" on shop_paniers_abandonnes
  for delete to authenticated using (is_shop_admin());

-- Étape manuelle, une seule fois : ajouter le ou les comptes autorisés.
-- Remplacer l'e-mail par celui/ceux du compte /store réel.
-- insert into shop_admins (user_id, email)
--   select id, email from auth.users where email = 'ton-email@exemple.com';
