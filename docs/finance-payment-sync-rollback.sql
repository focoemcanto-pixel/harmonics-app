-- Desligar (imediato): update public.op_finance_payment_sync_settings set enabled=false;
-- Remover o gatilho, preservando o mapa e o caixa operacional (imutável) para auditoria:
drop trigger if exists op_finance_payment_sync on public.payments;
-- Remoção completa, só se op_finance_payment_receipts estiver vazia:
-- drop function public.op_finance_payment_sync(); drop table public.op_finance_payment_receipts; drop table public.op_finance_payment_sync_settings;
