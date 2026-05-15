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

const GUIDE_STEPS = {
  select: {
    title: 'Selecione um trecho do contrato',
    description: 'Selecione no texto um trecho que será preenchido automaticamente depois. Exemplo: Nome, CPF, Data ou Local.',
  },
  choose: {
    title: 'Escolha o campo automático',
    description: 'Agora selecione no painel lateral qual informação do sistema substituirá esse trecho.',
  },
  replace: {
    title: 'Transforme em campo dinâmico',
    description: 'Clique para substituir o trecho pela tag automática do sistema.',
  },
  done: {
    title: 'Perfeito. Campo preparado.',
    description: 'Esse trecho agora será preenchido automaticamente quando o contrato for gerado.',
  },
};

function GuideCard({ step, canContinue, onContinue }) {
  if (!step) return null;

  return (
    <div className="pointer-events-auto absolute bottom-5 right-5 z-[1300] w-[360px] rounded-[28px] border border-violet-200 bg-white p-5 shadow-[0_25px_80px_rgba(15,23,42,0.35)]">
      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">Assistente de automação</div>
      <h4 className="mt-3 text-[24px] font-black tracking-[-0.04em] text-[#0f172a]">{step.title}</h4>
      <p className="mt-2 text-[14px] font-semibold leading-7 text-[#64748b]">{step.description}</p>

      <button
        type="button"
        disabled={!canContinue}
        onClick={onContinue}
        className="mt-5 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.32)] disabled:cursor-not-allowed disabled:opacity-40"
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

  const selectedFieldLabel = useMemo(
    () => DYNAMIC_FIELDS.find((item) => item.value === selectedField)?.label || '',
    [selectedField]
  );

  useEffect(() => {
    if (guideStep === 'select') {
      textareaRef.current?.focus();
    }
  }, [guideStep]);

  function handleSelect(event) {
    const start = event.target.selectionStart || 0;
    const end = event.target.selectionEnd || 0;
    setSelectionStart(start);
    setSelectionEnd(end);

    const text = workingText.slice(start, end);
    setSelectedText(text);

    if (text?.trim()) {
      if (/nome/i.test(text)) {
        setSelectedField('client_name');
      }

      if (/cpf/i.test(text)) {
        setSelectedField('client_cpf');
      }

      if (guideStep === 'select') {
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

    setSelectionStart(nextCursor);
    setSelectionEnd(nextCursor);
    setSelectedText('');
    setLastReplacement(placeholder);
    setGuideStep('done');
  }

  function handleGuideContinue() {
    if (guideStep === 'choose') {
      setGuideStep('replace');
      selectRef.current?.focus();
      return;
    }

    if (guideStep === 'replace') {
      replaceButtonRef.current?.focus();
      return;
    }

    if (guideStep === 'done') {
      setGuideStep('select');
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
          <p className="mt-2 text-sm text-[#475569]">Selecione um trecho do contrato e associe a um campo do sistema.</p>
          <p className="mt-1 text-xs text-[#64748b]">A preparação de campos trabalha em texto limpo para facilitar a seleção.</p>
          <p className="mt-1 text-xs font-medium text-[#64748b]">Esse recurso ajuda a transformar contratos prontos em templates dinâmicos.</p>
        </div>

        <div className="grid max-h-[calc(95vh-168px)] gap-4 overflow-auto p-6 md:grid-cols-[1.5fr_1fr]">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748b]">Texto do contrato</p>
              {guideStep === 'select' ? (
                <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700 animate-pulse">Selecione um trecho</span>
              ) : null}
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
              Seleção atual:{' '}
              <span className="font-semibold text-[#334155]">{selectedText ? `“${selectedText}”` : 'nenhuma'}</span>
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748b]">Campos dinâmicos disponíveis</p>
              {guideStep === 'choose' ? (
                <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700 animate-pulse">Escolha o campo</span>
              ) : null}
            </div>

            <div className={`rounded-[22px] transition-all duration-300 ${guideStep === 'choose' ? 'ring-4 ring-violet-400/30 shadow-[0_0_0_2px_rgba(124,58,237,0.20)]' : ''}`}>
              <select
                ref={selectRef}
                value={selectedField}
                onChange={(event) => setSelectedField(event.target.value)}
                className="w-full rounded-2xl border border-[#dbe3ef] bg-white px-3 py-2.5 text-sm font-semibold text-[#0f172a] outline-none transition focus:border-violet-400"
              >
                {DYNAMIC_FIELDS.map((field) => (
                  <option key={field.value} value={field.value}>{field.label} ({field.value})</option>
                ))}
              </select>
            </div>

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
              {lastReplacement ? (
                <>
                  <br />
                  Última automação criada: <span className="font-black text-emerald-600">{lastReplacement}</span>
                </>
              ) : null}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-[#e2e8f0] bg-white px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-[#dbe3ef] bg-white px-4 py-2.5 text-sm font-bold text-[#475569] transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConclude?.(workingText)}
            className="rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_25px_rgba(124,58,237,0.32)] transition hover:bg-violet-700"
          >
            Concluir
          </button>
        </div>

        <GuideCard
          step={GUIDE_STEPS[guideStep]}
          canContinue={canContinue}
          onContinue={handleGuideContinue}
        />
      </div>
    </div>
  );
}
