'use client';

import Link from 'next/link';
import AdminPill from '../admin/AdminPill';
import { formatDateBR } from '../../lib/contratos/contratos-format';

export default function ContractCard({ item, onCopyLink }) {
  return (
    <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.04)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="text-[20px] font-black text-[#0f172a]">
            {item.clienteNome}
          </div>
          <div className="mt-1 text-[14px] font-semibold text-[#64748b]">
            {item.eventoTitulo}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <AdminPill tone={item.statusTone}>{item.statusLabel}</AdminPill>

          {item.assinadoEm ? (
            <AdminPill tone="emerald">Assinado em {formatDateBR(item.assinadoEm)}</AdminPill>
          ) : null}

          {!item.assinadoEm && item.visualizado ? (
            <AdminPill tone="blue">Visualizado</AdminPill>
          ) : null}

          {!item.assinadoEm && !item.visualizado ? (
            <AdminPill tone="amber">Não visualizado</AdminPill>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-2">
          <p className="text-[14px] text-slate-700">
            <strong>Evento:</strong> {item.eventoTipo || 'Evento'} &nbsp;•&nbsp;
            <strong>Data:</strong> {formatDateBR(item.dataEvento)} &nbsp;•&nbsp;
            <strong>Local:</strong> {item.localEvento || '-'}
          </p>

          <p className="text-[14px] text-slate-700">
            <strong>WhatsApp:</strong> {item.whatsapp || '-'}
          </p>

          <p className="text-[14px] text-slate-500">
            <strong>Token:</strong> {item.token}
          </p>

          {item.observacoes ? (
            <p className="text-[14px] text-slate-500">{item.observacoes}</p>
          ) : null}
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-500">
            <strong>Link do contrato:</strong>
          </p>

          <div className="mt-2 break-all text-[13px] font-semibold text-[#475569]">
            {item.linkContrato}
          </div>

          <p className="mt-4 text-sm text-slate-500">
            <strong>Enviado em:</strong> {formatDateBR(item.enviadoEm)}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            <strong>Assinado em:</strong> {formatDateBR(item.assinadoEm)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={item.linkContrato}
          className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
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
