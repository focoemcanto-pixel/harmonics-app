'use client';

import { useEffect, useRef, useState } from 'react';

const SCENARIO = 'Oi! Quero orçamento para meu casamento dia 11/12/2027 na Chácara de Alice.';

export default function ChatSimulationPanel() {
  const [messages, setMessages] = useState([]);
  const [engine, setEngine] = useState('legacy');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('engine') === 'v2') setEngine('v2');
  }, []);
  const [simulationClosing, setSimulationClosing] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [review, setReview] = useState(null);
  const sessionRef = useRef({ id: null, revision: 0 });
  const [lead, setLead] = useState({});
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState([]);
  const endRef = useRef(null);
  const requestRef = useRef(null);

  function applySession(session) {
    const current = sessionRef.current;
    if (current.id !== session.id || session.revision <= current.revision) return;
    sessionRef.current = { id: session.id, revision: session.revision };
    setMessages(session.state.messages);
    setLead(session.state.lead);
    setReview(session.state.closing);
  }

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('simulation');
    if (id) {
      sessionRef.current = { id, revision: 0 };
      setSessionId(id);
    }
  }, []);
  useEffect(() => {
    if (!sessionId || engine !== 'v2') return;
    let active = true;
    const refresh = async () => {
      if (requestRef.current) return;
      const response = await fetch('/api/ai/commercial/simulation-supervision?id=' + encodeURIComponent(sessionId), { cache: 'no-store' }).catch(() => null);
      if (response?.ok && active && !requestRef.current) {
        const data = await response.json();
        if (data.session) applySession(data.session);
      }
    };
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [sessionId, engine]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, pending]);

  function restart() {
    requestRef.current?.abort();
    requestRef.current = null;
    setMessages([]);
    setLead({});
    setSimulationClosing(null);
    sessionRef.current = { id: null, revision: 0 };
    setSessionId(null);
    setReview(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('simulation');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    setDiagnostics([]);
    setDraft('');
    setPending(false);
    setError('');
  }

  function selectEngine(next) {
    if (next === engine) return;
    restart();
    setEngine(next);
    const url = new URL(window.location.href);
    if (next === 'v2') url.searchParams.set('engine', 'v2');
    else url.searchParams.delete('engine');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
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
    if (engine === 'v2' && !sessionRef.current.id) {
      sessionRef.current = { id: crypto.randomUUID(), revision: 0 };
      setSessionId(sessionRef.current.id);
    }
    try {
      const response = await fetch('/api/ai/commercial/chat-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, lead, simulationClosing, engine, sessionId: sessionRef.current.id, revision: sessionRef.current.revision }),
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        if (data.diagnostic) setDiagnostics((old) => [...old, { message: content, ...data.diagnostic }]);
        throw new Error(data.error || 'Falha na simulação.');
      }
      if (controller.signal.aborted) return;
      if (data.session) {
        applySession(data.session);
        const url = new URL(window.location.href);
        url.searchParams.set('simulation', data.session.id);
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      } else {
        setMessages((old) => [...old, { role: 'assistant', content: data.reply }]);
        setLead(data.lead || {});
      }
      setSimulationClosing(data.simulationClosing || null);
      setDiagnostics((old) => [...old, { message: content, ...(data.diagnostic || {}) }]);
    } catch (e) {
      if (!controller.signal.aborted) {
        setMessages(messages);
        setDraft(content);
        setError(e.message || 'Falha ao conversar com a Nara. Você pode tentar novamente.');
      }
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
          <h2 className="text-base font-bold">Chat de Testes — Nara {engine === 'v2' ? 'Agent v2' : 'Atual'}</h2>
          <p className="text-xs text-slate-500">{engine === 'v2' ? 'AI SDK · agente conversacional experimental · somente simulação' : 'Motor atual · regras oficiais'} · nenhuma mensagem enviada ao WhatsApp</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Selecionar motor de teste" className="flex rounded-xl border border-slate-300 bg-slate-50 p-1">
            <button type="button" onClick={() => selectEngine('legacy')} aria-pressed={engine === 'legacy'}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${engine === 'legacy' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Atual</button>
            <button type="button" onClick={() => selectEngine('v2')} aria-pressed={engine === 'v2'}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${engine === 'v2' ? 'bg-violet-700 text-white' : 'text-slate-500'}`}>Nara Agent v2</button>
          </div>
          <button type="button" onClick={restart} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Reiniciar conversa</button>
        </div>
      </div>
      <div className="h-[440px] space-y-4 overflow-y-auto bg-slate-50 p-4 sm:p-5" aria-live="polite">
        {!messages.length && (
          <div className="mx-auto mt-12 max-w-md space-y-4 text-center">
            <div className="text-3xl">🎶</div>
            <h3 className="font-semibold">Converse com a Nara como se fosse um cliente</h3>
            <p className="text-sm text-slate-500">Teste espaços, receptivo, dúvidas, orçamentos e continuidade. {engine === 'v2' ? 'O novo motor decide quando responder e quando consultar ferramentas, sem roteiro de ações fixas.' : 'Este é o motor atual para comparação.'} Este chat é temporário e isolado.</p>
            <button type="button" onClick={() => setDraft(SCENARIO)} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">Preparar teste: Chácara de Alice</button>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[77%] ${m.role === 'user' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-800'}`}>
              <div className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${m.role === 'user' ? 'text-slate-300' : 'text-violet-700'}`}>{m.role === 'user' ? 'Cliente (simulado)' : 'Nara'}</div>
              {m.content}
              {m.link && <a className="mt-2 block font-semibold underline" href={m.link} target="_blank" rel="noreferrer">Abrir link fictício de pré-contrato</a>}
            </div>
          </div>
        ))}
        {pending && <div className="text-xs text-slate-500">Nara está respondendo…</div>}
        <div ref={endRef} />
      </div>
      <div className="space-y-2 border-t border-slate-100 p-4">
        {review?.status === 'awaiting_approval' && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
            <strong>Aguardando aprovação</strong>
            <a className="underline" href={`?tab=center&simulation=${sessionId}`} target="_blank" rel="noreferrer">Abrir fila no dashboard de IA</a>
          </div>
        )}
        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error} <span className="font-semibold">Se a mensagem já estiver no histórico, reinicie para repetir.</span></div>}
        <form onSubmit={send} className="flex items-end gap-2">
          <textarea className="min-h-[44px] max-h-36 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} placeholder="Escreva como um cliente no WhatsApp..." value={draft} maxLength={1200} disabled={pending || messages.length >= 38} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button type="submit" disabled={pending || !draft.trim() || messages.length >= 38} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Enviar</button>
        </form>
        <p className="text-[11px] text-slate-500">Teste isolado: sem clientes reais, contratos ou pagamentos. A pesquisa de locais e o modelo dependem dos provedores configurados. A memória geográfica de teste fica separada. Encaminhamentos são simulados.</p>
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
                {d.geography && (
                  <div className="mt-2 space-y-1 text-slate-600">
                    <p>Geografia · {d.geography.status || 'pendente'} · Cache: {d.geography.cache} · Faixa: {d.geography.tier || '—'}</p>
                    {d.geography.route && <p>Rota por {d.geography.provider}: {d.geography.route.distanceKm.toFixed(1)} km · {d.geography.route.travelMinutes.toFixed(0)} min</p>}
                    {d.geography.source && <p>Fonte do mapa: <a className="underline" href={d.geography.source} target="_blank" rel="noreferrer">{d.geography.source === 'https://www.geoapify.com/' ? 'Powered by Geoapify' : '© OpenStreetMap contributors'}</a>{d.geography.attribution && ` · ${d.geography.attribution}`}</p>}
                    {d.geography.webSource && <p>Fonte pública: <a className="underline" href={d.geography.webSource} target="_blank" rel="noreferrer">abrir referência</a></p>}
                    {d.geography.webSearchFeeUsd > 0 && <p>Pesquisa web: US$ {d.geography.webSearchFeeUsd.toFixed(2)} em chamadas, além dos tokens.</p>}
                    {d.geography.checkedAt && <p>Verificado em {new Date(d.geography.checkedAt).toLocaleString('pt-BR', { timeZone: 'America/Bahia' })}</p>}
                    {d.geography.calls.map((call, n) => <p key={n}>{call.provider} · {call.cached ? 'cache do provedor' : call.status}{call.httpStatus ? ` (HTTP ${call.httpStatus})` : ''} · {call.latencyMs} ms{call.usage ? ` · ${call.usage.searchCalls} buscas, ${call.usage.inputTokens ?? '—'}/${call.usage.outputTokens ?? '—'} tokens` : ''}</p>)}
                  </div>
                )}
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

