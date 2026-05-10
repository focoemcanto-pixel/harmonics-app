import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

const PROTECTED_PATHS = [
  '/dashboard',
  '/eventos',
  '/contratos',
  '/pre-contratos',
  '/contatos',
  '/convites',
  '/escalas',
  '/automacoes',
  '/pagamentos',
  '/repertorios',
  '/sugestoes',
  '/avaliacoes',
  '/configuracoes',
  '/admin',
];

const PUBLIC_BYPASS_PATHS = [
  '/membro',
  '/cliente',
  '/contrato',
  '/api/public',
];

export async function middleware(req) {
  const pathname = req.nextUrl.pathname;

  // 🔥 Blindagem dos fluxos públicos/externos: não aplicar auth admin aqui.
  if (PUBLIC_BYPASS_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[middleware] Missing Supabase environment variables');
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

  const isProtectedPath = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (!isProtectedPath) {
    return res;
  }

  // Importante: middleware valida apenas sessão.
  // Roles/permissões ficam em WorkspaceModuleGuard + APIs, evitando queries pesadas no edge.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/eventos/:path*',
    '/contratos/:path*',
    '/pre-contratos/:path*',
    '/contatos/:path*',
    '/convites/:path*',
    '/escalas/:path*',
    '/automacoes/:path*',
    '/pagamentos/:path*',
    '/repertorios/:path*',
    '/sugestoes/:path*',
    '/avaliacoes/:path*',
    '/configuracoes/:path*',
    '/admin/:path*',
  ],
};
