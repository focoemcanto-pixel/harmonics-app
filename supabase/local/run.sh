#!/usr/bin/env bash
# Recria o banco local descartável (schema de produção + migrações novas) e roda o Client Zero.
# Requer Postgres 16 local; NUNCA aponte para produção.
set -euo pipefail
cd "$(dirname "$0")/../.."
PSQL="psql -X -q -v ON_ERROR_STOP=1 -h ${PGHOST:-/tmp} -p ${PGPORT:-54329} -U postgres"
$PSQL -d postgres -c 'drop database if exists harmonics_local' -c 'create database harmonics_local'
for f in supabase/local/[0-9]*.sql "$@"; do $PSQL -d harmonics_local -f "$f"; done
$PSQL -d harmonics_local -f supabase/migrations/20261016180000_tenant_scope_config_tables.sql
NEXT_PUBLIC_SUPABASE_URL=http://local SUPABASE_SERVICE_ROLE_KEY=local \
  node --import ./tests/helpers/register-alias.mjs --test supabase/local/client-zero.local.test.mjs
