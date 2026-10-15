-- Fase 3 — fonte única do onboarding: workspace_onboarding_progress.flow_state.
-- O código já gravava esta coluna, mas ela não existia: progresso, conclusão e "pular" nunca
-- persistiam. Aditiva; registros existentes recebem '{}'. Aplicada em 2026-10-14.
alter table public.workspace_onboarding_progress add column flow_state jsonb not null default '{}'::jsonb;
