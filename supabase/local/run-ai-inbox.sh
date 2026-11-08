#!/usr/bin/env bash
# Recria o banco local descartável (schema de produção + migrations AI v1/v2) e roda os testes
# de integração/concorrência do Inbox híbrido. Requer Postgres 16 local; NUNCA aponte para produção.
set -euo pipefail
cd "$(dirname "$0")/../.."
PSQL="psql -X -q -v ON_ERROR_STOP=1 -h ${PGHOST:-/tmp} -p ${PGPORT:-54329} -U postgres"
$PSQL -d postgres -c 'drop database if exists harmonics_local' -c 'create database harmonics_local'
for f in supabase/local/[0-9]*.sql \
  supabase/migrations/20261016180000_tenant_scope_config_tables.sql \
  supabase/migrations/20261107150000_harmonics_ai_hybrid_inbox_v1.sql \
  supabase/migrations/20261108120000_harmonics_ai_hybrid_inbox_v2.sql; do
  $PSQL -d harmonics_local -f "$f"
done
node --import ./tests/helpers/register-alias.mjs --test supabase/local/ai-inbox.local.test.mjs
