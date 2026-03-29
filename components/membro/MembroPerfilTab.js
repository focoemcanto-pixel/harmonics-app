'use client';

export default function MembroPerfilTab({ member, onLogout }) {
  return (
    <section className="space-y-5">
      <div>
        <div className="text-[12px] font-black uppercase tracking-[0.14em] text-white/50">
          Conta
        </div>
        <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-white">
          Perfil
        </h2>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
              Nome
            </div>
            <div className="mt-2 text-[16px] font-semibold">
              {member?.name || '-'}
            </div>
          </div>

          <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
              Email
            </div>
            <div className="mt-2 break-words text-[16px] font-semibold">
              {member?.email || '-'}
            </div>
          </div>

          <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
              WhatsApp
            </div>
            <div className="mt-2 text-[16px] font-semibold">
              {member?.phone || '-'}
            </div>
          </div>

          <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
              Tag / Função
            </div>
            <div className="mt-2 text-[16px] font-semibold">
              {member?.tag || '-'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="mt-6 rounded-[18px] border border-red-300/15 bg-red-400/10 px-5 py-4 text-[15px] font-black text-red-100"
        >
          Sair da conta
        </button>
      </div>
    </section>
  );
}
