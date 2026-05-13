'use client';

import { useMemo, useState } from 'react';
import {
  CONTRACT_TAG_CATEGORIES,
  CONTRACT_TAGS,
  getMockContractTagValues,
} from '@/lib/contracts/contractTagsRegistry';
import { analyzeTemplateQuality } from '@/lib/contracts/analyzeTemplateQuality';
import { useContractEditor } from '@/contexts/ContractEditorContext';

function replaceTagsWithMockValues(content = '') {
  const values = getMockContractTagValues();
  let output = String(content || '');

  Object.entries(values).forEach(([tag, example]) => {
    output = output.split(tag).join(example);
  });

  return output;
}

function stripHtml(value = '') {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function copyToClipboard(value) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return Promise.resolve(false);
  return navigator.clipboard.writeText(value).then(() => true).catch(() => false);
}

const TAB_ITEMS = [
  { key: 'tags', label: 'Tags' },
  { key: 'quality', label: 'Checklist' },
  { key: 'preview', label: 'Preview' },
  { key: 'guide', label: 'Guia' },
];

export default function ContractAssistantPanel({ content = '', onInsertTag }) {
  const editorContext = useContractEditor();

  const liveContent = editorContext?.html ?? content;

  const [activeTab, setActiveTab] = useState('tags');
  const [copiedTag, setCopiedTag] = useState('');

  const analysis = useMemo(() => {
    if (editorContext?.analysis) return editorContext.analysis;
    return analyzeTemplateQuality(liveContent);
  }, [editorContext, liveContent]);

  const preview = useMemo(() => {
    if (editorContext?.preview) return editorContext.preview;
    return stripHtml(replaceTagsWithMockValues(liveContent));
  }, [editorContext, liveContent]);

  async function handleTagClick(tag) {
    if (typeof onInsertTag === 'function') {
      onInsertTag(tag.tag);

      if (editorContext?.setLastInsertedTag) {
        editorContext.setLastInsertedTag(tag.tag);
      }

      return;
    }

    const copied = await copyToClipboard(tag.tag);

    if (copied) {
      setCopiedTag(tag.key);

      if (editorContext?.setLastInsertedTag) {
        editorContext.setLastInsertedTag(tag.tag);
      }

      window.setTimeout(() => setCopiedTag(''), 1400);
    }
  }

  return (
    <aside className="rounded-[30px] border border-[#dbe3ef] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
      <div className="rounded-[24px] bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.18),transparent_42%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4">
        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
          Assistente de contrato
        </div>

        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <div className="text-[30px] font-black tracking-[-0.06em] text-[#0f172a] transition-all duration-300">
              {analysis.qualityScore}%
            </div>

            <div className="text-[12px] font-black uppercase tracking-[0.12em] text-[#64748b]">
              completo
            </div>
          </div>

          <span className={`rounded-full px-3 py-1 text-[11px] font-black ${analysis.isReadyForAutomation ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {analysis.isReadyForAutomation ? 'Pronto' : 'Ajustar'}
          </span>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-violet-600 transition-all duration-300"
            style={{ width: `${analysis.qualityScore}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1 rounded-[18px] bg-slate-100 p-1">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-[14px] px-2 py-2 text-[11px] font-black transition ${activeTab === tab.key ? 'bg-white text-violet-700 shadow-sm' : 'text-[#64748b]'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4 max-h-[620px] overflow-y-auto pr-1">
        {activeTab === 'tags' ? (
          <div className="space-y-4">
            {CONTRACT_TAG_CATEGORIES.map((category) => {
              const tags = CONTRACT_TAGS.filter((tag) => tag.category === category.key);
              if (!tags.length) return null;

              return (
                <section key={category.key} className="rounded-[22px] border border-[#e2e8f0] bg-[#f8fafc] p-3">
                  <div className="text-[13px] font-black text-[#0f172a]">{category.label}</div>

                  <p className="mt-1 text-[11px] font-semibold leading-5 text-[#64748b]">
                    {category.description}
                  </p>

                  <div className="mt-3 space-y-2">
                    {tags.map((tag) => {
                      const isPresent = analysis.foundTags.includes(tag.key);

                      return (
                        <button
                          key={tag.key}
                          type="button"
                          onClick={() => handleTagClick(tag)}
                          className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-3 py-3 text-left transition hover:border-violet-200 hover:bg-violet-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[12px] font-black text-[#0f172a]">
                                {tag.label}
                              </div>

                              <div className="mt-1 font-mono text-[11px] font-black text-violet-700">
                                {tag.tag}
                              </div>
                            </div>

                            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${isPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                              {isPresent ? 'usada' : copiedTag === tag.key ? 'copiada' : 'inserir'}
                            </span>
                          </div>

                          <p className="mt-2 text-[11px] font-semibold leading-5 text-[#64748b]">
                            {tag.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}

        {activeTab === 'quality' ? (
          <div className="space-y-3">
            {analysis.missingRequiredTags.length === 0 ? (
              <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-[13px] font-bold leading-6 text-emerald-700">
                Seu template possui as tags obrigatórias para automação básica.
              </div>
            ) : (
              <div className="space-y-2">
                {analysis.missingRequiredTags.map((tag) => (
                  <button
                    key={tag.key}
                    type="button"
                    onClick={() => handleTagClick(tag)}
                    className="w-full rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-left"
                  >
                    <div className="text-[13px] font-black text-amber-800">
                      Falta: {tag.label}
                    </div>

                    <div className="mt-1 font-mono text-[11px] font-black text-amber-700">
                      {tag.tag}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {analysis.duplicatedTags.length > 0 ? (
              <div className="rounded-[22px] border border-violet-200 bg-violet-50 px-4 py-4">
                <div className="text-[13px] font-black text-violet-800">
                  Tags repetidas
                </div>

                <p className="mt-1 text-[12px] font-semibold leading-5 text-violet-700">
                  Revise se estas tags precisam aparecer mais de uma vez.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'preview' ? (
          <div className="rounded-[22px] border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <div className="text-[12px] font-black uppercase tracking-[0.12em] text-violet-700">
              Preview com dados fictícios
            </div>

            <pre className="mt-3 max-h-[420px] whitespace-pre-wrap text-[12px] font-semibold leading-6 text-[#334155]">
              {preview || 'Escreva o texto do contrato e use tags para visualizar o contrato preenchido aqui.'}
            </pre>
          </div>
        ) : null}

        {activeTab === 'guide' ? (
          <div className="space-y-3">
            {[
              'Escreva o contrato normalmente, como se fosse um documento manual.',
              'Substitua dados variáveis por tags, como {{cliente_nome}} e {{evento_data}}.',
              'Use o checklist para garantir que cliente, evento, valor, formação e assinatura estão presentes.',
              'Depois de salvar, associe esse template ao tipo de evento correto.',
            ].map((item, index) => (
              <div key={item} className="flex gap-3 rounded-[20px] border border-violet-100 bg-violet-50 px-4 py-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[12px] font-black text-white">
                  {index + 1}
                </div>

                <p className="text-[13px] font-semibold leading-6 text-[#475569]">
                  {item}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
