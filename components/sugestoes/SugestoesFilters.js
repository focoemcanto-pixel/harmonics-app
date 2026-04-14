export default function SugestoesFilters({
  search,
  statusFilter,
  genreFilter,
  featuredFilter,
  genres,
  onSearchChange,
  onStatusChange,
  onGenreChange,
  onFeaturedChange,
  onCreate,
  total,
  sourceFilter,
  onSourceChange,
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">Catálogo editorial</div>
          <h3 className="mt-1 text-[24px] font-black tracking-[-0.03em] text-slate-900">Músicas</h3>
          <p className="mt-1 text-[14px] font-semibold text-slate-500">{total} resultado(s) no filtro atual.</p>
        </div>

        <button
          type="button"
          onClick={onCreate}
          className="rounded-2xl bg-violet-600 px-5 py-3 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.22)]"
        >
          Nova música
        </button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-6">
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por música, artista ou tag..."
          className="lg:col-span-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] font-semibold text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
        />

        <select
          value={genreFilter}
          onChange={(e) => onGenreChange(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] font-semibold text-slate-900"
        >
          <option value="todos">Todos os gêneros</option>
          {genres.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] font-semibold text-slate-900"
        >
          <option value="todos">Todos os status</option>
          <option value="ativas">Ativas</option>
          <option value="inativas">Inativas</option>
          <option value="pendentes">Pendentes</option>
          <option value="erro">Com erro</option>
        </select>

        <select
          value={featuredFilter}
          onChange={(e) => onFeaturedChange(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] font-semibold text-slate-900"
        >
          <option value="todos">Todos os destaques</option>
          <option value="featured">Somente destaque</option>
          <option value="nao-featured">Sem destaque</option>
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => onSourceChange(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] font-semibold text-slate-900"
        >
          <option value="todos">Todas as origens</option>
          <option value="admin">admin</option>
          <option value="imported">imported</option>
        </select>
      </div>
    </section>
  );
}
