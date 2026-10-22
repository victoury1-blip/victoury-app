-- Codes VI à plus de 5 chiffres (VI458312, VI458316…) : à corriger.
--
-- La commande de test VI458311 avait laissé le « prochain numéro » de Réglages
-- à 458312 : chaque commande du site recevait ensuite un code à 6 chiffres.
-- L'application ignore désormais ces numéros (src/lib/victId.js) ; ce script
-- fait la même chose côté base et renumérote les commandes encore « Nouveau ».
--
-- À exécuter une fois dans Supabase → SQL Editor (projet VICTOURY).

-- 1. La séquence repart du plus grand numéro valide (5 chiffres au plus).
select setval('vi_tracking_seq', greatest(1, (
  select coalesce(max(n), 0) from (
    select substring(tracking_number from '^VI(\d+)$')::bigint as n from orders where tracking_number ~ '^VI\d{1,5}$'
    union all
    select substring(id from '^VI(\d+)$')::bigint from orders where id ~ '^VI\d{1,5}$'
  ) s
)));

-- 2. Le déclencheur remplace aussi un NOUVEAU code à 6 chiffres ou plus.
create or replace function ensure_unique_vi_code() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  code text;
  n bigint;
begin
  code := coalesce(nullif(trim(NEW.tracking_number), ''), case when NEW.id ~ '^VI\d+$' then NEW.id end);
  if code is null or code !~ '^VI\d+$' then return NEW; end if;
  if TG_OP = 'UPDATE' and OLD.tracking_number is not distinct from NEW.tracking_number then return NEW; end if;

  perform pg_advisory_xact_lock(hashtext('vi_tracking_code'));

  if code ~ '^VI\d{1,5}$'
     and not exists (select 1 from orders o where o.id <> NEW.id and (o.tracking_number = code or o.id = code)) then
    return NEW;
  end if;

  -- Un appareil qui renvoie un code périmé ne doit pas faire changer le code
  -- déjà corrigé en base : on garde celui-ci s'il est valide et libre.
  if TG_OP = 'UPDATE' and OLD.tracking_number ~ '^VI\d{1,5}$'
     and not exists (select 1 from orders o where o.id <> NEW.id and (o.tracking_number = OLD.tracking_number or o.id = OLD.tracking_number)) then
    NEW.tracking_number := OLD.tracking_number;
    return NEW;
  end if;

  loop
    n := nextval('vi_tracking_seq');
    NEW.tracking_number := 'VI' || lpad(n::text, 5, '0');
    exit when not exists (select 1 from orders o where o.id <> NEW.id and (o.tracking_number = NEW.tracking_number or o.id = NEW.tracking_number));
  end loop;
  return NEW;
end $$;

-- 3. Renumérote les commandes encore « Nouveau » (pas encore envoyées au
--    transporteur) ; le déclencheur leur attribue le prochain numéro libre.
update orders
set tracking_number = 'VI000000'
where status = 'nouveau'
  and is_deleted is not true
  and tracking_number ~ '^VI\d{6,}$';

-- 4. Codes à 6 chiffres restants sur des commandes déjà avancées : à vérifier
--    à la main (le colis est peut-être déjà chez le transporteur).
select id, tracking_number, status, date_added
from orders
where is_deleted is not true
  and tracking_number ~ '^VI\d{6,}$'
order by date_added;
