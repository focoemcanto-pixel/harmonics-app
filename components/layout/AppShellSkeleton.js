// Esqueletos do admin. `AppShellSkeleton` desenha o app inteiro (menu + conteúdo) e só aparece
// antes do frame existir; `AdminContentSkeleton` ocupa apenas a área de conteúdo, usado nas
// trocas de tela com o frame persistente já montado.
export function AdminContentSkeleton({ label = 'Carregando' }) {
  return (
    <div className="py-2" aria-busy="true" aria-label={label} role="status">
      <div className="hx-skeleton mb-2 h-8 w-56 rounded-[12px]" />
      <div className="hx-skeleton mb-6 h-4 w-80 max-w-full rounded-[8px]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="hx-skeleton h-28 rounded-[20px]" />
        ))}
      </div>
      <div className="hx-skeleton mt-4 h-72 rounded-[24px]" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default function AppShellSkeleton({ label = 'Carregando' }) {
  return (
    <div className="hx-admin flex min-h-[100dvh]" aria-busy="true" aria-label={label}>
      <aside className="hidden w-[84px] shrink-0 p-3 md:block lg:w-[264px]">
        <div className="h-full rounded-[24px] border border-[var(--hx-border)] bg-white p-3">
          <div className="hx-skeleton mb-5 h-10 w-10 rounded-[14px] lg:w-40" />
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="hx-skeleton mb-2 h-10 rounded-[12px]" />
          ))}
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 pt-6 md:px-8">
        <AdminContentSkeleton label={label} />
      </main>
    </div>
  );
}
