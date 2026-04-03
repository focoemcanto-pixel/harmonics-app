import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL');
if (!SUPABASE_ANON_KEY) throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');

export async function middleware(req) {
  let res = NextResponse.next();

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
      },
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value;
        },
        set(name, value, options) {
          req.cookies.set({ name, value, ...options });
          res = NextResponse.next({ request: { headers: req.headers } });
          res.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          req.cookies.set({ name, value: '', ...options });
          res = NextResponse.next({ request: { headers: req.headers } });
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const protectedPaths = [
    '/dashboard',
    '/eventos',
    '/contratos',
    '/contatos',
    '/escalas',
    '/automacoes',
    '/pagamentos',
    '/admin',
  ];

  const isProtectedPath = protectedPaths.some(path =>
    req.nextUrl.pathname.startsWith(path)
  );

  // Apenas verificar sessão (sem query de role no middleware)
  if (isProtectedPath && !session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/eventos/:path*',
    '/contratos/:path*',
    '/contatos/:path*',
    '/escalas/:path*',
    '/automacoes/:path*',
    '/pagamentos/:path*',
    '/admin/:path*',
  ],
};
