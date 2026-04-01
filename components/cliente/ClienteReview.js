'use client';

import { useState } from 'react';

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
  const [error, setError] = useState('');

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
