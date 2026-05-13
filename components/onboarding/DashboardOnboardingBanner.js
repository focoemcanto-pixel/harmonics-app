import Link from 'next/link';

export default function DashboardOnboardingBanner() {
  return (
    <section className="rounded-[30px] border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 p-5 shadow-[0_14px_34px_rgba(124,58,237,0.10)] md:p-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-center">
        <div>
          <div className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-violet-700">
            Onboarding
          </div>

          <h2 className="mt-3 text-[24px] font-black tracking-[-0.04em] text-[#0f172a] md:text-[30px]">
            Finalize a configuração do seu workspace
          </h2>

          <p className="mt-2 text-[14px] font-semibold leading-6 text-[#64748b]">
            Continue o checklist inicial para preparar modelos, tipos de evento, pré-contratos, automações e equipe.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-[12px] font-black text-violet-700">Modelos</span>
            <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-[12px] font-black text-violet-700">Tipos de evento</span>
            <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-[12px] font-black text-violet-700">Automações</span>
          </div>
        </div>

        <div className="rounded-[24px] border border-violet-200 bg-white p-4">
          <div className="text-[11px] font-black uppercase tracking-[0.12em] text-violet-700">Configuração inicial</div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-violet-100">
            <div className="h-full w-1/3 rounded-full bg-violet-600" />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Link href="/settings/onboarding" className="rounded-2xl bg-violet-600 px-4 py-3 text-center text-[13px] font-black text-white hover:bg-violet-500">
              Continuar
            </Link>
            <Link href="/settings/onboarding" className="rounded-2xl border border-violet-200 bg-white px-4 py-3 text-center text-[13px] font-black text-violet-700 hover:bg-violet-50">
              Checklist
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
