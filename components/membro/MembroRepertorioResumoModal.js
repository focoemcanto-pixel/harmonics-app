'use client';

import { useEffect, useMemo } from 'react';

function extractOrderedRepertorio(item) {
  if (!item) return [];

  const repertorio = Array.isArray(item?.repertorioItems)
    ? item.repertorioItems
    : [];

  if (repertorio.length > 0) {
    return [...repertorio].sort((a, b) => {
      const ao = Number(a?.ordem || 0);
      const bo = Number(b?.ordem || 0);
      return ao - bo;
    });
  }

  const youtubeUrls = Array.isArray(item?.youtubeUrls) ? item.youtubeUrls : [];

  return youtubeUrls.map((url, index) => ({
    ordem: index + 1,
    musica: `Faixa ${index + 1}`,
    referencia: url,
    tipo: '',
    momento: '',
    quemEntra: '',
    observacao: '',
  }));
}

function RepertorioLinha({ row, index }) {
  const titulo =
    row?.musica ||
    row?.label ||
    row?.momento ||
    row?.quemEntra ||
    `Faixa ${index + 1}`;

  const subtitulo =
    row?.momento ||
    row?.quemEntra ||
    row?.tipo ||
    '';

  return (
    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-300/15 bg-violet-400/10 text-[13px] font-black text-violet-100">
          {String(index + 1).padStart(2, '0')}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-black text-white">
            {titulo}
          </div>

          {subtitulo ? (
            <div className="mt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-violet-200/70">
              {subtitulo}
            </div>
          ) : null}

          {row?.observacao ? (
            <div className="mt-2 text-[14px] leading-6 text-white/65">
              {row.observacao}
            </div>
          ) : null}

          {row?.referencia ? (
            <div className="mt-2 break-all text-[13px] text-white/45">
              {row.referencia}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function MembroRepertorioResumoModal({
  open,
  item,
  onClose,
  onOpenPdf,
  onOpenPlayer,
  onGoToRepertorios,
}) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
    };
  }, [open]);

  const repertorio = useMemo(() => extractOrderedRepertorio(item), [item]);

  const hasPdf = !!item?.contractInfo?.pdfUrl;
  const hasPlayer = Array.isArray(item?.youtubeUrls) && item.youtubeUrls.length > 0;
  const hasRepertorio = repertorio.length > 0;

  if (!open || !item) return null;

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-[4px]"
      onClick={handleBackdropClick}
    >
      <div className="flex h-[100dvh] items-end justify-center overflow-hidden px-0 md:items-center md:px-6">
        <div
          className="flex h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#111827] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:h-auto md:max-h-[88vh] md:max-w-2xl md:rounded-[28px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 border-b border-white/10 px-5 py-4">
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/15 md:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[12px] font-black uppercase tracking-[0.12em] text-fuchsia-200/70">
                  Repertório do evento
                </div>

                <h3 className="mt-2 line-clamp-2 text-[26px] font-black tracking-[-0.04em] md:text-[28px]">
                  {item.clientName || 'Repertório'}
                </h3>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-[16px] border border-white/10 bg-white/10 px-4 py-3 text-[14px] font-black text-white"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            {hasRepertorio ? (
              <div className="space-y-3">
                {repertorio.map((row, index) => (
                  <RepertorioLinha
                    key={`${row?.ordem || index}-${row?.musica || row?.referencia || index}`}
                    row={row}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-[15px] font-semibold leading-7 text-white/65">
                O cliente ainda não enviou o repertório deste evento.
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => onOpenPdf(item)}
                disabled={!hasPdf}
                className="rounded-[18px] border border-white/10 bg-white/10 px-5 py-4 text-[15px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Baixar PDF
              </button>

              <button
                type="button"
                onClick={() => onOpenPlayer(item)}
                disabled={!hasPlayer}
                className="rounded-[18px] bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-4 text-[15px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Abrir player
              </button>

              <button
                type="button"
                onClick={onGoToRepertorios}
                className="rounded-[18px] border border-white/10 bg-white/10 px-5 py-4 text-[15px] font-black text-white"
              >
                Ir para repertórios
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
