-- À exécuter une seule fois dans l’éditeur SQL Supabase.
-- Le bucket reste privé : tous les accès passent par les routes sécurisées du serveur.
insert into storage.buckets (id, name, public, file_size_limit)
values ('progressed-pedago', 'progressed-pedago', false, 26214400)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;
