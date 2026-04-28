'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../ui/Button.js';
import RichContractEditor from '@/components/contracts/RichContractEditor';
import { parseContractTemplateInput, looksLikeHtml } from '@/lib/contracts/templateImport';

function htmlToReadableText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (typeof window !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, 'text/html');
    return String(doc.body?.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  return raw
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function textToEditorHtml(value) {
  const text = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!text) return '';
  if (looksLikeHtml(text)) return text;

  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('');
}

export default function ContractTemplateEditorModal({
  open,
  onClose,
  onSave,
  onRestoreDefault,
  templateName,
  eventTypeName,
  initialText,
  hasCustomContent,
  readOnly = false,
}) {
  const [draft, setDraft] = useState(() => textToEditorHtml(initialText));
  const [mobileTab, setMobileTab] = useState('edit');
  const editorApiRef = useRef(null);

  const parsed = useMemo(() => parseContractTemplateInput(draft), [draft]);
  const previewHtml = useMemo(() => {
    if (!String(draft || '').trim()) return '';
    return parsed.normalizedContent;
  }, [draft, parsed.normalizedContent]);
  const handleClose = () => {
    setMobileTab('edit');
    onClose?.();
  };

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[210] overflow-hidden bg-[rgba(15,23,42,0.66)] p-0 backdrop-blur-[4px] md:p-4"
      onClick={handleClose}
    >
      <div className="mx-auto flex h-[100dvh] md:h-[calc(100dvh-32px)] w-full max-w-6xl flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-white shadow-[0_32px_90px_rgba(0,0,0,0.4)] md:mt-4 md:h-auto md:rounded-[30px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 px-5 py-4 md:px-7 md:py-5">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-violet-600/80">Editor de documento</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black tracking-[-0.02em] text-slate-900 md:text-2xl">Editar modelo deste contrato</h3>
              <p className="mt-1 text-sm text-slate-500">
                Template: <span className="font-semibold text-slate-700">{templateName || 'Sem template'}</span>
                {' · '}
                Evento: <span className="font-semibold text-slate-700">{eventTypeName || 'Não informado'}</span>
              </p>
            </div>
            <Button variant="soft" onClick={handleClose}>Fechar</Button>
          </div>
        </div>

        <div className="shrink-0 border-b border-slate-200 px-5 py-3 md:hidden">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMobileTab('edit')}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                mobileTab === 'edit'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                mobileTab === 'preview'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Preview
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-2">
            <div
              className={`min-h-0 flex-col overflow-y-auto border-slate-200 bg-slate-50 md:flex md:border-b-0 md:border-r ${
                mobileTab === 'edit' ? 'flex' : 'hidden'
              }`}
            >
            <div className="border-b border-slate-200 px-5 py-3 md:px-6">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Edição</p>
            </div>
            <div className="min-h-0 flex-1 p-4 md:p-6">
              <RichContractEditor
                ref={editorApiRef}
                sessionKey={`${open}-${templateName}-${eventTypeName}`}
                initialHtml={draft}
                readOnly={readOnly}
                minHeightClass="h-full min-h-[260px]"
                onChangeHtml={(nextHtml) => {
                  setDraft(nextHtml);
                }}
              />
            </div>
            </div>

            <div
              className={`min-h-0 flex-col overflow-y-auto bg-gradient-to-b from-slate-100 to-slate-50 md:flex ${
                mobileTab === 'preview' ? 'flex' : 'hidden'
              }`}
            >
            <div className="border-b border-slate-200 px-5 py-3 md:px-6">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Preview</p>
            </div>
            <div className="min-h-0 flex-1 p-4 md:p-6">
              <div className="mx-auto w-full max-w-[680px] rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)] md:p-8">
                {previewHtml ? (
                  <div className="prose prose-slate max-w-none text-[15px] leading-7" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                ) : (
                  <p className="text-sm text-slate-500">Sem conteúdo para pré-visualização.</p>
                )}
              </div>
            </div>
            <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-600 md:px-6">
              <p><span className="font-bold">Placeholders reconhecidos:</span> {parsed.detectedPlaceholders.length}</p>
              <p><span className="font-bold">Placeholders não reconhecidos:</span> {parsed.unknownPlaceholders.length}</p>
              <p><span className="font-bold">Condicionais:</span> {parsed.hasConditionals ? parsed.conditionals.join(', ') : 'Nenhum'}</p>
            </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {hasCustomContent ? 'Este pré-contrato está personalizado.' : 'Usando o modelo padrão até salvar alterações.'}
            </div>
            <div className="flex flex-wrap gap-2">
              {hasCustomContent && !readOnly ? (
                <Button variant="ghost" onClick={() => onRestoreDefault?.()}>
                  Restaurar modelo padrão
                </Button>
              ) : null}
              <Button variant="soft" onClick={handleClose}>Cancelar</Button>
              {!readOnly ? (
                <Button onClick={() => onSave?.({ rawText: draft, processedContent: parsed.normalizedContent, sourceText: htmlToReadableText(draft) })}>
                  Salvar personalização
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
