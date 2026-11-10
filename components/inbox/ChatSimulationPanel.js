'use client';

import { useEffect, useRef, useState } from 'react';

const SCENARIO = 'Oi! Quero orçamento para meu casamento dia 11/12/2027 na Chácara de Alice.';

export default function ChatSimulationPanel() {
  const [messages, setMessages] = useState([]);
  const [lead, setLead] = useState({});
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState([]);
  const endRef = useRef(null);
  const requestRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, pending]);

  function restart() {
    requestRef.current?.abort();
    requestRef.current = null;
    setMessages([]);
    setLead({});
    setDiagnostics([]);
    setDraft('');
    setPending(false);
    setError('');
  }

  async function send(event) {
    event?.preventDefault();
    const content = draft.trim();
    if (pending || !content || content.length > 1200 || messages.length >= 38) return;
    const next = [...messages, { role: 'user', content }];
    setDraft('');
    setMessages(next);
    setError('');
    setPending(true);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch('/api/ai/commercial/chat-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, lead }),
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        if (data.diagnostic) setDiagnostics((old) => [...old, { message: content, ...data.diagnostic }]);
        throw new Error(data.error || 'Falha na simulação.');
      }
      if (controller.signal.aborted) return;
      setMessages((old) => [...old, { role: 'assistant', content: data.reply }]);
      setLead(data.lead || {});
      setDiagnostics((old) => [...old, { message: content, ...(data.diagnostic || {}) }]);
    } catch (e) {
      if (!controller.signal.aborted) setError(e.message || 'Falha ao conversar com a Nara. Você pode tentar novamente.');
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPending(false);
      }
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-bold">Chat de Testes — Nara</h2>
          <p className="text-xs text-slate-500">Motor real de IA e regras oficiais · nenhuma mensagem enviada ao WhatsApp</p>
        </div>
        <button type="button" onClick={restart} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Reiniciar conversa</button>
      </div>
      <div className="h-[440px] space-y-4 overflow-y-auto bg-slate-50 p-4 sm:p-5" aria-live="polite">
        {!messages.length && (
          <div className="mx-auto mt-12 max-w-md space-y-4 text-center">
            <div className="text-3xl">🎶</div>
            <h3 className="font-semibold">Converse com a Nara como se fosse um cliente</h3>
            <p className="text-sm text-slate-500">Teste identificação de espaços, perguntas, orçamentos e continuidade. Este chat é temporário e isolado.</p>
            <button type="button" onClick={() => setDraft(SCENARIO)} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">Preparar teste: Chácara de Alice</button>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[77%] ${m.role === 'user' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-800'}`}>
              <div className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${m.role === 'user' ? 'text-slate-300' : 'text-violet-700'}`}>{m.role === 'user' ? 'Cliente (simulado)' : 'Nara'}</div>
              {m.content}
            </div>
          </div>
        ))}
        {pending && <div className="text-xs text-slate-500">Nara está respondendo…</div>}
        <div ref={endRef} />
      </div>
      <div className="space-y-2 border-t border-slate-100 p-4">
        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error} <span className="font-semibold">Se a mensagem já estiver no histórico, reinicie para repetir.</span></div>}
        <form onSubmit={send} className="flex items-end gap-2">
          <textarea className="min-h-[44px] max-h-36 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} placeholder="Escreva como um cliente no WhatsApp..." value={draft} maxLength={1200} disabled={pending || messages.length >= 38} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button type="submit" disabled={pending || !draft.trim() || messages.length >= 38} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Enviar</button>
        </form>
        <p className="text-[11px] text-slate-500">Teste isolado: sem clientes reais, contratos, pagamentos, pendências ou gravação de aprendizado. O modelo de IA pode gerar consumo mínimo de tokens. Pesquisa pública gratuita de espaços conectada. Encaminhamentos são simulados.</p>
        {messages.length >= 38 && <p className="text-xs text-amber-700">Limite de mensagens alcançado. Reinicie para testar outro cenário.</p>}
      </div>
      <details className="border-t border-slate-100 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold">Diagnóstico do teste ({diagnostics.length} resposta(s))</summary>
        {!diagnostics.length ? <p className="mt-2 text-xs text-slate-500">Envie uma mensagem para ver quais ferramentas a Nara consultou.</p> : (
          <div className="mt-3 space-y-3">
            {diagnostics.map((d, i) => (
              <div key={i} className="rounded-xl bg-slate-50 p-3 text-xs">
                <strong>Turno {i + 1}</strong>
                <p className="mt-1 text-slate-600">Ferramentas: {d.toolCalls?.join(', ') || 'Nenhuma'}</p>
                {d.errorCode && <p className="text-red-700">Validação: {d.errorCode}</p>}
                {d.latencyMs && <p className="text-slate-500">Tempo: {(d.latencyMs / 1000).toFixed(1)} s</p>}
                {d.intent && <p className="text-slate-600">Intenção: {d.intent}</p>}
                {(d.results || []).map((r, n) => <p key={n} className="text-slate-600">{r.ferramenta}: {r.resultado}{r.detalhe ? ` · ${r.detalhe}` : ''}</p>)}
                <p className="mt-1 text-slate-500">Modelo: {d.model || '—'} · Motor: {d.engineVersion || '—'} · Custo: US$ {Number(d.costUsd || 0).toFixed(5)} · Simulação sem efeitos comerciais</p>
                {d.webSearchStatus && d.webSearchStatus !== 'nao_necessaria' && (
                  <p className="mt-1 text-slate-600">Busca online do espaço: {d.webSearchStatus === 'found' ? 'localizado' : d.webSearchStatus === 'not_found' ? 'não localizado' : d.webSearchStatus === 'ambiguous' ? 'mais de um resultado' : 'indisponível'} · {d.webAttribution || '© OpenStreetMap contributors'}</p>
                )}
              </div>
            ))}
            {Object.keys(lead).length > 0 && <div className="rounded-xl bg-violet-50 p-3 text-xs"><strong>Memória temporária do atendimento</strong><pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(lead, null, 2)}</pre></div>}
          </div>
        )}
      </details>
    </section>
  );
}

