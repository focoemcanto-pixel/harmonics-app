'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

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
    sessionKey,
    onChangeHtml,
    readOnly = false,
    minHeightClass = 'min-h-[260px]',
  },
  ref
) {
  const editorRef = useRef(null);
  const htmlRef = useRef(String(initialHtml || ''));

  useEffect(() => {
    const nextHtml = String(initialHtml || '');
    htmlRef.current = nextHtml;
    if (editorRef.current) {
      editorRef.current.innerHTML = nextHtml;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  function commitHtml(nextHtml) {
    htmlRef.current = String(nextHtml || '');
    onChangeHtml?.(htmlRef.current);
  }

  function handleInput() {
    if (!editorRef.current) return;
    commitHtml(editorRef.current.innerHTML || '');
  }

  function runEditorCommand(command, value) {
    if (readOnly || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    commitHtml(editorRef.current.innerHTML || '');
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

    queueMicrotask(() => {
      if (!editorRef.current) return;
      commitHtml(editorRef.current.innerHTML || '');
    });
  }

  useImperativeHandle(ref, () => ({
    getHtml: () => String(editorRef.current?.innerHTML || htmlRef.current || ''),
    setHtml: (nextHtml) => {
      const normalized = String(nextHtml || '');
      htmlRef.current = normalized;
      if (editorRef.current) editorRef.current.innerHTML = normalized;
      onChangeHtml?.(normalized);
    },
    focus: () => {
      editorRef.current?.focus();
    },
  }), [onChangeHtml]);

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-[#64748b]">Texto do contrato</span>
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
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        onPaste={handlePaste}
        className={`prose prose-slate max-w-none overflow-y-auto rounded-2xl border border-[#dbe3ef] bg-white px-4 py-3 text-sm text-[#0f172a] outline-none transition focus:border-violet-400 ${minHeightClass}`}
      />
    </label>
  );
});

export default RichContractEditor;
