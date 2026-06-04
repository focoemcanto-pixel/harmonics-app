'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useContractEditor } from '@/contexts/ContractEditorContext';

const EDITOR_ACTIONS = [
  { label: 'Título', command: 'formatBlock', value: 'h2' },
  { label: 'Subtítulo', command: 'formatBlock', value: 'h3' },
  { label: 'Parágrafo', command: 'formatBlock', value: 'p' },
  { label: 'Negrito', command: 'bold' },
  { label: 'Itálico', command: 'italic' },
  { label: 'Lista', command: 'insertUnorderedList' },
  { label: 'Numeração', command: 'insertOrderedList' },
];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextToEditorHtml(value) {
  const text = String(value || '').replace(/\r\n/g, '\n');
  if (!text.trim()) return '';

  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

const RichContractEditor = forwardRef(function RichContractEditor(
  {
    initialHtml = '',
    editSessionId,
    sessionKey,
    onChangeHtml,
    readOnly = false,
    canHydrate = true,
    minHeightClass = 'min-h-[260px]',
  },
  ref
) {
  const editorRef = useRef(null);
  const latestHtmlRef = useRef(String(initialHtml || ''));
  const contractEditor = useContractEditor();
  const consumedTagRef = useRef('');

  useEffect(() => {
    if (!canHydrate) return;
    const nextHtml = String(initialHtml || '');
    latestHtmlRef.current = nextHtml;
    if (editorRef.current) {
      editorRef.current.innerHTML = nextHtml;
    }
    contractEditor?.setHtml?.(nextHtml);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHtml, editSessionId, sessionKey, canHydrate]);

  function commitHtml(nextHtml) {
    const normalized = String(nextHtml || '');
    latestHtmlRef.current = normalized;
    contractEditor?.setHtml?.(normalized);
    onChangeHtml?.(normalized);
  }

  function commitCurrentEditorHtml() {
    const nextHtml = editorRef.current?.innerHTML || '';
    commitHtml(nextHtml);
    return nextHtml;
  }

  function scheduleCommitCurrentEditorHtml() {
    window.setTimeout(() => commitCurrentEditorHtml(), 0);
    window.setTimeout(() => commitCurrentEditorHtml(), 80);
  }

  function handleInput() {
    commitCurrentEditorHtml();
  }

  function insertHtmlAtCursor(html) {
    if (readOnly || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertHTML', false, html);
    commitCurrentEditorHtml();
  }

  function insertTextAtCursor(text) {
    insertHtmlAtCursor(escapeHtml(text));
  }

  useEffect(() => {
    const tag = String(contractEditor?.lastInsertedTag || '').trim();
    if (!tag || consumedTagRef.current === tag) return;
    consumedTagRef.current = tag;
    insertTextAtCursor(tag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractEditor?.lastInsertedTag]);

  function runEditorCommand(command, value) {
    if (readOnly || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    commitCurrentEditorHtml();
    scheduleCommitCurrentEditorHtml();
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
      document.execCommand('insertHTML', false, plainTextToEditorHtml(text));
    }

    commitCurrentEditorHtml();
    scheduleCommitCurrentEditorHtml();
  }

  useImperativeHandle(ref, () => ({
    flush: () => {
      return commitCurrentEditorHtml();
    },
    getHtml: () => String(editorRef.current?.innerHTML || latestHtmlRef.current || ''),
    setHtml: (nextHtml) => {
      const normalized = String(nextHtml || '');
      latestHtmlRef.current = normalized;
      if (editorRef.current) editorRef.current.innerHTML = normalized;
      contractEditor?.setHtml?.(normalized);
      onChangeHtml?.(normalized);
    },
    insertTag: (tag) => {
      insertTextAtCursor(String(tag || ''));
    },
    focus: () => {
      editorRef.current?.focus();
    },
  }), [contractEditor, onChangeHtml]);

  return (
    <div className="block" data-contract-editor-shell="true">
      <p className="mb-2 text-xs font-medium text-[#64748b]">Cole aqui o contrato base mantendo negrito, títulos e estrutura visual.</p>
      <p className="mb-2 text-xs font-medium text-[#64748b]">Texto do contrato = sua versão rica/editável.</p>
      <div className="mb-2 flex flex-wrap gap-2">
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
      <div
        ref={editorRef}
        data-contract-rich-editor="true"
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        onPaste={handlePaste}
        onKeyUp={handleInput}
        onMouseUp={handleInput}
        onCut={scheduleCommitCurrentEditorHtml}
        className={`prose prose-slate max-w-none overflow-y-auto rounded-2xl border border-[#dbe3ef] bg-white px-4 py-3 text-sm text-[#0f172a] outline-none transition focus:border-violet-400 ${minHeightClass}`}
      />
    </div>
  );
});

export default RichContractEditor;
