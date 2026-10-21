-- Codes de suivi VIxxxxx : unicité garantie par la base.
--
-- Les numéros sont calculés dans le navigateur (src/lib/victId.js), chaque
-- appareil à partir de SA liste de commandes. Deux appareils qui confirment
-- (ou reçoivent une commande du site) au même moment calculent le même
-- numéro : deux colis partaient avec le même code. Ce déclencheur vérifie
-- chaque nouveau code au moment de l'écriture, sous un verrou, et remplace
-- un doublon par le prochain numéro libre.
--
-- Un code DÉJÀ enregistré n'est jamais modifié (il peut être imprimé sur un
-- colis en route) : seuls les codes nouveaux ou changés sont contrôlés.
--
-- À exécuter une fois dans Supabase → SQL Editor (projet VICTOURY).

create sequence if not exists vi_tracking_seq;

-- Les numéros >= 10000 sont ignorés : un seul code aberrant (commande de
-- test, saisie manuelle) suffisait à faire sauter toute la série à VI45831.
select setval('vi_tracking_seq', greatest(1, (
  select coalesce(max(n), 0) from (
    select substring(tracking_number from '^VI(\d+)$')::bigint as n from orders where tracking_number ~ '^VI\d+$'
    union all
    select substring(id from '^VI(\d+)$')::bigint from orders where id ~ '^VI\d+$'
  ) s where n < 10000
)));

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

  if not exists (select 1 from orders o where o.id <> NEW.id and (o.tracking_number = code or o.id = code)) then
    return NEW;
  end if;

  -- Un appareil qui renvoie un code périmé ne doit pas faire changer le code
  -- déjà corrigé en base : on garde celui-ci s'il est valide et libre.
  if TG_OP = 'UPDATE' and OLD.tracking_number ~ '^VI\d+$'
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

drop trigger if exists trg_unique_vi_code on orders;
create trigger trg_unique_vi_code
  before insert or update of tracking_number on orders
  for each row execute function ensure_unique_vi_code();

-- Doublons déjà présents (à vérifier à la main avant toute correction : un
-- de ces colis est peut-être déjà chez le transporteur).
select coalesce(nullif(trim(tracking_number), ''), id) as code,
       array_agg(id order by date_added) as commandes,
       array_agg(status order by date_added) as statuts
from orders
where is_deleted is not true
  and coalesce(nullif(trim(tracking_number), ''), id) ~ '^VI\d+$'
group by 1
having count(*) > 1
order by 1;
