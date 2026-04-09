'use client';

import { useEffect, useMemo, useState } from 'react';

function getYoutubeVideoId(url = '') {
  const value = String(url || '').trim();
  if (!value) return '';

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace('www.', '');

    if (host === 'youtu.be') {
      return parsed.pathname.replace('/', '');
    }

    if (host.includes('youtube.com')) {
      return parsed.searchParams.get('v') || '';
    }
  } catch {
    return '';
  }

  return '';
}

export default function ReferenceSearchInput({
  searchValue = '',
  referenceValue = '',
  selectedReference = null,
  onSearchValueChange,
  onReferenceValueChange,
  onSelectResult,
  onClearReference,
  disabled = false,
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

  const videoId = useMemo(
    () => selectedReference?.videoId || getYoutubeVideoId(referenceValue),
    [referenceValue, selectedReference?.videoId]
  );
  const previewThumbnail =
    selectedReference?.thumbnail ||
    (videoId ? `https://i.ytimg.com/vi/${videoId}/default.jpg` : '');
  const previewTitle = selectedReference?.title || '';
  const previewChannel = selectedReference?.channelTitle || '';
  const hasReference = Boolean(referenceValue);

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

      {hasReference ? (
        <div className="rounded-[16px] border border-[#eadfd6] bg-[#fcfbff] p-3">
          <div className="mb-2 inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
            Referência selecionada
          </div>
          <div className="flex items-start gap-3">
            {previewThumbnail ? (
              <img
                src={previewThumbnail}
                alt="Miniatura da referência"
                className="h-12 w-20 rounded-md border border-[#eadfd6] object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-black text-[#241a14]">
                {previewTitle || referenceValue}
              </div>
              {previewChannel ? (
                <div className="mt-1 truncate text-[12px] font-semibold text-[#7a6a5e]">{previewChannel}</div>
              ) : null}
              <a
                href={referenceValue}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block truncate text-[12px] font-bold text-violet-700"
              >
                {referenceValue}
              </a>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setIsOpen(true)}
              className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-[12px] font-black text-violet-700"
            >
              Trocar referência
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onClearReference}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-black text-red-600"
            >
              Limpar referência
            </button>
          </div>
        </div>
      ) : null}

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
