'use client';

import { useEffect, useState } from 'react';

export default function OnboardingCelebrationToast({
  open = false,
  title = 'Etapa concluída!',
  description = 'Seu onboarding avançou.',
  nextStep = null,
  duration = 5200,
  onClose,
}) {
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    setVisible(open);
  }, [open]);

  useEffect(() => {
    if (!visible) return undefined;

    const timer = window.setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [duration, onClose, visible]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[260] w-[min(92vw,420px)] animate-[fadeIn_.24s_ease]">
      <div className="pointer-events-auto overflow-hidden rounded-[28px] border border-emerald-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)] shadow-[0_24px_70px_rgba(16,185,129,0.20)]">
        <div className="flex items-start gap-4 p-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[26px] shadow-[0_12px_30px_rgba(16,185,129,0.30)]">
            ✨
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">
              Onboarding atualizado
            </div>

            <h3 className="mt-1 text-[20px] font-black tracking-[-0.04em] text-[#111827]">
              {title}
            </h3>

            <p className="mt-2 text-[14px] font-semibold leading-6 text-[#4b5563]">
              {description}
            </p>

            {nextStep ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-white/80 px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">
                  Próximo passo
                </div>
                <div className="mt-1 text-[13px] font-semibold leading-6 text-[#374151]">
                  {nextStep}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
