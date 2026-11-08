'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAppToast } from '@/components/ui/ToastProvider';
import { HANDOFF_REASON_LABELS } from '@/lib/ai/agent/policy.mjs';

const LIST_POLL_MS = 4000;
const THREAD_POLL_MS = 3000;
const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'needs_human', label: 'Precisa de humano', counter: 'needs_human' },
  { key: 'unread', label: 'Não lidas', counter: 'unread' },
  { key: 'ai', label: 'Com a IA', counter: 'ai_open' },
  { key: 'human', label: 'Com a equipe' },
  { key: 'closed', label: 'Encerradas' },
];
const APPROVAL_LABELS = { proposal: 'Proposta', discount: 'Desconto', contract_change: 'Alteração contratual', other: 'Outro' };

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function maskPhone(value) {
  const d = String(value || '').replace(/\D/g, '');
  return d.length > 4 ? `+${d.slice(0, d.length - 4).replace(/\d(?=\d{2})/g, '•')}${d.slice(-4)}` : d;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok && body?.ok !== false, status: response.status, body };
}

function OwnerBadge({ conversation }) {
  if (conversation.state === 'closed') return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Encerrada</span>;
  if (conversation.needs_human) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Precisa de humano</span>;
  return conversation.owner === 'ai'
    ? <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">IA</span>
    : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Equipe</span>;
}

