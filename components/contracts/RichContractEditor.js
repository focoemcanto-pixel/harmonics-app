'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  SeparatorHorizontal,
  Undo2,
} from 'lucide-react';
import { useContractEditor } from '@/contexts/ContractEditorContext';
import { normalizePastedContractHtml } from '@/lib/contracts/pasteNormalize';
import { withOrderedListMarkers } from '@/lib/contracts/listMarkers';

// Toolbar enxuta: só o que um contrato precisa. `state` indica o que está ativo na seleção.
const EDITOR_GROUPS = [
  [
    { key: 'undo', label: 'Desfazer', icon: Undo2, command: 'undo' },
    { key: 'redo', label: 'Refazer', icon: Redo2, command: 'redo' },
  ],
  [
    { key: 'h2', label: 'Título', icon: Heading2, command: 'formatBlock', value: '<h2>', state: (s) => s.block === 'h2' },
    { key: 'h3', label: 'Subtítulo', icon: Heading3, command: 'formatBlock', value: '<h3>', state: (s) => s.block === 'h3' },
    { key: 'p', label: 'Parágrafo', icon: Pilcrow, command: 'formatBlock', value: '<p>', state: (s) => s.block === 'p' },
  ],
  [
    { key: 'bold', label: 'Negrito', icon: Bold, command: 'bold', state: (s) => s.bold },
    { key: 'italic', label: 'Itálico', icon: Italic, command: 'italic', state: (s) => s.italic },
  ],
  [
    { key: 'ul', label: 'Lista', icon: List, command: 'insertUnorderedList', state: (s) => s.ul },
    { key: 'ol', label: 'Lista numerada', icon: ListOrdered, command: 'insertOrderedList', state: (s) => s.ol },
  ],
  [
    { key: 'left', label: 'Alinhar à esquerda', icon: AlignLeft, command: 'justifyLeft', state: (s) => s.align === 'left' },
    { key: 'center', label: 'Centralizar', icon: AlignCenter, command: 'justifyCenter', state: (s) => s.align === 'center' },
    { key: 'justify', label: 'Justificar', icon: AlignJustify, command: 'justifyFull', state: (s) => s.align === 'justify' },
  ],
  [
    { key: 'hr', label: 'Separador', icon: SeparatorHorizontal, command: 'insertHorizontalRule' },
  ],
];

