export function getSupabaseAdmin() {
  if (!globalThis.__MEMORY_SUPABASE__) throw new Error('memory supabase não configurado no teste');
  return globalThis.__MEMORY_SUPABASE__;
}
