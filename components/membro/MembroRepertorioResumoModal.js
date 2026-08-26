'use client';

import { useEffect, useMemo } from 'react';

const SECTION_ORDER = ['antessala', 'cortejo', 'cerimonia', 'saida', 'receptivo'];

function normalizeSection(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function resolveTrackUrl(row) {
  const referenceLink = String(row?.referencia || row?.reference_link || '').trim();
  if (referenceLink) return referenceLink;
  const referenceVideoId = String(row?.reference_video_id || '').trim();
  return referenceVideoId ? `https://www.youtube.com/watch?v=${referenceVideoId}` : '';
}

function extractOrderedRepertorio(item) {
  if (!item) return [];
  const repertorio = Array.isArray(item?.repertorioItems) ? item.repertorioItems : [];
  if (repertorio.length) return [...repertorio].sort((a, b) => Number(a?.ordem ?? a?.item_order ?? 0) - Number(b?.ordem ?? b?.item_order ?? 0));
  return (Array.isArray(item?.youtubeUrls) ? item.youtubeUrls : []).map((url, index) => ({ ordem: index + 1, musica: `Faixa ${index + 1}`, referencia: url, section: '' }));
}

function getSectionLabel(value) {
  const section = normalizeSection(value);
  return { antessala: '🎶 Antessala', cortejo: '🚶 Cortejo', cerimonia: '⛪ Cerimônia', saida: '🎉 Saída', receptivo: '🎤 Receptivo' }[section] || '';
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
  return row?.musica || row?.song_name || row?.label || row?.momento || row?.quemEntra || `Faixa ${index + 1}`;
}

function getSecondaryText(row) { return row?.quemEntra || row?.momento || row?.tipo || ''; }

function isReceptivoGenericRow(row) {
  if (normalizeSection(row?.section) !== 'receptivo') return false;
  const title = String(row?.musica || row?.song_name || row?.label || row?.momento || '').trim();
  const orderLabel = String(row?.label || row?.momento || '').trim();
  return !title || (!row?.referencia && !row?.observacao && !row?.genres && !row?.artists && orderLabel.toLowerCase() === 'receptivo');
}

function isDescriptiveOnlySectionRow(row) {
  const section = normalizeSection(row?.section);
  if (!['antessala', 'receptivo'].includes(section)) return false;
  const title = String(row?.song_name || row?.musica || '').trim();
  const normalizedTitle = normalizeSection(title);
  const normalizedLabel = normalizeSection(row?.label || row?.momento || '');
  const hasReference = Boolean(String(row?.referencia || '').trim());
  if (normalizeSection(row?.tipo) === 'ante_room') return true;
  if (!title && !hasReference) return true;
  return !hasReference && (normalizedTitle === section || normalizedLabel === section);
}

function openLyricsSearch(title) {
  if (typeof window === 'undefined') return;
  const query = encodeURIComponent(`${String(title || '').trim()} letra`);
  window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer');
}

function RepertorioLinha({ row, index, displayNumber }) {
  const orderLabel = getOrderLabel(row, index);
  const title = getMainTitle(row, index);
  const secondary = getSecondaryText(row);
  const normalizedSecondary = String(secondary || '').trim().toLowerCase();
  const showSecondary = normalizedSecondary && normalizedSecondary !== String(orderLabel).trim().toLowerCase() && normalizedSecondary !== String(title).trim().toLowerCase();

  return (
    <div className="rounded-[18px] border border-white/10 bg-[#1e1535] px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-300/15 bg-violet-400/10 text-[12px] font-black text-violet-100">{String(displayNumber || index + 1).padStart(2, '0')}</div>
        <div className="min-w-0 flex-1">
          <div className="break-words text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-200/60">{orderLabel}</div>
          <div className="mt-1 flex items-start gap-2">
            <div className="min-w-0 flex-1 break-words text-[17px] font-black text-white">{title}</div>
            <button type="button" onClick={() => openLyricsSearch(title)} aria-label={`Buscar letra de ${title}`} title="Abrir letra" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-violet-300/20 bg-violet-400/10 text-[17px] text-violet-100 transition active:scale-95">♫</button>
          </div>
          {showSecondary ? <div className="mt-1 break-words text-[12px] font-semibold uppercase tracking-[0.08em] text-violet-200/70">{secondary}</div> : null}
          {row?.observacao ? <div className="mt-2 break-words rounded-[14px] border border-white/10 bg-black/10 px-3 py-3 text-[13px] leading-5 text-white/70"><span className="font-black text-white/85">Observação:</span>{' '}{row.observacao}</div> : null}
        </div>
      </div>
    </div>
  );
}

function ConfigBlock({ title, rows = [], references = [] }) {
  const visibleRows = rows.filter((row) => row?.value);
  if (!visibleRows.length && !references.length) return null;
  return <div className="rounded-[18px] border border-white/10 bg-[#1e1535] px-4 py-4"><div className="space-y-2 break-words text-[14px] text-white/80">{title ? <div className="font-black text-white">{title}</div> : null}{visibleRows.map((row) => <div key={row.label}><span className="font-black text-white">{row.label}:</span> {row.value}</div>)}{references.length ? <div><div className="font-black text-white">Referências:</div><ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-violet-100/85">{references.map((ref) => <li className="break-all" key={ref}>{ref}</li>)}</ul></div> : null}</div></div>;
}

export default function MembroRepertorioResumoModal({ open, item, onClose, onOpenPdf, onOpenPlayer, onGoToRepertorios }) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const touchAction = document.body.style.touchAction;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => { document.documentElement.style.overflow = htmlOverflow; document.body.style.overflow = bodyOverflow; document.body.style.touchAction = touchAction; };
  }, [open]);

  const repertorioData = useMemo(() => {
    const rawInput = extractOrderedRepertorio(item);
    const grouped = rawInput.reduce((acc, row) => {
      const normalized = normalizeSection(row?.section);
      const section = SECTION_ORDER.includes(normalized) ? normalized : 'cerimonia';
      (acc[section] ||= []).push(row);
      return acc;
    }, {});
    const antessalaRows = grouped.antessala || [];
    const antessalaDescriptions = antessalaRows.filter(isDescriptiveOnlySectionRow);
    const config = item?.repertoireConfig || {};
    const antessalaBlock = {
      estilo: antessalaDescriptions.map((row) => String(row?.musica || row?.song_name || '').trim()).find(Boolean) || '',
      observacao: antessalaDescriptions.map((row) => String(row?.observacao || '').trim()).filter(Boolean).join(' · '),
      references: Array.from(new Set(antessalaDescriptions.map((row) => String(row?.referencia || '').trim()).filter(Boolean))),
    };
    const receptivoBlock = {
      duracao: String(config?.reception_duration || '').trim(), generos: String(config?.reception_genres || '').trim(), artistas: String(config?.reception_artists || '').trim(), observacao: String(config?.reception_notes || '').trim(),
      references: Array.from(new Set((grouped.receptivo || []).map((row) => String(row?.referencia || '').trim()).filter(Boolean))),
    };
    let globalNumber = 0;
    const orderedSections = SECTION_ORDER.map((section) => ({
      key: section,
      label: getSectionLabel(section),
      items: (grouped[section] || []).filter((row) => !isReceptivoGenericRow(row) && !isDescriptiveOnlySectionRow(row)).map((row) => ({ row, displayNumber: ++globalNumber })),
    }));
    return { rawInput, orderedSections, antessalaBlock, receptivoBlock };
  }, [item]);

  const hasPdf = Boolean(item?.repertorioPdfUrl);
  const hasPlayer = repertorioData.rawInput.some((row) => Boolean(resolveTrackUrl(row)));
  const hasRepertorio = repertorioData.rawInput.length > 0 || Boolean(repertorioData.antessalaBlock.estilo || repertorioData.antessalaBlock.observacao || repertorioData.antessalaBlock.references.length || repertorioData.receptivoBlock.duracao || repertorioData.receptivoBlock.generos || repertorioData.receptivoBlock.artistas || repertorioData.receptivoBlock.observacao || repertorioData.receptivoBlock.references.length);
  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-[180] bg-black/70 backdrop-blur-[4px]" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="flex h-[100dvh] items-end justify-center overflow-hidden px-0 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))] w-full max-w-[500px] flex-col overflow-hidden rounded-t-[22px] border border-white/10 bg-[#1a1230] text-white shadow-[0_24px_80px_rgba(0,0,0,0.42)] md:my-6 md:h-auto md:max-h-[88vh] md:rounded-[20px]" onClick={(e) => e.stopPropagation()}>
          <div className="shrink-0"><div className="mx-auto mt-3 h-1 w-9 rounded-full bg-white/15" /><div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#1a1230] px-5 py-4"><div className="min-w-0 flex-1"><div className="text-[18px] font-black tracking-[-0.03em] text-white">🎼 Repertório</div><div className="mt-1 truncate text-[12px] font-semibold text-white/55">{item?.clientName || 'Evento'}</div></div><button type="button" onClick={onClose} aria-label="Fechar repertório" className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-[12px] border border-white/10 bg-[#241b3d] px-3 py-2 text-[13px] font-extrabold text-white transition active:scale-[0.98]">✕</button></div></div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-4 [-webkit-overflow-scrolling:touch]">
            {hasRepertorio ? <div className="space-y-3">{repertorioData.orderedSections.map((section) => {
              const isAntessala = section.key === 'antessala'; const isReceptivo = section.key === 'receptivo';
              const hasExtra = (isAntessala && (repertorioData.antessalaBlock.estilo || repertorioData.antessalaBlock.observacao || repertorioData.antessalaBlock.references.length)) || (isReceptivo && (repertorioData.receptivoBlock.duracao || repertorioData.receptivoBlock.generos || repertorioData.receptivoBlock.artistas || repertorioData.receptivoBlock.observacao || repertorioData.receptivoBlock.references.length));
              if (!section.items.length && !hasExtra) return null;
              return <div key={section.key} className="space-y-2"><div className="break-words px-1 pt-2 text-[13px] font-black uppercase tracking-[0.08em] text-violet-300">{section.label}</div>{isAntessala ? <ConfigBlock rows={[{ label: 'Estilo', value: repertorioData.antessalaBlock.estilo }, { label: 'Observações', value: repertorioData.antessalaBlock.observacao }]} references={repertorioData.antessalaBlock.references} /> : null}{isReceptivo ? <ConfigBlock rows={[{ label: 'Duração', value: repertorioData.receptivoBlock.duracao }, { label: 'Gêneros', value: repertorioData.receptivoBlock.generos }, { label: 'Artistas', value: repertorioData.receptivoBlock.artistas }, { label: 'Observações', value: repertorioData.receptivoBlock.observacao }]} references={repertorioData.receptivoBlock.references} /> : null}{section.items.map(({ row, displayNumber }, index) => <RepertorioLinha key={`${section.key}-${row?.ordem || row?.item_order || index}-${row?.musica || row?.song_name || index}`} row={row} index={index} displayNumber={displayNumber} />)}</div>;
            })}</div> : <div className="rounded-[16px] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-center text-[14px] font-semibold leading-6 text-white/60">O cliente ainda não enviou o repertório deste evento.</div>}
            <div className="mt-4 grid grid-cols-1 gap-3"><button type="button" onClick={() => onOpenPdf(item)} disabled={!hasPdf} className="min-h-11 touch-manipulation rounded-[14px] border border-white/10 bg-[#241b3d] px-4 py-3 text-[14px] font-black text-white disabled:opacity-50">Baixar PDF</button><button type="button" onClick={() => onOpenPlayer(item)} disabled={!hasPlayer} className="min-h-11 touch-manipulation rounded-[14px] bg-[linear-gradient(135deg,#7c3aed,#8b5cf6)] px-4 py-3 text-[14px] font-black text-white disabled:opacity-50">Abrir player</button><button type="button" onClick={onGoToRepertorios} className="min-h-11 touch-manipulation rounded-[14px] border border-white/10 bg-[#241b3d] px-4 py-3 text-[14px] font-black text-white">Ir para repertórios</button></div>
          </div>
        </div>
      </div>
    </div>
  );
}
