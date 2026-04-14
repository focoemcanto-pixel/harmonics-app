'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  { id: 'story', label: 'Story', ratioLabel: '9:16', sizeLabel: '1080x1920', width: 1080, height: 1920 },
  { id: 'square', label: 'Feed quadrado', ratioLabel: '1:1', sizeLabel: '1080x1080', width: 1080, height: 1080 },
  { id: 'vertical', label: 'Feed vertical', ratioLabel: '4:5', sizeLabel: '1080x1350', width: 1080, height: 1350 },
];

const TEMPLATE_OPTIONS = [
  { id: 'clean-premium', label: 'Clean Premium', idealFor: 'Textos curtos e médios' },
  { id: 'card-editorial', label: 'Card Editorial', idealFor: 'Textos médios e longos' },
  { id: 'avatar-card', label: 'Avatar + Card', idealFor: 'Feed com nome, estrelas e avatar' },
  { id: 'quote-impact', label: 'Quote Impact', idealFor: 'Frases curtas e de impacto' },
];

const TEMPLATE_TEXT_CONFIG = {
  'clean-premium': {
    story: { widthRatio: 0.78, heightRatio: 0.37, minFont: 36, maxFont: 74, baseLineHeight: 1.2, baseLetterSpacing: -0.012, padding: 24, maxPadding: 50 },
    square: { widthRatio: 0.8, heightRatio: 0.34, minFont: 30, maxFont: 62, baseLineHeight: 1.2, baseLetterSpacing: -0.012, padding: 20, maxPadding: 42 },
    vertical: { widthRatio: 0.8, heightRatio: 0.35, minFont: 32, maxFont: 66, baseLineHeight: 1.2, baseLetterSpacing: -0.012, padding: 22, maxPadding: 44 },
  },
  'card-editorial': {
    story: { widthRatio: 0.78, heightRatio: 0.56, minFont: 30, maxFont: 56, baseLineHeight: 1.36, baseLetterSpacing: -0.004, padding: 36, maxPadding: 56 },
    square: { widthRatio: 0.8, heightRatio: 0.5, minFont: 26, maxFont: 46, baseLineHeight: 1.34, baseLetterSpacing: -0.003, padding: 28, maxPadding: 48 },
    vertical: { widthRatio: 0.79, heightRatio: 0.52, minFont: 28, maxFont: 50, baseLineHeight: 1.35, baseLetterSpacing: -0.004, padding: 30, maxPadding: 50 },
  },
  'avatar-card': {
    story: { widthRatio: 0.72, heightRatio: 0.43, minFont: 28, maxFont: 52, baseLineHeight: 1.33, baseLetterSpacing: -0.004, padding: 30, maxPadding: 52 },
    square: { widthRatio: 0.72, heightRatio: 0.4, minFont: 24, maxFont: 42, baseLineHeight: 1.32, baseLetterSpacing: -0.003, padding: 24, maxPadding: 44 },
    vertical: { widthRatio: 0.72, heightRatio: 0.42, minFont: 26, maxFont: 46, baseLineHeight: 1.32, baseLetterSpacing: -0.004, padding: 26, maxPadding: 46 },
  },
  'quote-impact': {
    story: { widthRatio: 0.66, heightRatio: 0.3, minFont: 34, maxFont: 78, baseLineHeight: 1.15, baseLetterSpacing: -0.018, padding: 10, maxPadding: 24 },
    square: { widthRatio: 0.68, heightRatio: 0.28, minFont: 30, maxFont: 64, baseLineHeight: 1.15, baseLetterSpacing: -0.018, padding: 8, maxPadding: 22 },
    vertical: { widthRatio: 0.67, heightRatio: 0.29, minFont: 32, maxFont: 68, baseLineHeight: 1.15, baseLetterSpacing: -0.018, padding: 8, maxPadding: 24 },
  },
};

const TEMPLATE_SUGGESTIONS = {
  short: ['quote-impact', 'clean-premium', 'avatar-card'],
  medium: ['clean-premium', 'avatar-card', 'card-editorial'],
  long: ['card-editorial', 'avatar-card', 'clean-premium'],
};

const INSTAGRAM_CREATE_URL = 'https://www.instagram.com/create/style/';
const INSTAGRAM_URL = 'https://www.instagram.com/';
const META_BUSINESS_SUITE_URL = 'https://business.facebook.com/latest/home';

