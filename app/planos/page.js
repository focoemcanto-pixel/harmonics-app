import Link from 'next/link';
import { ArrowRight, Check, Minus } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { loadPublicPlans } from '@/lib/billing/public-plans';
import {
  COMPARISON_ROWS,
  RECOMMENDED_PLAN_SLUG,
  formatMoney,
  isPaidPlan,
  planFeatureList,
  planTagline,
} from '@/lib/billing/plan-presentation';
import PublicFooter from '@/components/public/PublicFooter';
import { PublicBackground, PublicHeader, primaryButtonClass, secondaryButtonClass } from '@/components/public/PublicUI';

// Página pública de planos: o visitante conhece os planos antes de criar a conta.
// Mesma fonte dos limites do backend (workspace_plans), sem nada fixo no código.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Planos | Harmonics',
  description: 'Planos do Harmonics para bandas e equipes musicais: eventos, contratos, escalas e automações.',
};

const FAQ = [
  {
    q: 'Posso começar sem pagar?',
    a: 'Sim. Toda conta começa no plano Free, sem cartão. Se você escolher um plano pago, o pagamento é feito logo depois de configurar seu espaço.',
  },
  {
    q: 'Como funciona o pagamento?',
    a: 'A cobrança é mensal e processada pelo Asaas, por Pix, boleto ou cartão. O plano é ativado assim que o pagamento é confirmado.',
  },
  {
    q: 'Tem fidelidade? Como cancelo?',
    a: 'Não há fidelidade. Você cancela quando quiser em Configurações → Assinatura e mantém o plano até o fim do período já pago.',
  },
  {
    q: 'E se eu atingir um limite do plano?',
    a: 'Seus dados continuam intactos. Novas ações sujeitas ao limite ficam bloqueadas até você mudar de plano ou, nos limites mensais, até o início do período seguinte.',
  },
  {
    q: 'E se um pagamento atrasar?',
    a: 'O plano pago continua ativo por 7 dias de tolerância. Depois disso o espaço passa aos limites do Free, sem perder dados, e volta ao plano pago quando o pagamento for confirmado.',
  },
];

function signupHrefFor(plan) {
  return isPaidPlan(plan) ? `/signup?plan=${encodeURIComponent(plan.slug)}` : '/signup';
}

function loginHrefFor(plan) {
  return `/login?next=${encodeURIComponent(isPaidPlan(plan) ? `/settings/billing?plan=${plan.slug}` : '/dashboard')}`;
}

function ComparisonCell({ value }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-emerald-300" aria-label="Incluído" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-slate-600" aria-label="Não incluído" />;
  return <span className="font-semibold text-slate-100">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</span>;
}

