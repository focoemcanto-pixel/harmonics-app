export default function Header({ title = 'Dashboard' }) {
  return (
    <header className="mb-5 md:mb-8">
      <div className="rounded-3xl border border-slate-200 bg-white/95 px-5 py-4 shadow-sm md:px-6 md:py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-violet-600 font-medium">Harmonics SaaS</p>
            <h1 className="text-2xl md:text-4xl font-bold text-slate-950 mt-1">
              {title}
            </h1>
            <p className="text-sm md:text-base text-slate-500 mt-1">
              Painel administrativo responsivo
            </p>
          </div>

          <div className="rounded-full bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700">
            Admin
          </div>
        </div>
      </div>
    </header>
  );
}