'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SugestaoCard from '@/components/sugestoes/SugestaoCard';
import SugestoesFilters from '@/components/sugestoes/SugestoesFilters';
import ReferenceSearchInput from '@/components/repertorio/ReferenceSearchInput';
import { getYoutubeVideoId } from '@/lib/youtube/getYoutubeVideoId';

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


function getSongHealth(song) {
  const hasTitle = Boolean(String(song?.title || '').trim());
  const hasArtist = Boolean(String(song?.artist || '').trim());
  const hasThumb = Boolean(song?.thumbnail_url);
  const hasYoutube = Boolean(song?.youtube_id || song?.youtube_url);
  const hasGenre = Boolean(song?.genre?.id);
  const hasMoment = Boolean(song?.moment?.id);

  const hasError = !hasTitle || !hasArtist;
  const isPending = !hasError && (!hasThumb || !hasYoutube || !hasGenre || !hasMoment);

  return { hasError, isPending };
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

function formatDateOnlyBR(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function normalizeSuggestionSong(song = {}) {
  return {
    ...song,
    id: song?.id ? String(song.id) : null,
    title: String(song?.title || ''),
    artist: String(song?.artist || ''),
    youtube_url: String(song?.youtube_url || ''),
    youtube_id: String(song?.youtube_id || ''),
    thumbnail_url: String(song?.thumbnail_url || ''),
    __isPersisted: Boolean(song?.id),
  };
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
    persisted_song_id: null,
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
  const [referenceSearch, setReferenceSearch] = useState('');
  const [selectedReference, setSelectedReference] = useState(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      persisted_song_id: song?.id ? String(song.id) : null,
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
    setReferenceSearch(song?.title || '');
    setSelectedReference(
      song?.youtube_id || song?.youtube_url
        ? {
            title: song?.title || '',
            channelTitle: song?.reference_channel || '',
            thumbnail: song?.thumbnail_url || '',
            videoId: song?.youtube_id || getYoutubeVideoId(song?.youtube_url || ''),
          }
        : null
    );
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

  function applyReference(result) {
    const nextVideoId = result?.videoId || '';
    const nextUrl = nextVideoId ? `https://www.youtube.com/watch?v=${nextVideoId}` : '';
    const nextThumb = result?.thumbnail || '';
    console.info('[sugestoes] referência selecionada no cadastro', {
      title: result?.title || '',
      channelTitle: result?.channelTitle || '',
      youtube_id: nextVideoId || null,
      youtube_url: nextUrl || null,
      thumbnail_url: nextThumb || null,
      source: 'youtube_search',
    });

    setSelectedReference(result || null);
    setReferenceSearch(result?.title || '');
    setForm((prev) => ({
      ...prev,
      title: result?.title || prev.title,
      artist: prev.artist || result?.channelTitle || '',
      youtube_url: nextUrl || prev.youtube_url,
      youtube_id: nextVideoId || prev.youtube_id,
      thumbnail_url: nextThumb || prev.thumbnail_url,
    }));
  }

  function clearReference() {
    setSelectedReference(null);
    setForm((prev) => ({
      ...prev,
      youtube_url: '',
      youtube_id: '',
      thumbnail_url: '',
    }));
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
                    onChange={(e) => {
                      const nextTitle = e.target.value;
                      setForm((prev) => ({ ...prev, title: nextTitle }));
                      setReferenceSearch(nextTitle);
                    }}
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

            <SectionCard eyebrow="Referência premium" title="Busca e preenchimento automático do YouTube">
              <ReferenceSearchInput
                searchValue={referenceSearch}
                referenceValue={form.youtube_url}
                selectedReference={selectedReference}
                onSearchValueChange={setReferenceSearch}
                onReferenceValueChange={(event) => {
                  const nextValue = event.target.value;
                  const nextVideoId = getYoutubeVideoId(nextValue);
                  setSelectedReference(
                    nextVideoId
                      ? {
                          title: form.title || '',
                          channelTitle: form.artist || '',
                          thumbnail: form.thumbnail_url || '',
                          videoId: nextVideoId,
                        }
                      : null
                  );
                  setForm((prev) => ({
                    ...prev,
                    youtube_url: nextValue,
                    youtube_id: nextVideoId,
                  }));
                }}
                onSelectResult={applyReference}
                onClearReference={clearReference}
              />
            </SectionCard>

            <SectionCard eyebrow="Mídia" title="YouTube, thumb e descrição">
              <div className="grid gap-4">
                <FormField label="URL do YouTube">
                  <Input
                    value={form.youtube_url}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        youtube_url: e.target.value,
                        youtube_id: getYoutubeVideoId(e.target.value),
                      }))
                    }
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
                onClick={() =>
                  onSubmit(form, {
                    persistedSongId: form?.persisted_song_id || null,
                    fromSelectedReference: Boolean(selectedReference?.videoId),
                  })
                }
                disabled={loading}
                className="rounded-[18px] bg-violet-600 px-5 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] disabled:opacity-60"
              >
                {loading ? 'Salvando curadoria premium…' : song?.id ? 'Salvar alterações' : 'Criar música'}
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
  songsLoadFailed,
  onRetryLoad,
  onCreate,
  onEdit,
  onDelete,
  onToggleFeatured,
  onToggleActive,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [genreFilter, setGenreFilter] = useState('todos');
  const [featuredFilter, setFeaturedFilter] = useState('todos');
  const [sourceFilter, setSourceFilter] = useState('todos');

  const genres = useMemo(() => {
    return Array.from(
      new Set(songs.map((song) => song?.genre?.name).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [songs]);

  const filteredSongs = useMemo(() => {
    const q = search.trim().toLowerCase();

    return songs.filter((song) => {
      const { hasError, isPending } = getSongHealth(song);

      const matchesSearch =
        !q ||
        String(song?.title || '').toLowerCase().includes(q) ||
        String(song?.artist || '').toLowerCase().includes(q) ||
        String(song?.description || '').toLowerCase().includes(q) ||
        String(song?.genre?.name || '').toLowerCase().includes(q) ||
        (song?.song_tags || [])
          .map((item) => item?.tag?.name)
          .filter(Boolean)
          .some((tag) => String(tag).toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'ativas' && song?.is_active) ||
        (statusFilter === 'inativas' && !song?.is_active) ||
        (statusFilter === 'pendentes' && isPending) ||
        (statusFilter === 'erro' && hasError);

      const matchesGenre = genreFilter === 'todos' || song?.genre?.name === genreFilter;
      const matchesFeatured =
        featuredFilter === 'todos' ||
        (featuredFilter === 'featured' && song?.is_featured) ||
        (featuredFilter === 'nao-featured' && !song?.is_featured);
      const matchesSource =
        sourceFilter === 'todos' || String(song?.source_type || '') === sourceFilter;

      return matchesSearch && matchesStatus && matchesGenre && matchesFeatured && matchesSource;
    });
  }, [songs, search, statusFilter, genreFilter, featuredFilter, sourceFilter]);

  return (
    <div className="space-y-5">
      <SugestoesFilters
        search={search}
        statusFilter={statusFilter}
        genreFilter={genreFilter}
        featuredFilter={featuredFilter}
        genres={genres}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
        onGenreChange={setGenreFilter}
        onFeaturedChange={setFeaturedFilter}
        onCreate={onCreate}
        total={filteredSongs.length}
        sourceFilter={sourceFilter}
        onSourceChange={setSourceFilter}
      />

      {loading ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] md:p-6">
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white"
              >
                <div className="h-[164px] animate-pulse bg-slate-200" />
                <div className="space-y-3 p-5">
                  <div className="h-6 w-2/3 animate-pulse rounded-xl bg-slate-200" />
                  <div className="h-4 w-1/2 animate-pulse rounded-xl bg-slate-200" />
                  <div className="h-10 w-full animate-pulse rounded-2xl bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : songsLoadFailed ? (
        <EmptyState
          title="Não foi possível carregar o catálogo agora"
          text="Tivemos um erro ao consultar o catálogo editorial. Tente atualizar em instantes."
          actionLabel="Tentar novamente"
          onAction={onRetryLoad}
        />
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
            <SugestaoCard
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

function SuggestoesRepertoriosTab({
  songs,
  loading,
  onImport,
  importingKey,
  eyebrow = 'Origem dos repertórios',
  title = 'Usadas por clientes',
  subtitle = 'Músicas históricas vindas de repertórios preenchidos pelos clientes, separadas da curadoria editorial.',
  emptyTitle = 'Nenhuma música de repertório encontrada',
  emptyText = 'Quando clientes preencherem repertórios, as músicas únicas aparecerão aqui para importação manual.',
  searchPlaceholder = 'Buscar por título, artista ou cliente',
  searchByClient = true,
}) {
  const [search, setSearch] = useState('');

  const filteredSongs = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    return songs.filter((song) => {
      if (!q) return true;
      return (
        String(song?.title || '').toLowerCase().includes(q) ||
        String(song?.artist || '').toLowerCase().includes(q) ||
        (searchByClient && String(song?.last_event_client || '').toLowerCase().includes(q))
      );
    });
  }, [songs, search, searchByClient]);

  const importedCount = songs.filter((song) => song?.catalog_source_type === 'imported').length;
  const alreadyCatalogCount = songs.filter((song) => song?.already_in_catalog).length;

  return (
    <div className="space-y-5">
      <SectionCard
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Músicas únicas" value={songs.length} helper="sem duplicação por título/chave" tone="default" />
          <SummaryCard label="Já no catálogo" value={alreadyCatalogCount} helper="equivalentes em suggestion_songs" tone="emerald" />
          <SummaryCard label="Importadas" value={importedCount} helper="com source_type = imported" tone="violet" />
          <SummaryCard
            label="Pendentes de curadoria"
            value={Math.max(songs.length - alreadyCatalogCount, 0)}
            helper="disponíveis para importar"
            tone="amber"
          />
        </div>
      </SectionCard>

      <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-4 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
        />
      </div>

      {loading ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] md:p-6">
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-[24px] bg-slate-100" />
            ))}
          </div>
        </section>
      ) : filteredSongs.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          text={emptyText}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredSongs.map((song) => {
            const isBusy = importingKey === song.key;
            return (
              <article key={song.key} className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[20px] font-black tracking-[-0.03em] text-[#0f172a]">{song.title}</h3>
                    <p className="mt-1 truncate text-[14px] font-semibold text-[#64748b]">{song.artist || 'Artista não informado'}</p>
                  </div>
                  <Pill tone={song.already_in_catalog ? 'emerald' : 'amber'}>
                    {song.already_in_catalog ? 'Já está no catálogo' : 'Disponível para importar'}
                  </Pill>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Pill tone="sky">{song.usage_count} uso(s)</Pill>
                  <Pill>Último uso: {formatDateOnlyBR(song.last_used_at)}</Pill>
                  {song.catalog_source_type ? <Pill tone="violet">{song.catalog_source_type}</Pill> : null}
                </div>

                <div className="mt-4 rounded-[18px] bg-[#f8fafc] px-4 py-3 text-[13px] font-semibold text-[#475569]">
                  Último cliente/evento: {song.last_event_client || 'Não identificado'}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <button
                    type="button"
                    disabled={isBusy || song.already_in_catalog}
                    onClick={() => onImport(song)}
                    className="rounded-[16px] border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] font-black text-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {song.already_in_catalog ? 'Já cadastrada' : isBusy ? 'Importando…' : 'Adicionar ao catálogo'}
                  </button>

                  {song.youtube_url ? (
                    <a
                      href={song.youtube_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-center text-[13px] font-black text-[#0f172a]"
                    >
                      Abrir referência
                    </a>
                  ) : (
                    <div className="rounded-[16px] border border-dashed border-[#dbe3ef] px-4 py-3 text-center text-[12px] font-bold text-[#94a3b8]">
                      Sem referência externa
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaxonomyCard({ item, typeLabel, usageCount = 0, onEdit, onToggleActive }) {
  return (
    <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[20px] font-black tracking-[-0.03em] text-[#0f172a]">
            {item?.name || 'Sem nome'}
          </div>
          <div className="mt-1 text-[13px] font-semibold text-[#64748b]">
            slug: {item?.slug || '—'}
          </div>
        </div>

        <Pill tone={item?.is_active ? 'emerald' : 'red'}>
          {item?.is_active ? 'Ativo' : 'Oculto'}
        </Pill>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Pill tone="sky">{typeLabel}</Pill>
        <Pill>Ordem {item?.sort_order ?? 0}</Pill>
        <Pill>{usageCount} uso(s)</Pill>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[13px] font-black text-[#0f172a]"
        >
          Editar
        </button>

        <button
          type="button"
          onClick={() => onToggleActive(item)}
          className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-black text-amber-700"
        >
          {item?.is_active ? 'Ocultar' : 'Ativar'}
        </button>
      </div>

      <div className="mt-4 text-[12px] font-semibold text-[#94a3b8]">
        Atualizado em {formatDateBR(item?.updated_at)}
      </div>
    </div>
  );
}

function TaxonomyEditorModal({
  open,
  onClose,
  onSubmit,
  loading,
  item,
  title,
  eyebrow,
}) {
  const [form, setForm] = useState({
    name: '',
    slug: '',
    is_active: true,
    sort_order: 0,
  });

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: item?.name || '',
      slug: item?.slug || '',
      is_active: typeof item?.is_active === 'boolean' ? item.is_active : true,
      sort_order: Number(item?.sort_order || 0),
    });
  }, [open, item]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,23,42,0.45)] p-4 md:items-center">
      <div className="w-full max-w-2xl overflow-hidden rounded-[30px] border border-[#dbe3ef] bg-[#f8fafc] shadow-[0_30px_90px_rgba(15,23,42,0.26)]">
        <div className="border-b border-[#e5edf6] bg-white px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[12px] font-black uppercase tracking-[0.1em] text-violet-600">
                {eyebrow}
              </div>
              <div className="mt-1 text-[24px] font-black tracking-[-0.03em] text-[#0f172a]">
                {item?.id ? `Editar ${title.toLowerCase()}` : `Novo ${title.toLowerCase()}`}
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

        <div className="space-y-5 p-6">
          <FormField label="Nome">
            <Input
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  name: e.target.value,
                  slug: prev.slug ? prev.slug : slugify(e.target.value),
                }))
              }
              placeholder={`Ex: ${title === 'Gênero' ? 'Gospel' : 'Cerimônia'}`}
            />
          </FormField>

          <FormField label="Slug" helper="Pode editar manualmente se quiser.">
            <Input
              value={form.slug}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))
              }
              placeholder="slug"
            />
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

          <Checkbox
            checked={form.is_active}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, is_active: e.target.checked }))
            }
            label={`${title} ativo`}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => onSubmit(form)}
              disabled={loading}
              className="rounded-[18px] bg-violet-600 px-5 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] disabled:opacity-60"
            >
              {loading ? 'Salvando...' : item?.id ? 'Salvar alterações' : `Criar ${title.toLowerCase()}`}
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
  );
}

