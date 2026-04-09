'use client';

import Link from 'next/link';
import AdminSectionTitle from '../admin/AdminSectionTitle';
import { normalizeTimeStrict } from '@/lib/time/normalize-time';

function formatDateBR(dateStr) {
  if (!dateStr) return '-';

  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function normalizeContractStatus(rawStatus) {
  const status = String(rawStatus || '').trim().toLowerCase();

  if (!status) {
    return {
      label: 'Sem contrato',
      tone: 'border-slate-200 bg-slate-100 text-slate-700',
    };
  }

  if (status === 'signed') {
    return {
      label: 'Assinado',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }

  if (status === 'client_filling') {
    return {
      label: 'Preenchendo',
      tone: 'border-violet-200 bg-violet-50 text-violet-700',
    };
  }

  if (status === 'link_generated') {
    return {
      label: 'Link gerado',
      tone: 'border-sky-200 bg-sky-50 text-sky-700',
    };
  }

  if (status === 'cancelled') {
    return {
      label: 'Cancelado',
      tone: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }

  return {
    label: 'Pendente',
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
  };
}

function normalizePaymentStatus(event) {
  const openAmount = Number(event?.open_amount || 0);
  const paidAmount = Number(event?.paid_amount || 0);
  const agreedAmount = Number(event?.agreed_amount || 0);

  if (agreedAmount > 0 && openAmount <= 0) {
    return {
      label: 'Pago',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }

  if (paidAmount > 0 && openAmount > 0) {
    return {
      label: 'Parcial',
      tone: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  return {
    label: 'Pendente',
    tone: 'border-slate-200 bg-slate-100 text-slate-700',
  };
}

function isUpcomingEvent(dateStr) {
  if (!dateStr) return false;

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${dateStr}T00:00:00`);

  return target >= start;
}

function buildContractsByEventId(precontracts = [], contracts = []) {
  const map = new Map();

  const contractsByPreId = new Map(
    contracts.map((item) => [String(item.precontract_id), item])
  );

  for (const pre of precontracts) {
    const contract = contractsByPreId.get(String(pre.id));
    const eventId = contract?.event_id || pre?.event_id;

    if (!eventId) continue;

    map.set(String(eventId), {
      status: contract?.status || pre?.status || '',
      token: pre?.public_token || contract?.public_token || '',
      pdfUrl: contract?.pdf_url || '',
      docUrl: contract?.doc_url || '',
    });
  }

  return map;
}

function EventMetaPill({ children, tone = 'default' }) {
  const tones = {
    default: 'bg-[#f8fafc] text-[#475569]',
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${tones[tone] || tones.default}`}
    >
      {children}
    </span>
  );
}

export default function DashboardUpcomingEvents({
  events = [],
  contracts = [],
  precontracts = [],
}) {
  const contractsByEventId = buildContractsByEventId(precontracts, contracts);

  const upcomingEvents = [...events]
    .filter((ev) => isUpcomingEvent(ev.event_date))
    .sort((a, b) => {
      const aDate = a.event_date
        ? new Date(`${a.event_date}T${normalizeTimeStrict(a.event_time) || '00:00'}`).getTime()
        : 0;
      const bDate = b.event_date
        ? new Date(`${b.event_date}T${normalizeTimeStrict(b.event_time) || '00:00'}`).getTime()
        : 0;

      return aDate - bDate;
    })
    .slice(0, 6);

  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_12px_32px_rgba(17,24,39,0.05)] md:p-6">
      <div className="flex items-start justify-between gap-4">
        <AdminSectionTitle
          title="Próximos eventos"
          subtitle="Agenda imediata com leitura contratual e financeira."
        />

        <Link
          href="/eventos"
          className="hidden rounded-[16px] border border-[#dbe3ef] bg-[#f8fafc] px-4 py-3 text-[12px] font-black text-[#0f172a] transition hover:bg-[#eef2ff] md:inline-flex"
        >
          Ver agenda completa
        </Link>
      </div>

      {upcomingEvents.length === 0 ? (
        <div className="mt-4 rounded-[22px] border border-[#e6ebf2] bg-[#f8fafc] px-5 py-6 text-[14px] font-semibold text-[#64748b]">
          Nenhum próximo evento encontrado no momento.
        </div>
      ) : (
        <>
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2 md:hidden">
            {upcomingEvents.map((event) => {
              const contractInfo = contractsByEventId.get(String(event.id));
              const contractStatus = normalizeContractStatus(contractInfo?.status);
              const paymentStatus = normalizePaymentStatus(event);

              return (
                <div
                  key={event.id}
                  className="w-[88%] shrink-0 rounded-[24px] border border-[#e6ebf2] bg-[linear-gradient(180deg,#ffffff_0%,#fcfdff_100%)] px-4 py-4 shadow-[0_10px_24px_rgba(17,24,39,0.04)]"
                >
                  <div className="flex flex-wrap gap-2">
                    <EventMetaPill tone="violet">
                      {formatDateBR(event.event_date)}
                    </EventMetaPill>

                    <EventMetaPill>
                      {String(event.event_time || '-').slice(0, 5)}
                    </EventMetaPill>
                  </div>

                  <h3 className="mt-4 text-[20px] font-black tracking-[-0.04em] text-[#0f172a]">
                    {event.client_name || 'Evento sem cliente'}
                  </h3>

                  <div className="mt-2 text-[14px] font-semibold leading-6 text-[#64748b]">
                    {event.location_name || 'Local não informado'}
                  </div>

                  <div className="mt-1 text-[13px] font-semibold leading-6 text-[#64748b]">
                    {event.formation || 'Sem formação definida'}
                    {event.instruments ? ` — ${event.instruments}` : ''}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${contractStatus.tone}`}
                    >
                      {contractStatus.label}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${paymentStatus.tone}`}
                    >
                      {paymentStatus.label}
                    </span>
                  </div>

                  <div className="mt-5 rounded-[18px] border border-[#eef2f7] bg-[#f8fafc] px-4 py-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                      Valor do evento
                    </div>
                    <div className="mt-2 text-[22px] font-black tracking-[-0.03em] text-[#0f172a]">
                      {formatMoney(event.agreed_amount)}
                    </div>
                  </div>

                  <Link
                    href="/eventos"
                    className="mt-4 inline-flex w-full items-center justify-center rounded-[18px] bg-violet-600 px-4 py-3 text-[13px] font-black text-white shadow-[0_14px_28px_rgba(124,58,237,0.22)] transition hover:bg-violet-700"
                  >
                    Ver evento
                  </Link>
                </div>
              );
            })}
          </div>

          <div className="mt-4 hidden space-y-4 md:block">
            {upcomingEvents.map((event) => {
              const contractInfo = contractsByEventId.get(String(event.id));
              const contractStatus = normalizeContractStatus(contractInfo?.status);
              const paymentStatus = normalizePaymentStatus(event);

              return (
                <div
                  key={event.id}
                  className="relative overflow-hidden rounded-[24px] border border-[#e6ebf2] bg-[linear-gradient(180deg,#ffffff_0%,#fcfdff_100%)] px-5 py-5 shadow-[0_10px_24px_rgba(17,24,39,0.04)]"
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.06),transparent_28%)]" />

                  <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-violet-700">
                          {formatDateBR(event.event_date)}
                        </span>

                        <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#475569]">
                          {String(event.event_time || '-').slice(0, 5)}
                        </span>

                        {event.event_type ? (
                          <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#475569]">
                            {event.event_type}
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-4 text-[22px] font-black tracking-[-0.04em] text-[#0f172a]">
                        {event.client_name || 'Evento sem cliente'}
                      </h3>

                      <div className="mt-2 text-[14px] font-semibold leading-6 text-[#64748b]">
                        {event.location_name || 'Local não informado'}
                      </div>

                      <div className="mt-1 text-[14px] font-semibold leading-6 text-[#64748b]">
                        {event.formation || 'Sem formação definida'}
                        {event.instruments ? ` — ${event.instruments}` : ''}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${contractStatus.tone}`}
                        >
                          {contractStatus.label}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${paymentStatus.tone}`}
                        >
                          {paymentStatus.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-3 xl:min-w-[220px]">
                      <div className="rounded-[20px] border border-[#eef2f7] bg-[#f8fafc] px-4 py-4">
                        <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                          Valor do evento
                        </div>
                        <div className="mt-2 text-[22px] font-black tracking-[-0.03em] text-[#0f172a]">
                          {formatMoney(event.agreed_amount)}
                        </div>
                      </div>

                      <Link
                        href="/eventos"
                        className="inline-flex items-center justify-center rounded-[18px] bg-violet-600 px-4 py-3 text-[13px] font-black text-white shadow-[0_14px_28px_rgba(124,58,237,0.22)] transition hover:bg-violet-700"
                      >
                        Ver evento
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 md:hidden">
            <Link
              href="/eventos"
              className="inline-flex w-full items-center justify-center rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[13px] font-black text-[#0f172a] transition hover:bg-[#eef2ff]"
            >
              Ver agenda completa
            </Link>
          </div>
        </>
      )}
    </section>
  );
}