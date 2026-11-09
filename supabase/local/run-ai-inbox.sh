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
  supabase/migrations/20261108120000_harmonics_ai_hybrid_inbox_v2.sql \
  supabase/migrations/20261109120000_harmonics_ai_commercial_v3.sql \
  supabase/migrations/20261110120000_harmonics_ai_manual_v21.sql \
  supabase/migrations/20261111120000_harmonics_ai_assistant_identity.sql \
  supabase/migrations/20261112120000_price_rules_governance.sql \
  supabase/migrations/20261113120000_harmonics_ai_vocalists.sql; do
  $PSQL -d harmonics_local -f "$f"
done
node --import ./tests/helpers/register-alias.mjs --test-concurrency=1 --test supabase/local/ai-inbox.local.test.mjs supabase/local/ai-commercial.local.test.mjs
PANEL_WORKSPACE_ID=00000000-0000-4000-8000-0000000000f1 NEXT_PUBLIC_SUPABASE_URL=http://local SUPABASE_SERVICE_ROLE_KEY=local \
  node --import ./supabase/local/panel/register.mjs --test supabase/local/ai-panel.local.test.mjs
PANEL_WORKSPACE_ID=00000000-0000-4000-8000-0000000000f3 NEXT_PUBLIC_SUPABASE_URL=http://local SUPABASE_SERVICE_ROLE_KEY=local NEXT_PUBLIC_APP_URL=https://app.example.test \
  node --import ./supabase/local/panel/register.mjs --test supabase/local/ai-manual.local.test.mjs
node --test supabase/local/price-rules.local.test.mjs
node --import ./tests/helpers/register-alias.mjs --test supabase/local/nara-sim.local.test.mjs
node --import ./tests/helpers/register-alias.mjs --test supabase/local/vocalists.local.test.mjs
NEXT_PUBLIC_SUPABASE_URL=http://local SUPABASE_SERVICE_ROLE_KEY=local \
  node --import ./supabase/local/panel/register.mjs --test supabase/local/vocalists-approval.local.test.mjs
PANEL_WORKSPACE_ID=00000000-0000-4000-8000-0000000000f7 NEXT_PUBLIC_SUPABASE_URL=http://local SUPABASE_SERVICE_ROLE_KEY=local \
  node --import ./supabase/local/panel/register.mjs --test supabase/local/reset-test.local.test.mjs
