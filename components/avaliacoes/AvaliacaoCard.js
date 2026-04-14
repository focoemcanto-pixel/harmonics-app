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

function getTestimonialLayout(text, formatId) {
  const baseText = (text || '').trim();
  const length = baseText.length;

  const tier = length <= 130 ? 'short' : length <= 240 ? 'medium' : 'long';

  const config = {
    story: {
      short: { maxChars: 140, fontSize: 78, lineHeight: 1.16, maxWidth: '74%', lineClamp: 5, quoteSize: 138 },
      medium: { maxChars: 185, fontSize: 66, lineHeight: 1.18, maxWidth: '78%', lineClamp: 6, quoteSize: 124 },
      long: { maxChars: 220, fontSize: 58, lineHeight: 1.2, maxWidth: '82%', lineClamp: 6, quoteSize: 118 },
    },
    square: {
      short: { maxChars: 120, fontSize: 62, lineHeight: 1.16, maxWidth: '74%', lineClamp: 4, quoteSize: 112 },
      medium: { maxChars: 150, fontSize: 53, lineHeight: 1.2, maxWidth: '78%', lineClamp: 5, quoteSize: 104 },
      long: { maxChars: 180, fontSize: 47, lineHeight: 1.22, maxWidth: '82%', lineClamp: 5, quoteSize: 96 },
    },
    vertical: {
      short: { maxChars: 145, fontSize: 66, lineHeight: 1.16, maxWidth: '75%', lineClamp: 5, quoteSize: 124 },
      medium: { maxChars: 195, fontSize: 58, lineHeight: 1.19, maxWidth: '79%', lineClamp: 6, quoteSize: 116 },
      long: { maxChars: 230, fontSize: 50, lineHeight: 1.22, maxWidth: '84%', lineClamp: 6, quoteSize: 108 },
    },
  };

  const selected = config[formatId]?.[tier] || config.square.medium;
  const clippedText =
    baseText.length > selected.maxChars
      ? `${baseText.slice(0, selected.maxChars - 1).trimEnd()}…`
      : baseText;

  return {
    ...selected,
    tier,
    clippedText,
  };
}

