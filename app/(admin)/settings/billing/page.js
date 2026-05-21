import AdminShell from '@/components/layout/AdminShell';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PLAN_LIMITS = [
  ['Eventos mensais', 'Plano Free com limite inicial para validação'],
  ['Membros da equipe', 'Controle por quantidade de usuários ativos'],
  ['Contratos', 'Geração, assinatura, PDF e armazenamento'],
  ['Automações', 'Lembretes, WhatsApp e fluxos operacionais'],
  ['White-label', 'Personalização avançada em planos superiores'],
];

export default async function BillingSettingsPage() {
  const supabase = createClient();
  const { data: sub } = await supabase.from('workspace_subscriptions').select('*, plan:workspace_plans(*)').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const { data: events } = await supabase.from('billing_events').select('event_type, created_at').order('created_at', { ascending: false }).limit(5);

  return (
    <AdminShell pageTitle="Assinatura" activeItem="settings" mobileSubtitle="Plano e cobrança">
      <div className="space-y-6">
        <section className="rounded-[30px] border border-[#dbe3ef] bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-700">Billing</div>
          <h1 className="mt-2 text-[34px] font-black tracking-[-0.05em] text-[#0f172a] md:text-[44px]">Assinatura e plano</h1>
          <p className="mt-3 max-w-3xl text-[15px] font-semibold leading-7 text-[#64748b]">Checkout próprio com Asaas, assinaturas recorrentes, status em tempo real e estrutura pronta para múltiplos gateways.</p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[30px] border border-emerald-200 bg-emerald-50 p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-emerald-700">Plano atual</div>
            <h2 className="mt-2 text-[32px] font-black tracking-[-0.05em] text-emerald-950">{sub?.plan?.name || 'Free'}</h2>
            <p className="mt-3 text-[14px] font-semibold leading-7 text-emerald-800">Status: <strong>{sub?.status || 'active'}</strong></p>
            <p className="text-[13px] text-emerald-900">Próxima cobrança: {sub?.next_billing_at || '—'}</p>
            <p className="text-[13px] text-emerald-900">Asaas customer: {sub?.asaas_customer_id || '—'}</p>
            <p className="text-[13px] text-emerald-900">Asaas subscription: {sub?.asaas_subscription_id || '—'}</p>
            <Link href="/assinar" className="mt-6 inline-block w-full rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-black text-white">Gerenciar assinatura</Link>
          </div>

          <div className="rounded-[30px] border border-[#dbe3ef] bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <h2 className="text-[24px] font-black tracking-[-0.03em] text-[#0f172a]">Eventos de billing</h2>
            <div className="mt-4 space-y-2">{(events || []).map((e) => <div key={`${e.event_type}-${e.created_at}`} className="rounded-xl border p-3 text-sm"><strong>{e.event_type}</strong> • {e.created_at}</div>)}</div>
            <div className="mt-5 grid gap-3">{PLAN_LIMITS.map(([title, description]) => <div key={title} className="rounded-2xl border border-[#e2e8f0] bg-slate-50 p-4"><div className="text-sm font-black text-[#0f172a]">{title}</div><div className="mt-1 text-[13px] font-semibold leading-6 text-[#64748b]">{description}</div></div>)}</div>
          </div>
        </section>

        <Link href="/settings" className="inline-flex rounded-2xl border border-[#dbe3ef] bg-white px-5 py-3 text-sm font-black text-[#0f172a] hover:bg-slate-50">← Voltar para Configurações</Link>
      </div>
    </AdminShell>
  );
}
