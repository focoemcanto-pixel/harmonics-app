-- Remove o escopo por workspace (dados de preço/custo/templates permanecem intactos).
drop index if exists public.pricing_settings_workspace_unique_idx;
drop index if exists public.finance_cost_defaults_workspace_unique_idx;
drop index if exists public.scale_templates_workspace_idx;
alter table public.pricing_settings drop column workspace_id;
alter table public.finance_cost_defaults drop column workspace_id;
alter table public.scale_templates drop column workspace_id;