const ART_PALETTE = {
  backgroundA: '#5b2acc',
  backgroundB: '#7d27d6',
  backgroundC: '#d335ae',
  panel: 'rgba(255,255,255,0.1)',
  panelBorder: 'rgba(255,255,255,0.22)',
  whiteSoft: 'rgba(255,255,255,0.85)',
  whiteMeta: 'rgba(255,255,255,0.7)',
  whiteMuted: 'rgba(255,255,255,0.5)',
  starOn: '#ffd166',
  starOff: 'rgba(255,255,255,0.28)',
};

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
  const textLayout = getTestimonialLayout(testimonial, format.id);
  const signatureSize = isStory ? 44 : format.id === 'vertical' ? 38 : 34;
  const metaSize = isStory ? 24 : format.id === 'vertical' ? 21 : 19;
  const badgeSize = isStory ? 22 : 18;
  const starsSize = isStory ? 68 : format.id === 'vertical' ? 60 : 54;

  return (
    <div
      id={exportId}
      className={compact ? 'w-full' : ''}
      style={{
        position: 'relative',
        margin: '0 auto',
        overflow: 'hidden',
        borderRadius: 36,
        border: '1px solid rgba(255,255,255,0.28)',
        background: `linear-gradient(145deg, ${ART_PALETTE.backgroundA} 0%, ${ART_PALETTE.backgroundB} 52%, ${ART_PALETTE.backgroundC} 100%)`,
        boxShadow: '0 35px 80px rgba(31, 24, 64, 0.45)',
        color: '#ffffff',
        width: compact ? '100%' : `${format.width}px`,
        aspectRatio: `${format.width}/${format.height}`,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 20% 12%, rgba(255,255,255,0.26), rgba(255,255,255,0) 34%), radial-gradient(circle at 88% 85%, rgba(188,151,255,0.36), rgba(188,151,255,0) 35%)',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
          padding: '7.5% 8%',
          gap: '2.5%',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              borderRadius: 999,
              border: `1px solid ${ART_PALETTE.panelBorder}`,
              background: ART_PALETTE.panel,
              padding: '9px 20px',
              fontSize: badgeSize,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: ART_PALETTE.whiteSoft,
            }}
          >
            Recomendado
          </span>
          <span
            style={{
              borderRadius: 999,
              border: `1px solid ${ART_PALETTE.panelBorder}`,
              background: 'rgba(13,9,40,0.28)',
              padding: '8px 18px',
              fontSize: badgeSize,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 600,
              color: ART_PALETTE.whiteMeta,
            }}
          >
            Harmonics
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 900, fontSize: textLayout.quoteSize, lineHeight: 0.7, color: 'rgba(255,255,255,0.24)' }}>“</p>
          <p
            style={{
              margin: '8px auto 0',
              maxWidth: textLayout.maxWidth,
              textAlign: 'center',
              fontWeight: 650,
              letterSpacing: '-0.015em',
              fontSize: textLayout.fontSize,
              lineHeight: textLayout.lineHeight,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: textLayout.lineClamp,
              overflow: 'hidden',
              textWrap: 'pretty',
              ...(textStyle
                ? {
                    borderRadius: 30,
                    padding: '24px 30px',
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.16)',
                  }
                : {}),
            }}
          >
            {textLayout.clippedText}
          </p>
        </div>

        <div style={{ textAlign: 'center', display: 'grid', gap: isStory ? 20 : 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 10,
              borderRadius: 22,
              padding: starsStyle ? '14px 12px' : '0',
              background: starsStyle ? 'rgba(255,255,255,0.12)' : 'transparent',
              border: starsStyle ? '1px solid rgba(255,255,255,0.2)' : 'none',
            }}
          >
            {stars.map((filled, index) => (
              <span key={index} style={{ lineHeight: 1, fontSize: starsSize, color: filled ? ART_PALETTE.starOn : ART_PALETTE.starOff }}>
                ★
              </span>
            ))}
          </div>

          <div>
            <p style={{ margin: 0, fontSize: signatureSize, fontWeight: 620, letterSpacing: '0.03em', color: ART_PALETTE.whiteSoft }}>
              {coupleName}
            </p>
            {eventName ? (
              <p style={{ margin: '8px 0 0', fontSize: metaSize, color: ART_PALETTE.whiteMeta }}>{eventName}</p>
            ) : null}
            <p
              style={{
                margin: '10px 0 0',
                fontSize: metaSize,
                fontWeight: 600,
                color: ART_PALETTE.whiteMuted,
                letterSpacing: '0.11em',
                textTransform: 'uppercase',
              }}
            >
              {formatDate(item?.submitted_at)}
            </p>
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
  const [generationError, setGenerationError] = useState('');

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
    setGenerationError('');

    const result = await exportDepoimentoAsImage(exportElementId, {
      download: false,
      fileName: `depoimento-harmonics-${selectedFormat.id}-${Date.now()}.png`,
      format: selectedFormat,
    });

    if (result?.ok) {
      setGeneratedImage(result.dataUrl || '');
      setGenerationStatus('done');
      showToast?.('Arte gerada com sucesso', 'success');
      return;
    }

    const reason = result?.error || 'Falha desconhecida ao exportar imagem';
    console.error('[AvaliacaoCard] Falha na geração da arte:', reason, result?.details || {});
    setGenerationStatus('error');
    setGenerationError(reason);
    showToast?.(`Erro ao gerar arte: ${reason}`, 'error');
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
    setGenerationError('');
  }

  function handleChangeVariation() {
    setVariationIndex((current) => (current + 1) % STYLE_VARIATIONS.length);
    setGenerationStatus('idle');
    setGeneratedImage('');
  }

  function handleResetPreview() {
    setGenerationStatus('idle');
    setGeneratedImage('');
    setGenerationError('');
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
                  <div
                    className="pointer-events-none"
                    aria-hidden="true"
                    style={{
                      position: 'fixed',
                      left: '-10000px',
                      top: 0,
                      width: `${selectedFormat.width}px`,
                      height: `${selectedFormat.height}px`,
                      opacity: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <TestimonialArt
                      item={item}
                      coupleName={coupleName}
                      eventName={eventName}
                      testimonial={testimonial}
                      stars={stars}
                      format={selectedFormat}
                      styleId={selectedStyle.id}
                      exportId={exportElementId}
                    />
                  </div>
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
                        exportId={`${exportElementId}-preview`}
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
                  disabled={generationStatus !== 'done' || !generatedImage}
                  className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {downloadStatus === 'done' ? 'Baixado com sucesso ✓' : 'Baixar imagem'}
                </button>

                {generationStatus === 'error' && generationError ? (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    Falha técnica: {generationError}
                  </p>
                ) : null}

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
