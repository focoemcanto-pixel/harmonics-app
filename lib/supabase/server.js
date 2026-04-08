import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const supabaseAnonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não configurada.');
  }

  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY não configurada.');
  }

  // ✅ CORRIGIDO: Não use await, cookies() é síncrono no App Router
  const cookieStore = cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        try {
          return cookieStore.getAll();
        } catch (error) {
          console.error('[SUPABASE-CLIENT] getAll() error:', error.message);
          return [];
        }
      },
      
      setAll(cookiesToSet) {
        try {
          if (!Array.isArray(cookiesToSet)) return;
          
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          console.error('[SUPABASE-CLIENT] setAll() error:', error.message);
          // Ignora quando set é chamado em contexto sem mutação de cookies.
        }
      },
    },
  });
}
