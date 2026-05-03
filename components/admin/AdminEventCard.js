'use client';

import { memo } from 'react';
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
  if (value === 'pendente') return 'Pendente';
  if (value === 'parcial') return 'Parcial';
  if (value === 'pago') return 'Pago';

  return paymentStatus;
}

function formatContractLabel(contractLabel) {
  const value = String(contractLabel || '').trim().toLowerCase();

  if (!value) return '';
  if (value === 'contrato assinado') return 'Assinado';
  if (value === 'preenchendo contrato') return 'Preenchendo';
  if (value === 'link do contrato gerado') return 'Link gerado';
  if (value === 'sem contrato') return 'Sem contrato';
  if (value === 'gerando contrato...') return 'Gerando contrato';

  return contractLabel;
}

function getScaleStatus(totalScale, confirmedScale) {
  const total = Number(totalScale || 0);
  const confirmed = Number(confirmedScale || 0);

  if (total === 0) return 'empty';
  if (confirmed < total) return 'partial';
  return 'complete';
}

function parseEventDate(value) {
  if (!value) return null;
  const raw = String(value);
  const [year, month, day] = raw.split('T')[0].split('-').map(Number);

  if (
    Number.isFinite(year) &&
    Number.isFinite(month) &&
    Number.isFinite(day)
  ) {
    return new Date(year, month - 1, day);
  }

  const fallbackDate = new Date(raw);
  if (Number.isNaN(fallbackDate.getTime())) return null;
  return fallbackDate;
}

function isSettledPaymentStatus(paymentStatus) {
  const value = String(paymentStatus || '').trim().toLowerCase();
  return value === 'paid' || value === 'pago';
}

