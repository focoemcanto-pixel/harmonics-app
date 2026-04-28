alter table precontracts
add column if not exists reception_formation text,
add column if not exists reception_instruments text;

alter table events
add column if not exists reception_formation text,
add column if not exists reception_instruments text;
