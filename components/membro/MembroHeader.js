'use client';

export default function MembroHeader({
  member,
  onLogout,
}) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.22),_rgba(12,18,34,0.98)_58%)] px-5 py-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.28)] md:px-7 md:py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black text-[18px] font-black italic text-white shadow-[0_0_35px_rgba(139,92,246,0.22)]">
            H
          </div>

          <div className="min-w-0">
            <div className="inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-violet-200">
              Harmonics Member
            </div>

            <div className="mt-3 text-[34px] font-black tracking-[-0.05em] leading-none">
              Harmonics
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px] font-semibold text-violet-100/75">
              <span>{member?.name || 'Membro'}</span>
              <span>•</span>
              <span>{member?.tag || 'Membro da equipe'}</span>
            </div>
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