function getTextTier(text) {
  const length = String(text || '').trim().length;
  if (length <= 140) return 'short';
  if (length <= 360) return 'medium';
  return 'long';
}

function getInitials(name) {
  const tokens = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!tokens.length) return 'HC';
  return tokens.map((token) => token[0]?.toUpperCase() || '').join('');
}

function ensureMeasureContext() {
  if (typeof document === 'undefined') return null;
  const canvas = ensureMeasureContext.canvas || document.createElement('canvas');
  ensureMeasureContext.canvas = canvas;
  return canvas.getContext('2d');
}

function measureWrappedText({
  text,
  maxWidth,
  fontSize,
  lineHeight,
  letterSpacing,
  fontWeight = 600,
  fontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
}) {
  const context = ensureMeasureContext();
  if (!context) {
    return {
      lineCount: 999,
      height: Number.POSITIVE_INFINITY,
      width: Number.POSITIVE_INFINITY,
    };
  }

  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  const paragraphs = String(text || '').split(/\n+/);
  let lineCount = 0;
  let maxLineWidth = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);

    if (!words.length) {
      lineCount += 1;
      continue;
    }

    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const candidateWidth =
        context.measureText(candidate).width + Math.max(candidate.length - 1, 0) * fontSize * letterSpacing;

      if (candidateWidth <= maxWidth || currentLine.length === 0) {
        currentLine = candidate;
      } else {
        const lineWidth =
          context.measureText(currentLine).width + Math.max(currentLine.length - 1, 0) * fontSize * letterSpacing;
        maxLineWidth = Math.max(maxLineWidth, lineWidth);
        lineCount += 1;
        currentLine = word;
      }
    }

    const finalLineWidth =
      context.measureText(currentLine).width + Math.max(currentLine.length - 1, 0) * fontSize * letterSpacing;
    maxLineWidth = Math.max(maxLineWidth, finalLineWidth);
    lineCount += 1;
  }

  const lineHeightPx = fontSize * lineHeight;
  const paragraphGap = Math.max(fontSize * 0.38, 10);
  const paragraphCount = Math.max(paragraphs.length - 1, 0);
  const height = lineCount * lineHeightPx + paragraphCount * paragraphGap;

  return {
    lineCount,
    height,
    width: maxLineWidth,
  };
}

function computeAutoFit({ text, format, templateId }) {
  const templateConfig = TEMPLATE_TEXT_CONFIG[templateId]?.[format.id];

  if (!templateConfig) {
    return {
      fits: false,
      fontSize: 28,
      lineHeight: 1.24,
      letterSpacing: -0.004,
      padding: 22,
      metrics: null,
    };
  }

  const areaWidth = format.width * templateConfig.widthRatio;
  const areaHeight = format.height * templateConfig.heightRatio;

  for (let font = templateConfig.maxFont; font >= templateConfig.minFont; font -= 1) {
    const lineHeight = Math.max(1.08, templateConfig.baseLineHeight - (templateConfig.maxFont - font) * 0.0045);
    const letterSpacing = Math.max(-0.024, templateConfig.baseLetterSpacing - (templateConfig.maxFont - font) * 0.00022);
    const padding = Math.max(templateConfig.padding, templateConfig.maxPadding - (templateConfig.maxFont - font) * 1.3);
    const usableWidth = Math.max(areaWidth - padding * 2, areaWidth * 0.62);
    const usableHeight = Math.max(areaHeight - padding * 2, areaHeight * 0.62);

    const metrics = measureWrappedText({
      text,
      maxWidth: usableWidth,
      fontSize: font,
      lineHeight,
      letterSpacing,
    });

    if (metrics.height <= usableHeight && metrics.width <= usableWidth) {
      return {
        fits: true,
        fontSize: font,
        lineHeight,
        letterSpacing,
        padding,
        metrics,
      };
    }
  }

  const fallback = templateConfig.minFont;
  return {
    fits: false,
    fontSize: fallback,
    lineHeight: templateConfig.baseLineHeight,
    letterSpacing: templateConfig.baseLetterSpacing,
    padding: templateConfig.padding,
    metrics: measureWrappedText({
      text,
      maxWidth: areaWidth - templateConfig.padding * 2,
      fontSize: fallback,
      lineHeight: templateConfig.baseLineHeight,
      letterSpacing: templateConfig.baseLetterSpacing,
    }),
  };
}

