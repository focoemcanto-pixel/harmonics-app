'use client';

function Card({ title, desc, href }) {
  return (
    <a
      href={href}
      className="block rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] transition hover:shadow-[0_14px_32px_rgba(17,24,39,0.08)]"
    >
      <div className="text-[18px] font-black tracking-[-0.02em] text-[#0f172a]">
        {title}
      </div>
      <div className="mt-1 text-[14px] leading-6 text-[#64748b]">
        {desc}
      </div>
    </a>
  );
}

export default function AutomacoesPageClient() {
  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
          Automação
        </div>

        <h1 className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#0f172a]">
          Central de Automação
        </h1>

        <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[#64748b]">
          Configure mensagens automáticas, canais de envio e regras inteligentes do seu sistema.
        </p>
      </section>

      {/* Cards Grid */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card
          title="Templates"
          desc="Mensagens configuráveis com variáveis dinâmicas"
          href="/automacoes/templates"
        />
        <Card
          title="Canais"
          desc="Gerencie APIs e números de envio"
          href="/automacoes/canais"
        />
        <Card
          title="Regras"
          desc="Defina quando e para quem cada automação é executada"
          href="/automacoes/regras"
        />
        <Card
          title="Logs"
          desc="Histórico completo dos disparos"
          href="/automacoes/logs"
        />
      </section>
    </div>
  );
}
