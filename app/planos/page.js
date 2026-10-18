import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { loadPublicPlans } from '@/lib/billing/public-plans';
import PublicFooter from '@/components/public/PublicFooter';

// Página pública de planos: o visitante conhece os planos antes de criar a conta.
// Mesma fonte dos limites do backend (workspace_plans), sem nada fixo no código.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Planos | Harmonics',
  description: 'Planos do Harmonics para bandas e equipes musicais: eventos, contratos, escalas e automações.',
};

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function limitText(value, singular, plural) {
  if (value === null || value === undefined) return `${plural} ilimitados`;
  return `${value} ${Number(value) === 1 ? singular : plural}`;
}

function features(plan) {
  return [
    limitText(plan.max_events_per_month, 'evento por mês', 'eventos por mês'),
    limitText(plan.max_members, 'membro na equipe', 'membros na equipe'),
    plan.can_use_contracts ? 'Contratos com assinatura online' : null,
    plan.can_use_automation ? 'Automações e lembretes' : null,
    plan.can_use_whatsapp
      ? `WhatsApp integrado${plan.max_whatsapp_messages ? ` (${plan.max_whatsapp_messages} mensagens/mês)` : ''}`
      : null,
    plan.can_use_white_label ? 'Sua marca no lugar da Harmonics' : null,
  ].filter(Boolean);
}

export default async function PlanosPage() {
  let plans = [];
  try {
    ({ plans } = await loadPublicPlans(getSupabaseAdmin()));
  } catch (error) {
    console.error('[PLANOS][LOAD_FAILED]', error?.message);
  }

  return (
    <main className="min-h-[100dvh] bg-slate-950 px-4 pt-10 text-white md:pt-16">
      <section className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-emerald-200">Harmonics</Link>
          <Link href="/login" className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10">
            Entrar
          </Link>
        </div>

        <div className="mt-10 max-w-3xl space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Planos para a sua banda ou equipe musical</h1>
          <p className="text-lg leading-8 text-slate-300">
            Comece grátis e mude de plano quando precisar. Sem fidelidade: você pode cancelar quando quiser e mantém o plano
            até o fim do período pago.
          </p>
        </div>

        {plans.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-slate-300">
            Não foi possível carregar os planos agora. <Link href="/signup" className="font-semibold text-emerald-200 underline">Comece grátis</Link> e
            escolha o plano depois, dentro do painel.
          </p>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {plans.map((plan) => {
              const isPaid = Number(plan.monthly_price) > 0;
              const signupHref = isPaid ? `/signup?plan=${encodeURIComponent(plan.slug)}` : '/signup';
              const loginHref = `/login?next=${encodeURIComponent(isPaid ? `/settings/billing?plan=${plan.slug}` : '/dashboard')}`;
              return (
                <article key={plan.id} className="flex flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-5">
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  <div className="mt-2 text-3xl font-black">
                    {isPaid ? money(plan.monthly_price) : 'Grátis'}
                    {isPaid ? <span className="text-sm font-semibold text-slate-400">/mês</span> : null}
                  </div>
                  {plan.description ? <p className="mt-2 text-sm text-slate-300">{plan.description}</p> : null}
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-200">
                    {features(plan).map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden="true" className="text-emerald-300">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={signupHref}
                    className="mt-5 block rounded-2xl bg-emerald-300 px-4 py-3 text-center text-sm font-black text-slate-950 hover:bg-emerald-200"
                  >
                    {isPaid ? `Começar com o ${plan.name}` : 'Começar grátis'}
                  </Link>
                  <Link href={loginHref} className="mt-2 block text-center text-xs font-semibold text-slate-400 hover:text-slate-200">
                    Já tenho conta
                  </Link>
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-sm text-slate-400">
          Planos pagos: você cria a conta, configura seu espaço em 1 minuto e conclui o pagamento (Pix, boleto ou cartão). O plano
          é ativado assim que o pagamento é confirmado.
        </p>
      </section>
      <PublicFooter className="mt-12" />
    </main>
  );
}