function resolveTemplateSelection({ text, format, preferredTemplateId }) {
  const tier = getTextTier(text);
  const preferredFit = computeAutoFit({ text, format, templateId: preferredTemplateId });

  if (preferredFit.fits) {
    return {
      tier,
      selectedTemplateId: preferredTemplateId,
      suggestionTemplateId: preferredTemplateId,
      fitResult: preferredFit,
      fallbackUsed: false,
    };
  }

  const candidates = TEMPLATE_SUGGESTIONS[tier] || TEMPLATE_SUGGESTIONS.medium;
  for (const templateId of candidates) {
    const candidateFit = computeAutoFit({ text, format, templateId });
    if (candidateFit.fits) {
      return {
        tier,
        selectedTemplateId: templateId,
        suggestionTemplateId: templateId,
        fitResult: candidateFit,
        fallbackUsed: templateId !== preferredTemplateId,
      };
    }
  }

  const editorialFallback = computeAutoFit({ text, format, templateId: 'card-editorial' });
  return {
    tier,
    selectedTemplateId: 'card-editorial',
    suggestionTemplateId: 'card-editorial',
    fitResult: editorialFallback,
    fallbackUsed: true,
  };
}

function TestimonialArt({
  item,
  coupleName,
  eventName,
  testimonial,
  stars,
  format,
  templateId,
  fit,
  exportId,
  compact,
}) {
  const isStory = format.id === 'story';
  const signatureSize = isStory ? 42 : format.id === 'vertical' ? 36 : 32;
  const metaSize = isStory ? 24 : format.id === 'vertical' ? 21 : 19;
  const avatarSize = isStory ? 150 : format.id === 'vertical' ? 126 : 112;
  const initials = getInitials(coupleName);

  const sharedTextStyle = {
    margin: 0,
    fontWeight: 600,
    fontSize: fit.fontSize,
    lineHeight: fit.lineHeight,
    letterSpacing: `${fit.letterSpacing}em`,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    textWrap: 'pretty',
  };

  return (
    <div
      id={exportId}
      className={compact ? 'w-full' : ''}
      style={{
        position: 'relative',
        margin: '0 auto',
        overflow: 'hidden',
        borderRadius: 36,
        border: '1px solid rgba(255,255,255,0.35)',
        color: '#ffffff',
        width: compact ? '100%' : `${format.width}px`,
        aspectRatio: `${format.width}/${format.height}`,
      }}
    >
      {templateId === 'clean-premium' ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(145deg, #1b0d40 0%, #421c84 42%, #7c2fd0 100%), radial-gradient(circle at 20% 10%, rgba(255,255,255,0.22), transparent 36%)',
          }}
        />
      ) : null}

      {templateId === 'card-editorial' ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 18% 12%, rgba(209, 178, 255, 0.65), transparent 36%), radial-gradient(circle at 85% 82%, rgba(119, 112, 255, 0.45), transparent 38%), linear-gradient(160deg, #0f172a 0%, #2b1954 100%)',
          }}
        />
      ) : null}

      {templateId === 'avatar-card' ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(135deg, #111827 0%, #1f2937 45%, #4c1d95 100%), radial-gradient(circle at 24% 24%, rgba(196,181,253,0.3), transparent 36%)',
          }}
        />
      ) : null}

      {templateId === 'quote-impact' ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(150deg, #070b22 0%, #2a1c5f 48%, #9a2ede 100%), radial-gradient(circle at 80% 18%, rgba(255,255,255,0.18), transparent 36%)',
          }}
        />
      ) : null}

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          height: '100%',
          padding: '7.5% 8%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '2%',
        }}
      >
        {templateId === 'clean-premium' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: metaSize, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>Depoimento real</span>
              <span style={{ fontSize: metaSize, color: 'rgba(255,255,255,0.65)' }}>Harmonics</span>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div
                style={{
                  width: `${TEMPLATE_TEXT_CONFIG['clean-premium'][format.id].widthRatio * 100}%`,
                  minHeight: `${TEMPLATE_TEXT_CONFIG['clean-premium'][format.id].heightRatio * 100}%`,
                  padding: fit.padding,
                  borderRadius: 30,
                  border: '1px solid rgba(255,255,255,0.26)',
                  background: 'rgba(255,255,255,0.12)',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)',
                  display: 'grid',
                  alignItems: 'center',
                }}
              >
                <p style={{ ...sharedTextStyle, textAlign: 'center' }}>{testimonial}</p>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: signatureSize, fontWeight: 650 }}>{coupleName}</p>
              {eventName ? <p style={{ margin: '8px 0 0', fontSize: metaSize, color: 'rgba(255,255,255,0.75)' }}>{eventName}</p> : null}
            </div>
          </>
        ) : null}

        {templateId === 'card-editorial' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: metaSize, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)', fontWeight: 700 }}>Card Editorial</span>
              <span style={{ fontSize: metaSize, color: 'rgba(255,255,255,0.72)' }}>{format.sizeLabel}</span>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <article
                style={{
                  width: `${TEMPLATE_TEXT_CONFIG['card-editorial'][format.id].widthRatio * 100}%`,
                  minHeight: `${TEMPLATE_TEXT_CONFIG['card-editorial'][format.id].heightRatio * 100}%`,
                  padding: fit.padding,
                  borderRadius: 30,
                  background: 'rgba(255,255,255,0.94)',
                  color: '#0f172a',
                  boxShadow: '0 28px 70px rgba(9, 6, 30, 0.38)',
                  display: 'grid',
                  alignItems: 'center',
                }}
              >
                <p style={{ ...sharedTextStyle, color: '#0f172a' }}>{testimonial}</p>
              </article>
            </div>

            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.85)' }}>
              <p style={{ margin: 0, fontSize: signatureSize, fontWeight: 650 }}>{coupleName}</p>
              <p style={{ margin: '8px 0 0', fontSize: metaSize }}>{formatDate(item?.submitted_at)}</p>
            </div>
          </>
        ) : null}

        {templateId === 'avatar-card' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: '50%',
                    background: 'linear-gradient(145deg, #f5f3ff 0%, #ddd6fe 100%)',
                    color: '#4c1d95',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: avatarSize * 0.34,
                    fontWeight: 800,
                    border: '2px solid rgba(255,255,255,0.65)',
                  }}
                >
                  {initials}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: signatureSize * 0.78, fontWeight: 650 }}>{coupleName}</p>
                  <p style={{ margin: '6px 0 0', fontSize: metaSize, color: 'rgba(255,255,255,0.74)' }}>{eventName || 'Cliente Harmonics'}</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
              {stars.map((filled, index) => (
                <span key={index} style={{ lineHeight: 1, fontSize: isStory ? 68 : 56, color: filled ? '#fcd34d' : 'rgba(255,255,255,0.24)' }}>
                  ★
                </span>
              ))}
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div
                style={{
                  width: `${TEMPLATE_TEXT_CONFIG['avatar-card'][format.id].widthRatio * 100}%`,
                  minHeight: `${TEMPLATE_TEXT_CONFIG['avatar-card'][format.id].heightRatio * 100}%`,
                  padding: fit.padding,
                  borderRadius: 28,
                  border: '1px solid rgba(255,255,255,0.22)',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'grid',
                  alignItems: 'center',
                }}
              >
                <p style={{ ...sharedTextStyle }}>{testimonial}</p>
              </div>
            </div>
          </>
        ) : null}

        {templateId === 'quote-impact' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: metaSize, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Quote Impact</span>
              <span style={{ fontSize: metaSize, color: 'rgba(255,255,255,0.62)' }}>★★★★★</span>
            </div>

            <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              <div style={{ width: `${TEMPLATE_TEXT_CONFIG['quote-impact'][format.id].widthRatio * 100}%`, textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: isStory ? 168 : 130, lineHeight: 0.66, color: 'rgba(255,255,255,0.22)', fontWeight: 800 }}>“</p>
                <div
                  style={{
                    minHeight: `${TEMPLATE_TEXT_CONFIG['quote-impact'][format.id].heightRatio * 100}%`,
                    padding: fit.padding,
                  }}
                >
                  <p style={{ ...sharedTextStyle, textAlign: 'center' }}>{testimonial}</p>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: signatureSize, fontWeight: 650 }}>{coupleName}</p>
              <p style={{ margin: '8px 0 0', fontSize: metaSize, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)' }}>
                {formatDate(item?.submitted_at)}
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ScaledPreviewStage({ format, children }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.32);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const updateScale = () => {
      const container = containerRef.current;
      if (!container) return;

      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
      const maxWidth = Math.max(container.clientWidth - 28, 220);
      const maxHeight = Math.max(Math.min(viewportHeight * 0.58, 560), 340);
      const nextScale = Math.min(maxWidth / format.width, maxHeight / format.height, 1);

      setScale(Number.isFinite(nextScale) ? Math.max(nextScale, 0.12) : 0.32);
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(containerRef.current);
    window.addEventListener('resize', updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [format.height, format.width]);

  const scaledWidth = Math.round(format.width * scale);
  const scaledHeight = Math.round(format.height * scale);

  return (
    <div ref={containerRef} className="flex min-h-[420px] items-center justify-center">
      <div style={{ width: scaledWidth, height: scaledHeight }}>
        <div
          style={{
            width: format.width,
            height: format.height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
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
  const [templateMode, setTemplateMode] = useState('auto');
  const [manualTemplateId, setManualTemplateId] = useState(TEMPLATE_OPTIONS[0].id);
  const [generatedImage, setGeneratedImage] = useState('');
  const [generationError, setGenerationError] = useState('');

  const coupleName = useMemo(() => getCoupleName(item), [item]);
  const eventName = item?.event_title || item?.event_name || '';
  const testimonial = item?.testimonial?.trim() || 'Uma experiência incrível do começo ao fim. Recomendo demais!';
  const exportElementId = `depoimento-art-${item?.id || coupleName.replace(/\s+/g, '-').toLowerCase()}`;

  const stars = getStarsArray(item?.rating);
  const selectedFormat = ART_FORMATS.find((format) => format.id === selectedFormatId) || ART_FORMATS[0];

  const autoDecision = useMemo(() => {
    return resolveTemplateSelection({
      text: testimonial,
      format: selectedFormat,
      preferredTemplateId: manualTemplateId,
    });
  }, [manualTemplateId, selectedFormat, testimonial]);

  const activeTemplateId = templateMode === 'auto' ? autoDecision.selectedTemplateId : manualTemplateId;
  const activeFit = useMemo(() => {
    if (templateMode === 'auto') return autoDecision.fitResult;
    return computeAutoFit({ text: testimonial, format: selectedFormat, templateId: manualTemplateId });
  }, [autoDecision.fitResult, manualTemplateId, selectedFormat, templateMode, testimonial]);

  const manualSuggestion = useMemo(() => {
    if (activeFit.fits || templateMode === 'auto') return '';
    const suggested = TEMPLATE_OPTIONS.find((option) => option.id === autoDecision.suggestionTemplateId);
    return suggested?.label || 'Card Editorial';
  }, [activeFit.fits, autoDecision.suggestionTemplateId, templateMode]);

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
    if (templateMode === 'manual' && !activeFit.fits) {
      showToast?.('Este template não comporta todo o texto. Use a sugestão automática.', 'error');
      return;
    }

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

  function openExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function openModal() {
    setModalOpen(true);
    setGenerationStatus('idle');
    setGeneratedImage('');
    setGenerationError('');
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
              templateId={autoDecision.selectedTemplateId}
              fit={resolveTemplateSelection({
                text: testimonial,
                format: ART_FORMATS[1],
                preferredTemplateId: autoDecision.selectedTemplateId,
              }).fitResult}
              exportId={`${exportElementId}-list`}
              compact
            />
          </div>

          <div className="space-y-3 text-xs text-slate-500">
            <p className="font-semibold uppercase tracking-[0.15em] text-violet-600">
              Sugestão: {(TEMPLATE_OPTIONS.find((template) => template.id === autoDecision.selectedTemplateId) || TEMPLATE_OPTIONS[0]).label}
            </p>
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
                <h3 className="text-2xl font-extrabold text-slate-900">Templates adaptáveis para redes</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
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
                      {format.label}{' '}
                      <span className="text-xs opacity-80">
                        ({format.ratioLabel} · {format.sizeLabel})
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTemplateMode('auto')}
                    className={classNames(
                      'rounded-xl border px-3 py-2 text-sm font-semibold transition',
                      templateMode === 'auto'
                        ? 'border-violet-400 bg-violet-100 text-violet-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    Sugestão automática
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateMode('manual')}
                    className={classNames(
                      'rounded-xl border px-3 py-2 text-sm font-semibold transition',
                      templateMode === 'manual'
                        ? 'border-violet-400 bg-violet-100 text-violet-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    Escolher manualmente
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {TEMPLATE_OPTIONS.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        setManualTemplateId(template.id);
                        setTemplateMode('manual');
                        handleResetPreview();
                      }}
                      className={classNames(
                        'rounded-xl border px-3 py-2 text-left text-sm transition',
                        manualTemplateId === template.id
                          ? 'border-violet-400 bg-violet-50 text-violet-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <p className="font-semibold">{template.label}</p>
                      <p className="text-xs opacity-80">{template.idealFor}</p>
                    </button>
                  ))}
                </div>

                <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-4">
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
                      templateId={activeTemplateId}
                      fit={activeFit}
                      exportId={exportElementId}
                    />
                  </div>
                  <ScaledPreviewStage format={selectedFormat}>
                    <TestimonialArt
                      item={item}
                      coupleName={coupleName}
                      eventName={eventName}
                      testimonial={testimonial}
                      stars={stars}
                      format={selectedFormat}
                      templateId={activeTemplateId}
                      fit={activeFit}
                      exportId={`${exportElementId}-preview`}
                    />
                  </ScaledPreviewStage>
                </div>
                <p className="text-xs font-semibold text-slate-500">
                  Preview proporcional: {selectedFormat.label} ({selectedFormat.ratioLabel}) · Exportação real em {selectedFormat.sizeLabel}.
                </p>
              </div>

              <aside className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                <p className="text-sm font-bold text-slate-700">
                  Template ativo:{' '}
                  {(TEMPLATE_OPTIONS.find((template) => template.id === activeTemplateId) || TEMPLATE_OPTIONS[0]).label}
                </p>
                <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
                  Perfil do texto: {autoDecision.tier === 'short' ? 'curto' : autoDecision.tier === 'medium' ? 'médio' : 'longo'}.
                  Sugestão automática: {(TEMPLATE_OPTIONS.find((template) => template.id === autoDecision.suggestionTemplateId) || TEMPLATE_OPTIONS[0]).label}.
                </p>

                {templateMode === 'manual' && !activeFit.fits ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    Este modelo não acomoda o texto completo sem comprometer o layout. Sugestão: {manualSuggestion}.
                    <button
                      type="button"
                      onClick={() => {
                        setManualTemplateId(autoDecision.suggestionTemplateId);
                        handleResetPreview();
                      }}
                      className="mt-2 block rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-amber-900"
                    >
                      Aplicar sugestão
                    </button>
                  </div>
                ) : null}

                <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-violet-700">Fluxo de postagem</p>
                  <ol className="mt-2 space-y-1 text-xs font-medium text-violet-900">
                    <li>1. Definir formato e template</li>
                    <li>2. Gerar arte</li>
                    <li>3. Baixar imagem</li>
                    <li>4. Copiar legenda</li>
                    <li>5. Publicar</li>
                  </ol>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateImage}
                  disabled={generationStatus === 'loading' || (templateMode === 'manual' && !activeFit.fits)}
                  className="w-full rounded-xl border border-violet-300 bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {generationStatus === 'loading' ? 'Gerando arte...' : 'Gerar arte'}
                </button>

                {generationStatus === 'error' && generationError ? (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    Falha técnica: {generationError}
                  </p>
                ) : null}

                {generationStatus === 'done' && generatedImage ? (
                  <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-emerald-700">
                      Publicação pronta
                    </p>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="w-full rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-200"
                    >
                      {downloadStatus === 'done'
                        ? 'Baixado com sucesso ✓'
                        : selectedFormat.id === 'story'
                          ? 'Baixar story'
                          : 'Baixar post'}
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
                      onClick={() => openExternal(INSTAGRAM_CREATE_URL)}
                      className="w-full rounded-xl border border-fuchsia-300 bg-fuchsia-50 px-4 py-2.5 text-sm font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100"
                    >
                      Abrir Instagram
                    </button>
                    <button
                      type="button"
                      onClick={() => openExternal(META_BUSINESS_SUITE_URL)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Abrir Meta Business Suite
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
                    Gere a arte para liberar o fluxo completo de postagem: baixar, copiar legenda e abrir Instagram.
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleResetPreview}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Gerar outra versão
                </button>

                <button
                  type="button"
                  onClick={() => openExternal(INSTAGRAM_URL)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Abrir Instagram web
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
