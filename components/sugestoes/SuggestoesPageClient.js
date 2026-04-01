'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatDateBR(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

function EmptyState({ title, text, actionLabel, onAction }) {
  return (
    <div className="rounded-[26px] border border-dashed border-[#dbe3ef] bg-[#f8fafc] px-5 py-8 text-center">
      <div className="text-[18px] font-black text-[#0f172a]">{title}</div>
      <p className="mx-auto mt-2 max-w-xl text-[15px] leading-7 text-[#64748b]">
        {text}
      </p>

      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex rounded-[16px] border border-violet-200 bg-violet-50 px-5 py-3 text-[14px] font-black text-violet-700 transition hover:bg-violet-100"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, helper, tone = 'default' }) {
  const tones = {
    default: 'border-[#dbe3ef] bg-white text-[#0f172a]',
    violet: 'border-violet-200 bg-violet-50 text-violet-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
  };

  return (
    <div className={`rounded-[24px] border p-4 ${tones[tone] || tones.default}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.1em] opacity-75">
        {label}
      </div>
      <div className="mt-2 text-[30px] font-black tracking-[-0.04em]">{value}</div>
      {helper ? (
        <div className="mt-1 text-[13px] font-semibold opacity-80">{helper}</div>
      ) : null}
    </div>
  );
}

function SectionCard({ eyebrow, title, subtitle, right, children }) {
  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          {eyebrow ? (
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="mt-1 text-[24px] font-black tracking-[-0.03em] text-[#0f172a] md:text-[28px]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[#64748b]">
              {subtitle}
            </p>
          ) : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function Pill({ children, tone = 'default' }) {
  const tones = {
    default: 'border-[#dbe3ef] bg-[#f8fafc] text-[#475569]',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${tones[tone] || tones.default}`}
    >
      {children}
    </span>
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        'rounded-[18px] px-4 py-3 text-[14px] font-black transition',
        active
          ? 'bg-violet-600 text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]'
          : 'bg-[#f8fafc] text-[#475569] hover:bg-[#eef2ff]'
      )}
    >
      {children}
    </button>
  );
}

