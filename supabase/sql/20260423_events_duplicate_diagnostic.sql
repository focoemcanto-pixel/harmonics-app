-- Diagnóstico de possíveis duplicidades de eventos por cliente/data/hora/local.
-- Ajuste o limite e ordenação conforme necessário para investigação operacional.
SELECT
  client_name,
  event_date,
  event_time,
  location_name,
  COUNT(*) AS duplicate_count,
  ARRAY_AGG(id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS event_ids,
  ARRAY_AGG(status ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS statuses
FROM events
WHERE client_name IS NOT NULL
  AND event_date IS NOT NULL
  AND event_time IS NOT NULL
  AND location_name IS NOT NULL
GROUP BY client_name, event_date, event_time, location_name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, event_date DESC, event_time DESC, client_name ASC;
