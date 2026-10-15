-- Opção (b) aprovada pelo dono em 2026-10-15 (PR #736, item 3).
-- A regra "Lembrete de repertório" (847c0e98-..., lembrete_repertorio_rapido) estava ativa com
-- template_id NULL e enviava a mensagem fixa de fallback de execute-automation-event.js.
-- Cria um template com o MESMO texto do fallback (sem mudança para o cliente) e vincula à regra,
-- para que o texto fique editável na Central de Automação. Idempotente.
with tpl as (
  insert into public.message_templates (workspace_id, workspace_settings_id, key, name, channel, recipient_type, body, is_active)
  values (
    'f36dcd9b-22a9-487a-bf2e-691d17bd6294',
    'e5d8dc0a-e164-4fbd-a6f5-1b278d43c3b2',
    'repertoire_pending_15_days_client_whatsapp',
    'Lembrete de repertório (15 dias)',
    'whatsapp',
    'client',
    'Olá, {cliente_nome}! Faltam 15 dias para o seu evento ({evento_data}). Por favor, acesse o painel e finalize a escolha do repertório: {link_painel_cliente}',
    true
  )
  on conflict (workspace_id, key) do update set updated_at = public.message_templates.updated_at
  returning id
)
update public.automation_rules r
set template_id = (select id from tpl), updated_at = now()
where r.id = '847c0e98-b6b4-43c9-afb5-98cd6ec23070'
  and r.workspace_id = 'f36dcd9b-22a9-487a-bf2e-691d17bd6294'
  and r.template_id is null
returning r.id, r.template_id;
