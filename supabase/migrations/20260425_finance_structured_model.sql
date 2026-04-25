-- Structured finance model for precontracts/events/payments + repertoire alert compatibility.

-- precontracts: fonte comercial do valor
alter table precontracts
add column if not exists agreed_amount numeric default 0;

alter table precontracts
add column if not exists signal_amount numeric default 0;

alter table precontracts
add column if not exists remaining_amount numeric default 0;

alter table precontracts
add column if not exists payment_method text;

alter table precontracts
add column if not exists signal_due_date date;

alter table precontracts
add column if not exists balance_due_date date;

alter table precontracts
add column if not exists card_due_date date;

alter table precontracts
add column if not exists payment_card boolean default false;

-- events: snapshot operacional/financeiro
alter table events
add column if not exists agreed_amount numeric default 0;

alter table events
add column if not exists paid_amount numeric default 0;

alter table events
add column if not exists open_amount numeric default 0;

alter table events
add column if not exists payment_status text default 'pending';

alter table events
add column if not exists signal_due_date date;

alter table events
add column if not exists balance_due_date date;

alter table events
add column if not exists card_due_date date;

-- payments: transações reais
alter table payments
add column if not exists precontract_id uuid;

alter table payments
add column if not exists due_date date;

alter table payments
add column if not exists payment_method text;

alter table payments
add column if not exists proof_file_url text;

alter table payments
add column if not exists notes text;

alter table payments
add column if not exists status text default 'pending';

-- repertório: evita erro de coluna ausente em alerta
alter table repertoire_config
add column if not exists reminder_15d_whatsapp_sent_at timestamptz;

create index if not exists idx_payments_event_id on payments(event_id);
create index if not exists idx_payments_precontract_id on payments(precontract_id);
create index if not exists idx_precontracts_public_token on precontracts(public_token);
create index if not exists idx_precontracts_event_id on precontracts(event_id);
