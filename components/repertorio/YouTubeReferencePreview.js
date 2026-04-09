'use client';

import { useEffect, useMemo, useState } from 'react';
import { getYoutubeVideoId } from '../../lib/youtube/getYoutubeVideoId';

export default function YouTubeReferencePreview({
  url = '',
  title = '',
  channelTitle = '',
  thumbnail = '',
  onReplace,
  onClear,
  disabled = false,
}) {
  const [openModal, setOpenModal] = useState(false);
  const videoId = useMemo(() => getYoutubeVideoId(url), [url]);

  useEffect(() => {
    if (!openModal) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [openModal]);

  if (!videoId) return null;

  const previewThumbnail = thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const previewTitle = title || 'Referência do YouTube';
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;

  return (
    <>
      <div className="rounded-[18px] border border-[#e9dcfb] bg-[linear-gradient(180deg,#ffffff_0%,#fbf8ff_100%)] p-3 shadow-[0_10px_28px_rgba(76,29,149,0.10)]">
        <div className="mb-2 inline-flex rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
          Referência selecionada
        </div>

        <div className="flex items-start gap-3">
          <img
            src={previewThumbnail}
            alt={`Miniatura de ${previewTitle}`}
            className="h-16 w-28 shrink-0 rounded-xl border border-[#e9dcfb] object-cover"
          />

          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[13px] font-black leading-5 text-[#241a14]">{previewTitle}</div>
            {channelTitle ? (
              <div className="mt-1 truncate text-[12px] font-semibold text-[#7a6a5e]">{channelTitle}</div>
            ) : null}
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate text-[12px] font-bold text-violet-700"
            >
              {url}
            </a>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpenModal(true)}
            className="rounded-xl bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] px-3 py-2 text-[12px] font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Pré-visualizar
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onReplace}
            className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-[12px] font-black text-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Trocar referência
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onClear}
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Limpar referência
          </button>
        </div>
      </div>

      {openModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,14,12,0.72)] p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-3xl rounded-[24px] border border-[#eadfd6] bg-white p-4 shadow-[0_24px_90px_rgba(20,14,12,0.34)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="line-clamp-2 text-[18px] font-black text-[#241a14]">{previewTitle}</div>
                {channelTitle ? (
                  <div className="mt-1 truncate text-[13px] font-semibold text-[#7a6a5e]">{channelTitle}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#eadfd6] bg-[#faf7f3] text-[#6f5d51]"
                aria-label="Fechar pré-visualização"
              >
                ✕
              </button>
            </div>

            <div className="overflow-hidden rounded-[18px] border border-[#eadfd6] bg-black shadow-inner">
              <div className="relative w-full pb-[56.25%]">
                <iframe
                  title={previewTitle}
                  src={embedUrl}
                  className="absolute left-0 top-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
