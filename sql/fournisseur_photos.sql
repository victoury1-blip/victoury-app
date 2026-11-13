-- Photos des bons fournisseur (page /fournisseur) : bucket PRIVÉ.
-- Seule l'équipe connectée à l'app peut voir / ajouter / supprimer.
insert into storage.buckets (id, name, public)
values ('fournisseur', 'fournisseur', false)
on conflict (id) do nothing;

drop policy if exists "fournisseur lecture" on storage.objects;
create policy "fournisseur lecture" on storage.objects
  for select to authenticated using (bucket_id = 'fournisseur');

drop policy if exists "fournisseur ajout" on storage.objects;
create policy "fournisseur ajout" on storage.objects
  for insert to authenticated with check (bucket_id = 'fournisseur');

drop policy if exists "fournisseur suppression" on storage.objects;
create policy "fournisseur suppression" on storage.objects
  for delete to authenticated using (bucket_id = 'fournisseur');
