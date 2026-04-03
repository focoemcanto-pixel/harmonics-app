import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  // 🔥 BLINDAGEM DO FLUXO MEMBRO
  if (req.nextUrl.pathname.startsWith('/membro')) {
    return NextResponse.next();
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables');
    return NextResponse.next();
  }

  let res = NextResponse.next();

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
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
