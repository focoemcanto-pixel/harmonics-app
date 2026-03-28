'use client';

import Link from 'next/link';

function getToneClasses(tone) {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-100 text-emerald-700';
    case 'amber':
      return 'bg-amber-100 text-amber-800';
    case 'red':
      return 'bg-red-100 text-red-700';
    case 'violet':
      return 'bg-violet-100 text-violet-700';
    case 'blue':
      return 'bg-sky-100 text-sky-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function Pill({ tone = 'default', children }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${getToneClasses(
        tone
      )}`}
    >
      {children}
    </span>
  );
}

function getPaymentTone(paymentStatus) {
  if (paymentStatus === 'Pago') return 'emerald';
  if (paymentStatus === 'Parcial') return 'amber';
  if (paymentStatus === 'Pendente') return 'red';
  return 'default';
}

function getOperationalTone(status) {
  const value = String(status || '').trim().toLowerCase();

  if (value === 'executado' || value === 'done') return 'blue';
  if (value === 'confirmado' || value === 'confirmed') return 'emerald';
  if (value === 'rascunho' || value === 'draft') return 'amber';
  if (value === 'cancelado' || value === 'cancelled') return 'red';

  return 'default';
}

function formatOperationalStatus(status) {
  const value = String(status || '').trim().toLowerCase();

  if (!value) return 'Rascunho';
  if (value === 'draft') return 'Rascunho';
  if (value === 'confirmed') return 'Confirmado';
  if (value === 'cancelled') return 'Cancelado';
  if (value === 'done') return 'Executado';
  if (value === 'rascunho') return 'Rascunho';
  if (value === 'confirmado') return 'Confirmado';
  if (value === 'cancelado') return 'Cancelado';
  if (value === 'executado') return 'Executado';

  return status;
}

function formatPaymentStatus(paymentStatus) {
  const value = String(paymentStatus || '').trim().toLowerCase();

  if (!value) return 'Pendente';
  if (value === 'pending') return 'Pendente';
  if (value === 'partial') return 'Parcial';
  if (value === 'paid') return 'Pago';

  return paymentStatus;
}

export default function AdminEventCard({
  id,
  cliente,
  tipo,
  data,
  hora,
  local,
  formacao,
  receptivo,
  temSom,
  whatsappNome,
  whatsappNumero,
  observacoes,
  valorAcertado,
  valorPago,
  valorAberto,
  lucroFinal,
  paymentStatus,
  operationalStatus,
  timelineText,
  timelineTone,
  contractLink,
  onEdit,
  onDelete,
  flat = false,
}) {
  const phoneDigits = String(whatsappNumero || '').replace(/\D/g, '');
  const whatsappHref = phoneDigits
    ? `https://wa.me/55${phoneDigits}`
    : null;

  return (
    <article className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.04)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:justify-between">

        {/* HEADER */}
        <div>
          <div className="text-[20px] font-black">{cliente}</div>
          <div className="text-sm text-slate-500">{tipo}</div>

          <div className="mt-3 text-sm">
            {data} • {hora} • {local}
          </div>

          <div className="mt-2 text-sm">
            {formacao} • {receptivo} • {temSom ? 'Som' : 'Sem som'}
          </div>
        </div>

        {/* STATUS */}
        <div className="flex gap-2 flex-wrap">
          {timelineText && (
            <Pill tone={timelineTone}>{timelineText}</Pill>
          )}

          <Pill tone={getOperationalTone(operationalStatus)}>
            {formatOperationalStatus(operationalStatus)}
          </Pill>

          <Pill tone={getPaymentTone(paymentStatus)}>
            {formatPaymentStatus(paymentStatus)}
          </Pill>
        </div>
      </div>

      {/* VALORES */}
      <div className="mt-5 text-sm space-y-1">
        <div>Acertado: {valorAcertado}</div>
        <div>Pago: {valorPago}</div>
        <div className="text-amber-600">Aberto: {valorAberto}</div>
        <div className="text-emerald-600">Lucro: {lucroFinal}</div>
      </div>

      {/* AÇÕES */}
      <div className="mt-5 flex flex-wrap gap-2">

        {/* 👇 BOTÃO ESCALA (NOVO) */}
        <Link
          href={`/eventos/${id}?tab=escala`}
          className="rounded-[16px] bg-violet-600 px-4 py-3 text-[14px] font-black text-white shadow"
        >
          Escala
        </Link>

        <Link
          href={`/eventos/${id}`}
          className="rounded-[16px] border px-4 py-3 text-sm font-black"
        >
          Detalhes
        </Link>

        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            className="rounded-[16px] border px-4 py-3 text-sm font-black"
          >
            WhatsApp
          </a>
        )}

        <button
          onClick={onEdit}
          className="rounded-[16px] border px-4 py-3 text-sm font-black"
        >
          Editar
        </button>

        <button
          onClick={onDelete}
          className="rounded-[16px] bg-red-600 px-4 py-3 text-sm font-black text-white"
        >
          Excluir
        </button>

      </div>
    </article>
  );
}
