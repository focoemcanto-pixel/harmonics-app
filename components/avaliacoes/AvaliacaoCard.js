'use client';

import { useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { buildDepoimentoFilename, exportElementAsImage } from '@/lib/export/export-element-as-image';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function formatDate(value) {
  if (!value) return 'Data não informada';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';

  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
}

function getCoupleName(item) {
  const fromPayload =
    item?.couple_name || item?.couple || item?.bride_and_groom || item?.noivos || item?.client_name;

  if (!fromPayload) return 'Noivos não informados';
  return fromPayload;
}

function getStars(rating) {
  const normalized = Math.max(0, Math.min(5, Math.round(Number(rating || 0))));
  const filled = '★'.repeat(normalized);
  const empty = '☆'.repeat(5 - normalized);

  return `${filled}${empty}`;
}

function getSlugOrId(item, coupleName) {
  return item?.slug || item?.id || coupleName;
}

export default function AvaliacaoCard({ item }) {
  const { showToast } = useToast() || {};
  const [copyStatus, setCopyStatus] = useState('idle');
  const [exportStatus, setExportStatus] = useState('idle');
  const exportCardRef = useRef(null);

  const coupleName = useMemo(() => getCoupleName(item), [item]);
  const eventName = item?.event_title || item?.event_name || '';
  const testimonial = item?.testimonial?.trim() || 'Uma experiência incrível do começo ao fim. Recomendo demais!';

  const shareText = useMemo(() => {
    return [
      `${coupleName}${eventName ? ` • ${eventName}` : ''}`,
      `Nota: ${getStars(item?.rating)} (${Number(item?.rating || 0)}/5)`,
      `“${testimonial}”`,
      item?.would_recommend ? '✅ Recomendaria a Harmonics' : null,
    ]
      .filter(Boolean)
      .join('\n');
  }, [coupleName, eventName, item?.rating, item?.would_recommend, testimonial]);

  async function handleCopy() {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard indisponível neste navegador');
      }

      await navigator.clipboard.writeText(shareText);
      setCopyStatus('done');
      setTimeout(() => setCopyStatus('idle'), 1800);
    } catch (error) {
      console.error(error);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2200);
    }
  }

  async function handleExportImage() {
    if (!exportCardRef.current) {
      showToast?.('Card indisponível para exportação.', 'error');
      return;
    }

    try {
      setExportStatus('loading');

      const slugOrId = getSlugOrId(item, coupleName);
      const filename = buildDepoimentoFilename(slugOrId);

      await exportElementAsImage(exportCardRef.current, { filename, scale: 3 });
      setExportStatus('done');
      showToast?.('Imagem gerada e download iniciado.', 'success');
      setTimeout(() => setExportStatus('idle'), 1400);
    } catch (error) {
      console.error(error);
      setExportStatus('error');
      showToast?.('Não foi possível exportar o depoimento como imagem.', 'error');
      setTimeout(() => setExportStatus('idle'), 2200);
    }
  }

  const stars = getStars(item?.rating);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/80 p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-100/40 blur-2xl" />

      <div className="relative flex h-full flex-col gap-4">
        <div
          ref={exportCardRef}
          className="space-y-5 rounded-2xl border border-slate-100 bg-white/95 p-1"
        >
          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Depoimento</p>

            <div>
              <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">{coupleName}</h3>
              {eventName ? <p className="mt-1 text-sm font-medium text-slate-500">{eventName}</p> : null}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xl leading-none text-amber-500" aria-label={`Nota ${item?.rating || 0} de 5`}>
                {stars}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                {Number(item?.rating || 0).toFixed(1)}/5
              </span>
            </div>
          </header>

          <p className="text-base leading-7 text-slate-700">“{testimonial}”</p>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={classNames(
                  'rounded-full px-3 py-1 text-xs font-bold',
                  item?.would_recommend
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                )}
              >
                {item?.would_recommend ? 'Recomendaria' : 'Não informou recomendação'}
              </span>
              <span className="text-xs font-medium text-slate-400">{formatDate(item?.submitted_at)}</span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">Harmonics</span>
              <span className="text-[11px] font-semibold text-slate-400">harmonics.app</span>
            </div>
          </div>
        </div>

        <div className="mt-auto grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {copyStatus === 'done'
              ? 'Copiado!'
              : copyStatus === 'error'
                ? 'Falha ao copiar'
                : 'Copiar depoimento'}
          </button>
          <button
            type="button"
            onClick={handleExportImage}
            disabled={exportStatus === 'loading'}
            className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exportStatus === 'loading'
              ? 'Gerando...'
              : exportStatus === 'done'
                ? 'Baixado!'
                : exportStatus === 'error'
                  ? 'Falhou, tente novamente'
                  : 'Exportar como imagem'}
          </button>
        </div>
      </div>
    </article>
  );
}