function SuggestionCard({ song, onEdit, onDelete, onToggleFeatured, onToggleActive }) {
  const genreName = song?.genre?.name || 'Sem gênero';
  const momentName = song?.moment?.name || 'Sem momento';
  const tags = (song?.song_tags || []).map((item) => item?.tag?.name).filter(Boolean);
  const collections = (song?.collection_links || [])
    .map((item) => item?.collection?.name)
    .filter(Boolean);

  const hasThumb = Boolean(song?.thumbnail_url);
  const hasYoutube = Boolean(song?.youtube_id || song?.youtube_url);
  const isComplete =
    Boolean(song?.title) &&
    Boolean(song?.genre?.id) &&
    Boolean(song?.moment?.id) &&
    hasYoutube &&
    hasThumb;

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#dbe3ef] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="relative h-[180px] bg-[#f3f4f6]">
        {song?.thumbnail_url ? (
          <img
            src={song.thumbnail_url}
            alt={song.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] font-black text-[#64748b]">
            Sem thumbnail
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Pill tone={song?.is_active ? 'emerald' : 'red'}>
            {song?.is_active ? 'Ativa' : 'Oculta'}
          </Pill>
          {song?.is_featured ? <Pill tone="violet">Destaque</Pill> : null}
          {!isComplete ? <Pill tone="amber">Incompleta</Pill> : null}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="line-clamp-1 text-[20px] font-black tracking-[-0.03em] text-[#0f172a]">
              {song?.title || 'Sem título'}
            </div>
            <div className="mt-1 line-clamp-1 text-[14px] font-semibold text-[#64748b]">
              {song?.artist || 'Artista não informado'}
            </div>
          </div>

          <div className="text-right text-[12px] font-black text-[#94a3b8]">
            Ordem {song?.sort_order ?? 0}
          </div>
        </div>

        {song?.description ? (
          <p className="mt-3 line-clamp-2 text-[14px] leading-6 text-[#64748b]">
            {song.description}
          </p>
        ) : (
          <p className="mt-3 text-[14px] leading-6 text-[#94a3b8]">
            Sem descrição editorial.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Pill tone="sky">{genreName}</Pill>
          <Pill>{momentName}</Pill>
          {!hasYoutube ? <Pill tone="amber">Sem YouTube</Pill> : null}
          {!hasThumb ? <Pill tone="amber">Sem thumbnail</Pill> : null}
        </div>

        {tags.length > 0 ? (
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Tags
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Pill key={`${song.id}-tag-${tag}`}>{tag}</Pill>
              ))}
            </div>
          </div>
        ) : null}

        {collections.length > 0 ? (
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Coleções
            </div>
            <div className="flex flex-wrap gap-2">
              {collections.map((collection) => (
                <Pill key={`${song.id}-collection-${collection}`} tone="violet">
                  {collection}
                </Pill>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onEdit(song)}
            className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[13px] font-black text-[#0f172a]"
          >
            Editar
          </button>

          <button
            type="button"
            onClick={() => onToggleFeatured(song)}
            className="rounded-[16px] border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] font-black text-violet-700"
          >
            {song?.is_featured ? 'Remover destaque' : 'Destacar'}
          </button>

          <button
            type="button"
            onClick={() => onToggleActive(song)}
            className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-black text-amber-700"
          >
            {song?.is_active ? 'Ocultar' : 'Ativar'}
          </button>

          <button
            type="button"
            onClick={() => onDelete(song)}
            className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-black text-red-700"
          >
            Excluir
          </button>
        </div>

        <div className="mt-4 text-[12px] font-semibold text-[#94a3b8]">
          Atualizada em {formatDateBR(song?.updated_at)}
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children, helper }) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </label>
      {children}
      {helper ? (
        <div className="text-[12px] font-semibold text-[#94a3b8]">{helper}</div>
      ) : null}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
    />
  );
}

function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
    >
      {children}
    </select>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-[#cbd5e1]"
      />
      <span className="text-[14px] font-black text-[#0f172a]">{label}</span>
    </label>
  );
}

function SuggestionEditorModal({
  open,
  onClose,
  onSubmit,
  loading,
  song,
  genres,
  moments,
  tags,
  collections,
}) {
  const [form, setForm] = useState({
    title: '',
    artist: '',
    genre_id: '',
    moment_id: '',
    youtube_url: '',
    youtube_id: '',
    thumbnail_url: '',
    description: '',
    is_featured: false,
    is_active: true,
    sort_order: 0,
    tag_ids: [],
    collection_ids: [],
  });

  useEffect(() => {
    if (!open) return;

    setForm({
      title: song?.title || '',
      artist: song?.artist || '',
      genre_id: song?.genre?.id || '',
      moment_id: song?.moment?.id || '',
      youtube_url: song?.youtube_url || '',
      youtube_id: song?.youtube_id || '',
      thumbnail_url: song?.thumbnail_url || '',
      description: song?.description || '',
      is_featured: Boolean(song?.is_featured),
      is_active: typeof song?.is_active === 'boolean' ? song.is_active : true,
      sort_order: Number(song?.sort_order || 0),
      tag_ids: (song?.song_tags || []).map((item) => item?.tag?.id).filter(Boolean),
      collection_ids: (song?.collection_links || [])
        .map((item) => item?.collection?.id)
        .filter(Boolean),
    });
  }, [open, song]);

  if (!open) return null;

  function toggleId(listKey, id) {
    setForm((prev) => {
      const exists = prev[listKey].includes(id);
      return {
        ...prev,
        [listKey]: exists
          ? prev[listKey].filter((item) => item !== id)
          : [...prev[listKey], id],
      };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,23,42,0.45)] p-4 md:items-center">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-[30px] border border-[#dbe3ef] bg-[#f8fafc] shadow-[0_30px_90px_rgba(15,23,42,0.26)]">
        <div className="sticky top-0 z-10 border-b border-[#e5edf6] bg-white/95 px-6 py-5 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[12px] font-black uppercase tracking-[0.1em] text-violet-600">
                Biblioteca musical
              </div>
              <div className="mt-1 text-[24px] font-black tracking-[-0.03em] text-[#0f172a]">
                {song?.id ? 'Editar música' : 'Nova música'}
              </div>
              <div className="mt-1 text-[14px] font-semibold text-[#64748b]">
                Cadastre e refine a curadoria exibida no painel do cliente.
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[13px] font-black text-[#0f172a]"
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <SectionCard eyebrow="Identidade" title="Dados principais">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Título">
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex: A Thousand Years"
                  />
                </FormField>

                <FormField label="Artista">
                  <Input
                    value={form.artist}
                    onChange={(e) => setForm((prev) => ({ ...prev, artist: e.target.value }))}
                    placeholder="Ex: Christina Perri"
                  />
                </FormField>

                <FormField label="Gênero">
                  <Select
                    value={form.genre_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, genre_id: e.target.value }))}
                  >
                    <option value="">Selecionar gênero</option>
                    {genres.map((genre) => (
                      <option key={genre.id} value={genre.id}>
                        {genre.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Momento">
                  <Select
                    value={form.moment_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, moment_id: e.target.value }))}
                  >
                    <option value="">Selecionar momento</option>
                    {moments.map((moment) => (
                      <option key={moment.id} value={moment.id}>
                        {moment.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Ordem">
                  <Input
                    type="number"
                    value={String(form.sort_order)}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sort_order: Number(e.target.value || 0),
                      }))
                    }
                    placeholder="0"
                  />
                </FormField>
              </div>
            </SectionCard>

            <SectionCard eyebrow="Mídia" title="YouTube, thumb e descrição">
              <div className="grid gap-4">
                <FormField label="URL do YouTube">
                  <Input
                    value={form.youtube_url}
                    onChange={(e) => setForm((prev) => ({ ...prev, youtube_url: e.target.value }))}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </FormField>

                <FormField label="YouTube ID" helper="Pode deixar vazio se você informar a URL.">
                  <Input
                    value={form.youtube_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, youtube_id: e.target.value }))}
                    placeholder="rtOvBOTyX00"
                  />
                </FormField>

                <FormField label="Thumbnail URL">
                  <Input
                    value={form.thumbnail_url}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, thumbnail_url: e.target.value }))
                    }
                    placeholder="https://img.youtube.com/..."
                  />
                </FormField>

                <FormField label="Descrição editorial">
                  <Textarea
                    rows={4}
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Texto curto que aparece no card e orienta a escolha."
                  />
                </FormField>
              </div>
            </SectionCard>

            <SectionCard eyebrow="Editorial" title="Destaques, status e agrupamentos">
              <div className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Checkbox
                    checked={form.is_featured}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, is_featured: e.target.checked }))
                    }
                    label="Marcar como destaque"
                  />

                  <Checkbox
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, is_active: e.target.checked }))
                    }
                    label="Música ativa no catálogo"
                  />
                </div>

                <FormField label="Tags editoriais">
                  <div className="flex flex-wrap gap-2 rounded-[18px] border border-[#dbe3ef] bg-white p-3">
                    {tags.length ? (
                      tags.map((tag) => {
                        const active = form.tag_ids.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleId('tag_ids', tag.id)}
                            className={classNames(
                              'rounded-full px-3 py-2 text-[12px] font-black transition',
                              active
                                ? 'bg-violet-100 text-violet-700'
                                : 'border border-[#dbe3ef] bg-white text-[#475569]'
                            )}
                          >
                            {tag.name}
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-[13px] font-semibold text-[#94a3b8]">
                        Nenhuma tag cadastrada ainda.
                      </div>
                    )}
                  </div>
                </FormField>

                <FormField label="Coleções">
                  <div className="flex flex-wrap gap-2 rounded-[18px] border border-[#dbe3ef] bg-white p-3">
                    {collections.length ? (
                      collections.map((collection) => {
                        const active = form.collection_ids.includes(collection.id);
                        return (
                          <button
                            key={collection.id}
                            type="button"
                            onClick={() => toggleId('collection_ids', collection.id)}
                            className={classNames(
                              'rounded-full px-3 py-2 text-[12px] font-black transition',
                              active
                                ? 'bg-violet-100 text-violet-700'
                                : 'border border-[#dbe3ef] bg-white text-[#475569]'
                            )}
                          >
                            {collection.name}
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-[13px] font-semibold text-[#94a3b8]">
                        Nenhuma coleção cadastrada ainda.
                      </div>
                    )}
                  </div>
                </FormField>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard eyebrow="Prévia" title="Como vai aparecer">
              <div className="overflow-hidden rounded-[24px] border border-[#dbe3ef] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                <div className="relative h-[220px] bg-[#f3f4f6]">
                  {form.thumbnail_url ? (
                    <img
                      src={form.thumbnail_url}
                      alt={form.title || 'Prévia'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[13px] font-black text-[#64748b]">
                      Sem thumbnail
                    </div>
                  )}

                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    {form.genre_id ? <Pill tone="sky">Gênero selecionado</Pill> : null}
                    {form.moment_id ? <Pill>Momento selecionado</Pill> : null}
                    {form.is_featured ? <Pill tone="violet">Destaque</Pill> : null}
                    {!form.is_active ? <Pill tone="red">Oculta</Pill> : null}
                  </div>
                </div>

                <div className="p-5">
                  <div className="text-[20px] font-black tracking-[-0.03em] text-[#0f172a]">
                    {form.title || 'Título da música'}
                  </div>
                  <div className="mt-1 text-[14px] font-semibold text-[#64748b]">
                    {form.artist || 'Artista'}
                  </div>

                  <p className="mt-3 text-[14px] leading-6 text-[#64748b]">
                    {form.description || 'Descrição editorial da música.'}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard eyebrow="Validação" title="Qualidade do cadastro">
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-[18px] bg-[#f8fafc] px-4 py-3">
                  <span className="text-[14px] font-black text-[#0f172a]">Título</span>
                  <Pill tone={form.title ? 'emerald' : 'amber'}>
                    {form.title ? 'OK' : 'Falta'}
                  </Pill>
                </div>

                <div className="flex items-center justify-between rounded-[18px] bg-[#f8fafc] px-4 py-3">
                  <span className="text-[14px] font-black text-[#0f172a]">Gênero</span>
                  <Pill tone={form.genre_id ? 'emerald' : 'amber'}>
                    {form.genre_id ? 'OK' : 'Falta'}
                  </Pill>
                </div>

                <div className="flex items-center justify-between rounded-[18px] bg-[#f8fafc] px-4 py-3">
                  <span className="text-[14px] font-black text-[#0f172a]">Momento</span>
                  <Pill tone={form.moment_id ? 'emerald' : 'amber'}>
                    {form.moment_id ? 'OK' : 'Falta'}
                  </Pill>
                </div>

                <div className="flex items-center justify-between rounded-[18px] bg-[#f8fafc] px-4 py-3">
                  <span className="text-[14px] font-black text-[#0f172a]">YouTube</span>
                  <Pill tone={form.youtube_url || form.youtube_id ? 'emerald' : 'amber'}>
                    {form.youtube_url || form.youtube_id ? 'OK' : 'Falta'}
                  </Pill>
                </div>

                <div className="flex items-center justify-between rounded-[18px] bg-[#f8fafc] px-4 py-3">
                  <span className="text-[14px] font-black text-[#0f172a]">Thumbnail</span>
                  <Pill tone={form.thumbnail_url ? 'emerald' : 'amber'}>
                    {form.thumbnail_url ? 'OK' : 'Falta'}
                  </Pill>
                </div>
              </div>
            </SectionCard>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => onSubmit(form)}
                disabled={loading}
                className="rounded-[18px] bg-violet-600 px-5 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] disabled:opacity-60"
              >
                {loading ? 'Salvando...' : song?.id ? 'Salvar alterações' : 'Criar música'}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-4 text-[15px] font-black text-[#0f172a]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuggestoesResumoTab({ songs }) {
  const ativos = songs.filter((song) => song.is_active).length;
  const destaques = songs.filter((song) => song.is_featured).length;
  const comYoutube = songs.filter((song) => song.youtube_id || song.youtube_url).length;
  const comThumb = songs.filter((song) => song.thumbnail_url).length;
  const incompletas = songs.filter(
    (song) =>
      !song.genre?.id ||
      !song.moment?.id ||
      !song.youtube_id ||
      !song.thumbnail_url
  ).length;

  const colecoesAtivas = new Set(
    songs.flatMap((song) =>
      (song.collection_links || [])
        .map((item) => item?.collection?.name)
        .filter(Boolean)
    )
  ).size;

  return (
    <div className="space-y-5">
      <SectionCard
        eyebrow="Saúde do catálogo"
        title="Resumo editorial"
        subtitle="Acompanhe rapidamente o estado geral da curadoria musical do cliente."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            label="Músicas ativas"
            value={ativos}
            helper="disponíveis no catálogo"
            tone="emerald"
          />
          <SummaryCard
            label="Destaques"
            value={destaques}
            helper="marcadas como featured"
            tone="violet"
          />
          <SummaryCard
            label="Coleções"
            value={colecoesAtivas}
            helper="coleções em uso"
            tone="sky"
          />
          <SummaryCard
            label="Com YouTube"
            value={comYoutube}
            helper="com vídeo vinculado"
            tone="default"
          />
          <SummaryCard
            label="Com thumbnail"
            value={comThumb}
            helper="imagem carregada"
            tone="default"
          />
          <SummaryCard
            label="Pendências"
            value={incompletas}
            helper="músicas com cadastro incompleto"
            tone="amber"
          />
        </div>
      </SectionCard>
    </div>
  );
}

function SuggestoesBibliotecaTab({
  songs,
  loading,
  onCreate,
  onEdit,
  onDelete,
  onToggleFeatured,
  onToggleActive,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [featuredFilter, setFeaturedFilter] = useState('todos');
  const [genreFilter, setGenreFilter] = useState('todos');
  const [momentFilter, setMomentFilter] = useState('todos');

  const genres = useMemo(() => {
    return Array.from(
      new Set(songs.map((song) => song?.genre?.name).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [songs]);

  const moments = useMemo(() => {
    return Array.from(
      new Set(songs.map((song) => song?.moment?.name).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [songs]);

  const filteredSongs = useMemo(() => {
    const q = search.trim().toLowerCase();

    return songs.filter((song) => {
      const matchesSearch =
        !q ||
        String(song?.title || '').toLowerCase().includes(q) ||
        String(song?.artist || '').toLowerCase().includes(q) ||
        String(song?.description || '').toLowerCase().includes(q) ||
        String(song?.genre?.name || '').toLowerCase().includes(q) ||
        String(song?.moment?.name || '').toLowerCase().includes(q) ||
        (song?.song_tags || [])
          .map((item) => item?.tag?.name)
          .filter(Boolean)
          .some((tag) => String(tag).toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'ativas' && song?.is_active) ||
        (statusFilter === 'ocultas' && !song?.is_active);

      const matchesFeatured =
        featuredFilter === 'todos' ||
        (featuredFilter === 'featured' && song?.is_featured) ||
        (featuredFilter === 'normal' && !song?.is_featured);

      const matchesGenre =
        genreFilter === 'todos' || song?.genre?.name === genreFilter;

      const matchesMoment =
        momentFilter === 'todos' || song?.moment?.name === momentFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesFeatured &&
        matchesGenre &&
        matchesMoment
      );
    });
  }, [songs, search, statusFilter, featuredFilter, genreFilter, momentFilter]);

  return (
    <div className="space-y-5">
      <SectionCard
        eyebrow="Biblioteca"
        title="Catálogo de músicas"
        subtitle="Gerencie o acervo completo exibido no painel do cliente, com filtros e ações rápidas."
        right={
          <button
            type="button"
            onClick={onCreate}
            className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
          >
            Nova música
          </button>
        }
      >
        <div className="grid gap-3 lg:grid-cols-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar título, artista, tag..."
            className="lg:col-span-2 w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a]"
          >
            <option value="todos">Todos os status</option>
            <option value="ativas">Ativas</option>
            <option value="ocultas">Ocultas</option>
          </select>

          <select
            value={featuredFilter}
            onChange={(e) => setFeaturedFilter(e.target.value)}
            className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a]"
          >
            <option value="todos">Com ou sem destaque</option>
            <option value="featured">Só destaque</option>
            <option value="normal">Sem destaque</option>
          </select>

          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a]"
          >
            <option value="todos">Todos os gêneros</option>
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>

          <select
            value={momentFilter}
            onChange={(e) => setMomentFilter(e.target.value)}
            className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a]"
          >
            <option value="todos">Todos os momentos</option>
            {moments.map((moment) => (
              <option key={moment} value={moment}>
                {moment}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 text-[13px] font-semibold text-[#64748b]">
          {filteredSongs.length} música(s) encontrada(s)
        </div>
      </SectionCard>

      {loading ? (
        <SectionCard title="Carregando" subtitle="Buscando catálogo real do banco.">
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-[360px] animate-pulse rounded-[28px] bg-[#eef2f7]"
              />
            ))}
          </div>
        </SectionCard>
      ) : filteredSongs.length === 0 ? (
        <EmptyState
          title="Nenhuma música encontrada"
          text="Ajuste os filtros ou cadastre a primeira música da curadoria."
          actionLabel="Nova música"
          onAction={onCreate}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredSongs.map((song) => (
            <SuggestionCard
              key={song.id}
              song={song}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleFeatured={onToggleFeatured}
              onToggleActive={onToggleActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlaceholderTab({ title, text }) {
  return (
    <SectionCard eyebrow="Em sequência" title={title} subtitle={text}>
      <EmptyState
        title="Próxima etapa do módulo"
        text="A estrutura da página já está pronta para receber esse gerenciamento com a mesma linguagem visual premium."
      />
    </SectionCard>
  );
}

export default function SuggestoesPageClient() {
  const [activeTab, setActiveTab] = useState('resumo');
  const [songs, setSongs] = useState([]);
  const [genres, setGenres] = useState([]);
  const [moments, setMoments] = useState([]);
  const [tags, setTags] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSong, setSavingSong] = useState(false);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);

  const tabs = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'biblioteca', label: 'Biblioteca' },
    { key: 'generos', label: 'Gêneros' },
    { key: 'momentos', label: 'Momentos' },
    { key: 'tags', label: 'Tags' },
    { key: 'colecoes', label: 'Coleções' },
    { key: 'qualidade', label: 'Qualidade' },
  ];

  async function loadSongs() {
    const response = await fetch('/api/suggestions/songs', {
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error || 'Erro ao carregar músicas');
    }

    const list = Array.isArray(data?.songs) ? data.songs : [];
    setSongs(list);

    const genresMap = new Map();
    const momentsMap = new Map();
    const tagsMap = new Map();
    const collectionsMap = new Map();

    list.forEach((song) => {
      if (song?.genre?.id) genresMap.set(song.genre.id, song.genre);
      if (song?.moment?.id) momentsMap.set(song.moment.id, song.moment);

      (song?.song_tags || []).forEach((item) => {
        if (item?.tag?.id) tagsMap.set(item.tag.id, item.tag);
      });

      (song?.collection_links || []).forEach((item) => {
        if (item?.collection?.id) {
          collectionsMap.set(item.collection.id, item.collection);
        }
      });
    });

    setGenres(
      Array.from(genresMap.values()).sort(
        (a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0)
      )
    );

    setMoments(
      Array.from(momentsMap.values()).sort(
        (a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0)
      )
    );

    setTags(Array.from(tagsMap.values()).sort((a, b) => a.name.localeCompare(b.name)));

    setCollections(
      Array.from(collectionsMap.values()).sort(
        (a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0)
      )
    );
  }

 async function loadAll() {
  try {
    setLoading(true);
    setError('');

    const [songsResponse, genresResponse, momentsResponse] = await Promise.all([
      fetch('/api/suggestions/songs', { cache: 'no-store' }),
      fetch('/api/suggestions/genres', { cache: 'no-store' }),
      fetch('/api/suggestions/moments', { cache: 'no-store' }),
    ]);

    const [songsData, genresData, momentsData] = await Promise.all([
      songsResponse.json().catch(() => ({})),
      genresResponse.json().catch(() => ({})),
      momentsResponse.json().catch(() => ({})),
    ]);

    if (!songsResponse.ok) {
      throw new Error(songsData?.error || 'Erro ao carregar músicas');
    }

    if (!genresResponse.ok) {
      throw new Error(genresData?.error || 'Erro ao carregar gêneros');
    }

    if (!momentsResponse.ok) {
      throw new Error(momentsData?.error || 'Erro ao carregar momentos');
    }

    const songsList = Array.isArray(songsData?.songs) ? songsData.songs : [];
    const genresList = Array.isArray(genresData?.genres) ? genresData.genres : [];
    const momentsList = Array.isArray(momentsData?.moments) ? momentsData.moments : [];

    setSongs(songsList);
    setGenres(genresList);
    setMoments(momentsList);

    const tagsMap = new Map();
    const collectionsMap = new Map();

    songsList.forEach((song) => {
      (song?.song_tags || []).forEach((item) => {
        if (item?.tag?.id) tagsMap.set(item.tag.id, item.tag);
      });

      (song?.collection_links || []).forEach((item) => {
        if (item?.collection?.id) {
          collectionsMap.set(item.collection.id, item.collection);
        }
      });
    });

    setTags(Array.from(tagsMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
    setCollections(
      Array.from(collectionsMap.values()).sort(
        (a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0)
      )
    );
  } catch (err) {
    console.error(err);
    setError(err?.message || 'Erro ao carregar módulo de sugestões');
  } finally {
    setLoading(false);
  }
}
  function openCreate() {
    setEditingSong(null);
    setEditorOpen(true);
  }

  function openEdit(song) {
    setEditingSong(song);
    setEditorOpen(true);
  }

  async function handleSaveSong(form) {
    try {
      setSavingSong(true);
      setError('');

      const method = editingSong?.id ? 'PATCH' : 'POST';
      const url = editingSong?.id
        ? `/api/suggestions/songs/${editingSong.id}`
        : '/api/suggestions/songs';

      const payload = {
        ...form,
        title: String(form.title || '').trim(),
        artist: String(form.artist || '').trim(),
        description: String(form.description || '').trim(),
        youtube_url: String(form.youtube_url || '').trim(),
        youtube_id: String(form.youtube_id || '').trim(),
        thumbnail_url: String(form.thumbnail_url || '').trim(),
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao salvar música');
      }

      setEditorOpen(false);
      setEditingSong(null);
      await loadAll();
      setActiveTab('biblioteca');
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Erro ao salvar música');
    } finally {
      setSavingSong(false);
    }
  }

  async function handleDelete(song) {
    const confirmed = window.confirm(
      `Excluir "${song?.title || 'esta música'}"? Essa ação não poderá ser desfeita.`
    );

    if (!confirmed) return;

    try {
      setError('');

      const response = await fetch(`/api/suggestions/songs/${song.id}`, {
        method: 'DELETE',
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao excluir música');
      }

      await loadAll();
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Erro ao excluir música');
    }
  }

  async function handleToggleFeatured(song) {
    await handleSaveSong({
      title: song.title,
      artist: song.artist || '',
      genre_id: song?.genre?.id || '',
      moment_id: song?.moment?.id || '',
      youtube_url: song.youtube_url || '',
      youtube_id: song.youtube_id || '',
      thumbnail_url: song.thumbnail_url || '',
      description: song.description || '',
      is_featured: !song.is_featured,
      is_active: song.is_active,
      sort_order: song.sort_order || 0,
      tag_ids: (song.song_tags || []).map((item) => item?.tag?.id).filter(Boolean),
      collection_ids: (song.collection_links || [])
        .map((item) => item?.collection?.id)
        .filter(Boolean),
    });

    setEditingSong({ ...song, is_featured: !song.is_featured, id: song.id });
  }

  async function handleToggleActive(song) {
    await handleSaveSong({
      title: song.title,
      artist: song.artist || '',
      genre_id: song?.genre?.id || '',
      moment_id: song?.moment?.id || '',
      youtube_url: song.youtube_url || '',
      youtube_id: song.youtube_id || '',
      thumbnail_url: song.thumbnail_url || '',
      description: song.description || '',
      is_featured: song.is_featured,
      is_active: !song.is_active,
      sort_order: song.sort_order || 0,
      tag_ids: (song.song_tags || []).map((item) => item?.tag?.id).filter(Boolean),
      collection_ids: (song.collection_links || [])
        .map((item) => item?.collection?.id)
        .filter(Boolean),
    });

    setEditingSong({ ...song, is_active: !song.is_active, id: song.id });
  }

  return (
    <div className="space-y-5">
      <SectionCard
        eyebrow="Harmonics Admin"
        title="Sugestões"
        subtitle="Gerencie a curadoria musical do painel do cliente com controle editorial, visão de catálogo e ações rápidas."
        right={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openCreate}
              className="rounded-[18px] border border-violet-200 bg-violet-50 px-5 py-4 text-[14px] font-black text-violet-700"
            >
              Nova música
            </button>

            <Link
              href="/cliente/demo"
              className="rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-4 text-[14px] font-black text-[#0f172a]"
            >
              Ver painel do cliente
            </Link>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Catálogo"
            value={songs.length}
            helper="músicas registradas"
            tone="default"
          />
          <SummaryCard
            label="Ativas"
            value={songs.filter((song) => song.is_active).length}
            helper="visíveis para o cliente"
            tone="emerald"
          />
          <SummaryCard
            label="Destaques"
            value={songs.filter((song) => song.is_featured).length}
            helper="featured na curadoria"
            tone="violet"
          />
          <SummaryCard
            label="Pendências"
            value={songs.filter((song) => !song.thumbnail_url || !song.youtube_id).length}
            helper="cadastros incompletos"
            tone="amber"
          />
        </div>
      </SectionCard>

      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-5 text-[15px] font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-2 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <TabButton
              key={tab.key}
              active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </TabButton>
          ))}
        </div>
      </div>

      {activeTab === 'resumo' && <SuggestoesResumoTab songs={songs} />}

      {activeTab === 'biblioteca' && (
        <SuggestoesBibliotecaTab
          songs={songs}
          loading={loading}
          onCreate={openCreate}
          onEdit={openEdit}
          onDelete={handleDelete}
          onToggleFeatured={handleToggleFeatured}
          onToggleActive={handleToggleActive}
        />
      )}

      {activeTab === 'generos' && (
        <PlaceholderTab
          title="Gêneros"
          text="Aqui vamos gerenciar os gêneros do catálogo, com ordem, status e volume de uso."
        />
      )}

      {activeTab === 'momentos' && (
        <PlaceholderTab
          title="Momentos"
          text="Aqui vamos controlar os momentos exibidos nos filtros e no painel do cliente."
        />
      )}

      {activeTab === 'tags' && (
        <PlaceholderTab
          title="Tags editoriais"
          text="Aqui vamos organizar as tags da curadoria, badges e agrupamentos semânticos."
        />
      )}

      {activeTab === 'colecoes' && (
        <PlaceholderTab
          title="Coleções"
          text="Aqui vamos montar vitrines como Mais escolhidas, Entrada da noiva e Gospel para cerimônia."
        />
      )}

      {activeTab === 'qualidade' && (
        <PlaceholderTab
          title="Qualidade do catálogo"
          text="Aqui vamos auditar músicas sem thumb, sem vídeo, sem gênero, sem momento e outras pendências."
        />
      )}

      <SuggestionEditorModal
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingSong(null);
        }}
        onSubmit={handleSaveSong}
        loading={savingSong}
        song={editingSong}
        genres={genres}
        moments={moments}
        tags={tags}
        collections={collections}
      />
    </div>
  );
}
