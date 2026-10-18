import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import PublicFooter from '@/components/public/PublicFooter';

// Landing comercial pública. Quem já está autenticado continua indo direto para o painel.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Harmonics | Gestão para bandas e equipes musicais',
  description:
    'Eventos, contratos com assinatura online, escalas de músicos, repertórios, financeiro e automações de WhatsApp em um só lugar.',
};

async function hasAuthenticatedUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;
  try {
    const cookieStore = await cookies();
    if (!cookieStore.getAll().some((cookie) => cookie.name.startsWith('sb-'))) return false;
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    });
    const { data } = await supabase.auth.getUser();
    return Boolean(data?.user);
  } catch {
    return false;
  }
}

const FEATURES = [
  {
    title: 'Eventos e agenda',
    text: 'Cadastre cada evento com data, local, formação e valores, e acompanhe o que está por vir no painel.',
  },
  {
    title: 'Pré-contratos e contratos',
    text: 'Envie o pré-contrato por link, gere o contrato a partir dos seus modelos e colete a assinatura online, com o PDF guardado.',
  },
  {
    title: 'Escalas e convites de músicos',
    text: 'Monte a escala de cada evento, convide os músicos e acompanhe quem confirmou. Cada músico tem sua página com a agenda.',
  },
  {
    title: 'Repertório com o cliente',
    text: 'O contratante monta e envia o repertório por uma página própria, com sugestões, e você recebe tudo organizado.',
  },
  {
    title: 'Financeiro do evento',
    text: 'Registre pagamentos e comprovantes, veja o que falta receber e controle custos por evento.',
  },
  {
    title: 'Automações e WhatsApp',
    text: 'Lembretes de pagamento, de repertório e confirmação no dia do evento, enviados pelo WhatsApp conectado à sua conta.',
  },
];

const AUDIENCES = ['Bandas para eventos e casamentos', 'Grupos e projetos musicais', 'Ministérios e equipes de louvor', 'Produtores e gestores de músicos'];

export default async function Home() {
  if (await hasAuthenticatedUser()) redirect('/dashboard');

  return (
    <main className="min-h-[100dvh] bg-slate-950 text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-6">
        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-emerald-200">Harmonics</span>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/planos" className="rounded-2xl px-3 py-2 font-semibold text-slate-200 hover:bg-white/10">Planos</Link>
          <Link href="/login" className="rounded-2xl border border-white/15 px-4 py-2 font-semibold text-slate-200 hover:bg-white/10">Entrar</Link>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 pb-14 pt-8 md:pt-16">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
            A operação da sua banda organizada do primeiro contato ao dia do evento.
          </h1>
          <p className="text-lg leading-8 text-slate-300">
            O Harmonics reúne eventos, contratos com assinatura online, escalas de músicos, repertório com o cliente,
            financeiro e lembretes automáticos por WhatsApp em um só lugar.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="rounded-2xl bg-emerald-300 px-6 py-4 text-center font-black text-slate-950 hover:bg-emerald-200">
              Começar grátis
            </Link>
            <Link href="/planos" className="rounded-2xl border border-white/15 px-6 py-4 text-center font-semibold text-slate-100 hover:bg-white/10">
              Ver planos e preços
            </Link>
          </div>
          <p className="text-sm text-slate-400">Plano gratuito disponível. Sem fidelidade nos planos pagos.</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-14">
        <h2 className="text-2xl font-semibold">O que você faz no Harmonics</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-5">
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-16 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-semibold">Para quem é</h2>
          <ul className="mt-4 space-y-2 text-slate-300">
            {AUDIENCES.map((item) => (
              <li key={item} className="flex gap-2"><span aria-hidden="true" className="text-emerald-300">✓</span>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-semibold">Como começar</h2>
          <ol className="mt-4 space-y-2 text-slate-300">
            <li>1. Crie sua conta grátis em menos de um minuto.</li>
            <li>2. Configure seu espaço: nome, contato e tipo de atuação.</li>
            <li>3. Cadastre seu primeiro evento e convide a equipe.</li>
            <li>4. Quando precisar de mais, escolha um plano pago.</li>
          </ol>
          <Link href="/signup" className="mt-6 inline-block rounded-2xl bg-emerald-300 px-5 py-3 font-black text-slate-950 hover:bg-emerald-200">
            Criar conta grátis
          </Link>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
