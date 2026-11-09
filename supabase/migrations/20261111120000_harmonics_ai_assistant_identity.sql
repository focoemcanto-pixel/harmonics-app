-- Harmonics AI v5: identidade pública da assistente (aditivo, sem efeito em dados existentes).
-- assistant_company: como a assistente apresenta a empresa ("assistente da <assistant_company>").
-- Nulo = usa o nome público do workspace, como antes.
alter table public.ai_workspace_settings
  add column if not exists assistant_company text;

alter table public.ai_workspace_settings
  drop constraint if exists ai_workspace_settings_assistant_company_len;
alter table public.ai_workspace_settings
  add constraint ai_workspace_settings_assistant_company_len
  check (assistant_company is null or char_length(assistant_company) between 1 and 80);
