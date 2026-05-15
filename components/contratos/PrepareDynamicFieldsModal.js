'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const DYNAMIC_FIELDS = [
  { value: 'client_name', label: 'Nome do cliente' },
  { value: 'client_marital_status', label: 'Estado civil' },
  { value: 'client_profession', label: 'Profissão' },
  { value: 'client_cpf', label: 'CPF do cliente' },
  { value: 'client_rg', label: 'RG do cliente' },
  { value: 'client_address', label: 'Endereço do cliente' },
  { value: 'formation', label: 'Formação' },
  { value: 'instruments', label: 'Instrumentos' },
  { value: 'event_date', label: 'Data do evento' },
  { value: 'event_time', label: 'Hora do evento' },
  { value: 'event_location', label: 'Local do evento' },
  { value: 'total_amount', label: 'Valor total' },
  { value: 'total_amount_extenso', label: 'Valor total por extenso' },
  { value: 'deposit_due_date', label: 'Data do sinal' },
  { value: 'balance_due_date', label: 'Data do saldo' },
  { value: 'card_due_date', label: 'Data do cartão' },
  { value: 'extras_text', label: 'Texto dos extras' },
  { value: 'client_signature', label: 'Assinatura do cliente' },
  { value: 'accepted_name', label: 'Nome do signatário' },
  { value: 'accepted_cpf', label: 'CPF do signatário' },
  { value: 'accepted_datetime', label: 'Data e hora do aceite' },
  { value: 'accepted_ip', label: 'IP do aceite' },
  { value: 'accepted_origin', label: 'Origem do aceite' },
  { value: 'contract_token', label: 'Token do contrato' },
  { value: 'document_hash', label: 'Hash do documento' },
  { value: 'signature_stamp', label: 'Carimbo de assinatura' },
];

const FIELD_RULES = [
  { field: 'client_name', label: 'Nome do cliente', patterns: [/\bnome\b/i, /contratante/i, /cliente/i] },
  { field: 'client_cpf', label: 'CPF do cliente', patterns: [/cpf\/?cnpj/i, /\bcpf\b/i, /cnpj/i] },
  { field: 'client_rg', label: 'RG do cliente', patterns: [/\brg\b/i, /identidade/i] },
  { field: 'client_address', label: 'Endereço do cliente', patterns: [/endere[cç]o/i, /logradouro/i, /rua/i, /bairro/i] },
  { field: 'client_marital_status', label: 'Estado civil', patterns: [/estado civil/i, /casado/i, /solteiro/i] },
  { field: 'client_profession', label: 'Profissão', patterns: [/profiss[aã]o/i, /profissional/i] },
  { field: 'event_date', label: 'Data do evento', patterns: [/\bdata\b/i, /dia do evento/i, /realizar-se-[aá]/i] },
  { field: 'event_time', label: 'Hora do evento', patterns: [/hor[aá]rio/i, /\bhora\b/i, /às/i] },
  { field: 'event_location', label: 'Local do evento', patterns: [/local/i, /cerim[oô]nia/i, /recep[cç][aã]o/i, /endere[cç]o do evento/i] },
  { field: 'formation', label: 'Formação', patterns: [/forma[cç][aã]o/i, /quarteto/i, /trio/i, /banda/i] },
  { field: 'instruments', label: 'Instrumentos', patterns: [/instrumentos/i, /voz/i, /viol[aã]o/i, /teclado/i] },
  { field: 'total_amount', label: 'Valor total', patterns: [/valor total/i, /valor contratado/i, /r\$/i, /pre[cç]o/i] },
  { field: 'deposit_due_date', label: 'Data do sinal', patterns: [/sinal/i, /entrada/i] },
  { field: 'balance_due_date', label: 'Data do saldo', patterns: [/saldo/i, /restante/i] },
  { field: 'client_signature', label: 'Assinatura do cliente', patterns: [/assinatura do cliente/i, /contratante assina/i] },
  { field: 'accepted_name', label: 'Nome do signatário', patterns: [/signat[aá]rio/i, /aceite/i] },
];

