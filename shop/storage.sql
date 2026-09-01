-- ============================================================
--  PHOTOS DE LA BOUTIQUE
--
--  Les photos vivent dans le stockage de Supabase, pas dans la base : une
--  image en base la ferait grossir sans mesure et ralentirait chaque lecture
--  du catalogue.
--
--  Le dépôt est PUBLIC en lecture — une photo de produit est faite pour être
--  vue — et fermé en écriture à qui n'est pas connecté.
--
--  À exécuter dans Supabase → SQL Editor, après schema.sql.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('boutique', 'boutique', true)
on conflict (id) do update set public = true;

-- Lecture ouverte : c'est ce qui permet d'afficher les photos sur le site.
create policy "photos visibles par tous"
  on storage.objects for select
  using (bucket_id = 'boutique');

-- Dépôt, remplacement et suppression : réservés à l'administration.
create policy "depot des photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'boutique');

create policy "remplacement des photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'boutique');

create policy "suppression des photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'boutique');
