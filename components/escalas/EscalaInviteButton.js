'use client';

import { canResendInvite, formatInviteSentDate } from '../../lib/escalas/escalas-invite';

export default function EscalaInviteButton({ escala, onEnviarConvite, enviando = false }) {
  const hasEmail = !!escala.musician_email;
  const wasSent = !!escala.invite_sent_at;
  const canResend = canResendInvite(escala);

  // Não exibir se não tem email
  if (!hasEmail) {
    return (
      <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-700">
        ⚠️ Músico sem email
      </div>
    );
  }

  // Já enviado e não pode reenviar ainda
  if (wasSent && !canResend) {
    return (
      <div className="flex flex-col gap-1">
        <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-[12px] font-bold text-emerald-700">
          ✓ Convite enviado
        </div>
        <div className="text-[11px] text-slate-500">
          {formatInviteSentDate(escala.invite_sent_at)}
        </div>
      </div>
    );
  }

  // Pode reenviar
  if (wasSent && canResend) {
    return (
      <button
        type="button"
        onClick={() => onEnviarConvite(escala.id)}
        disabled={enviando}
        className="rounded-[16px] border border-violet-200 bg-violet-50 px-4 py-2 text-[13px] font-black text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
      >
        {enviando ? 'Reenviando...' : '🔄 Reenviar convite'}
      </button>
    );
  }

  // Nunca enviou
  return (
    <button
      type="button"
      onClick={() => onEnviarConvite(escala.id)}
      disabled={enviando}
      className="rounded-[16px] border border-violet-200 bg-violet-600 px-4 py-2 text-[13px] font-black text-white transition hover:bg-violet-700 disabled:opacity-50"
    >
      {enviando ? 'Enviando...' : '📧 Enviar convite'}
    </button>
  );
}
