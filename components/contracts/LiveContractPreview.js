'use client';

import { useMemo } from 'react';
import { getMockContractTagValues } from '@/lib/contracts/contractTagsRegistry';

function replaceTags(content = '') {
  const values = getMockContractTagValues();
  let output = String(content || '');

  Object.entries(values).forEach(([tag, value]) => {
    output = output.split(tag).join(`<span data-contract-preview-tag="true" class="rounded-md bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-800">${value}</span>`);
  });

  return output;
}

function buildEmptyState() {
  return `
    <div style="padding:32px;text-align:center;color:#64748b;">
      <div style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#7c3aed;">
        Preview do contrato
      </div>
      <div style="margin-top:14px;font-size:15px;line-height:1.8;">
        Escreva o contrato e utilize tags dinâmicas para visualizar como o documento ficará para o cliente.
      </div>
    </div>
  `;
}

export default function LiveContractPreview({ html = '' }) {
  const renderedHtml = useMemo(() => {
    const normalized = String(html || '').trim();

    if (!normalized) {
      return buildEmptyState();
    }

    return replaceTags(normalized);
  }, [html]);

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#dbe3ef] bg-[#e2e8f0] p-3 shadow-inner">
      <div className="mx-auto max-w-[760px] rounded-[22px] border border-[#dbe3ef] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between border-b border-[#eef2f7] px-5 py-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
              Documento renderizado
            </div>
            <div className="mt-1 text-[12px] font-semibold text-[#64748b]">
              Visualização dinâmica do contrato final
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
        </div>

        <div className="bg-[#f8fafc] px-5 py-5">
          <article
            className="prose prose-slate max-w-none rounded-[18px] bg-white px-8 py-8 text-[14px] leading-7 text-[#0f172a] shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>
      </div>
    </div>
  );
}
