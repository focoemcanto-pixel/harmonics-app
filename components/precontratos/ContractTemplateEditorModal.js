'use client';

import { useMemo, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
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

const EDITOR_ACTIONS = [
  { label: 'Título', command: 'formatBlock', value: 'h2' },
  { label: 'Subtítulo', command: 'formatBlock', value: 'h3' },
  { label: 'Parágrafo', command: 'formatBlock', value: 'p' },
  { label: 'Negrito', command: 'bold' },
  { label: 'Itálico', command: 'italic' },
  { label: 'Lista', command: 'insertUnorderedList' },
  { label: 'Numeração', command: 'insertOrderedList' },
];

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
  const editorRef = useRef(null);

  const parsed = useMemo(() => parseContractTemplateInput(draft), [draft]);
  const previewHtml = useMemo(() => {
    if (!String(draft || '').trim()) return '';
    return parsed.normalizedContent;
  }, [draft, parsed.normalizedContent]);

  function runEditorCommand(command, value) {
    if (readOnly) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, value);
    setDraft(editor.innerHTML || '');
  }

  function handleEditorInput() {
    if (!editorRef.current) return;
    setDraft(editorRef.current.innerHTML || '');
  }

  function handlePaste(event) {
    if (readOnly) return;
    event.preventDefault();

    const clipboard = event.clipboardData;
    const html = clipboard?.getData('text/html');
    const text = clipboard?.getData('text/plain');

    if (html) {
      document.execCommand('insertHTML', false, html);
    } else if (text) {
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br />');
      document.execCommand('insertHTML', false, escaped);
    }

    queueMicrotask(() => {
      if (editorRef.current) {
        setDraft(editorRef.current.innerHTML || '');
      }
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end justify-center bg-[rgba(15,23,42,0.66)] p-0 backdrop-blur-[4px] md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-white shadow-[0_32px_90px_rgba(0,0,0,0.4)] md:h-[88vh] md:rounded-[30px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 md:px-7 md:py-5">
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
            <Button variant="soft" onClick={onClose}>Fechar</Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-2">
          <div className="flex min-h-0 flex-col border-b border-slate-200 bg-slate-50 md:border-b-0 md:border-r">
            <div className="border-b border-slate-200 px-5 py-3 md:px-6">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Edição</p>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3 md:px-6">
              {EDITOR_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  disabled={readOnly}
                  onClick={() => runEditorCommand(action.command, action.value)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-violet-400 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 p-4 md:p-6">
              <div
                ref={editorRef}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onInput={handleEditorInput}
                onBlur={handleEditorInput}
                onPaste={handlePaste}
                className="prose prose-slate h-full min-h-[260px] max-w-none overflow-y-auto rounded-2xl border border-slate-300 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                dangerouslySetInnerHTML={{ __html: draft }}
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-col bg-gradient-to-b from-slate-100 to-slate-50">
            <div className="border-b border-slate-200 px-5 py-3 md:px-6">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Preview</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
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

        <div className="border-t border-slate-200 bg-white px-5 py-4 md:px-7">
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
              <Button variant="soft" onClick={onClose}>Cancelar</Button>
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
