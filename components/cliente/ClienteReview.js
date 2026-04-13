'use client';

import { useRef, useState } from 'react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function StarButton({ active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        'text-[32px] transition',
        active ? 'scale-110' : 'opacity-60 hover:opacity-100'
      )}
    >
      ⭐
    </button>
  );
}

async function nodeToPngDataUrl(node) {
  const clonedNode = node.cloneNode(true);
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const scale = 3;

  clonedNode.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="transform: scale(${scale}); transform-origin: top left; width:${width}px; height:${height}px;">
          ${new XMLSerializer().serializeToString(clonedNode)}
        </div>
      </foreignObject>
    </svg>
  `;

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = blobUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas indisponível para gerar a imagem.');
    }

    context.drawImage(image, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export default function ClienteReview({ data, token }) {
  const [rating, setRating] = useState(data?.existingReview?.rating || 0);
  const [testimonial, setTestimonial] = useState(
    data?.existingReview?.testimonial || ''
  );
  const [wouldRecommend, setWouldRecommend] = useState(
    data?.existingReview?.wouldRecommend ?? true
  );
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(Boolean(data?.reviewSubmitted));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const exportCardRef = useRef(null);

  async function handleSubmit() {
    try {
      setSaving(true);
      setError('');

      const response = await fetch('/api/client/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          rating,
          testimonial,
          would_recommend: wouldRecommend,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Não foi possível enviar sua avaliação.');
      }

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Erro ao enviar avaliação.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExportImage() {
    if (!exportCardRef.current) return;

    try {
      setExporting(true);
      const imageDataUrl = await nodeToPngDataUrl(exportCardRef.current);
      const link = document.createElement('a');
      link.download = `depoimento-harmonics-${Date.now()}.png`;
      link.href = imageDataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      setError('Não foi possível exportar o card como imagem.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f4ef] px-4 py-6 text-[#241a14]">
      <div className="mx-auto w-full max-w-[560px] space-y-4">
        <section className="overflow-hidden rounded-[30px] border border-[#2f2231] bg-[linear-gradient(135deg,#1e1723_0%,#2d1c4b_52%,#5b21b6_100%)] px-5 py-6 text-white shadow-[0_16px_50px_rgba(37,25,52,0.24)]">
          <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/90">
            Pós-evento
          </div>

          <div className="mt-4 text-[28px] font-black leading-tight">
            Obrigado por viver esse momento com a Harmonics
          </div>

          <div className="mt-3 text-[15px] leading-7 text-white/85">
            Sua opinião é muito importante para nós. Ela nos ajuda a melhorar e
            também inspira outros noivos a conhecerem nosso trabalho.
          </div>

          <div className="mt-5 rounded-[22px] border border-white/10 bg-white/8 p-4">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/70">
              Evento
            </div>
            <div className="mt-1 text-[18px] font-black">{data?.eventoTitulo}</div>
            <div className="mt-2 text-[14px] text-white/80">
              Cliente: {data?.clienteNome}
            </div>
            <div className="mt-1 text-[14px] text-white/80">
              Data: {data?.eventoData || '—'}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#eadfd6] bg-white p-5 shadow-[0_10px_30px_rgba(36,26,20,0.06)]">
          {submitted ? (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-[42px]">💜</div>
                <div className="mt-4 text-[24px] font-black text-[#241a14]">
                  Avaliação enviada com sucesso
                </div>
                <div className="mt-3 text-[15px] leading-7 text-[#6f5d51]">
                  Muito obrigado pelo carinho e pela confiança. Foi uma alegria
                  fazer parte desse momento tão especial.
                </div>
              </div>

              <div
                ref={exportCardRef}
                className="overflow-hidden rounded-[26px] border border-[#e8dff7] bg-[radial-gradient(circle_at_top,#ffffff_0%,#f4ecff_45%,#ebddff_100%)] p-5 shadow-[0_16px_50px_rgba(91,33,182,0.22)]"
              >
                <div className="inline-flex items-center rounded-full border border-[#d8c1ff] bg-white/70 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#5b21b6]">
                  Harmonics
                </div>
                <div className="mt-4 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#7c5db0]">
                  Nome dos noivos
                </div>
                <div className="text-[24px] font-black leading-tight text-[#25123f]">
                  {data?.clienteNome || 'Noivos Harmonics'}
                </div>

                <div className="mt-4 text-[22px] text-[#f59e0b]">
                  {'★'.repeat(Math.max(rating, 1))}
                  <span className="text-[#d5c3f3]">
                    {'★'.repeat(Math.max(0, 5 - Math.max(rating, 1)))}
                  </span>
                </div>

                <blockquote className="mt-4 rounded-[20px] border border-white/70 bg-white/75 px-4 py-4 text-[16px] font-semibold leading-7 text-[#3f2d56]">
                  “
                  {testimonial?.trim() ||
                    'Uma experiência inesquecível. Obrigado por tornarem nosso dia ainda mais especial!'}
                  ”
                </blockquote>

                <div className="mt-4 text-right text-[12px] font-bold uppercase tracking-[0.06em] text-[#7c5db0]">
                  @harmonics.app
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportImage}
                disabled={exporting}
                className="flex w-full items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] px-4 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? 'Gerando imagem...' : 'Exportar como imagem'}
              </button>

              {error ? (
                <div className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-bold text-red-700">
                  {error}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="text-[22px] font-black text-[#241a14]">
                Como você avalia sua experiência?
              </div>

              <div className="mt-4 flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <StarButton
                    key={value}
                    active={value <= rating}
                    onClick={() => setRating(value)}
                  />
                ))}
              </div>

              <div className="mt-6">
                <label className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
                  Seu comentário
                </label>
                <textarea
                  rows={5}
                  value={testimonial}
                  onChange={(e) => setTestimonial(e.target.value)}
                  placeholder="Conte como foi sua experiência com a Harmonics..."
                  className="mt-2 w-full rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4 text-[15px] font-semibold text-[#241a14] outline-none"
                />
              </div>

              <div className="mt-5 rounded-[18px] border border-[#eadfd6] bg-[#faf7f3] px-4 py-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={wouldRecommend}
                    onChange={(e) => setWouldRecommend(e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-[14px] font-semibold text-[#241a14]">
                    Eu recomendaria a Harmonics para outros noivos.
                  </span>
                </label>
              </div>

              {error ? (
                <div className="mt-4 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-bold text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || rating < 1}
                className="mt-5 flex w-full items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] px-4 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Enviando avaliação...' : 'Enviar avaliação'}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
