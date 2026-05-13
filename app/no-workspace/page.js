import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function NoWorkspacePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-10 text-white">
      <section className="w-full max-w-3xl rounded-[34px] border border-white/10 bg-white/[0.06] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur md:p-10">
        <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-100">
          Nenhum workspace ativo
        </div>

        <h1 className="mt-6 text-4xl font-black tracking-[-0.05em] md:text-5xl">
          Esta conta ainda não possui um workspace ativo.
        </h1>

        <p className="mt-4 max-w-2xl text-[16px] font-semibold leading-8 text-slate-300">
          O login foi validado, mas não encontramos uma organização ativa vinculada a este usuário. Isso pode acontecer após excluir um workspace ou antes de concluir o cadastro inicial.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/signup"
            className="rounded-3xl bg-emerald-300 px-5 py-5 text-center font-black text-slate-950 transition hover:bg-emerald-200"
          >
            Criar novo workspace
          </Link>

          <Link
            href="/login"
            className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5 text-center font-black text-white transition hover:bg-white/10"
          >
            Entrar com outra conta
          </Link>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm font-semibold leading-7 text-slate-300">
          Se você acredita que deveria ter acesso a um workspace, peça para um owner ou administrador convidar seu e-mail novamente.
        </div>
      </section>
    </main>
  );
}
