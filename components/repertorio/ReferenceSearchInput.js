'use client';

import { useEffect, useMemo, useState } from 'react';
import YouTubeReferencePreview from './YouTubeReferencePreview';
import { getYoutubeVideoId } from '../../lib/youtube/getYoutubeVideoId';

export default function ReferenceSearchInput({
  searchValue = '',
  referenceValue = '',
  selectedReference = null,
  onSearchValueChange,
  onReferenceValueChange,
  onSelectResult,
  onClearReference,
  disabled = false,
  autoOpenOnSearchValue = true,
}) {
  const [query, setQuery] = useState(searchValue);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setQuery(searchValue || '');
  }, [searchValue]);

  useEffect(() => {
    if (disabled || !autoOpenOnSearchValue) return;
    if (String(searchValue || '').trim().length >= 2) {
      setIsOpen(true);
    }
  }, [searchValue, disabled, autoOpenOnSearchValue]);

  useEffect(() => {
    if (disabled) return undefined;

    const trimmed = query.trim();
    if (trimmed.length < 2 || !isOpen) {
      setResults([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok || !data?.ok) {
          setResults([]);
          setError(data?.error || 'Não foi possível buscar no YouTube agora.');
          return;
        }

        setResults(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setError('Erro ao buscar referências. Verifique sua conexão e tente novamente.');
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [query, isOpen, disabled]);

  const fallbackVideoId = useMemo(() => getYoutubeVideoId(referenceValue), [referenceValue]);

  const selectedReferenceData = useMemo(() => {
    const title = selectedReference?.title || selectedReference?.reference_title || '';
    const channelTitle =
      selectedReference?.channelTitle || selectedReference?.reference_channel || '';
    const thumbnail =
      selectedReference?.thumbnail || selectedReference?.reference_thumbnail || '';
    const videoId =
      selectedReference?.videoId || selectedReference?.reference_video_id || fallbackVideoId;

    return { title, channelTitle, thumbnail, videoId };
  }, [fallbackVideoId, selectedReference]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
          Referência
        </label>
        <input
          type="text"
          placeholder="Busque no YouTube sem sair do app"
          value={query}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            onSearchValueChange?.(nextValue);
            setIsOpen(true);
          }}
          className="w-full rounded-[16px] border border-[#eadfd6] bg-white px-4 py-4 text-[15px] font-semibold text-[#241a14] outline-none disabled:cursor-not-allowed disabled:bg-[#f4efea] disabled:text-[#a59588]"
        />
      </div>

      <YouTubeReferencePreview
        url={referenceValue}
        title={selectedReferenceData.title}
        channelTitle={selectedReferenceData.channelTitle}
        thumbnail={selectedReferenceData.thumbnail}
        disabled={disabled}
        onReplace={() => setIsOpen(true)}
        onClear={onClearReference}
      />

      {isOpen && !disabled ? (
        <div className="rounded-[16px] border border-[#eadfd6] bg-white p-2 shadow-[0_8px_24px_rgba(36,26,20,0.06)]">
          {loading ? <div className="px-3 py-2 text-[13px] font-semibold text-[#7a6a5e]">Buscando no YouTube...</div> : null}
          {!loading && error ? <div className="px-3 py-2 text-[13px] font-semibold text-red-600">{error}</div> : null}
          {!loading && !error && query.trim().length < 2 ? (
            <div className="px-3 py-2 text-[13px] font-semibold text-[#7a6a5e]">Digite pelo menos 2 caracteres para buscar.</div>
          ) : null}
          {!loading && !error && query.trim().length >= 2 && results.length === 0 ? (
            <div className="px-3 py-2 text-[13px] font-semibold text-[#7a6a5e]">Nenhum vídeo encontrado para este termo.</div>
          ) : null}

          {!loading && !error && results.length > 0 ? (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {results.map((result) => (
                <button
                  key={result.videoId}
                  type="button"
                  onClick={() => {
                    onSelectResult?.(result);
                    setQuery(result.title || query);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[#f8f4ef]"
                >
                  <img
                    src={result.thumbnail}
                    alt={result.title}
                    className="h-12 w-20 rounded-md border border-[#eadfd6] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-black text-[#241a14]">{result.title}</div>
                    <div className="mt-1 truncate text-[12px] font-semibold text-[#7a6a5e]">{result.channelTitle}</div>
                  </div>
                  <span className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-black text-violet-700">
                    Selecionar
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
          Link de referência (edição manual)
        </label>
        <input
          type="text"
          placeholder="Cole manualmente um link do YouTube, se preferir"
          value={referenceValue}
          onChange={onReferenceValueChange}
          disabled={disabled}
          className="w-full rounded-[16px] border border-[#eadfd6] bg-white px-4 py-4 text-[15px] font-semibold text-[#241a14] outline-none disabled:cursor-not-allowed disabled:bg-[#f4efea] disabled:text-[#a59588]"
        />
      </div>
    </div>
  );
}
