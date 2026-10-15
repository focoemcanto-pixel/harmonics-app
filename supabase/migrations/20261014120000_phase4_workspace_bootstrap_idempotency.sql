-- Fase 4 — bootstrap idempotente: um workspace "próprio" por usuário criado pelo signup.
-- owner_user_id estava nulo em todos os workspaces existentes, portanto o índice não afeta dados
-- atuais. O bootstrap passa a preencher owner_user_id; uma segunda criação concorrente do mesmo
-- usuário falha com 23505 e a API devolve o workspace já existente. Aplicada em 2026-10-14.
create unique index workspaces_one_owned_per_user_idx on public.workspaces(owner_user_id) where owner_user_id is not null;
