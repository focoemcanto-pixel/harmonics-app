'use client';

import Link from 'next/link';
import AdminSectionTitle from '../admin/AdminSectionTitle';

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
      tone: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  }

  if (status === 'signed') {
    return {
      label: 'Assinado',
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }

  if (status === 'client_filling') {
    return {
      label: 'Preenchendo',
      tone: 'bg-violet-50 text-violet-700 border-violet-200',
    };
  }

  if (status === 'link_generated') {
    return {
      label: 'Link gerado',
      tone: 'bg-sky-50 text-sky-700 border-sky-200',
    };
  }

  if (status === 'cancelled') {
    return {
      label: 'Cancelado',
      tone: 'bg-rose-50 text-rose-700 border-rose-200',
    };
  }

  return {
    label: 'Pendente',
    tone: 'bg-amber-50 text-amber-800 border-amber-200',
  };
}

function normalizePaymentStatus(event) {
  const openAmount = Number(event?.open_amount || 0);
  const paidAmount = Number(event?.paid_amount || 0);
  const agreedAmount = Number(event?.agreed_amount || 0);

  if (agreedAmount > 0 && openAmount <= 0) {
    return {
      label: 'Pago',
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }

  if (paidAmount > 0 && openAmount > 0) {
    return {
      label: 'Parcial',
      tone: 'bg-amber-50 text-amber-800 border-amber-200',
    };
  }

  return {
    label: 'Pendente',
    tone: 'bg-slate-100 text-slate-700 border-slate-200',
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
        ? new Date(`${a.event_date}T${a.event_time || '00:00:00'}`).getTime()
        : 0;
      const bDate = b.event_date
        ? new Date(`${b.event_date}T${b.event_time || '00:00:00'}`).getTime()
        : 0;

      return aDate - bDate;
    })
    .slice(0, 6);

  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
      <AdminSectionTitle
        title="Próximos eventos"
        subtitle="Leitura rápida da agenda mais imediata, com status financeiro e contratual."
      />

      <div className="mt-4 space-y-3">
        {upcomingEvents.length === 0 ? (
          <div className="rounded-[20px] bg-[#f8fafc] px-5 py-6 text-[14px] font-semibold text-[#64748b]">
            Nenhum próximo evento encontrado.
          </div>
        ) : (
          upcomingEvents.map((event) => {
            const contractInfo = contractsByEventId.get(String(event.id));
            const contractStatus = normalizeContractStatus(contractInfo?.status);
            const paymentStatus = normalizePaymentStatus(event);

            return (
              <div
                key={event.id}
                className="rounded-[22px] border border-[#e6ebf2] bg-[#fcfdff] px-4 py-4 shadow-[0_6px_18px_rgba(17,24,39,0.03)]"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-violet-700">
                        {formatDateBR(event.event_date)}
                      </span>

                      <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#475569]">
                        {String(event.event_time || '-').slice(0, 5)}
                      </span>
                    </div>

                    <h3 className="mt-3 text-[20px] font-black tracking-[-0.03em] text-[#0f172a]">
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

                  <div className="flex shrink-0 flex-col gap-2 xl:min-w-[190px]">
                    <div className="rounded-[18px] bg-[#f8fafc] px-4 py-3">
                      <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                        Valor do evento
                      </div>
                      <div className="mt-2 text-[18px] font-black text-[#0f172a]">
                        {formatMoney(event.agreed_amount)}
                      </div>
                    </div>

                    <Link
                      href="/eventos"
                      className="rounded-[16px] bg-violet-600 px-4 py-3 text-center text-[13px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
                    >
                      Ver evento
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