const GUIDE_STEPS = {
  select: {
    title: 'Selecione um trecho do contrato',
    description: 'Selecione no texto um trecho que será preenchido automaticamente depois. Exemplo: Nome, CPF, Data ou Local.',
  },
  replace: {
    title: 'Campo reconhecido automaticamente',
    description: 'O sistema identificou a tag mais provável. Revise a sugestão e clique para substituir.',
  },
  choose: {
    title: 'Ajuste manual se precisar',
    description: 'Não ficou certo? Escolha manualmente outro campo no painel lateral antes de substituir.',
  },
  done: {
    title: 'Perfeito. Campo preparado.',
    description: 'Esse trecho agora será preenchido automaticamente quando o contrato for gerado.',
  },
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getLineContext(text, start, end) {
  const safeText = String(text || '');
  const lineStart = safeText.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextBreak = safeText.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? safeText.length : nextBreak;
  const before = safeText.slice(Math.max(0, lineStart), start);
  const selected = safeText.slice(start, end);
  const after = safeText.slice(end, lineEnd);
  return `${before} ${selected} ${after}`.replace(/\s+/g, ' ').trim();
}

function detectDynamicField({ selectedText, lineContext }) {
  const selected = normalizeText(selectedText);
  const context = normalizeText(lineContext);
  const haystack = `${selected} ${context}`;

  if (!selected.trim() && !context.trim()) return null;

  const scored = FIELD_RULES.map((rule) => {
    const score = rule.patterns.reduce((total, pattern) => {
      const selectedMatch = pattern.test(selectedText || '') || pattern.test(selected);
      const contextMatch = pattern.test(lineContext || '') || pattern.test(context);
      return total + (selectedMatch ? 4 : 0) + (contextMatch ? 2 : 0);
    }, 0);

    return { ...rule, score };
  })
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored[0]) return scored[0];
  if (/____|___|:/.test(haystack)) return { field: 'client_name', label: 'Nome do cliente', score: 1 };
  return null;
}

function GuideCard({ step, canContinue, onContinue, onDismiss, suggestionLabel }) {
  if (!step) return null;

  return (
    <div className="pointer-events-auto absolute right-5 top-[150px] z-[1300] w-[340px] rounded-[26px] border border-violet-200 bg-white p-4 shadow-[0_22px_70px_rgba(15,23,42,0.28)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">Assistente de automação</div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-black text-slate-500 hover:bg-slate-50"
          aria-label="Minimizar assistente"
        >
          ✕
        </button>
      </div>

      <h4 className="mt-3 text-[20px] font-black tracking-[-0.04em] text-[#0f172a]">{step.title}</h4>
      <p className="mt-2 text-[13px] font-semibold leading-6 text-[#64748b]">{step.description}</p>

      {suggestionLabel ? (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-black text-emerald-700">
          Sugestão detectada: {suggestionLabel}
        </div>
      ) : null}

      <button
        type="button"
        disabled={!canContinue}
        onClick={onContinue}
        className="mt-4 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.32)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {step === GUIDE_STEPS.done ? 'Continuar preparando' : 'Entendi'}
      </button>
    </div>
  );
}

