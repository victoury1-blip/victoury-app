-- ============================================================
--  RÉSERVATION AUTOMATIQUE — jour de rupture de chaque taille
--
--  Quand le stock d'une taille tombe à 0, la base note le jour ; quand il
--  remonte, la ligne disparaît. La fiche produit annonce alors l'arrivage
--  « jour de rupture + 5 jours » (voir src/lib/precommande.js).
--  Table à part (et non une colonne de shop_product_sizes) : l'admin
--  supprime puis recrée les tailles à chaque enregistrement, ce qui aurait
--  remis la date à zéro.
-- ============================================================
create table if not exists shop_ruptures (
  product_id uuid not null references shop_products(id) on delete cascade,
  size       text not null,
  depuis     date not null default current_date,
  primary key (product_id, size)
);
alter table shop_ruptures enable row level security;
drop policy if exists "lecture publique ruptures" on shop_ruptures;
create policy "lecture publique ruptures" on shop_ruptures
  for select to anon, authenticated using (true);

create or replace function shop_noter_rupture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock <= 0 then
    insert into shop_ruptures (product_id, size) values (new.product_id, new.size)
    on conflict do nothing;
  else
    delete from shop_ruptures where product_id = new.product_id and size = new.size;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_sizes_rupture on shop_product_sizes;
create trigger shop_sizes_rupture
  after insert or update of stock on shop_product_sizes
  for each row execute function shop_noter_rupture();

-- Tailles déjà épuisées aujourd'hui : on part de maintenant.
insert into shop_ruptures (product_id, size)
  select product_id, size from shop_product_sizes where stock <= 0
  on conflict do nothing;
