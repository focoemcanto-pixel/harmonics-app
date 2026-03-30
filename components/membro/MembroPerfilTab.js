'use client';

function StatCard({ label, value, tone = 'default' }) {
  const tones = {
    default: 'border-white/10 bg-white/5 text-white',
    emerald: 'border-emerald-400/15 bg-emerald-500/10 text-emerald-100',
    amber: 'border-amber-400/15 bg-amber-500/10 text-amber-100',
    violet: 'border-violet-400/15 bg-violet-500/10 text-violet-100',
    sky: 'border-sky-400/15 bg-sky-500/10 text-sky-100',
  };

  return (
    <div
      className={`rounded-[22px] border px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.14)] ${tones[tone] || tones.default}`}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.1em] text-white/45">
        {label}
      </div>
      <div className="mt-2 text-[28px] font-black tracking-[-0.04em]">
        {value}
      </div>
    </div>
  );
}

function InfoLine({ label, value }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4">
      <div className="text-[10px] font-black uppercase tracking-[0.1em] text-white/45">
        {label}
      </div>
      <div className="mt-1 text-[15px] font-semibold text-white/85">
        {value || '-'}
      </div>
    </div>
  );
}

function getRoleLabel(tag) {
  const value = String(tag || '').trim();
  if (!value) return 'Membro';
  return value;
}

export default function MembroPerfilTab({
  member,
  onLogout,
  stats = {},
}) {
  const eventosRealizados = Number(stats?.realizados || 0);
  const eventosPendentes = Number(stats?.pendentes || 0);
  const eventosConfirmados = Number(stats?.confirmados || 0);
  const repertoriosDisponiveis = Number(stats?.repertorios || 0);

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#090414_0%,#0d061d_100%)] px-5 py-8 text-center text-white shadow-[0_18px_44px_rgba(0,0,0,0.22)]">
        <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border-[5px] border-violet-300/20 bg-black shadow-[0_0_80px_rgba(139,92,246,0.22)]">
          <span className="font-serif text-[60px] italic tracking-[-0.04em] text-white">
            H
          </span>
        </div>

        <h2 className="mt-8 text-[34px] font-black tracking-[-0.05em] text-white">
          {member?.name || 'Membro'}
        </h2>

        <div className="mt-3 text-[17px] font-semibold text-violet-200/80">
          👑 {getRoleLabel(member?.tag)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Realizados"
          value={eventosRealizados}
          tone="emerald"
        />
        <StatCard
          label="Pendentes"
          value={eventosPendentes}
          tone="amber"
        />
        <StatCard
          label="Confirmados"
          value={eventosConfirmados}
          tone="violet"
        />
        <StatCard
          label="Repertórios"
          value={repertoriosDisponiveis}
          tone="sky"
        />
      </div>

      <div className="space-y-3">
        <InfoLine label="Nome" value={member?.name || '-'} />
        <InfoLine label="E-mail" value={member?.email || '-'} />
        <InfoLine label="WhatsApp" value={member?.phone || '-'} />
        <InfoLine label="Função" value={getRoleLabel(member?.tag)} />
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="w-full rounded-[20px] border border-red-300/15 bg-red-400/10 px-5 py-4 text-[15px] font-black text-red-100 shadow-[0_10px_24px_rgba(127,29,29,0.18)]"
      >
        Sair da conta
      </button>
    </section>
  );
}
