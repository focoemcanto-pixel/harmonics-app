'use client';

import { useState } from 'react';
import { canResendInvite, formatInviteSentDate } from '../../lib/escalas/escalas-invite';

export default function EscalaInviteButton({ escala, onInviteSent }) {
  const [sending, setSending] = useState(false);

  const hasEmail = !!escala.musician_email;
  const wasSent = !!escala.invite_sent_at;
  const canResend = canResendInvite(escala);

  async function handleSend() {
    if (!hasEmail) {
      alert('Músico não possui email cadastrado. Atualize o contato antes de enviar o convite.');
      return;
    }

    if (wasSent && !canResend) {
      alert('Aguarde 24h após o último envio para reenviar o convite.');
      return;
    }

    const confirmMessage = wasSent
      ? 'Reenviar convite para este músico?'
      : 'Enviar convite por email para este músico?';

    if (!confirm(confirmMessage)) return;

    setSending(true);

    try {
      const response = await fetch('/api/escalas/enviar-convite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalaId: escala.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar convite');
      }

      alert('Convite enviado com sucesso! ✅');

      if (onInviteSent) {
        onInviteSent(escala.id);
      }
    } catch (error) {
      console.error('Erro ao enviar convite:', error);
      alert('Erro ao enviar convite: ' + error.message);
    } finally {
      setSending(false);
    }
  }

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
        onClick={handleSend}
        disabled={sending}
        className="rounded-[16px] border border-violet-200 bg-violet-50 px-4 py-2 text-[13px] font-black text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
      >
        {sending ? 'Reenviando...' : '🔄 Reenviar convite'}
      </button>
    );
  }

  // Nunca enviou
  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={sending}
      className="rounded-[16px] border border-violet-200 bg-violet-600 px-4 py-2 text-[13px] font-black text-white transition hover:bg-violet-700 disabled:opacity-50"
    >
      {sending ? 'Enviando...' : '📧 Enviar convite'}
    </button>
  );
}
