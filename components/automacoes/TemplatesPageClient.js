'use client';

export default function TemplatesPageClient() {
  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
          Templates
        </div>

        <h1 className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#0f172a]">
          Templates de Mensagens
        </h1>

        <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[#64748b]">
          Gerencie mensagens automáticas com variáveis dinâmicas. Configure templates reutilizáveis para convites, notificações e lembretes.
        </p>
      </section>

      {/* Empty State */}
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-12 text-center shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-[48px]">📝</div>

          <h2 className="text-[20px] font-black tracking-[-0.02em] text-[#0f172a]">
            Templates de Mensagens
          </h2>

          <p className="mt-2 text-[14px] leading-6 text-[#64748b]">
            Configure templates reutilizáveis com variáveis dinâmicas como nome do cliente, data do evento, link de confirmação e muito mais.
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <button
              disabled
              className="cursor-not-allowed rounded-full bg-[#e2e8f0] px-5 py-2.5 text-[14px] font-bold text-[#94a3b8]"
            >
              Em breve
            </button>
          </div>

          <div className="mt-8 space-y-2 text-left">
            <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <div className="text-[12px] font-bold text-[#64748b]">
                Próximas funcionalidades
              </div>
              <ul className="mt-2 space-y-1 text-[13px] text-[#64748b]">
                <li>• Editor visual de templates</li>
                <li>• Variáveis dinâmicas personalizáveis</li>
                <li>• Preview em tempo real</li>
                <li>• Versionamento de templates</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
