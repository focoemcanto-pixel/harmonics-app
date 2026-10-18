import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Contact,
  FileSignature,
  LayoutDashboard,
  ListMusic,
  MessageCircle,
  UsersRound,
  Wallet,
} from 'lucide-react';
import PublicFooter from '@/components/public/PublicFooter';
import { PublicBackground, PublicHeader, primaryButtonClass, secondaryButtonClass } from '@/components/public/PublicUI';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { loadPublicPlans } from '@/lib/billing/public-plans';
import { formatMoney, isPaidPlan, planTagline } from '@/lib/billing/plan-presentation';

// Landing comercial pública. Quem já está autenticado continua indo direto para o painel.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Harmonics | Gestão para bandas e equipes musicais',
  description:
    'Eventos, contratantes, contratos com assinatura online, escalas de músicos, repertório, financeiro e automações de WhatsApp em um só lugar.',
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

type PublicPlan = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  monthly_price: number | string;
};

async function loadPlans(): Promise<PublicPlan[]> {
  try {
    const { plans } = await loadPublicPlans(getSupabaseAdmin());
    return plans as PublicPlan[];
  } catch {
    return [];
  }
}

const PAINS = [
  {
    before: 'Datas, valores e contatos espalhados entre WhatsApp, planilhas e cadernos.',
    after: 'Cada evento com cliente, local, formação, valores e status em um só lugar.',
  },
  {
    before: 'Contratos montados à mão, enviados por PDF e cobrados um a um.',
    after: 'Pré-contrato por link, contrato gerado do seu modelo e assinatura online.',
  },
  {
    before: 'Escala fechada por mensagem e repertório chegando em cima da hora.',
    after: 'Convites com confirmação dos músicos e repertório enviado pelo próprio cliente.',
  },
];

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Eventos e agenda',
    text: 'Cadastre cada evento com data, local, formação e valores e acompanhe tudo o que vem pela frente no painel.',
  },
  {
    icon: Contact,
    title: 'Clientes e contratantes',
    text: 'Sua base de clientes em um só lugar, criada automaticamente quando alguém assina um pré-contrato.',
  },
  {
    icon: FileSignature,
    title: 'Pré-contratos e contratos',
    text: 'O cliente preenche o pré-contrato por link, você gera o contrato a partir dos seus modelos e ele assina online.',
  },
  {
    icon: UsersRound,
    title: 'Escalas e músicos',
    text: 'Monte a escala de cada evento, convide os músicos e veja quem confirmou. Cada músico tem sua área com agenda e repertório.',
  },
  {
    icon: ListMusic,
    title: 'Repertório com o cliente',
    text: 'O contratante escolhe as músicas por uma página própria e você recebe o repertório organizado por momento do evento.',
  },
  {
    icon: Wallet,
    title: 'Financeiro do evento',
    text: 'Registre pagamentos e comprovantes, veja o que falta receber e acompanhe os valores de cada evento.',
  },
  {
    icon: MessageCircle,
    title: 'Automações e WhatsApp',
    text: 'Lembretes de pagamento, de repertório e do dia do evento enviados pelo WhatsApp conectado à sua conta, nos planos pagos.',
  },
  {
    icon: LayoutDashboard,
    title: 'Sua operação em um painel',
    text: 'Um espaço próprio para a sua banda, com equipe convidada e permissões definidas por você.',
  },
];

const AUDIENCES = [
  { title: 'Bandas de eventos e casamentos', text: 'Agenda cheia, contratos, escalas e repertório de cada noiva ou contratante.' },
  { title: 'Grupos, orquestras e corais', text: 'Formações diferentes por evento e muitos músicos para confirmar.' },
  { title: 'Ministérios de louvor', text: 'Escalas, repertório e comunicação com a equipe organizados.' },
  { title: 'Produtoras e gestores', text: 'Vários eventos, músicos e clientes acompanhados por uma equipe.' },
];

const STEPS = [
  { title: 'Crie sua conta grátis', text: 'Leva menos de um minuto e não pede cartão.' },
  { title: 'Configure seu espaço', text: 'Nome da banda, contato e tipo de atuação. O resto você ajusta depois.' },
  { title: 'Cadastre o primeiro evento', text: 'Envie o pré-contrato, monte a escala e convide a equipe.' },
];

