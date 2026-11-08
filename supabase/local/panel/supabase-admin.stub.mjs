import { createPgSupabase } from '../pg-supabase.mjs';

const pg = (await import(process.env.PG_MODULE || 'pg')).default;
const pool = new pg.Pool({ connectionString: process.env.LOCAL_DB_URL || 'postgresql://postgres@localhost/harmonics_local?host=/tmp&port=54329', max: 6 });
const client = createPgSupabase({ pool, role: 'service_role' });
export function getSupabaseAdmin() { return client; }
export const panelPool = pool;
