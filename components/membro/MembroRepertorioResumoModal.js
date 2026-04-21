'use client';

import { useEffect, useMemo } from 'react';

const SECTION_ORDER = ['antessala', 'cortejo', 'cerimonia', 'saida', 'receptivo'];

function normalizeSection(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function extractOrderedRepertorio(item) {
  if (!item) return [];

  const repertorio = Array.isArray(item?.repertorioItems)
    ? item.repertorioItems
    : [];

  if (repertorio.length > 0) {
    return [...repertorio].sort((a, b) => {
      const ao = Number(a?.ordem ?? a?.item_order ?? 0);
      const bo = Number(b?.ordem ?? b?.item_order ?? 0);
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
    section: '',
  }));
}

function getSectionLabel(sectionValue) {
  const section = normalizeSection(sectionValue);
  if (section === 'antessala') return '🎶 Antessala';
  if (section === 'cortejo') return '🚶 Cortejo';
  if (section === 'cerimonia') return '⛪ Cerimônia';
  if (section === 'saida') return '🎉 Saída';
  if (section === 'receptivo') return '🎤 Receptivo';

  return '';
}

function getOrderLabel(row, index) {
  const section = normalizeSection(row?.section);

  if (section === 'cortejo') return `Entrada ${index + 1}`;
  if (section === 'cerimonia') return row?.label || row?.momento || `Momento ${index + 1}`;
  if (section === 'saida') return 'Saída dos noivos';
  if (section === 'antessala') return 'Estilo';
  if (section === 'receptivo') return 'Receptivo';

  return row?.label || row?.momento || `Faixa ${index + 1}`;
}

function getMainTitle(row, index) {
  return (
    row?.musica ||
    row?.song_name ||
    row?.label ||
    row?.momento ||
    row?.quemEntra ||
    `Faixa ${index + 1}`
  );
}

function getSecondaryText(row) {
  return row?.quemEntra || row?.momento || row?.tipo || '';
}

function isReceptivoGenericRow(row) {
  if (normalizeSection(row?.section) !== 'receptivo') return false;
  const title = String(row?.musica || row?.song_name || row?.label || row?.momento || '').trim();
  const orderLabel = String(row?.label || row?.momento || '').trim();
  const hasReference = Boolean(row?.referencia);
  const hasNotes = Boolean(row?.observacao);
  const hasMeta = Boolean(row?.genres || row?.artists);

  return !title || (!hasReference && !hasNotes && !hasMeta && orderLabel.toLowerCase() === 'receptivo');
}

function RepertorioLinha({ row, index }) {
  const orderLabel = getOrderLabel(row, index);
  const title = getMainTitle(row, index);
  const secondary = getSecondaryText(row);
  const normalizedSecondary = String(secondary || '').trim().toLowerCase();
  const normalizedOrder = String(orderLabel || '').trim().toLowerCase();
  const normalizedTitle = String(title || '').trim().toLowerCase();
  const showSecondary =
    normalizedSecondary &&
    normalizedSecondary !== normalizedOrder &&
    normalizedSecondary !== normalizedTitle;

  return (
    <div className="space-y-2">
      <div className="rounded-[18px] border border-white/10 bg-[#1e1535] px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-300/15 bg-violet-400/10 text-[12px] font-black text-violet-100">
            {String(index + 1).padStart(2, '0')}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-200/60">
              {orderLabel}
            </div>

            <div className="mt-1 text-[17px] font-black text-white">
              {title}
            </div>

            {showSecondary ? (
              <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-violet-200/70">
                {secondary}
              </div>
            ) : null}

            {row?.observacao ? (
              <div className="mt-2 rounded-[14px] border border-white/10 bg-black/10 px-3 py-3 text-[13px] leading-5 text-white/70">
                <span className="font-black text-white/85">Observação:</span>{' '}
                {row.observacao}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceptivoBloco({ receptivo }) {
  if (!receptivo) return null;

  return (
    <div className="rounded-[18px] border border-white/10 bg-[#1e1535] px-4 py-4">
      <div className="space-y-2 text-[14px] text-white/80">
        {receptivo?.duracao ? <div><span className="font-black text-white">Duração:</span> {receptivo.duracao}</div> : null}
        {receptivo?.generos ? <div><span className="font-black text-white">Gêneros:</span> {receptivo.generos}</div> : null}
        {receptivo?.artistas ? <div><span className="font-black text-white">Artistas:</span> {receptivo.artistas}</div> : null}
        {receptivo?.observacao ? <div><span className="font-black text-white">Observações:</span> {receptivo.observacao}</div> : null}
        {Array.isArray(receptivo?.references) && receptivo.references.length > 0 ? (
          <div>
            <div className="font-black text-white">Referências:</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-violet-100/85">
              {receptivo.references.map((ref) => (
                <li key={ref}>{ref}</li>
              ))}
            </ul>
          </div>
        ) : null}
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

  const repertorioData = useMemo(() => {
    const rawInput = extractOrderedRepertorio(item);
    console.log('[MEMBER_REPERTOIRE][RAW_INPUT]', rawInput);

    const groupedSections = rawInput.reduce((acc, row) => {
      const section = normalizeSection(row?.section);
      if (!SECTION_ORDER.includes(section)) return acc;
      if (!acc[section]) acc[section] = [];
      acc[section].push(row);
      return acc;
    }, {});

    console.log('[MEMBER_REPERTOIRE][GROUPED_SECTIONS]', groupedSections);

    const orderedSections = SECTION_ORDER.map((section) => ({
      key: section,
      label: getSectionLabel(section),
      items: (groupedSections[section] || []).filter((row) => !isReceptivoGenericRow(row)),
    }));

    console.log('[MEMBER_REPERTOIRE][ORDERED_SECTIONS]', orderedSections);

    const receptivoConfig = item?.repertoireConfig || {};
    const receptivoReferences = (groupedSections.receptivo || [])
      .map((row) => String(row?.referencia || '').trim())
      .filter(Boolean);
    const receptivoBlock = {
      duracao: String(receptivoConfig?.reception_duration || '').trim(),
      generos: String(receptivoConfig?.reception_genres || '').trim(),
      artistas: String(receptivoConfig?.reception_artists || '').trim(),
      observacao: String(receptivoConfig?.reception_notes || '').trim(),
      references: Array.from(new Set(receptivoReferences)),
    };

    console.log('[MEMBER_REPERTOIRE][RECEPTIVO_BLOCK]', receptivoBlock);

    return {
      orderedSections,
      receptivoBlock,
    };
  }, [item]);

  const repertorio = repertorioData.orderedSections.flatMap((section) => section.items);

  const hasPdf = !!item?.repertorioPdfUrl;
  const hasPlayer = repertorio.some((row) => !!row?.referencia);
  const hasRepertorio =
    repertorio.length > 0 ||
    Boolean(
      repertorioData?.receptivoBlock?.duracao ||
      repertorioData?.receptivoBlock?.generos ||
      repertorioData?.receptivoBlock?.artistas ||
      repertorioData?.receptivoBlock?.observacao ||
      (Array.isArray(repertorioData?.receptivoBlock?.references) &&
        repertorioData.receptivoBlock.references.length > 0)
    );

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
              <div className="space-y-3">
                {repertorioData.orderedSections.map((section) => {
                  const isReceptivo = section.key === 'receptivo';
                  const hasReceptivoConfig = Boolean(
                    repertorioData?.receptivoBlock?.duracao ||
                    repertorioData?.receptivoBlock?.generos ||
                    repertorioData?.receptivoBlock?.artistas ||
                    repertorioData?.receptivoBlock?.observacao ||
                    (Array.isArray(repertorioData?.receptivoBlock?.references) &&
                      repertorioData.receptivoBlock.references.length > 0)
                  );
                  const shouldRender = section.items.length > 0 || (isReceptivo && hasReceptivoConfig);
                  if (!shouldRender) return null;

                  return (
                    <div key={section.key} className="space-y-2">
                      <div className="px-1 pt-2 text-[13px] font-black uppercase tracking-[0.08em] text-violet-300">
                        {section.label}
                      </div>

                      {isReceptivo && hasReceptivoConfig ? (
                        <ReceptivoBloco receptivo={repertorioData.receptivoBlock} />
                      ) : null}

                      {section.items.map((row, index) => (
                        <RepertorioLinha
                          key={`${section.key}-${row?.ordem || row?.item_order || index}-${row?.musica || row?.song_name || index}`}
                          row={row}
                          index={index}
                        />
                      ))}
                    </div>
                  );
                })}
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