export default function PrepareDynamicFieldsModal({
  initialText,
  onCancel,
  onConclude,
  onLiveChange,
}) {
  const textareaRef = useRef(null);
  const selectRef = useRef(null);
  const replaceButtonRef = useRef(null);

  const [workingText, setWorkingText] = useState(String(initialText || ''));
  const [selectedField, setSelectedField] = useState(DYNAMIC_FIELDS[0].value);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [selectedText, setSelectedText] = useState('');
  const [guideStep, setGuideStep] = useState('select');
  const [lastReplacement, setLastReplacement] = useState('');
  const [smartSuggestion, setSmartSuggestion] = useState(null);
  const [guideVisible, setGuideVisible] = useState(true);

  const selectedFieldLabel = useMemo(
    () => DYNAMIC_FIELDS.find((item) => item.value === selectedField)?.label || '',
    [selectedField]
  );

  useEffect(() => {
    if (guideStep === 'select') textareaRef.current?.focus();
  }, [guideStep]);

  function handleSelect(event) {
    const start = event.target.selectionStart || 0;
    const end = event.target.selectionEnd || 0;
    setSelectionStart(start);
    setSelectionEnd(end);

    const text = workingText.slice(start, end);
    setSelectedText(text);

    if (text?.trim()) {
      const context = getLineContext(workingText, start, end);
      const suggestion = detectDynamicField({ selectedText: text, lineContext: context });
      setSmartSuggestion(suggestion);
      setGuideVisible(true);

      if (suggestion?.field) {
        setSelectedField(suggestion.field);
        setGuideStep('replace');
      } else {
        setGuideStep('choose');
      }
    }
  }

  function handleTextChange(value) {
    setWorkingText(value);
    onLiveChange?.(value);
  }

  function handleReplace() {
    if (selectionStart === selectionEnd || !selectedText) return;

    const placeholder = `{{${selectedField}}}`;
    const nextText = `${workingText.slice(0, selectionStart)}${placeholder}${workingText.slice(selectionEnd)}`;

    handleTextChange(nextText);

    const nextCursor = selectionStart + placeholder.length;

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextCursor, nextCursor);
    });

    setSelectionStart(0);
    setSelectionEnd(0);
    setSelectedText('');
    setLastReplacement(placeholder);
    setSmartSuggestion(null);
    setGuideStep('done');
    setGuideVisible(true);
  }

  function handleGuideContinue() {
    if (guideStep === 'choose') {
      selectRef.current?.focus();
      return;
    }

    if (guideStep === 'replace') {
      replaceButtonRef.current?.focus();
      return;
    }

    if (guideStep === 'done') {
      setGuideStep('select');
      setGuideVisible(false);
      textareaRef.current?.focus();
    }
  }

  const canContinue =
    (guideStep === 'select' && !!selectedText) ||
    guideStep === 'choose' ||
    guideStep === 'replace' ||
    guideStep === 'done';

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-[#020617]/70 p-4 backdrop-blur-[2px]">
      <div className="relative max-h-[95vh] w-full max-w-6xl overflow-hidden rounded-[28px] border border-violet-100 bg-white shadow-[0_30px_80px_rgba(2,6,23,0.35)]">
        <div className="border-b border-[#e2e8f0] px-6 py-5">
          <h3 className="text-2xl font-black tracking-[-0.03em] text-[#0f172a]">Preparar campos dinâmicos</h3>
          <p className="mt-2 text-sm text-[#475569]">Selecione um trecho do contrato e o sistema tentará reconhecer a tag correta automaticamente.</p>
          <p className="mt-1 text-xs text-[#64748b]">Você ainda pode ajustar manualmente se a sugestão não for a ideal.</p>
        </div>

        <div className="grid max-h-[calc(95vh-168px)] gap-4 overflow-auto p-6 md:grid-cols-[1.5fr_1fr]">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748b]">Texto do contrato</p>
              {guideStep === 'select' ? <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700 animate-pulse">Selecione um trecho</span> : null}
            </div>

            <div className={`rounded-[24px] transition-all duration-300 ${guideStep === 'select' ? 'ring-4 ring-violet-400/30 shadow-[0_0_0_2px_rgba(124,58,237,0.20)]' : ''}`}>
              <textarea
                ref={textareaRef}
                value={workingText}
                onChange={(event) => handleTextChange(event.target.value)}
                onSelect={handleSelect}
                className="min-h-[460px] w-full rounded-2xl border border-[#dbe3ef] bg-white px-4 py-3 text-sm text-[#0f172a] outline-none transition focus:border-violet-400"
                placeholder="Selecione trechos e substitua por placeholders dinâmicos."
              />
            </div>

            <p className="text-xs text-[#64748b]">
              Seleção atual: <span className="font-semibold text-[#334155]">{selectedText ? `“${selectedText}”` : 'nenhuma'}</span>
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748b]">Campos dinâmicos disponíveis</p>
              {smartSuggestion ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700">Auto</span> : null}
            </div>

            <div className={`rounded-[22px] transition-all duration-300 ${guideStep === 'choose' ? 'ring-4 ring-violet-400/30 shadow-[0_0_0_2px_rgba(124,58,237,0.20)]' : ''}`}>
              <select
                ref={selectRef}
                value={selectedField}
                onChange={(event) => {
                  setSelectedField(event.target.value);
                  setSmartSuggestion(null);
                }}
                className="w-full rounded-2xl border border-[#dbe3ef] bg-white px-3 py-2.5 text-sm font-semibold text-[#0f172a] outline-none transition focus:border-violet-400"
              >
                {DYNAMIC_FIELDS.map((field) => (
                  <option key={field.value} value={field.value}>{field.label} ({field.value})</option>
                ))}
              </select>
            </div>

            {smartSuggestion ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
                Reconhecido automaticamente como: {smartSuggestion.label}
              </div>
            ) : null}

            <button
              ref={replaceButtonRef}
              type="button"
              onClick={handleReplace}
              disabled={!selectedText}
              className={`w-full rounded-2xl px-4 py-2.5 text-sm font-black text-white shadow-[0_12px_25px_rgba(124,58,237,0.32)] transition disabled:cursor-not-allowed disabled:opacity-60 ${guideStep === 'replace' ? 'bg-fuchsia-600 ring-4 ring-fuchsia-400/30 animate-pulse' : 'bg-violet-600 hover:bg-violet-700'}`}
            >
              Substituir por campo
            </button>

            <div className="rounded-xl border border-violet-100 bg-white px-3 py-2 text-xs text-[#475569]">
              Próxima substituição: <span className="font-bold text-violet-700">{'{{'}{selectedField}{'}}'}</span>
              <br />
              Campo selecionado: <span className="font-semibold">{selectedFieldLabel}</span>
              {lastReplacement ? <><br />Última automação criada: <span className="font-black text-emerald-600">{lastReplacement}</span></> : null}
            </div>
          </section>
        </div>

        <div className="relative z-[1350] flex flex-wrap justify-end gap-3 border-t border-[#e2e8f0] bg-white px-6 py-4">
          <button type="button" onClick={onCancel} className="rounded-2xl border border-[#dbe3ef] bg-white px-4 py-2.5 text-sm font-bold text-[#475569] transition hover:bg-slate-50">Cancelar</button>
          <button type="button" onClick={() => onConclude?.(workingText)} className="rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_25px_rgba(124,58,237,0.32)] transition hover:bg-violet-700">Concluir</button>
        </div>

        {guideVisible ? (
          <GuideCard
            step={GUIDE_STEPS[guideStep]}
            canContinue={canContinue}
            onContinue={handleGuideContinue}
            onDismiss={() => setGuideVisible(false)}
            suggestionLabel={smartSuggestion?.label}
          />
        ) : null}
      </div>
    </div>
  );
}