const EMPTY_STATE = { block: '', bold: false, italic: false, ul: false, ol: false, align: 'left' };

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
  const [selectionState, setSelectionState] = useState(EMPTY_STATE);

  // Estado da toolbar acompanha a seleção dentro do editor.
  useEffect(() => {
    function readSelectionState() {
      const editor = editorRef.current;
      const selection = typeof window !== 'undefined' ? window.getSelection() : null;
      if (!editor || !selection?.anchorNode || !editor.contains(selection.anchorNode)) return;
      let node = selection.anchorNode.nodeType === 1 ? selection.anchorNode : selection.anchorNode.parentElement;
      let block = '';
      let align = 'left';
      while (node && node !== editor) {
        const tag = node.tagName?.toLowerCase();
        if (!block && /^(p|h1|h2|h3|h4|li)$/.test(tag)) {
          block = tag === 'li' ? '' : tag;
          const value = node.style?.textAlign || node.getAttribute?.('align') || '';
          if (/center|justify|right/.test(value)) align = value;
        }
        node = node.parentElement;
      }
      setSelectionState({
        block,
        align,
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
      });
    }
    document.addEventListener('selectionchange', readSelectionState);
    return () => document.removeEventListener('selectionchange', readSelectionState);
  }, []);

  useEffect(() => {
    if (!canHydrate) return;
    const nextHtml = String(initialHtml || '');
    latestHtmlRef.current = nextHtml;
    if (editorRef.current) {
      editorRef.current.innerHTML = withOrderedListMarkers(nextHtml);
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
    document.execCommand('defaultParagraphSeparator', false, 'p');
    document.execCommand(command, false, value);
    commitCurrentEditorHtml();
    scheduleCommitCurrentEditorHtml();
  }

  // Colar blocos (títulos, listas...) com o cursor dentro de um título faria o navegador aninhar
  // tudo no título. Antes de inserir, o cursor vai para um parágrafo (sem sair da pilha de desfazer).
  function prepareBlockPaste(html) {
    if (!/<(h[1-6]|p|ul|ol|hr|table)\b/i.test(html)) return;
    document.execCommand('defaultParagraphSeparator', false, 'p');
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) document.execCommand('delete');
    let node = selection?.anchorNode || null;
    if (node && node.nodeType !== 1) node = node.parentElement;
    let heading = null;
    while (node && node !== editorRef.current) {
      if (/^H[1-6]$/.test(node.tagName)) heading = node;
      node = node.parentElement;
    }
    if (!heading) return;
    if (heading.textContent.trim()) document.execCommand('insertParagraph');
    document.execCommand('formatBlock', false, '<p>');
  }

  function handlePaste(event) {
    if (readOnly) return;
    event.preventDefault();

    const clipboard = event.clipboardData;
    const html = clipboard?.getData('text/html');
    const text = clipboard?.getData('text/plain');
    // Conteúdo formatado: mantém a estrutura (títulos, negrito, listas, separadores, quebras)
    // e descarta fonte/cor/tamanhos externos. Placeholders e condicionais seguem intactos.
    const normalizedHtml = html ? normalizePastedContractHtml(html) : '';

    if (normalizedHtml) {
      prepareBlockPaste(normalizedHtml);
      document.execCommand('insertHTML', false, normalizedHtml);
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
      if (editorRef.current) editorRef.current.innerHTML = withOrderedListMarkers(normalized);
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
      <div
        role="toolbar"
        aria-label="Formatação do contrato"
        className="sticky top-0 z-10 -mx-1 mb-3 flex items-center gap-1 overflow-x-auto rounded-[14px] border border-[#e4e7ec] bg-white/95 p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)] backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {EDITOR_GROUPS.map((group, groupIndex) => (
          <div key={groupIndex} className={`flex shrink-0 items-center gap-0.5 ${groupIndex ? 'border-l border-[#eceef2] pl-1' : ''}`}>
            {group.map((action) => {
              const Icon = action.icon;
              const active = action.state ? action.state(selectionState) : false;
              return (
                <button
                  key={action.key}
                  type="button"
                  title={action.label}
                  aria-label={action.label}
                  aria-pressed={action.state ? active : undefined}
                  disabled={readOnly}
                  // mousedown não rouba a seleção do texto; o comando age sobre o que está selecionado.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => runEditorCommand(action.command, action.value)}
                  className={`flex h-9 min-w-9 items-center justify-center rounded-[10px] px-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    active ? 'bg-[#0c0d12] text-white' : 'text-[#475467] hover:bg-[#f2f4f7] hover:text-[#0c0d12]'
                  }`}
                >
                  <Icon size={17} strokeWidth={2} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div
        ref={editorRef}
        data-contract-rich-editor="true"
        data-placeholder="Cole ou escreva o contrato aqui. Títulos, negrito, listas e placeholders como {{client_name}} são preservados."
        contentEditable={!readOnly}
        suppressContentEditableWarning
        spellCheck
        onInput={handleInput}
        onBlur={handleInput}
        onPaste={handlePaste}
        onKeyUp={handleInput}
        onMouseUp={handleInput}
        onCut={scheduleCommitCurrentEditorHtml}
        className={`hx-doc hx-doc-editor max-w-none overflow-y-auto rounded-[16px] border border-[#e4e7ec] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-[border-color,box-shadow] focus:border-violet-400 focus:shadow-[0_0_0_4px_rgba(124,58,237,0.12)] md:px-10 md:py-8 ${minHeightClass}`}
      />
      <p className="mt-2 text-[12px] text-[#8b93a3]">Ao colar de Word ou Google Docs, a estrutura é mantida e a formatação externa (fonte, cor, tamanho) é removida.</p>
    </div>
  );
});

export default RichContractEditor;
