'use client';

import { useState } from 'react';
import ContractAssistantPanel from '@/components/contracts/ContractAssistantPanel';
import { ContractEditorProvider } from '@/contexts/ContractEditorContext';

export default function ContractEditorShell({
  children,
  initialHtml = '',
  assistantContent = '',
  onInsertTag,
  helper,
}) {
  const [assistantOpen, setAssistantOpen] = useState(false);

  return (
    <ContractEditorProvider initialHtml={initialHtml || assistantContent}>
      <section className="relative">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-violet-200 bg-violet-50/70 px-4 py-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
              Builder inteligente
            </div>
            <p className="mt-1 text-[13px] font-semibold leading-5 text-violet-800">
              Escreva o contrato e use o assistente para inserir tags, validar campos e visualizar o preview.
            </p>
            {helper ? (
              <p className="mt-1 text-[12px] font-semibold leading-5 text-violet-700/80">
                {helper}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setAssistantOpen(true)}
            className="rounded-[18px] bg-violet-600 px-4 py-2.5 text-[13px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.28)] lg:hidden"
          >
            Abrir assistente
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0">
            {children}
          </div>

          <div className="hidden xl:block xl:sticky xl:top-6 xl:self-start">
            <ContractAssistantPanel content={assistantContent} onInsertTag={onInsertTag} />
          </div>
        </div>

        {assistantOpen ? (
          <div
            className="fixed inset-0 z-[220] bg-slate-950/45 backdrop-blur-[2px] xl:hidden"
            onClick={() => setAssistantOpen(false)}
          >
            <div
              className="absolute bottom-0 left-0 right-0 max-h-[88dvh] overflow-y-auto rounded-t-[34px] bg-white p-4 shadow-[0_-24px_80px_rgba(15,23,42,0.28)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
                    Assistente
                  </div>
                  <h2 className="text-[20px] font-black tracking-[-0.04em] text-[#0f172a]">
                    Contrato inteligente
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setAssistantOpen(false)}
                  className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-black text-[#475569]"
                >
                  Fechar
                </button>
              </div>

              <ContractAssistantPanel content={assistantContent} onInsertTag={onInsertTag} />
            </div>
          </div>
        ) : null}
      </section>
    </ContractEditorProvider>
  );
}
