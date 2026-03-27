'use client';

import { useState } from 'react';
import { useToast } from '../ui/ToastProvider';

export default function ClienteReview({ data }) {
  const { showToast } = useToast();

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(data.reviewSubmitted);

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#f8f4ef] px-4 py-6">
        <div className="mx-auto max-w-[520px]">
          <div className="rounded-[30px] border border-[#eadfd6] bg-white p-6 text-center shadow-[0_16px_40px_rgba(36,26,20,0.06)]">
            <div className="text-4xl">💜</div>
            <div className="mt-4 text-[24px] font-black text-[#241a14]">
              Obrigado pelo seu feedback!
            </div>
            <div className="mt-3 text-[14px] leading-6 text-[#6f5d51]">
              Foi uma alegria fazer parte desse momento tão especial.
              Sua avaliação é muito importante para nós.
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f4ef] px-4 py-6">
      <div className="mx-auto max-w-[520px] space-y-4">

        {/* HERO */}
        <div className="rounded-[30px] border border-[#eadfd6] bg-white p-6 text-center shadow-[0_16px_40px_rgba(36,26,20,0.06)]">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
            Obrigado pela confiança
          </div>

          <div className="mt-4 text-[22px] font-black text-[#241a14]">
            Como foi sua experiência?
          </div>

          <div className="mt-3 text-[14px] leading-6 text-[#6f5d51]">
            Foi uma honra fazer parte do seu evento.
            Se puder, deixe sua avaliação e conte como foi esse momento pra você 💜
          </div>
        </div>

        {/* ESTRELAS */}
        <div className="rounded-[24px] border border-[#eadfd6] bg-white p-6 text-center">
          <div className="text-[14px] font-bold text-[#7a6a5e]">
            Sua avaliação
          </div>

          <div className="mt-4 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                className="text-[32px] transition-transform active:scale-110"
              >
                {(hover || rating) >= star ? '⭐' : '☆'}
              </button>
            ))}
          </div>
        </div>

        {/* TEXTO */}
        <div className="rounded-[24px] border border-[#eadfd6] bg-white p-6">
          <div className="text-[14px] font-bold text-[#7a6a5e]">
            Conte como foi
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex: Foi tudo perfeito, emocionante..."
            rows={5}
            className="mt-4 w-full rounded-[16px] border border-[#eadfd6] px-4 py-3 text-[14px] outline-none"
          />
        </div>

        {/* BOTÃO */}
        <button
          onClick={() => {
            if (!rating) {
              showToast('Selecione uma nota antes de enviar', 'warning');
              return;
            }

            if (!text.trim()) {
              showToast('Escreva sua experiência antes de enviar', 'warning');
              return;
            }

            // MOCK — depois aqui vai salvar no backend real
setSubmitted(true);

            showToast('Avaliação enviada com sucesso 💜', 'success');
          }}
          className="w-full rounded-[22px] bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] px-4 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.24)]"
        >
          Enviar avaliação
        </button>

      </div>
    </main>
  );
}