export default async function PlanosPage() {
  let plans = [];
  try {
    ({ plans } = await loadPublicPlans(getSupabaseAdmin()));
  } catch (error) {
    console.error('[PLANOS][LOAD_FAILED]', error?.message);
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <PublicBackground />
      <PublicHeader active="planos" />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 pt-6 md:px-6 md:pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">Planos e preços</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] md:text-5xl">O plano certo para o tamanho da sua operação.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Comece grátis e mude de plano quando precisar. Sem fidelidade: cancele quando quiser e mantenha o plano até o fim do
            período pago.
          </p>
        </div>

        {plans.length === 0 ? (
          <div className="mx-auto mt-12 max-w-xl rounded-[24px] border border-white/10 bg-white/[0.05] p-6 text-center text-slate-300">
            <p>Não foi possível carregar os planos agora.</p>
            <Link href="/signup" className={`${primaryButtonClass} mt-5`}>Começar grátis</Link>
            <p className="mt-3 text-sm text-slate-400">Você pode escolher o plano depois, dentro do painel.</p>
          </div>
        ) : (
          <>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {plans.map((plan) => {
                const isPaid = isPaidPlan(plan);
                const recommended = plan.slug === RECOMMENDED_PLAN_SLUG;
                return (
                  <article
                    key={plan.id}
                    className={`relative flex flex-col rounded-[26px] border p-5 ${
                      recommended
                        ? 'border-violet-300/50 bg-gradient-to-b from-violet-600/25 via-fuchsia-600/10 to-white/[0.04] shadow-[0_24px_80px_rgba(124,58,237,0.25)]'
                        : 'border-white/10 bg-white/[0.04]'
                    }`}
                  >
                    {recommended ? (
                      <span className="absolute -top-3 left-5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-white">
                        Recomendado
                      </span>
                    ) : null}
                    <h2 className="text-lg font-black tracking-[-0.02em]">{plan.name}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-400 xl:min-h-[4.5rem]">{planTagline(plan)}</p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-black tracking-[-0.04em]">{isPaid ? formatMoney(plan.monthly_price) : 'Grátis'}</span>
                      {isPaid ? <span className="text-sm font-semibold text-slate-400">/mês</span> : null}
                    </div>
                    <Link
                      href={signupHrefFor(plan)}
                      className={`${recommended ? primaryButtonClass : secondaryButtonClass} mt-5 w-full whitespace-nowrap px-4 py-3`}
                      aria-label={isPaid ? `Escolher o plano ${plan.name}` : 'Começar grátis no plano Free'}
                    >
                      {isPaid ? 'Escolher plano' : 'Começar grátis'}
                    </Link>
                    <Link href={loginHrefFor(plan)} className="mt-2 block text-center text-xs font-semibold text-slate-400 hover:text-slate-200">
                      Já tenho conta
                    </Link>
                    <ul className="mt-5 flex-1 space-y-2.5 border-t border-white/10 pt-5 text-sm">
                      {planFeatureList(plan).map((item) => (
                        <li key={item.text} className={`flex gap-2 ${item.included ? 'text-slate-200' : 'text-slate-500'}`}>
                          {item.included ? (
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                          ) : (
                            <Minus className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                          )}
                          <span>
                            <span className="sr-only">{item.included ? 'Incluído: ' : 'Não incluído: '}</span>
                            {item.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>

            <p className="mt-6 text-center text-sm text-slate-400">
              Planos pagos: você cria a conta, configura seu espaço em 1 minuto e conclui o pagamento (Pix, boleto ou cartão). O
              plano é ativado assim que o pagamento é confirmado.
            </p>

            <section className="mt-16" aria-labelledby="comparativo">
              <h2 id="comparativo" className="text-2xl font-black tracking-[-0.04em] md:text-3xl">Compare os planos</h2>
              <div className="mt-6 overflow-x-auto rounded-[24px] border border-white/10 bg-white/[0.03]">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th scope="col" className="px-5 py-4 text-left font-semibold text-slate-400">Recurso</th>
                      {plans.map((plan) => (
                        <th
                          key={plan.id}
                          scope="col"
                          className={`px-4 py-4 text-center font-black ${plan.slug === RECOMMENDED_PLAN_SLUG ? 'text-violet-200' : 'text-white'}`}
                        >
                          {plan.name}
                          <span className="mt-0.5 block text-xs font-semibold text-slate-400">
                            {isPaidPlan(plan) ? `${formatMoney(plan.monthly_price)}/mês` : 'Grátis'}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_ROWS.map((row) => (
                      <tr key={row.label} className="border-b border-white/5 last:border-0">
                        <th scope="row" className="px-5 py-3.5 text-left font-semibold text-slate-300">{row.label}</th>
                        {plans.map((plan) => (
                          <td key={plan.id} className={`px-4 py-3.5 text-center ${plan.slug === RECOMMENDED_PLAN_SLUG ? 'bg-violet-500/[0.06]' : ''}`}>
                            <ComparisonCell value={row.value(plan)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500">Todos os planos incluem eventos, clientes, escalas, repertório com o cliente e financeiro do evento.</p>
            </section>
          </>
        )}

        <section className="mt-16 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]" aria-labelledby="duvidas">
          <div>
            <h2 id="duvidas" className="text-2xl font-black tracking-[-0.04em] md:text-3xl">Dúvidas frequentes</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              As regras completas estão nos <Link href="/termos" className="font-semibold text-violet-200 hover:text-white">Termos de Uso</Link>. Outras
              dúvidas: <a href="mailto:focoemcanto@gmail.com" className="font-semibold text-violet-200 hover:text-white">focoemcanto@gmail.com</a>.
            </p>
          </div>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 open:bg-white/[0.06]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-white">
                  {item.q}
                  <span className="text-violet-200 transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-16 rounded-[28px] border border-white/12 bg-gradient-to-r from-violet-700/35 via-fuchsia-700/20 to-purple-800/25 px-6 py-8 text-center md:py-10">
          <h2 className="text-2xl font-black tracking-[-0.04em] md:text-3xl">Ainda em dúvida? Comece pelo Free.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-200">Você pode mudar de plano a qualquer momento, sem perder nada do que cadastrou.</p>
          <Link href="/signup" className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-950 transition hover:bg-violet-100">
            Começar grátis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