function SuggestoesGenerosTab({
  genres,
  songs,
  loading,
  onCreate,
  onEdit,
  onToggleActive,
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return genres.filter((genre) => {
      if (!q) return true;
      return (
        String(genre?.name || '').toLowerCase().includes(q) ||
        String(genre?.slug || '').toLowerCase().includes(q)
      );
    });
  }, [genres, search]);

  function getUsageCount(genreId) {
    return songs.filter((song) => song?.genre?.id === genreId).length;
  }

  return (
    <div className="space-y-5">
      <SectionCard
        eyebrow="Taxonomia"
        title="Gêneros"
        subtitle="Gerencie os gêneros usados nos filtros e no catálogo da curadoria."
        right={
          <button
            type="button"
            onClick={onCreate}
            className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
          >
            Novo gênero
          </button>
        }
      >
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar gênero..."
            className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          />

          <div className="rounded-[18px] border border-[#dbe3ef] bg-[#f8fafc] px-4 py-3 text-[14px] font-black text-[#475569]">
            {filtered.length} encontrado(s)
          </div>
        </div>
      </SectionCard>

      {loading ? (
        <SectionCard title="Carregando" subtitle="Buscando gêneros do banco.">
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-[220px] animate-pulse rounded-[28px] bg-[#eef2f7]"
              />
            ))}
          </div>
        </SectionCard>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum gênero encontrado"
          text="Cadastre os gêneros usados na curadoria do painel do cliente."
          actionLabel="Novo gênero"
          onAction={onCreate}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((genre) => (
            <TaxonomyCard
              key={genre.id}
              item={genre}
              typeLabel="Gênero"
              usageCount={getUsageCount(genre.id)}
              onEdit={onEdit}
              onToggleActive={onToggleActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestoesMomentosTab({
  moments,
  songs,
  loading,
  onCreate,
  onEdit,
  onToggleActive,
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return moments.filter((moment) => {
      if (!q) return true;
      return (
        String(moment?.name || '').toLowerCase().includes(q) ||
        String(moment?.slug || '').toLowerCase().includes(q)
      );
    });
  }, [moments, search]);

  function getUsageCount(momentId) {
    return songs.filter((song) => song?.moment?.id === momentId).length;
  }

  return (
    <div className="space-y-5">
      <SectionCard
        eyebrow="Taxonomia"
        title="Momentos"
        subtitle="Controle os momentos do evento usados na organização e filtragem da curadoria."
        right={
          <button
            type="button"
            onClick={onCreate}
            className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
          >
            Novo momento
          </button>
        }
      >
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar momento..."
            className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          />

          <div className="rounded-[18px] border border-[#dbe3ef] bg-[#f8fafc] px-4 py-3 text-[14px] font-black text-[#475569]">
            {filtered.length} encontrado(s)
          </div>
        </div>
      </SectionCard>

      {loading ? (
        <SectionCard title="Carregando" subtitle="Buscando momentos do banco.">
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-[220px] animate-pulse rounded-[28px] bg-[#eef2f7]"
              />
            ))}
          </div>
        </SectionCard>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum momento encontrado"
          text="Cadastre os momentos usados no painel do cliente."
          actionLabel="Novo momento"
          onAction={onCreate}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((moment) => (
            <TaxonomyCard
              key={moment.id}
              item={moment}
              typeLabel="Momento"
              usageCount={getUsageCount(moment.id)}
              onEdit={onEdit}
              onToggleActive={onToggleActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestoesTagsTab({ tags, loading }) {
  if (loading) {
    return <SectionCard title="Carregando tags" subtitle="Buscando tags editoriais." />;
  }
  if (!tags.length) {
    return (
      <EmptyState
        title="Nenhuma tag cadastrada ainda"
        text="As tags aparecem aqui automaticamente quando músicas têm vínculos em suggestion_song_tags."
      />
    );
  }
  return (
    <SectionCard eyebrow="Organização" title="Tags" subtitle="Tags editoriais detectadas no catálogo.">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Pill key={tag.id}>{tag.name}</Pill>
        ))}
      </div>
    </SectionCard>
  );
}

function SuggestoesColecoesTab({ collections, loading }) {
  if (loading) {
    return <SectionCard title="Carregando coleções" subtitle="Buscando coleções editoriais." />;
  }
  if (!collections.length) {
    return (
      <EmptyState
        title="Nenhuma coleção cadastrada ainda"
        text="Vincule músicas em suggestion_collection_songs para organizar vitrines."
      />
    );
  }
  return (
    <SectionCard eyebrow="Organização" title="Coleções" subtitle="Coleções disponíveis para curadoria.">
      <div className="grid gap-3 md:grid-cols-2">
        {collections.map((collection) => (
          <div key={collection.id} className="rounded-[18px] border border-[#dbe3ef] bg-white p-4">
            <div className="text-[16px] font-black text-[#0f172a]">{collection.name}</div>
            <div className="text-[13px] font-semibold text-[#64748b]">slug: {collection.slug}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function SuggestoesQualidadeTab({ songs }) {
  const semGenero = songs.filter((song) => !song?.genre?.id).length;
  const semMomento = songs.filter((song) => !song?.moment?.id).length;
  const semYoutube = songs.filter((song) => !(song?.youtube_id || song?.youtube_url)).length;
  const semThumb = songs.filter((song) => !song?.thumbnail_url).length;

  return (
    <SectionCard eyebrow="Qualidade" title="Auditoria do catálogo">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Sem gênero" value={semGenero} tone="amber" />
        <SummaryCard label="Sem momento" value={semMomento} tone="amber" />
        <SummaryCard label="Sem YouTube" value={semYoutube} tone="amber" />
        <SummaryCard label="Sem thumbnail" value={semThumb} tone="amber" />
      </div>
    </SectionCard>
  );
}

export default function SuggestoesPageClient() {
  const [genreEditorOpen, setGenreEditorOpen] = useState(false);
const [momentEditorOpen, setMomentEditorOpen] = useState(false);
const [editingGenre, setEditingGenre] = useState(null);
const [editingMoment, setEditingMoment] = useState(null);
const [savingGenre, setSavingGenre] = useState(false);
const [savingMoment, setSavingMoment] = useState(false);
  const [activeTab, setActiveTab] = useState('resumo');
  const [songs, setSongs] = useState([]);
  const [clientPanelSongs, setClientPanelSongs] = useState([]);
  const [repertoireSongs, setRepertoireSongs] = useState([]);
  const [sourceAudit, setSourceAudit] = useState(null);
  const [reviewSongs, setReviewSongs] = useState([]);
  const [genres, setGenres] = useState([]);
  const [moments, setMoments] = useState([]);
  const [tags, setTags] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSong, setSavingSong] = useState(false);
  const [enrichingCatalog, setEnrichingCatalog] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [songsLoadFailed, setSongsLoadFailed] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [importingClientKey, setImportingClientKey] = useState('');
  const [importingRepertoireKey, setImportingRepertoireKey] = useState('');

  const repertoireKpis = useMemo(() => ({
    unique: repertoireSongs.length,
    alreadyInCatalog: repertoireSongs.filter((song) => song?.already_in_catalog).length,
  }), [repertoireSongs]);

  const songsKpis = useMemo(() => {
    return songs.reduce(
      (acc, song) => {
        const { hasError, isPending } = getSongHealth(song);
        acc.cadastradas += 1;
        if (song?.is_active) acc.ativas += 1;
        if (isPending) acc.pendentes += 1;
        if (hasError) acc.comErro += 1;
        return acc;
      },
      { cadastradas: 0, ativas: 0, pendentes: 0, comErro: 0 }
    );
  }, [songs]);

  const tabs = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'biblioteca', label: 'Biblioteca' },
    { key: 'sugestoes-cliente', label: 'Sugestões do cliente' },
    { key: 'revisao-legado', label: 'Revisão legado' },
    { key: 'repertorios', label: 'Repertórios' },
    { key: 'generos', label: 'Gêneros' },
    { key: 'momentos', label: 'Momentos' },
    { key: 'tags', label: 'Tags' },
    { key: 'colecoes', label: 'Coleções' },
    { key: 'qualidade', label: 'Qualidade' },
  ];

 async function loadAll() {
  try {
    console.info('[sugestoes] load start');
    setLoading(true);
    setError('');
    setSongsLoadFailed(false);

    const [songsResponse, genresResponse, momentsResponse, clientPanelResponse, reviewResponse, repertoireResponse, sourceAuditResponse] = await Promise.all([
      fetch('/api/suggestions/songs?scope=admin-editorial', { cache: 'no-store' }),
      fetch('/api/suggestions/genres', { cache: 'no-store' }),
      fetch('/api/suggestions/moments', { cache: 'no-store' }),
      fetch('/api/admin/suggestions/client-panel-songs', { cache: 'no-store' }),
      fetch('/api/admin/suggestions/review-songs', { cache: 'no-store' }),
      fetch('/api/admin/suggestions/repertoire-songs', { cache: 'no-store' }),
      fetch('/api/admin/suggestions/source-audit', { cache: 'no-store' }),
    ]);

    const [songsData, genresData, momentsData, clientPanelData, reviewData, repertoireData, sourceAuditData] = await Promise.all([
      songsResponse.json().catch(() => ({})),
      genresResponse.json().catch(() => ({})),
      momentsResponse.json().catch(() => ({})),
      clientPanelResponse.json().catch(() => ({})),
      reviewResponse.json().catch(() => ({})),
      repertoireResponse.json().catch(() => ({})),
      sourceAuditResponse.json().catch(() => ({})),
    ]);


    console.log('[sugestoes-debug] loadAll status', {
      songsStatus: songsResponse.status,
      genresStatus: genresResponse.status,
      momentsStatus: momentsResponse.status,
      clientPanelStatus: clientPanelResponse.status,
      reviewStatus: reviewResponse.status,
      repertoireStatus: repertoireResponse.status,
      sourceAuditStatus: sourceAuditResponse.status,
    });

    const songsList = songsResponse.ok && Array.isArray(songsData?.songs)
      ? songsData.songs.map(normalizeSuggestionSong)
      : [];
    const genresList = genresResponse.ok && Array.isArray(genresData?.genres) ? genresData.genres : [];
    const momentsList = momentsResponse.ok && Array.isArray(momentsData?.moments) ? momentsData.moments : [];
    const clientPanelList = clientPanelResponse.ok && Array.isArray(clientPanelData?.songs) ? clientPanelData.songs : [];
    const reviewList = reviewResponse.ok && Array.isArray(reviewData?.songs) ? reviewData.songs : [];
    const repertoireList = repertoireResponse.ok && Array.isArray(repertoireData?.songs) ? repertoireData.songs : [];

    const loadErrors = [];
    if (!songsResponse.ok) {
      setSongsLoadFailed(true);
      loadErrors.push(
        songsData?.error ||
          'Falha ao buscar músicas do catálogo editorial (suggestion_songs)'
      );
    }
    if (!genresResponse.ok) {
      loadErrors.push(
        genresData?.error ||
          'Gêneros não encontrados na tabela suggestion_genres'
      );
    }
    if (!momentsResponse.ok) loadErrors.push(momentsData?.error || 'Falha ao buscar momentos');
    if (!clientPanelResponse.ok) loadErrors.push(clientPanelData?.error || 'Falha ao buscar itens de source_type=client');
    if (!reviewResponse.ok) loadErrors.push(reviewData?.error || 'Falha ao buscar fila de revisão de legado source_type');
    if (!repertoireResponse.ok) loadErrors.push(repertoireData?.error || 'Falha ao buscar músicas de repertórios');
    if (!sourceAuditResponse.ok) loadErrors.push(sourceAuditData?.error || 'Falha ao auditar source_type do catálogo');
    if (loadErrors.length) {
      setError(loadErrors.join(' | '));
    }

    setSongs(songsList);
    setGenres(genresList);
    setMoments(momentsList);
    setClientPanelSongs(clientPanelList);
    setReviewSongs(reviewList);
    setRepertoireSongs(repertoireList);
    setSourceAudit(sourceAuditResponse.ok ? sourceAuditData : null);

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
    console.info('[sugestoes] data loaded', {
      songs: songsList.length,
      genres: genresList.length,
      moments: momentsList.length,
      clientPanelSongs: clientPanelList.length,
      reviewSongs: reviewList.length,
      repertoireSongs: repertoireList.length,
      source: 'public.suggestion_songs',
      source_scope: 'editorial_catalog_only',
      sourceAudit: sourceAuditResponse.ok ? sourceAuditData?.distribution || {} : null,
    });
  } catch (err) {
    console.error('[sugestoes] error', err);
    setSongsLoadFailed(true);
    setError(err?.message || 'Erro ao carregar módulo de sugestões');
  } finally {
    setLoading(false);
  }
}
  useEffect(() => {
  loadAll();
}, []);
  
  function openCreate() {
    setEditingSong(null);
    setEditorOpen(true);
  }

  function openEdit(song) {
    setEditingSong(song);
    setEditorOpen(true);
  }

  async function handleSaveSong(form, options = {}) {
    try {
      setSavingSong(true);
      setError('');
      setNotice('');

      if (!String(form?.title || '').trim()) {
        throw new Error('Nome da música é obrigatório');
      }
      if (!String(form?.artist || '').trim()) {
        throw new Error('Artista é obrigatório');
      }

      const songId =
        options.songId ||
        options.persistedSongId ||
        editingSong?.id ||
        null;
      const normalizedSongId = String(songId || '').trim();
      const shouldUpdate = Boolean(
        normalizedSongId &&
        normalizedSongId !== 'undefined' &&
        normalizedSongId !== 'null'
      );
      const method = shouldUpdate ? 'PATCH' : 'POST';
      const url = shouldUpdate
        ? `/api/suggestions/songs/${normalizedSongId}`
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
      delete payload.persisted_song_id;
      console.info('[sugestoes] save song payload origin', {
        destination: 'public.suggestion_songs',
        source: 'admin_editorial_form',
        action: method === 'PATCH' ? 'update' : 'create',
        songId: shouldUpdate ? normalizedSongId : null,
        selectedReferenceOnly: Boolean(options?.fromSelectedReference && !shouldUpdate),
      });

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao salvar música');
      }

      const persistedSong = normalizeSuggestionSong(data?.song || {});
      if (persistedSong?.id) {
        setSongs((prev) => {
          const withoutCurrent = prev.filter((item) => String(item?.id || '') !== persistedSong.id);
          return [persistedSong, ...withoutCurrent];
        });
      }

      setEditorOpen(false);
      setEditingSong(null);
      await loadAll();
      setNotice(shouldUpdate ? 'Música atualizada com sucesso.' : 'Música criada com sucesso.');
      setActiveTab('biblioteca');
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Erro ao salvar música');
    } finally {
      setSavingSong(false);
    }
  }


  async function handleImportFromClientPanel(song) {
    try {
      setImportingClientKey(song.key);
      setError('');
      setNotice('');

      const response = await fetch('/api/admin/suggestions/client-panel-songs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(song),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao importar sugestão do cliente.');
      }

      setNotice(data?.message || 'Sugestão do cliente adicionada ao catálogo editorial.');
      await loadAll();
      setActiveTab('sugestoes-cliente');
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Falha ao importar sugestão do cliente.');
    } finally {
      setImportingClientKey('');
    }
  }


  async function handleImportFromRepertoire(song) {
    try {
      setImportingRepertoireKey(song.key);
      setError('');
      setNotice('');

      const response = await fetch('/api/admin/suggestions/repertoire-songs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(song),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao importar música para o catálogo.');
      }

      setNotice(data?.message || 'Música importada para o catálogo editorial.');
      await loadAll();
      setActiveTab('repertorios');
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Falha ao importar música para o catálogo.');
    } finally {
      setImportingRepertoireKey('');
    }
  }

  async function handleDelete(song) {
    const confirmed = window.confirm(
      `Excluir "${song?.title || 'esta música'}"? Essa ação não poderá ser desfeita.`
    );

    if (!confirmed) return;

    try {
      setError('');
      setNotice('');

      const response = await fetch(`/api/suggestions/songs/${song.id}`, {
        method: 'DELETE',
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao excluir música');
      }

      await loadAll();
      setNotice('Música excluída com sucesso.');
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
    }, { songId: song.id });
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
    }, { songId: song.id });
  }

  function openCreateGenre() {
    setEditingGenre(null);
    setGenreEditorOpen(true);
  }

  function openEditGenre(item) {
    setEditingGenre(item);
    setGenreEditorOpen(true);
  }

  function openCreateMoment() {
    setEditingMoment(null);
    setMomentEditorOpen(true);
  }

  function openEditMoment(item) {
    setEditingMoment(item);
    setMomentEditorOpen(true);
  }

  async function handleSaveGenre(form, options = {}) {
    try {
      setSavingGenre(true);
      setError('');

      const genreId = options.genreId || editingGenre?.id || null;
      const method = genreId ? 'PATCH' : 'POST';
      const url = genreId
        ? `/api/suggestions/genres/${genreId}`
        : '/api/suggestions/genres';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(form.name || '').trim(),
          slug: String(form.slug || '').trim(),
          is_active: Boolean(form.is_active),
          sort_order: Number(form.sort_order || 0),
        }),
      });

      const data = await response.json().catch(() => ({}));
      console.log('[sugestoes-debug] save genre response', { method, url, status: response.status, data });

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao salvar gênero');
      }

      setGenreEditorOpen(false);
      setEditingGenre(null);
      await loadAll();
      setActiveTab('generos');
    } catch (err) {
      console.error('[sugestoes-debug] erro ao salvar gênero', err);
      setError(err?.message || 'Erro ao salvar gênero');
    } finally {
      setSavingGenre(false);
    }
  }

  async function handleToggleGenreActive(item) {
    await handleSaveGenre(
      {
        name: item.name,
        slug: item.slug,
        is_active: !item.is_active,
        sort_order: item.sort_order || 0,
      },
      { genreId: item.id }
    );
  }

  async function handleSaveMoment(form, options = {}) {
    try {
      setSavingMoment(true);
      setError('');

      const momentId = options.momentId || editingMoment?.id || null;
      const method = momentId ? 'PATCH' : 'POST';
      const url = momentId
        ? `/api/suggestions/moments/${momentId}`
        : '/api/suggestions/moments';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(form.name || '').trim(),
          slug: String(form.slug || '').trim(),
          is_active: Boolean(form.is_active),
          sort_order: Number(form.sort_order || 0),
        }),
      });

      const data = await response.json().catch(() => ({}));
      console.log('[sugestoes-debug] save moment response', { method, url, status: response.status, data });

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao salvar momento');
      }

      setMomentEditorOpen(false);
      setEditingMoment(null);
      await loadAll();
      setActiveTab('momentos');
    } catch (err) {
      console.error('[sugestoes-debug] erro ao salvar momento', err);
      setError(err?.message || 'Erro ao salvar momento');
    } finally {
      setSavingMoment(false);
    }
  }

  async function handleToggleMomentActive(item) {
    await handleSaveMoment(
      {
        name: item.name,
        slug: item.slug,
        is_active: !item.is_active,
        sort_order: item.sort_order || 0,
      },
      { momentId: item.id }
    );
  }

  async function handleEnrichCatalog() {
    try {
      setEnrichingCatalog(true);
      setError('');
      setNotice('');

      const response = await fetch('/api/admin/suggestions/enrich-catalog', {
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao enriquecer catálogo.');
      }

      await loadAll();
      const updated = Number(data?.result?.updated || 0);
      const scanned = Number(data?.result?.scanned || 0);
      setNotice(`Enriquecimento concluído: ${updated} de ${scanned} músicas atualizadas.`);
      setActiveTab('qualidade');
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Erro ao enriquecer catálogo.');
    } finally {
      setEnrichingCatalog(false);
    }
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
              onClick={handleEnrichCatalog}
              disabled={enrichingCatalog}
              className="rounded-[18px] border border-sky-200 bg-sky-50 px-5 py-4 text-[14px] font-black text-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {enrichingCatalog ? 'Enriquecendo…' : 'Enriquecer catálogo'}
            </button>

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
            label="Músicas cadastradas"
            value={songsKpis.cadastradas}
            helper={`catálogo editorial (${repertoireKpis.alreadyInCatalog} também em repertórios)`}
            tone="default"
          />
          <SummaryCard
            label="Ativas"
            value={songsKpis.ativas}
            helper="visíveis para o cliente"
            tone="emerald"
          />
          <SummaryCard
            label="Pendentes"
            value={songsKpis.pendentes}
            helper="faltam dados editoriais"
            tone="amber"
          />
          <SummaryCard
            label="Com erro"
            value={songsKpis.comErro}
            helper="faltam título ou artista"
            tone="red"
          />
        </div>
      </SectionCard>

      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-5 text-[15px] font-bold text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-5 text-[15px] font-bold text-emerald-700">
          {notice}
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
          songsLoadFailed={songsLoadFailed}
          onRetryLoad={loadAll}
          onCreate={openCreate}
          onEdit={openEdit}
          onDelete={handleDelete}
          onToggleFeatured={handleToggleFeatured}
          onToggleActive={handleToggleActive}
        />
      )}

      {activeTab === 'sugestoes-cliente' && (
        <SuggestoesRepertoriosTab
          songs={clientPanelSongs}
          loading={loading}
          importingKey={importingClientKey}
          onImport={handleImportFromClientPanel}
          eyebrow="Origem real do painel do cliente"
          title="Sugestões do cliente"
          subtitle="Fonte: lista cadastrada na aba de Sugestões do painel do cliente (não usa repertório de evento)."
          emptyTitle="Nenhuma sugestão encontrada no painel do cliente"
          emptyText="Cadastre músicas na própria aba de Sugestões do painel do cliente para aparecerem aqui."
          searchPlaceholder="Buscar por título, artista, gênero ou momento"
          searchByClient={false}
        />
      )}

      {activeTab === 'revisao-legado' && (
        <SuggestoesRepertoriosTab
          songs={reviewSongs}
          loading={loading}
          importingKey={importingClientKey}
          onImport={handleImportFromClientPanel}
          eyebrow="Separação semântica"
          title="Revisão de itens client/legado"
          subtitle={`Itens pendentes para classificar source_type. distribuição atual: ${JSON.stringify(sourceAudit?.distribution || {})}`}
          emptyTitle="Nenhum item client/legado para revisão"
          emptyText="Sem registros source_type=null/empty para analisar neste momento."
          searchPlaceholder="Buscar por título, artista, gênero ou momento"
          searchByClient={false}
        />
      )}

      {activeTab === 'repertorios' && (
        <SuggestoesRepertoriosTab
          songs={repertoireSongs}
          loading={loading}
          importingKey={importingRepertoireKey}
          onImport={handleImportFromRepertoire}
          eyebrow="Origem dos repertórios"
          title="Repertórios preenchidos"
          subtitle="Músicas históricas vindas de repertórios preenchidos pelos clientes, separadas da curadoria editorial."
          emptyTitle="Nenhuma música de repertório encontrada"
          emptyText="Quando clientes preencherem repertórios, as músicas únicas aparecerão aqui para importação manual."
          searchPlaceholder="Buscar por título, artista ou cliente"
          searchByClient
        />
      )}

     {activeTab === 'generos' && (
  <SuggestoesGenerosTab
    genres={genres}
    songs={songs}
    loading={loading}
    onCreate={openCreateGenre}
    onEdit={openEditGenre}
    onToggleActive={handleToggleGenreActive}
  />
)}

