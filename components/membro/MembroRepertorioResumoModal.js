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
    <div className="rounded-[14px] border border-white/10 bg-[#1e1535] px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-300/15 bg-violet-400/10 text-[12px] font-black text-violet-100">
          {String(index + 1).padStart(2, '0')}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-black text-white">
            {titulo}
          </div>

          {subtitulo ? (
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-violet-200/70">
              {subtitulo}
            </div>
          ) : null}

          {row?.observacao ? (
            <div className="mt-1.5 text-[13px] leading-5 text-white/60">
              {row.observacao}
            </div>
          ) : null}

          {row?.referencia ? (
            <div className="mt-1.5 break-all text-[12px] text-white/40">
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
  const hasPlayer =
    Array.isArray(item?.youtubeUrls) && item.youtubeUrls.length > 0;
  const hasRepertorio = repertorio.length > 0;

  if (!open || !item) return null;

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[180] bg-black/70 backdrop-blur-[4px]"
      onClick={handleBackdropClick}
    >
      <div className="flex h-[100dvh] items-end justify-center overflow-hidden px-0">
        <div
          className="flex h-[92dvh] w-full max-w-[500px] flex-col overflow-hidden rounded-t-[22px] border border-white/10 bg-[#1a1230] text-white shadow-[0_24px_80px_rgba(0,0,0,0.42)] md:my-6 md:h-auto md:max-h-[88vh] md:rounded-[20px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0">
            <div className="mx-auto mt-3 h-1 w-9 rounded-full bg-white/15" />

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#1a1230] px-5 py-4">
              <div className="min-w-0">
                <div className="text-[18px] font-black tracking-[-0.03em] text-white">
                  🎼 Repertório
                </div>
                <div className="mt-1 truncate text-[12px] font-semibold text-white/55">
                  {item?.clientName || 'Evento'}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-[12px] border border-white/10 bg-[#241b3d] px-3 py-2 text-[13px] font-extrabold text-white transition active:scale-[0.98]"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            {hasRepertorio ? (
              <div className="space-y-2">
                {repertorio.map((row, index) => (
                  <RepertorioLinha
                    key={`${row?.ordem || index}-${row?.musica || row?.referencia || index}`}
                    row={row}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[16px] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-center text-[14px] font-semibold leading-6 text-white/60">
                O cliente ainda não enviou o repertório deste evento.
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => onOpenPdf(item)}
                disabled={!hasPdf}
                className="rounded-[14px] border border-white/10 bg-[#241b3d] px-4 py-3 text-[14px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Baixar PDF
              </button>

              <button
                type="button"
                onClick={() => onOpenPlayer(item)}
                disabled={!hasPlayer}
                className="rounded-[14px] bg-[linear-gradient(135deg,#7c3aed,#8b5cf6)] px-4 py-3 text-[14px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Abrir player
              </button>

              <button
                type="button"
                onClick={onGoToRepertorios}
                className="rounded-[14px] border border-white/10 bg-[#241b3d] px-4 py-3 text-[14px] font-black text-white"
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
