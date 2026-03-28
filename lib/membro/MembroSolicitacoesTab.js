'use client';

import {
  addHoursToTime,
  formatDateBR,
  getInviteTone,
} from '../../lib/membro/membro-invites';

function EmptyState() {
  return (
    <div className="rounded-[26px] border border-dashed border-white/10 bg-white/5 px-5 py-8 text-center text-white">
      <div className="text-[18px] font-black">Nenhuma solicitação pendente</div>
      <p className="mt-2 text-[15px] leading-7 text-white/60">
        Quando você receber novos convites de escala, eles aparecem aqui.
      </p>
    </div>
  );
}

function SolicitationCard({
  item,
  onAccept,
  onDecline,
  loadingKey,
}) {
  const tone = getInviteTone(item.inviteStatus);
  const keyAccept = `${item.id}:accept`;
  const keyDecline = `${item.id}:decline`;
  const chegada = addHoursToTime(item.eventTime, -2);

  return (
    <article className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-[12px] font-black uppercase tracking-[0.12em] text-violet-200/80">
            Solicitação de escala
          </div>

          <h3 className="mt-2 text-[24px] font-black tracking-[-0.04em]">
            {item.clientName}
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${tone.badge}`}>
              {tone.label}
            </span>

            {item.suggestedRoleName ? (
              <span className="inline-flex rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-violet-100">
                {item.suggestedRoleName}
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-[20px] border border-white/10 bg-black/10 px-4 py-3 text-[13px] font-semibold text-white/70">
          Enviado em {item.sentAt ? new Date(item.sentAt).toLocaleDateString('pt-BR') : '-'}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
            Data e hora
          </div>
          <div className="mt-2 text-[15px] font-semibold">
            {formatDateBR(item.eventDate)} • {String(item.eventTime || '--:--').slice(0, 5)}
          </div>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
            Horário de chegada
          </div>
          <div className="mt-2 text-[15px] font-semibold">
            {chegada}
          </div>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
            Local
          </div>
          <div className="mt-2 text-[15px] font-semibold">
            {item.locationName || '-'}
          </div>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
            Formação
          </div>
          <div className="mt-2 text-[15px] font-semibold">
            {item.formation || '-'}
          </div>
        </div>
      </div>

      {item.instruments ? (
        <div className="mt-4 rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
            Instrumentos esperados
          </div>
          <div className="mt-2 text-[14px] leading-7 text-white/85">
            {item.instruments}
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onAccept(item)}
          disabled={loadingKey === keyAccept || !!loadingKey}
          className="rounded-[18px] bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-4 text-[15px] font-black text-white shadow-[0_14px_28px_rgba(16,185,129,0.25)] disabled:opacity-60"
        >
          {loadingKey === keyAccept ? 'Aceitando...' : 'Aceitar'}
        </button>

        <button
          type="button"
          onClick={() => onDecline(item)}
          disabled={loadingKey === keyDecline || !!loadingKey}
          className="rounded-[18px] bg-gradient-to-r from-rose-500 to-red-500 px-5 py-4 text-[15px] font-black text-white shadow-[0_14px_28px_rgba(239,68,68,0.22)] disabled:opacity-60"
        >
          {loadingKey === keyDecline ? 'Recusando...' : 'Recusar'}
        </button>
      </div>
    </article>
  );
}

export default function MembroSolicitacoesTab({
  pendentes,
  onAccept,
  onDecline,
  loadingKey,
}) {
  return (
    <section className="space-y-4">
      <div>
        <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-200/70">
          Convites
        </div>
        <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-white">
          Solicitações pendentes
        </h2>
      </div>

      {pendentes.length === 0 ? (
        <EmptyState />
      ) : (
        pendentes.map((item) => (
          <SolicitationCard
            key={item.id}
            item={item}
            onAccept={onAccept}
            onDecline={onDecline}
            loadingKey={loadingKey}
          />
        ))
      )}
    </section>
  );
}
