import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function WorkspaceDeletedPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-4xl grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-100">
            Workspace removido
          </div>

          <div>
            <h1 className="text-5xl font-black tracking-[-0.06em]">
              Workspace excluído com sucesso.
            </h1>

            <p className="mt-4 text-[16px] leading-8 text-slate-300 font-semibold">
              O tenant foi removido e sua sessão atual foi encerrada por segurança.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link href="/login?next=/workspace/new" className="rounded-3xl bg-emerald-300 px-5 py-5 text-center font-black text-slate-950 hover:bg-emerald-200 transition">
              Criar novo workspace
            </Link>

            <Link href="/login" className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5 text-center font-black text-white hover:bg-white/10 transition">
              Entrar em outro workspace
            </Link>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.06] p-6">
          <div className="text-[12px] uppercase tracking-[0.14em] font-black text-emerald-100">
            Fluxo concluído
          </div>

          <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
            Tenant removido
          </h2>

          <p className="mt-4 text-[15px] leading-7 text-slate-300 font-semibold">
            O Harmonics encerrou automaticamente a sessão do workspace excluído para evitar inconsistências multi-tenant.
          </p>

          <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-slate-300 font-semibold">
            Em versões futuras, usuários com múltiplos workspaces poderão ser redirecionados automaticamente para outro tenant disponível.
          </div>
        </div>
      </div>
    </main>
  );
}
