-- Fase 1.1 — configurações que eram globais passam a pertencer ao workspace (aditivo).
-- Aplicada em produção em 2026-10-14. Backfill: as linhas existentes (criadas antes de
-- qualquer workspace SaaS) pertencem à Harmonics (workspace key 'default').
-- Constraint UNIQUE(slug) legada mantida: linhas novas usam slug 'ws-<workspace_id>'.
-- Rollback: supabase/rollbacks/20261014100000_phase1_workspace_scoped_settings.rollback.sql

alter table public.pricing_settings add column workspace_id uuid references public.workspaces(id);
alter table public.finance_cost_defaults add column workspace_id uuid references public.workspaces(id);
alter table public.scale_templates add column workspace_id uuid references public.workspaces(id);

create unique index pricing_settings_workspace_unique_idx on public.pricing_settings(workspace_id) where workspace_id is not null;
create unique index finance_cost_defaults_workspace_unique_idx on public.finance_cost_defaults(workspace_id) where workspace_id is not null;
create index scale_templates_workspace_idx on public.scale_templates(workspace_id);

with h as (select id from public.workspaces where key = 'default')
update public.pricing_settings set workspace_id = (select id from h) where workspace_id is null and slug = 'default';
with h as (select id from public.workspaces where key = 'default')
update public.finance_cost_defaults set workspace_id = (select id from h) where workspace_id is null and slug = 'default';
with h as (select id from public.workspaces where key = 'default')
update public.scale_templates set workspace_id = (select id from h) where workspace_id is null;
