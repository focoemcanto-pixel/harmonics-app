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
      // getAll/setAll: uma sessão grande é gravada em vários pedaços (.0, .1, ...); todos precisam
      // chegar juntos na mesma resposta, senão o navegador fica com pedaços velhos e novos misturados.
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );

  const isProtectedPath = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  // Raiz pública: visitante vê a página de vendas; quem já tem sessão vai para o app.
  // A sessão é checada aqui (e não na página) porque o middleware grava os cookies renovados;
  // renovar numa página de servidor descartaria os tokens novos e derrubaria a sessão do navegador.
  if (pathname === '/') {
    const hasSessionCookie = req.cookies.getAll().some((cookie) => /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name));
    if (!hasSessionCookie) return res;
    const {
      data: { user: rootUser },
    } = await supabase.auth.getUser();
    if (!rootUser) return res;
    const redirect = NextResponse.redirect(new URL('/dashboard', req.url));
    res.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

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
    '/',
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
