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

  const cookieStore = cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        try {
          // ✅ CORRIGIDO: Suporta Cloudflare Workers
          const cookieList = [];
          try {
            // Tenta usar getAll() se disponível (Node.js)
            return cookieStore.getAll?.() || [];
          } catch {
            // Fallback para iteração manual (Cloudflare Workers)
            cookieStore.getAll?.().forEach?.((cookie) => {
              cookieList.push({
                name: cookie.name,
                value: cookie.value,
              });
            });
            return cookieList;
          }
        } catch (error) {
          console.error('[COOKIES] getAll() error:', error.message);
          return [];
        }
      },

      setAll(cookiesToSet) {
        try {
          if (!Array.isArray(cookiesToSet)) return;

          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch (error) {
              console.error(`[COOKIES] set(${name}) error:`, error.message);
            }
          });
        } catch (error) {
          console.error('[COOKIES] setAll() error:', error.message);
        }
      },
    },
  });
}
