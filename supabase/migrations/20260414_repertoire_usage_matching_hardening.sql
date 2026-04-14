-- Hardening do matching para incremento automático de usage_count
-- entre repertoire_items e suggestion_songs.

create extension if not exists pgcrypto;

-- 1) Garante normalized_title em suggestion_songs.
do $$
declare
  v_is_generated text;
begin
  select c.is_generated
    into v_is_generated
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'suggestion_songs'
    and c.column_name = 'normalized_title';

  if not found then
    alter table public.suggestion_songs
      add column normalized_title text;
  end if;
end
$$;

-- 2) Trigger de consistência para normalized_title (somente se coluna não for GENERATED).
create or replace function public.set_suggestion_song_normalized_title()
returns trigger
language plpgsql
as $$
declare
  v_is_generated text;
begin
  select c.is_generated
    into v_is_generated
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'suggestion_songs'
    and c.column_name = 'normalized_title';

  if coalesce(v_is_generated, 'NEVER') <> 'ALWAYS' then
    new.normalized_title := lower(trim(coalesce(new.title, '')));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_suggestion_song_normalized_title on public.suggestion_songs;
create trigger trg_set_suggestion_song_normalized_title
before insert or update of title on public.suggestion_songs
for each row
execute function public.set_suggestion_song_normalized_title();

-- 3) Backfill de normalized_title para dados atuais (somente quando não GENERATED).
do $$
declare
  v_is_generated text;
begin
  select c.is_generated
    into v_is_generated
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'suggestion_songs'
    and c.column_name = 'normalized_title';

  if coalesce(v_is_generated, 'NEVER') <> 'ALWAYS' then
    update public.suggestion_songs
       set normalized_title = lower(trim(coalesce(title, '')))
     where normalized_title is distinct from lower(trim(coalesce(title, '')));
  end if;
end
$$;

-- 4) Trigger de incremento com matching robusto por título normalizado
--    + fallback por youtube_url/reference_link.
create or replace function public.match_and_increment_suggestion_song_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_song_id uuid;
  v_normalized text;
  v_reference_link text;
begin
  if tg_op = 'UPDATE'
     and new.song_name is not distinct from old.song_name
     and new.reference_link is not distinct from old.reference_link
     and new.suggestion_song_id is not distinct from old.suggestion_song_id then
    return new;
  end if;

  v_normalized := lower(trim(coalesce(new.song_name, '')));
  v_reference_link := nullif(trim(coalesce(new.reference_link, '')), '');

  -- Não quebra se song_name vier vazio.
  if v_normalized = '' and v_reference_link is null and new.suggestion_song_id is null then
    return new;
  end if;

  if new.suggestion_song_id is not null then
    v_song_id := new.suggestion_song_id;
  else
    select ss.id
      into v_song_id
    from public.suggestion_songs ss
    where (
      v_normalized <> ''
      and ss.normalized_title = v_normalized
    )
    or (
      v_reference_link is not null
      and nullif(trim(coalesce(ss.youtube_url, '')), '') = v_reference_link
    )
    order by
      case
        when v_reference_link is not null
          and nullif(trim(coalesce(ss.youtube_url, '')), '') = v_reference_link
        then 0 else 1
      end,
      case
        when v_normalized <> '' and ss.normalized_title = v_normalized
        then 0 else 1
      end,
      ss.usage_count desc,
      ss.created_at asc
    limit 1;

    if v_song_id is not null then
      new.suggestion_song_id := v_song_id;
    end if;
  end if;

  if v_song_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.suggestion_song_id is not distinct from v_song_id then
    return new;
  end if;

  perform public.increment_suggestion_song_usage(v_song_id);

  return new;
end;
$$;

drop trigger if exists trg_match_and_increment_suggestion_song_usage on public.repertoire_items;
create trigger trg_match_and_increment_suggestion_song_usage
before insert or update of song_name, reference_link, suggestion_song_id
on public.repertoire_items
for each row
execute function public.match_and_increment_suggestion_song_usage();
