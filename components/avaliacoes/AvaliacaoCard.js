'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useToast } from '@/components/ui/ToastProvider';
import { exportDepoimentoAsImage } from '@/lib/export/export-element-as-image';

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

function getStarsArray(rating) {
  const normalized = Math.max(0, Math.min(5, Math.round(Number(rating || 0))));
  return Array.from({ length: 5 }, (_, index) => index < normalized);
}

const ART_FORMATS = [
  { id: 'story', label: 'Story', sizeLabel: '1080x1920', width: 1080, height: 1920 },
  { id: 'square', label: 'Feed quadrado', sizeLabel: '1080x1080', width: 1080, height: 1080 },
  { id: 'vertical', label: 'Feed vertical', sizeLabel: '1080x1350', width: 1080, height: 1350 },
];

const STYLE_VARIATIONS = [
  { id: 'clean', label: 'Clean' },
  { id: 'texto', label: 'Destaque no texto' },
  { id: 'estrelas', label: 'Destaque nas estrelas' },
];

function TestimonialArt({
  item,
  coupleName,
  eventName,
  testimonial,
  stars,
  format,
  styleId,
  exportId,
  compact,
}) {
  const isStory = format.id === 'story';
  const textStyle = styleId === 'texto';
  const starsStyle = styleId === 'estrelas';

  return (
    <div
      id={exportId}
      className={classNames(
        'relative mx-auto overflow-hidden rounded-[32px] border border-white/20',
        'bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-700 text-white shadow-2xl',
        compact ? 'w-full' : ''
      )}
      style={{
        width: compact ? '100%' : `${format.width}px`,
        aspectRatio: `${format.width}/${format.height}`,
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.3),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(196,181,253,0.4),transparent_50%)]" />
      <div className="absolute inset-0 backdrop-blur-[1px]" />

      <div className={classNames('relative flex h-full flex-col px-[8%] pb-[8%] pt-[10%]', isStory ? 'justify-between' : 'justify-around')}>
        <div className="flex items-center justify-between">
          <span className="rounded-full border border-white/25 bg-white/15 px-4 py-1.5 text-[20px] font-semibold tracking-wide text-white/95">
            Recomendado
          </span>
          <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-[15px] font-semibold text-white/80">
            Harmonics
          </span>
        </div>

        <div className="mt-4 flex-1">
          <p className="text-[120px] font-black leading-[0.65] text-white/25">“</p>
          <p
            className={classNames(
              'mt-3 text-center font-bold leading-[1.28] tracking-tight',
              isStory ? 'text-[56px]' : 'text-[52px]',
              textStyle ? 'rounded-[30px] bg-white/12 px-8 py-7 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]' : ''
            )}
          >
            {testimonial}
          </p>
        </div>

        <div className="space-y-6 text-center">
          <div
            className={classNames(
              'flex items-center justify-center gap-3',
              starsStyle ? 'rounded-2xl bg-white/12 py-4 shadow-[0_12px_36px_rgba(17,24,39,0.3)]' : ''
            )}
          >
            {stars.map((filled, index) => (
              <span key={index} className={classNames('leading-none', starsStyle ? 'text-[64px]' : 'text-[52px]', filled ? 'text-amber-300' : 'text-white/35')}>
                ★
              </span>
            ))}
          </div>

          <div>
            <p className="text-[32px] font-semibold tracking-[0.07em] text-white/95">{coupleName}</p>
            {eventName ? <p className="mt-1 text-[24px] text-white/75">{eventName}</p> : null}
            <p className="mt-2 text-[20px] font-medium uppercase tracking-[0.16em] text-white/60">{formatDate(item?.submitted_at)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AvaliacaoCard({ item }) {
  const { showToast } = useToast() || {};
  const [copyStatus, setCopyStatus] = useState('idle');
  const [modalOpen, setModalOpen] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('idle');
  const [downloadStatus, setDownloadStatus] = useState('idle');
  const [selectedFormatId, setSelectedFormatId] = useState(ART_FORMATS[0].id);
  const [variationIndex, setVariationIndex] = useState(0);
  const [generatedImage, setGeneratedImage] = useState('');

  const coupleName = useMemo(() => getCoupleName(item), [item]);
  const eventName = item?.event_title || item?.event_name || '';
  const testimonial = item?.testimonial?.trim() || 'Uma experiência incrível do começo ao fim. Recomendo demais!';
  const exportElementId = `depoimento-art-${item?.id || coupleName.replace(/\s+/g, '-').toLowerCase()}`;

  const stars = getStarsArray(item?.rating);
  const selectedFormat = ART_FORMATS.find((format) => format.id === selectedFormatId) || ART_FORMATS[0];
  const selectedStyle = STYLE_VARIATIONS[variationIndex];

  const autoCaption = useMemo(() => {
    return [
      `✨ ${testimonial}`,
      '',
      `Obrigado, ${coupleName}, por confiar na Harmonics${eventName ? ` em ${eventName}` : ''}!`,
      'Seu feedback inspira mais histórias inesquecíveis. 💜',
      '',
      '#Harmonics #DepoimentoReal #CasamentoDosSonhos #MusicaAoVivo #Eventos',
    ].join('\n');
  }, [coupleName, eventName, testimonial]);

  async function handleCopy() {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard indisponível neste navegador');
      }

      await navigator.clipboard.writeText(autoCaption);
      setCopyStatus('done');
      showToast?.('Legenda copiada', 'success');
      setTimeout(() => setCopyStatus('idle'), 1800);
    } catch (error) {
      console.error(error);
      setCopyStatus('error');
      showToast?.('Falha ao copiar legenda', 'error');
      setTimeout(() => setCopyStatus('idle'), 2200);
    }
  }

  async function handleGenerateImage() {
    setGenerationStatus('loading');
    setGeneratedImage('');

    const result = await exportDepoimentoAsImage(exportElementId, {
      download: false,
      fileName: `depoimento-harmonics-${selectedFormat.id}-${Date.now()}.png`,
    });

    if (result?.ok) {
      setGeneratedImage(result.dataUrl || '');
      setGenerationStatus('done');
      showToast?.('Arte gerada com sucesso', 'success');
      return;
    }

    setGenerationStatus('error');
    showToast?.('Erro ao gerar arte', 'error');
  }

  function handleDownload() {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.download = `depoimento-harmonics-${selectedFormat.id}-${Date.now()}.png`;
    link.href = generatedImage;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadStatus('done');
    showToast?.('Download concluído', 'success');
    setTimeout(() => setDownloadStatus('idle'), 1500);
  }

  function openModal() {
    setModalOpen(true);
    setGenerationStatus('idle');
    setGeneratedImage('');
  }

  function handleChangeVariation() {
    setVariationIndex((current) => (current + 1) % STYLE_VARIATIONS.length);
    setGenerationStatus('idle');
    setGeneratedImage('');
  }

  function handleResetPreview() {
    setGenerationStatus('idle');
    setGeneratedImage('');
  }

  return (
    <>
      <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/80 p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-100/40 blur-2xl" />

        <div className="relative flex h-full flex-col gap-4">
          <div className="mx-auto w-full max-w-[360px]">
            <TestimonialArt
              item={item}
              coupleName={coupleName}
              eventName={eventName}
              testimonial={testimonial}
              stars={stars}
              format={ART_FORMATS[1]}
              styleId={selectedStyle.id}
              exportId={`${exportElementId}-list`}
              compact
            />
          </div>

          <div className="space-y-3 text-xs text-slate-500">
            <p className="font-semibold uppercase tracking-[0.15em] text-violet-600">Estilo: {selectedStyle.label}</p>
            <p className="line-clamp-2">{testimonial}</p>
          </div>

          <div className="mt-auto grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {copyStatus === 'done'
                ? 'Legenda copiada!'
                : copyStatus === 'error'
                  ? 'Falha ao copiar'
                  : 'Copiar legenda'}
            </button>
            <button
              type="button"
              onClick={openModal}
              className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100"
            >
              Gerar arte
            </button>
          </div>
        </div>
      </article>

      {modalOpen ? (
        <div className="fixed inset-0 z-[180] flex items-end justify-center bg-[rgba(15,23,42,0.6)] p-4 backdrop-blur-[4px] md:items-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={() => setModalOpen(false)} />

          <div className="relative z-10 w-full max-w-5xl rounded-3xl border border-white/30 bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-600">Gerador profissional</p>
                <h3 className="text-2xl font-extrabold text-slate-900">Arte para redes sociais</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {ART_FORMATS.map((format) => (
                    <button
                      key={format.id}
                      type="button"
                      onClick={() => {
                        setSelectedFormatId(format.id);
                        handleResetPreview();
                      }}
                      className={classNames(
                        'rounded-xl border px-3 py-2 text-sm font-semibold transition',
                        selectedFormatId === format.id
                          ? 'border-violet-400 bg-violet-100 text-violet-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {format.label} <span className="text-xs opacity-80">({format.sizeLabel})</span>
                    </button>
                  ))}
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-4 min-h-[420px]">
                  {generationStatus === 'loading' ? (
                    <div className="space-y-3">
                      <div className="h-8 w-36 animate-pulse rounded bg-slate-200" />
                      <div className="h-[360px] animate-pulse rounded-2xl bg-slate-200" />
                      <div className="h-8 w-full animate-pulse rounded bg-slate-200" />
                    </div>
                  ) : generatedImage ? (
                    <div className="transition-all duration-500 ease-out">
                      <Image src={generatedImage} alt="Preview da arte do depoimento" width={selectedFormat.width} height={selectedFormat.height} unoptimized className="mx-auto max-h-[520px] h-auto w-auto rounded-2xl border border-slate-200 shadow-xl" />
                    </div>
                  ) : (
                    <div className="mx-auto max-w-[320px]">
                      <TestimonialArt
                        item={item}
                        coupleName={coupleName}
                        eventName={eventName}
                        testimonial={testimonial}
                        stars={stars}
                        format={selectedFormat}
                        styleId={selectedStyle.id}
                        exportId={exportElementId}
                        compact
                      />
                    </div>
                  )}
                </div>
              </div>

              <aside className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                <p className="text-sm font-bold text-slate-700">Estilo atual: {selectedStyle.label}</p>
                <button
                  type="button"
                  onClick={handleChangeVariation}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Trocar estilo
                </button>
                <button
                  type="button"
                  onClick={handleGenerateImage}
                  disabled={generationStatus === 'loading'}
                  className="w-full rounded-xl border border-violet-300 bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {generationStatus === 'loading' ? 'Gerando arte...' : 'Gerar arte'}
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!generatedImage}
                  className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {downloadStatus === 'done' ? 'Baixado com sucesso ✓' : 'Baixar imagem'}
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  {copyStatus === 'done' ? 'Legenda copiada!' : 'Copiar legenda'}
                </button>

                <button
                  type="button"
                  onClick={handleResetPreview}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Gerar outra versão
                </button>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Legenda automática</p>
                  <pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">{autoCaption}</pre>
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
