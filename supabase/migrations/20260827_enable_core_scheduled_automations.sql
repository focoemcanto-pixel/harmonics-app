-- Ativa apenas os lembretes programados que fazem parte do fluxo operacional atual.
-- Mantemos o lembrete genérico de pagamento separado/inativo para não criar
-- dois disparos D-2 com o mesmo event_type.

update automation_rules
set is_active = true
where event_type = 'repertoire_pending_15_days_client'
  and days_before = 15
  and (
    key = 'lembrete_repertorio_rapido'
    or lower(name) = lower('Lembrete de repertório')
  );

update automation_rules
set is_active = true
where event_type = 'payment_pending_2_days_client'
  and days_before = 2
  and (
    key = 'lembrete_quitacao_2_dias'
    or lower(name) = lower('Lembrete de quitação 2 dias antes')
  );