function AdminEventCard({
  id,
  cliente,
  tipo,
  data,
  hora,
  local,
  formacao,
  receptivo,
  antesala,
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
  totalMusicians = 0,
  confirmedMusicians = 0,
  contractLabel,
  contractTone,
  contractLink,
  onEdit,
  onDelete,
  onOpenEscala,
  onOpenContract,
  onCopyContractLink,
  gerandoContrato = false,
  excluindo = false,
  flat = false,
  selectable = false,
  selected = false,
  onToggleSelect,
  event,
}) {
  const phoneDigits = String(whatsappNumero || '').replace(/\D/g, '');
  const whatsappHref = phoneDigits
    ? `https://wa.me/55${phoneDigits}`
    : null;

  const contractButtonLabel = gerandoContrato
    ? 'Gerando contrato...'
    : contractLink
    ? 'Abrir contrato'
    : 'Gerar contrato';
  const eventMusicians = Array.isArray(event?.event_musicians)
    ? event.event_musicians
    : [];
  const totalScale =
    eventMusicians.length ||
    Number(event?.scale_count) ||
    Number(totalMusicians) ||
    0;
  const confirmedScale =
    eventMusicians.filter((item) => item?.status === 'confirmed').length ||
    Number(event?.confirmed_scale_count) ||
    Number(confirmedMusicians) ||
    0;
  const scaleStatus = getScaleStatus(totalScale, confirmedScale);
  const eventDate = parseEventDate(event?.event_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPastEvent = !!eventDate && eventDate < today;
  const isPaidEvent = isSettledPaymentStatus(paymentStatus);
  const isConcludedEvent = isPastEvent && isPaidEvent;
  const isPendingPostEvent = isPastEvent && !isPaidEvent;
  const visualStateClasses = flat
    ? ''
    : isConcludedEvent
    ? ' border-green-500 shadow-[0_0_0_1px_rgba(34,197,94,0.2)]'
    : isPendingPostEvent
    ? ' border-amber-400 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]'
    : '';

  return (
    <article
      className={
        flat
          ? 'rounded-[22px] border-0 bg-transparent p-0 shadow-none'
          : `rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.04)]${visualStateClasses}`
      }
    >
      <div className={flat ? 'space-y-4' : ''}>
        {selectable ? (
          <div className="mb-2 flex items-center justify-end">
            <label className="inline-flex items-center gap-2 rounded-[12px] border border-[#dbe3ef] bg-white/90 px-3 py-2 text-[12px] font-black text-[#334155]">
              <input
                type="checkbox"
                checked={selected}
                onChange={(event) => {
                  event.stopPropagation();
                  onToggleSelect?.(event.target.checked);
                }}
                className="h-4 w-4 rounded border-[#cbd5e1] text-violet-600 focus:ring-violet-500"
              />
              Selecionar
            </label>
          </div>
        ) : null}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="text-[20px] font-black tracking-[-0.03em] text-[#0f172a]">
              {cliente}
            </div>
            <div className="mt-1 text-[14px] font-semibold text-[#64748b]">
              {tipo || 'Evento'}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {timelineText ? (
              <Pill tone={timelineTone || 'default'}>{timelineText}</Pill>
            ) : null}

            {isConcludedEvent ? <Pill tone="emerald">Concluído</Pill> : null}

            {isPendingPostEvent ? (
              <Pill tone="amber">Pós-evento pendente</Pill>
            ) : null}

            <Pill tone={getOperationalTone(operationalStatus)}>
              {`Status: ${formatOperationalStatus(operationalStatus)}`}
            </Pill>

            {scaleStatus === 'empty' ? (
              <Pill tone="red">Escala pendente</Pill>
            ) : null}

            {scaleStatus === 'partial' ? (
              <Pill tone="amber">Escala parcial</Pill>
            ) : null}

            {scaleStatus === 'complete' ? (
              <Pill tone="emerald">Escala completa</Pill>
            ) : null}

            <Pill tone={getPaymentTone(paymentStatus)}>
              {`Financeiro: ${formatPaymentStatus(paymentStatus)}`}
            </Pill>

            {contractLabel ? (
              <Pill tone={contractTone || 'default'}>
                {`Contrato: ${formatContractLabel(contractLabel)}`}
              </Pill>
            ) : null}
          </div>
        </div>

        <div
          className={`mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr] ${
            flat ? 'mt-4' : ''
          }`}
        >
          <div className="space-y-2">
            <p className="text-[14px] text-slate-700">
              <strong>Data:</strong> {data || '-'} &nbsp;•&nbsp;
              <strong>Hora:</strong> {hora || '-'} &nbsp;•&nbsp;
              <strong>Local:</strong> {local || '-'}
            </p>

            <p className="text-[14px] text-slate-700">
              <strong>Formação:</strong> {formacao || '-'} &nbsp;•&nbsp;
              <strong>Receptivo:</strong> {receptivo || 'Não'} &nbsp;•&nbsp;
              <strong>Antesala:</strong> {antesala || 'Não'} &nbsp;•&nbsp;
              <strong>Som:</strong> {temSom ? 'Sim' : 'Não'}
            </p>

            <p className="text-[14px] text-slate-500">
              <strong>WhatsApp:</strong> {whatsappNome || '-'}{' '}
              {whatsappNumero ? `• ${whatsappNumero}` : ''}
            </p>

            {observacoes ? (
              <p className="text-[14px] text-slate-500">{observacoes}</p>
            ) : null}
          </div>

          <div
            className={
              flat
                ? 'rounded-[20px] border border-white/70 bg-white/70 p-4 backdrop-blur'
                : 'rounded-[22px] border border-slate-200 bg-slate-50 p-4'
            }
          >
            <p className="text-sm text-slate-500">
              <strong>Acertado:</strong> {valorAcertado || 'R$ 0,00'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              <strong>Quitado:</strong> {valorPago || 'R$ 0,00'}
            </p>
            <p className="mt-1 text-sm font-semibold text-amber-600">
              <strong>Em aberto:</strong> {valorAberto || 'R$ 0,00'}
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-600">
              <strong>Lucro final:</strong> {lucroFinal || 'R$ 0,00'}
            </p>
          </div>
        </div>

        <div className={`mt-5 flex flex-wrap gap-3 ${flat ? 'mt-4' : ''}`}>
          <button
            type="button"
            onClick={onOpenEscala}
            className="rounded-[16px] bg-violet-600 px-4 py-3 text-[14px] font-black text-white shadow-[0_10px_24px_rgba(124,58,237,0.25)]"
          >
            Escala
          </button>

          <Link
            href={`/eventos/${id}`}
            className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
          >
            Ver detalhe
          </Link>

          <button
            type="button"
            onClick={onOpenContract}
            disabled={gerandoContrato}
            className={`rounded-[16px] px-4 py-3 text-[14px] font-black transition ${
              gerandoContrato
                ? 'cursor-not-allowed border border-[#e5e7eb] bg-[#f8fafc] text-[#94a3b8]'
                : contractLink
                ? 'border border-[#dbe3ef] bg-white text-[#0f172a] hover:bg-[#f8fafc]'
                : 'bg-[#0f172a] text-white shadow-[0_10px_24px_rgba(15,23,42,0.20)] hover:bg-[#111827]'
            }`}
          >
            {contractButtonLabel}
          </button>

          {contractLink ? (
            <button
              type="button"
              onClick={onCopyContractLink}
              className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
            >
              Copiar link
            </button>
          ) : null}

          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
            >
              WhatsApp
            </a>
          ) : null}

          <button
            type="button"
            onClick={onEdit}
            className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
          >
            Editar
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={excluindo}
            className="rounded-[16px] bg-red-600 px-4 py-3 text-[14px] font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {excluindo ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </article>
  );
}

function areEventCardPropsEqual(prev, next) {
  return (
    prev.id === next.id &&
    prev.cliente === next.cliente &&
    prev.tipo === next.tipo &&
    prev.data === next.data &&
    prev.hora === next.hora &&
    prev.local === next.local &&
    prev.formacao === next.formacao &&
    prev.receptivo === next.receptivo &&
    prev.antesala === next.antesala &&
    prev.temSom === next.temSom &&
    prev.whatsappNome === next.whatsappNome &&
    prev.whatsappNumero === next.whatsappNumero &&
    prev.observacoes === next.observacoes &&
    prev.valorAcertado === next.valorAcertado &&
    prev.valorPago === next.valorPago &&
    prev.valorAberto === next.valorAberto &&
    prev.lucroFinal === next.lucroFinal &&
    prev.paymentStatus === next.paymentStatus &&
    prev.operationalStatus === next.operationalStatus &&
    prev.timelineText === next.timelineText &&
    prev.timelineTone === next.timelineTone &&
    prev.totalMusicians === next.totalMusicians &&
    prev.confirmedMusicians === next.confirmedMusicians &&
    prev.contractLabel === next.contractLabel &&
    prev.contractTone === next.contractTone &&
    prev.contractLink === next.contractLink &&
    prev.gerandoContrato === next.gerandoContrato &&
    prev.excluindo === next.excluindo &&
    prev.flat === next.flat &&
    prev.selectable === next.selectable &&
    prev.selected === next.selected &&
    prev.onToggleSelect === next.onToggleSelect
  );
}

export default memo(AdminEventCard, areEventCardPropsEqual);
