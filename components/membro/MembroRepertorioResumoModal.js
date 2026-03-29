'use client';

import { useEffect } from 'react';

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
            <div className="space-y-4">
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
                  Formação
                </div>
                <div className="mt-2 text-[16px] font-semibold">
                  {item.formation || '-'}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
                  Instrumentos
                </div>
                <div className="mt-2 text-[15px] leading-7 text-white/80">
                  {item.instruments || '-'}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
                  Material disponível
                </div>
                <div className="mt-2 space-y-2 text-[14px] text-white/75">
                  <div>
                    PDF: {item.contractInfo?.pdfUrl ? 'Disponível' : 'Não disponível'}
                  </div>
                  <div>Faixas: {item.youtubeUrls?.length || 0}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => onOpenPdf(item)}
                  disabled={!item.contractInfo?.pdfUrl}
                  className="rounded-[18px] border border-white/10 bg-white/10 px-5 py-4 text-[15px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Baixar PDF
                </button>

                <button
                  type="button"
                  onClick={() => onOpenPlayer(item)}
                  disabled={!item.youtubeUrls?.length}
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
    </div>
  );
}