function ProductPreview() {
  const rows = [
    { label: 'Contrato', value: 'Assinado', tone: 'text-emerald-300' },
    { label: 'Repertório', value: 'Recebido do cliente', tone: 'text-emerald-300' },
    { label: 'Escala', value: '5 de 6 confirmados', tone: 'text-amber-200' },
    { label: 'Pagamento', value: 'Sinal recebido', tone: 'text-violet-200' },
  ];
  return (
    <div className="relative" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-br from-violet-600/30 via-fuchsia-600/10 to-transparent blur-2xl" />
      <div className="relative rounded-[28px] border border-white/12 bg-slate-900/80 p-5 shadow-[0_35px_120px_rgba(2,6,23,0.65)] backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">Próximo evento</span>
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-black text-emerald-200">Confirmado</span>
        </div>
        <p className="mt-4 text-xl font-black tracking-[-0.03em] text-white">Casamento Ana &amp; Pedro</p>
        <p className="mt-1 text-sm text-slate-400">Sábado · 19h · Salvador/BA · Banda completa</p>
        <dl className="mt-5 space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm">
              <dt className="font-semibold text-slate-300">{row.label}</dt>
              <dd className={`font-black ${row.tone}`}>{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/8 bg-gradient-to-r from-violet-600/20 to-fuchsia-600/10 px-4 py-3 text-sm">
          <MessageCircle className="h-4 w-4 shrink-0 text-violet-200" />
          <span className="text-slate-200">Lembrete de repertório enviado ao cliente pelo WhatsApp</span>
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  if (await hasAuthenticatedUser()) redirect('/dashboard');
  const plans = await loadPlans();
  const paidPlans = plans.filter(isPaidPlan);
  const lowestPaid = paidPlans.length ? Math.min(...paidPlans.map((plan) => Number(plan.monthly_price))) : null;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <PublicBackground />
      <PublicHeader />

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto grid grid-cols-1 w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-8 md:px-6 md:pb-24 md:pt-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="inline-flex rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-violet-100">
              Gestão para bandas e equipes musicais
            </p>
            <h1 className="mt-6 text-[2.6rem] font-black leading-[1.02] tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
              A operação da sua banda, do primeiro contato ao dia do evento.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              O Harmonics reúne eventos, contratantes, contratos com assinatura online, escalas de músicos, repertório,
              financeiro e lembretes por WhatsApp em um só painel.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={primaryButtonClass}>
                Começar grátis <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/planos" className={secondaryButtonClass}>
                Ver planos
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
              {['Plano gratuito para começar', 'Sem cartão no cadastro', 'Sem fidelidade nos planos pagos'].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-300" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <ProductPreview />
        </section>

        {/* Problemas que resolve */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">Por que Harmonics</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">Menos mensagem perdida, mais evento bem feito.</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PAINS.map((pain) => (
              <article key={pain.after} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
                <p className="text-sm leading-6 text-slate-500 line-through decoration-slate-600">{pain.before}</p>
                <p className="mt-4 flex gap-3 text-[15px] font-semibold leading-6 text-slate-100">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                  {pain.after}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Recursos */}
        <section id="recursos" className="scroll-mt-6 mx-auto w-full max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">Recursos</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">Tudo o que a operação de uma banda precisa.</h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Recursos que já estão no produto hoje. O que cada plano inclui está detalhado na página de planos.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="group rounded-[24px] border border-white/10 bg-white/[0.04] p-5 transition hover:border-violet-300/30 hover:bg-white/[0.07]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/40 to-fuchsia-600/20 text-violet-100">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-black tracking-[-0.02em] text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{feature.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* Para quem é + como começar */}
        <section className="mx-auto grid grid-cols-1 w-full max-w-6xl gap-6 px-4 pb-16 md:px-6 md:pb-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">Para quem é</p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] md:text-3xl">Feito para quem vive de música ao vivo.</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {AUDIENCES.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="font-black text-white">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-violet-700/25 via-fuchsia-700/10 to-transparent p-6 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">Como começar</p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] md:text-3xl">Em poucos minutos, sua banda no ar.</h2>
            <ol className="mt-6 space-y-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-slate-950">{index + 1}</span>
                  <div>
                    <p className="font-black text-white">{step.title}</p>
                    <p className="mt-0.5 text-sm leading-6 text-slate-300">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/signup" className={`${primaryButtonClass} mt-7 w-full sm:w-auto`}>
              Criar conta grátis <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Planos (resumo) */}
        {plans.length ? (
          <section className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">Planos</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">Comece grátis. Cresça quando precisar.</h2>
                <p className="mt-4 text-base leading-7 text-slate-300">
                  {lowestPaid !== null ? `Planos pagos a partir de ${formatMoney(lowestPaid)}/mês, ` : 'Planos pagos '}
                  com pagamento por Pix, boleto ou cartão e cancelamento quando quiser.
                </p>
              </div>
              <Link href="/planos" className="inline-flex items-center gap-2 text-sm font-black text-violet-200 hover:text-white">
                Comparar todos os planos <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {plans.map((plan) => (
                <Link
                  key={plan.id}
                  href="/planos"
                  className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5 transition hover:border-violet-300/30 hover:bg-white/[0.07]"
                >
                  <p className="font-black text-white">{plan.name}</p>
                  <p className="mt-1 text-2xl font-black tracking-[-0.03em]">
                    {isPaidPlan(plan) ? formatMoney(plan.monthly_price) : 'Grátis'}
                    {isPaidPlan(plan) ? <span className="text-sm font-semibold text-slate-400">/mês</span> : null}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{planTagline(plan)}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* CTA final */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 md:px-6">
          <div className="relative overflow-hidden rounded-[32px] border border-white/12 bg-gradient-to-r from-violet-700/40 via-fuchsia-700/25 to-purple-800/30 px-6 py-10 text-center md:px-12 md:py-14">
            <h2 className="mx-auto max-w-2xl text-3xl font-black tracking-[-0.04em] md:text-4xl">Organize o próximo evento já no Harmonics.</h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-200">
              Crie sua conta grátis, configure seu espaço e cadastre o primeiro evento hoje.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-950 transition hover:bg-violet-100">
                Começar grátis <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/planos" className={secondaryButtonClass}>
                Ver planos
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
