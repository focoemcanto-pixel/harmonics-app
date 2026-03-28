'use client';

function ResumoCard({ label, value, helper, tone = 'default' }) {
  const tones = {
    default: 'border-white/10 bg-white/5 text-white',
    amber: 'border-amber-300/15 bg-amber-400/10 text-amber-100',
    emerald: 'border-emerald-300/15 bg-emerald-400/10 text-emerald-100',
    violet: 'border-violet-300/15 bg-violet-400/10 text-violet-100',
  };

  return (
    <div className={`rounded-[24px] border p-5 shadow-[0_10px_30px_rgba(15,23,42,0.16)] ${tones[tone] || tones.default}`}>
      <div className="text-[12px] font-black uppercase tracking-[0.1em] text-white/60">
        {label}
      </div>
      <div className="mt-3 text-[30px] font-black tracking-[-0.04em]">
        {value}
      </div>
      <div className="mt-2 text-[13px] leading-6 text-white/65">
        {helper}
      </div>
    </div>
  );
}

export default function MembroResumoCards({ resumo }) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <ResumoCard
        label="Solicitações pendentes"
        value={resumo?.pendentes || 0}
        helper="Convites aguardando sua resposta."
        tone="amber"
      />
      <ResumoCard
        label="Escalas confirmadas"
        value={resumo?.confirmados || 0}
        helper="Eventos já confirmados por você."
        tone="emerald"
      />
      <ResumoCard
        label="Repertórios disponíveis"
        value={resumo?.repertorios || 0}
        helper="Eventos com material de estudo pronto."
        tone="violet"
      />
    </section>
  );
}
