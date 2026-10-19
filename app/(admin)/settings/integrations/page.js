import AdminShell from '@/components/layout/AdminShell';

export const dynamic = 'force-dynamic';

const PROVIDERS = [
  ['WhatsApp Evolution API', 'Estrutura já preparada'],
  ['Z-API', 'Provider visual disponível'],
  ['Meta Cloud API', 'Planejado'],
  ['Twilio', 'Planejado'],
  ['Webhooks externos', 'Planejado'],
];

export default function IntegrationsSettingsPage() {
  return (
    <AdminShell pageTitle="Integrações" activeItem="settings" mobileSubtitle="Providers e canais">
      <div className="space-y-6">
        <section className="pt-1 md:pt-2">
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b93a3]">
            Integrações
          </div>

          <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-[#0c0d12] md:text-[34px]">
            Providers e automações
          </h1>

          <p className="mt-1.5 max-w-3xl text-[14px] leading-6 text-[#586174] md:text-[15px]">
            Esta área centralizará canais WhatsApp, providers externos, integrações e automações multi-workspace do Harmonics.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="rounded-[24px] border border-[#e4e7ec] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h2 className="text-[24px] font-black tracking-[-0.03em] text-[#0f172a]">
              Providers previstos
            </h2>

            <div className="mt-5 grid gap-3">
              {PROVIDERS.map(([title, status]) => (
                <div key={title} className="flex items-center justify-between rounded-2xl border border-[#e2e8f0] bg-slate-50 px-4 py-4">
                  <div>
                    <div className="text-sm font-black text-[#0f172a]">{title}</div>
                    <div className="mt-1 text-[13px] font-semibold text-[#64748b]">Integração do ecossistema Harmonics.</div>
                  </div>

                  <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-violet-700">
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#e4e7ec] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-700">
              Multi-provider
            </div>

            <h2 className="mt-2 text-[26px] font-black tracking-[-0.03em] text-[#0f172a]">
              Arquitetura preparada
            </h2>

            <p className="mt-4 text-[14px] font-semibold leading-7 text-[#64748b]">
              A UI já foi preparada para operar múltiplos canais de envio por workspace. O próximo passo é abstrair totalmente o backend de dispatch para cada provider.
            </p>

            <div className="mt-6 rounded-2xl border border-[#e2e8f0] bg-slate-50 p-5 text-[13px] font-semibold leading-7 text-[#475569]">
              Objetivo final:
              <br />
              permitir que cada workspace conecte seu próprio WhatsApp, número comercial e provider de automação.
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