{activeTab === 'momentos' && (
  <SuggestoesMomentosTab
    moments={moments}
    songs={songs}
    loading={loading}
    onCreate={openCreateMoment}
    onEdit={openEditMoment}
    onToggleActive={handleToggleMomentActive}
  />
)}
<TaxonomyEditorModal
  open={genreEditorOpen}
  onClose={() => {
    setGenreEditorOpen(false);
    setEditingGenre(null);
  }}
  onSubmit={handleSaveGenre}
  loading={savingGenre}
  item={editingGenre}
  title="Gênero"
  eyebrow="Taxonomia editorial"
/>

<TaxonomyEditorModal
  open={momentEditorOpen}
  onClose={() => {
    setMomentEditorOpen(false);
    setEditingMoment(null);
  }}
  onSubmit={handleSaveMoment}
  loading={savingMoment}
  item={editingMoment}
  title="Momento"
  eyebrow="Taxonomia editorial"
/>

      {activeTab === 'tags' && (
        <SuggestoesTagsTab tags={tags} loading={loading} />
      )}

      {activeTab === 'colecoes' && (
        <SuggestoesColecoesTab collections={collections} loading={loading} />
      )}

      {activeTab === 'qualidade' && (
        <SuggestoesQualidadeTab songs={songs} />
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
