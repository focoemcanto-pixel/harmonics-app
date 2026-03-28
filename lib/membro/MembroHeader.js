'use client';

export default function MembroHeader({
  member,
  onLogout,
}) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.28),_rgba(15,23,42,0.96)_55%)] px-5 py-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.28)] md:px-7 md:py-7">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-violet-200">
            Harmonics Member
          </div>

          <h1 className="mt-3 text-[30px] font-black tracking-[-0.05em] md:text-[38px]">
            Seu painel de ensaio
          </h1>

          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-violet-100/80 md:text-[16px]">
            Aceite convites, acompanhe suas escalas e estude os repertórios do jeito mais rápido.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[13px] font-black text-white">
              {member?.name || 'Membro'}
            </span>

            {member?.tag ? (
              <span className="inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-2 text-[13px] font-black text-violet-100">
                {member.tag}
              </span>
            ) : null}

            {member?.email ? (
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[12px] font-semibold text-violet-100/70">
                {member.email}
              </span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="rounded-[18px] border border-white/10 bg-white/10 px-5 py-3 text-[14px] font-black text-white transition hover:bg-white/15"
        >
          Sair
        </button>
      </div>
    </section>
  );
}
