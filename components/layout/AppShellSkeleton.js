// Esqueleto com a forma do app (menu lateral + conteúdo). Usado enquanto a sessão é
// restaurada e durante transições de rota: o usuário vê o app, não uma tela vazia.
export default function AppShellSkeleton({ label = 'Carregando' }) {
  return (
    <div className="flex min-h-[100dvh] bg-[#f6f8fb]" aria-busy="true" aria-label={label}>
      <aside className="hidden w-[260px] shrink-0 flex-col gap-3 border-r border-[#e2e8f0] bg-white p-5 lg:flex">
        <div className="mb-4 h-9 w-36 animate-pulse rounded-xl bg-slate-200" />
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="h-9 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </aside>
      <main className="flex-1 p-4 md:p-8">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-[24px] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.04)]" />
          ))}
        </div>
        <div className="mt-6 h-72 animate-pulse rounded-[28px] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.04)]" />
      </main>
    </div>
  );
}
