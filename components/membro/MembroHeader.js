'use client';

export default function MembroHeader({ member, onLogout }) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.24),_rgba(10,14,28,0.98)_58%)] px-5 py-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.28)] md:px-7 md:py-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black shadow-[0_0_24px_rgba(139,92,246,0.22)]">
            <span className="font-serif text-[20px] italic text-white">H</span>
          </div>

          <div className="min-w-0">
            <div className="inline-flex rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-200">
              Harmonics Member
            </div>

            <div className="mt-2 text-[30px] font-black tracking-[-0.05em] md:text-[34px]">
              Harmonics
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-[14px] font-semibold text-white/65">
              <span>{member?.name || 'Membro'}</span>
              {member?.tag ? <span>• {member.tag}</span> : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="hidden rounded-[18px] border border-white/10 bg-white/10 px-5 py-3 text-[14px] font-black text-white transition hover:bg-white/15 md:inline-flex"
        >
          Sair
        </button>
      </div>
    </section>
  );
}