function MessageBubble({ message }) {
  const inbound = message.direction === 'inbound';
  const author = inbound ? null
    : message.sender_type === 'ai' ? 'IA'
      : message.origin === 'business_app' ? 'App WhatsApp Business'
        : message.origin === 'history' ? 'Histórico' : 'Equipe';
  const text = message.content || (message.message_type !== 'text' ? `[${message.message_type}]` : '');
  return (
    <div className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${inbound ? 'bg-white text-slate-900' : message.sender_type === 'ai' ? 'bg-violet-600 text-white' : 'bg-emerald-600 text-white'}`}>
        {author ? <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-75">{author}</div> : null}
        {text ? <div className="whitespace-pre-wrap break-words">{text}</div> : null}
        {message.transcript ? <div className={`mt-1 text-xs italic ${inbound ? 'text-slate-500' : 'opacity-80'}`}>🎤 {message.transcript}</div> : null}
        <div className="mt-1 text-right text-[10px] opacity-60">
          {formatTime(message.provider_created_at || message.created_at)}
          {!inbound && message.status && message.status !== 'sent' ? ` · ${message.status}` : ''}
        </div>
      </div>
    </div>
  );
}

export default function InboxClient({ canAdmin = false }) {
  const toast = useAppToast();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState([]);
  const [counters, setCounters] = useState({});
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [editingDrafts, setEditingDrafts] = useState({});
  const [sending, setSending] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const lastCountersRef = useRef(null);
  const threadEndRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if ('Notification' in window) setNotifyEnabled(Notification.permission === 'granted');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const notify = useCallback((title, body) => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;
    try { new Notification(title, { body, tag: 'harmonics-inbox' }); } catch { /* navegador sem suporte */ }
  }, []);

  const loadList = useCallback(async () => {
    const params = new URLSearchParams({ filter });
    if (search.trim()) params.set('q', search.trim());
    const { ok, body } = await api(`/api/ai/inbox/conversations?${params}`);
    setLoadingList(false);
    if (!ok) return;
    setConversations(body.conversations || []);
    const next = body.counters || {};
    const prev = lastCountersRef.current;
    if (prev) {
      if ((next.needs_human || 0) > (prev.needs_human || 0)) {
        toast.info?.('Uma conversa precisa de atendimento humano.');
        notify('Harmonics Inbox', 'Uma conversa precisa de atendimento humano.');
      } else if ((next.unread || 0) > (prev.unread || 0)) {
        notify('Harmonics Inbox', 'Nova mensagem de cliente.');
      }
    }
    lastCountersRef.current = next;
    setCounters(next);
  }, [filter, search, notify, toast]);

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    const { ok, body } = await api(`/api/ai/conversations/${id}`);
    if (ok) setDetail(body);
  }, []);

  useEffect(() => {
    const initial = setTimeout(loadList, 0);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') loadList(); }, LIST_POLL_MS);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const initial = setTimeout(() => {
      loadDetail(selectedId);
      api(`/api/ai/conversations/${selectedId}/read`, { method: 'POST' });
    }, 0);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') loadDetail(selectedId); }, THREAD_POLL_MS);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [selectedId, loadDetail]);

  const messageCount = detail?.messages?.length || 0;
  useEffect(() => { threadEndRef.current?.scrollIntoView({ block: 'end' }); }, [messageCount, selectedId]);

  useEffect(() => {
    const total = Number(counters.needs_human || 0) + Number(counters.unread || 0);
    document.title = total ? `(${total}) Inbox · Harmonics` : 'Inbox · Harmonics';
  }, [counters]);

  const conversation = detail?.conversation || null;
  const drafts = useMemo(() => (detail?.outbox || []).filter((o) => o.status === 'draft'), [detail]);
  const failed = useMemo(() => (detail?.outbox || []).filter((o) => ['failed', 'unknown'].includes(o.status)), [detail]);
  const pendingApprovals = useMemo(() => (detail?.approvals || []).filter((a) => a.status === 'pending'), [detail]);

  async function switchOwner(owner) {
    const { ok, body } = await api(`/api/ai/conversations/${selectedId}/handoff`, {
      method: 'POST', body: JSON.stringify({ owner, reason: 'manual' }),
    });
    if (!ok) return toast.error(body?.error || 'Não foi possível transferir.');
    toast.success(owner === 'human' ? 'Você assumiu o atendimento.' : 'Conversa devolvida para a IA.');
    loadDetail(selectedId); loadList();
  }

  async function setState(state) {
    const { ok } = await api(`/api/ai/conversations/${selectedId}`, { method: 'PATCH', body: JSON.stringify({ state }) });
    if (!ok) return toast.error('Não foi possível atualizar.');
    loadDetail(selectedId); loadList();
  }

  async function sendMessage(event) {
    event?.preventDefault();
    const content = draftText.trim();
    if (!content || sending) return;
    setSending(true);
    const clientMessageId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const { ok, body } = await api(`/api/ai/conversations/${selectedId}/messages`, {
      method: 'POST', body: JSON.stringify({ content, client_message_id: clientMessageId }),
    });
    setSending(false);
    if (!ok) return toast.error(body?.error || 'Falha ao enviar.');
    if (body.status === 'failed') toast.error(`Envio recusado pelo WhatsApp (${body.error || 'erro'}).`);
    else if (body.status === 'unknown') toast.error('Envio sem confirmação. Verifique antes de reenviar.');
    setDraftText('');
    loadDetail(selectedId); loadList();
  }

  async function draftAction(id, action) {
    const content = editingDrafts[id];
    const { ok, body } = await api(`/api/ai/drafts/${id}`, { method: 'POST', body: JSON.stringify({ action, content }) });
    if (!ok) return toast.error(body?.error || 'Falha no rascunho.');
    if (action === 'approve' && body.status === 'failed') toast.error(`Envio recusado (${body.error || 'erro'}).`);
    loadDetail(selectedId); loadList();
  }

  async function decideApproval(id, decision) {
    const { ok, body } = await api(`/api/ai/approvals/${id}`, { method: 'POST', body: JSON.stringify({ decision }) });
    if (!ok) return toast.error(body?.error || 'Falha ao registrar decisão.');
    toast.success(body.quote_id ? 'Aprovado: rascunho criado em Orçamentos.' : 'Decisão registrada.');
    loadDetail(selectedId);
  }

  async function enableNotifications() {
    if (!('Notification' in window)) return toast.error('Navegador sem suporte a notificações.');
    const permission = await Notification.requestPermission();
    setNotifyEnabled(permission === 'granted');
  }

  return (
    <div className="flex h-[calc(100dvh-140px)] min-h-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <aside className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-slate-200 md:w-[360px]`}>
        <div className="space-y-2 border-b border-slate-100 p-3">
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome ou número"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
            {canAdmin ? <Link href="/inbox/inteligencia" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">IA</Link> : null}
            {canAdmin ? <Link href="/inbox/configuracoes" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Config.</Link> : null}
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${filter === f.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {f.label}{f.counter && counters[f.counter] ? ` (${counters[f.counter]})` : ''}
              </button>
            ))}
          </div>
          {!notifyEnabled ? (
            <button type="button" onClick={enableNotifications} className="text-xs font-semibold text-violet-700">Ativar notificações do navegador</button>
          ) : null}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingList ? <div className="p-6 text-sm text-slate-500">Carregando conversas…</div> : null}
          {!loadingList && !conversations.length ? (
            <div className="p-6 text-sm text-slate-500">Nenhuma conversa ainda. As mensagens do WhatsApp aparecem aqui assim que o canal oficial estiver conectado.</div>
          ) : null}
          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={`flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${selectedId === c.id ? 'bg-violet-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-slate-900">{c.contact_name || maskPhone(c.provider_chat_id)}</span>
                <span className="shrink-0 text-[11px] text-slate-400">{formatTime(c.last_message_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-slate-500">{c.last_message_direction === 'outbound' ? '↪ ' : ''}{c.last_message_preview || '—'}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <OwnerBadge conversation={c} />
                  {c.unread_count ? <span className="rounded-full bg-violet-600 px-1.5 text-[11px] font-bold text-white">{c.unread_count}</span> : null}
                </span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-slate-50`}>
        {!conversation ? (
          <div className="m-auto max-w-sm p-6 text-center text-sm text-slate-500">Selecione uma conversa para ver o histórico e assumir ou devolver o atendimento.</div>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
              <button type="button" onClick={() => { setSelectedId(null); setDetail(null); }} className="md:hidden text-sm text-slate-600">←</button>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-slate-900">{conversation.contact_name || maskPhone(conversation.provider_chat_id)}</div>
                <div className="text-xs text-slate-500">{maskPhone(conversation.provider_chat_id)}</div>
              </div>
              <OwnerBadge conversation={conversation} />
              {conversation.owner === 'ai' ? (
                <button type="button" onClick={() => switchOwner('human')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Assumir atendimento</button>
              ) : canAdmin ? (
                <button type="button" onClick={() => switchOwner('ai')} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white">Devolver para IA</button>
              ) : null}
              <button type="button" onClick={() => setState(conversation.state === 'closed' ? 'open' : 'closed')} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                {conversation.state === 'closed' ? 'Reabrir' : 'Encerrar'}
              </button>
            </header>

            {conversation.needs_human ? (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                <strong>Precisa de humano:</strong> {HANDOFF_REASON_LABELS[conversation.needs_human_reason] || conversation.needs_human_reason || 'motivo não informado'}. A IA não responde até alguém assumir.
                {conversation.handoff_summary ? <pre className="mt-1 whitespace-pre-wrap font-sans text-[11px] text-amber-800">{conversation.handoff_summary}</pre> : null}
              </div>
            ) : null}
            {conversation.lead_data && Object.keys(conversation.lead_data).length ? (
              <div className="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
                <strong>Dados coletados:</strong> {Object.entries(conversation.lead_data).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')}
              </div>
            ) : null}

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {(detail.messages || []).map((m) => <MessageBubble key={m.id} message={m} />)}
              {failed.map((o) => (
                <div key={o.id} className="ml-auto max-w-[80%] rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {o.status === 'unknown' ? 'Envio sem confirmação (não reenviado automaticamente)' : `Não enviado (${o.last_error || 'erro'})`}: “{o.content.slice(0, 120)}”
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>

            {pendingApprovals.length ? (
              <div className="space-y-2 border-t border-slate-200 bg-white px-4 py-3">
                {pendingApprovals.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900">
                    <strong>{APPROVAL_LABELS[a.kind] || a.kind}:</strong>
                    <span className="flex-1">{a.summary}</span>
                    {canAdmin ? (
                      <>
                        <button type="button" onClick={() => decideApproval(a.id, 'approved')} className="rounded-lg bg-sky-700 px-2 py-1 font-semibold text-white">Aprovar</button>
                        <button type="button" onClick={() => decideApproval(a.id, 'rejected')} className="rounded-lg border border-sky-300 px-2 py-1 font-semibold">Recusar</button>
                      </>
                    ) : <span className="italic">aguardando admin</span>}
                  </div>
                ))}
              </div>
            ) : null}

            {drafts.map((d) => (
              <div key={d.id} className="space-y-2 border-t border-violet-200 bg-violet-50 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Sugestão da IA (não enviada)</div>
                <textarea
                  value={editingDrafts[d.id] ?? d.content}
                  onChange={(e) => setEditingDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  rows={2}
                  className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => draftAction(d.id, 'approve')} className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">Enviar</button>
                  <button type="button" onClick={() => draftAction(d.id, 'discard')} className="rounded-xl border border-violet-300 px-3 py-1.5 text-xs font-semibold text-violet-700">Descartar</button>
                </div>
              </div>
            ))}

            <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(e); }}
                rows={1}
                placeholder={conversation.owner === 'ai' ? 'Escrever assume o atendimento e pausa a IA…' : 'Escreva sua resposta…'}
                className="max-h-40 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              />
              <button type="submit" disabled={sending || !draftText.trim()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {sending ? '…' : 'Enviar'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
