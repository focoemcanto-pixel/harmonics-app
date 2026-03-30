'use client';

import Link from 'next/link';
import AdminPill from '../admin/AdminPill';
import { formatDateBR } from '../../lib/contratos/contratos-format';

function buildContractTone(statusTone) {
  if (statusTone === 'emerald') {
    return 'border-emerald-200 bg-emerald-50';
  }
  if (statusTone === 'violet') {
    return 'border-violet-200 bg-violet-50';
  }
  if (statusTone === 'blue') {
    return 'border-sky-200 bg-sky-50';
  }
  if (statusTone === 'amber') {
    return 'border-amber-200 bg-amber-50';
  }
  return 'border-slate-200 bg-slate-50';
}

function truncateToken(token) {
  if (!token) return '-';
  if (token.length <= 18) return token;
  return `${token.slice(0, 8)}...${token.slice(-6)}`;
}

export default function ContractCard({ item, onCopyLink }) {
  const cardTone = buildContractTone(item.statusTone);

  return (
    <div
      className={`rounded-[26px] border p-5 shadow-[0_8px_22px_rgba(17,24,39,0.04)] ${cardTone}`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="text-[22px] font-black tracking-[-0.03em] text-[#0f172a]">
            {item.clienteNome}
          </div>

          <div className="mt-1 text-[14px] font-semibold text-[#64748b]">
            {item.eventoTitulo}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <AdminPill tone={item.statusTone}>{item.statusLabel}</AdminPill>

          {item.assinadoEm ? (
            <AdminPill tone="emerald">
              Assinado em {formatDateBR(item.assinadoEm)}
            </AdminPill>
          ) : null}

          {!item.assinadoEm && item.visualizado ? (
            <AdminPill tone="blue">Visualizado</AdminPill>
          ) : null}

          {!item.assinadoEm && !item.visualizado ? (
            <AdminPill tone="amber">Não visualizado</AdminPill>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-[22px] border border-white/70 bg-white/80 p-4 backdrop-blur">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                Evento
              </div>
              <div className="mt-1 text-[14px] font-semibold text-[#0f172a]">
                {item.eventoTipo || 'Evento'}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                Data
              </div>
              <div className="mt-1 text-[14px] font-semibold text-[#0f172a]">
                {formatDateBR(item.dataEvento)}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                Local
              </div>
              <div className="mt-1 text-[14px] font-semibold text-[#0f172a]">
                {item.localEvento || '-'}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                WhatsApp
              </div>
              <div className="mt-1 text-[14px] font-semibold text-[#0f172a]">
                {item.whatsapp || '-'}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-white/70 bg-white/80 p-4 backdrop-blur">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Token
            </div>
            <div className="mt-1 text-[14px] font-semibold text-[#0f172a]">
              {truncateToken(item.token)}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Enviado em
            </div>
            <div className="mt-1 text-[14px] font-semibold text-[#0f172a]">
              {formatDateBR(item.enviadoEm)}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Assinado em
            </div>
            <div className="mt-1 text-[14px] font-semibold text-[#0f172a]">
              {formatDateBR(item.assinadoEm)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={item.linkContrato}
          className="rounded-[16px] bg-[#0f172a] px-4 py-3 text-[14px] font-black text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
        >
          Abrir contrato
        </Link>

        {item.eventoId ? (
          <Link
            href={`/eventos/${item.eventoId}`}
            className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
          >
            Abrir evento
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => onCopyLink(item.linkContrato)}
          className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
        >
          Copiar link
        </button>

        {item.pdfUrl ? (
          <a
            href={item.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
          >
            PDF final
          </a>
        ) : null}

        {item.docUrl ? (
          <a
            href={item.docUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
          >
            Documento
          </a>
        ) : null}
      </div>
    </div>
  );
}
