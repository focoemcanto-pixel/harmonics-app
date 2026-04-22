import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (typeof window !== 'undefined') {
  if (!SUPABASE_URL) {
    console.error('[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!SUPABASE_ANON_KEY) {
    console.error('[Supabase] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
}

const globalSupabase =
  typeof globalThis !== 'undefined' ? globalThis : undefined;

export function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  if (globalSupabase?.__harmonicsSupabase) {
    return globalSupabase.__harmonicsSupabase;
  }

  const instance = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  if (globalSupabase) {
    globalSupabase.__harmonicsSupabase = instance;
  }

  return instance;
}

// Named export for compatibility
export const supabase = getSupabase();
