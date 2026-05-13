'use client';

import { useState } from 'react';
import ContractAssistantPanel from '@/components/contracts/ContractAssistantPanel';

export default function ContractTemplateRouteAssistant() {
  const [open, setOpen] = useState(false);

  async function handleInsertTag(tag) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(tag).catch(() => null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] right-4 z-[90] flex items-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-[13px] font-black text-white shadow-[0_18px_42px_rgba(124,58,237,0.38)] transition hover:bg-violet-700 md:bottom-6 md:right-6"
      >
        <span>✨</span>
        Assistente de contrato
      </button>

      {open ? (
        <div className="fixed inset-0 z-[220] bg-slate-950/45 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[88dvh] overflow-y-auto rounded-t-[34px] bg-white p-4 shadow-[0_-24px_80px_rgba(15,23,42,0.28)] md:bottom-6 md:left-auto md:right-6 md:top-6 md:w-[430px] md:rounded-[34px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
                  Builder guiado
                </div>
                <h2 className="text-[20px] font-black tracking-[-0.04em] text-[#0f172a]">
                  Monte contratos com tags
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-black text-[#475569]"
              >
                Fechar
              </button>
            </div>

            <div className="mb-3 rounded-[24px] border border-violet-200 bg-violet-50 px-4 py-4">
              <div className="text-[13px] font-black text-violet-900">
                Como usar agora
              </div>
              <p className="mt-1 text-[12px] font-semibold leading-6 text-violet-800">
                Clique numa tag para copiá-la. Depois cole no texto do contrato onde aquele dado deve aparecer. Em seguida salve o template e associe-o a um tipo de evento.
              </p>
            </div>

            <ContractAssistantPanel content="" onInsertTag={handleInsertTag} />
          </div>
        </div>
      ) : null}
    </>
  );
}
