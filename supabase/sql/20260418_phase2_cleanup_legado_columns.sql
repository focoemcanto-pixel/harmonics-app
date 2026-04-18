-- FASE 2 (preparação): limpeza final de colunas legadas
-- Executar SOMENTE após validação completa em homologação/produção.

begin;

-- 1) profiles
alter table if exists public.profiles
  drop column if exists permissions;

-- 2) events
alter table if exists public.events
  drop column if exists before_room_minutes,
  drop column if exists has_antessala,
  drop column if exists has_ante_room;

-- 3) pricing_settings (formação agora em formation_prices jsonb)
alter table if exists public.pricing_settings
  drop column if exists price_solo,
  drop column if exists price_duo,
  drop column if exists price_trio,
  drop column if exists price_quarteto,
  drop column if exists price_quinteto,
  drop column if exists price_sexteto,
  drop column if exists price_septeto;

-- 4) repertoire_config (canônico escolhido: repertoire_pdf_url)
alter table if exists public.repertoire_config
  drop column if exists pdf_url;

-- 5) repertoire_tokens
alter table if exists public.repertoire_tokens
  drop column if exists public_token;

-- 6) repertoire_items
alter table if exists public.repertoire_items
  drop column if exists title,
  drop column if exists artist,
  drop column if exists key;

-- 7) automation_logs
-- Mantém metadata como canônico.
-- Caso existam aliases legados em ambientes antigos, habilitar os drops abaixo:
-- alter table if exists public.automation_logs drop column if exists meta;
-- alter table if exists public.automation_logs drop column if exists meta_data;

commit;
