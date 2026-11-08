'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { HANDOFF_REASON_LABELS } from '@/lib/ai/agent/policy.mjs';

const KIND_LABELS = {
  takeover: 'Precisa de você', discount: 'Pedido de desconto', pricing_exception: 'Exceção de preço', availability_review: 'Agenda a confirmar',
  territory_exception: 'Localidade', participant_link: 'Vincular participante', contract_change: 'Alteração contratual', proposal: 'Proposta',
  other: 'Outro', closing: 'Pré-contrato', quote_followup: 'Follow-up de orçamento', signature_reminder: 'Lembrete de assinatura',
  signature_pending: 'Assinatura pendente', precontract_expiring: 'Pré-contrato expirando', send_failed: 'Falha de envio',
};
const EXCEPTION_LABELS = {
  event_type_unknown: 'Tipo de evento não identificado', template_missing: 'Sem modelo de contrato do tipo de evento', precontract_changed: 'Pré-contrato existente alterado',
  ceremony_time_missing: 'Horário da cerimônia ausente', location_missing: 'Local ausente',
};
const MODE_LABELS = { supervised: 'Supervisionado', assisted: 'Assistido', autonomous: 'Autônomo' };
const BTN = 'rounded-lg px-2 py-1 text-xs font-semibold';

async function api(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok && body?.ok !== false, body };
}

function Section({ title, count, children }) {
  return (
    <section className="space-y-2 rounded-3xl border border-slate-200 bg-white p-4 text-slate-900">
      <h2 className="text-base font-bold">{title} <span className="ml-1 rounded-full bg-slate-100 px-2 text-xs text-slate-700">{count}</span></h2>
      {count ? children : <p className="text-sm text-slate-500">Nada pendente.</p>}
    </section>
  );
}

function Card({ c, children }) {
  return (
    <div className="space-y-1 rounded-2xl border border-slate-100 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{KIND_LABELS[c.kind] || c.kind}</span>
        <strong>{c.contact_name || 'Contato'}</strong>
        {c.phone ? <span className="text-xs text-slate-500">+{c.phone}</span> : null}
        <span className="ml-auto flex gap-1">
          {c.whatsapp_url ? <a href={c.whatsapp_url} target="_blank" rel="noopener noreferrer" className={`${BTN} bg-emerald-600 text-white`} title="Abrir no WhatsApp">WhatsApp</a> : null}
          {c.inbox_url ? <Link href={c.inbox_url} className={`${BTN} border border-slate-300 text-slate-700`}>Inbox</Link> : null}
        </span>
      </div>
      <div className="text-xs text-slate-600">
        {[c.event?.type, c.event?.date, c.event?.location].filter(Boolean).join(' · ') || 'Evento ainda não informado'}
        {c.due_at ? ` · previsto ${new Date(c.due_at).toLocaleString('pt-BR')}` : ''}
        {c.days_left !== undefined && c.days_left !== null ? ` · ${c.days_left} dia(s) para expirar` : ''}
      </div>
      {c.reason ? <div className="text-xs text-amber-800">{HANDOFF_REASON_LABELS[c.reason] || c.reason}</div> : null}
      {c.summary ? <pre className="whitespace-pre-wrap font-sans text-xs text-slate-600">{c.summary}</pre> : null}
      {c.last_message ? <div className="text-xs text-slate-500">Última mensagem: “{c.last_message}”</div> : null}
      {children}
    </div>
  );
}

function AutonomyCard({ toast }) {
  const [state, setState] = useState(null);
  const [form, setForm] = useState({ mode: 'supervised', allowed_event_types: '', allowed_formations: '', max_total: '', confirm: '', reason: '' });
  const load = useCallback(async () => {
    const { ok, body } = await api('/api/ai/autonomy');
    if (!ok) return;
    setState(body);
    setForm((f) => ({ ...f, mode: body.mode, allowed_event_types: (body.rules.allowed_event_types || []).join(', '), allowed_formations: (body.rules.allowed_formations || []).join(', '), max_total: body.rules.max_total || '' }));
  }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);
  if (!state) return null;
  async function save(mode = form.mode) {
    const { ok, body } = await api('/api/ai/autonomy', { method: 'PUT', body: JSON.stringify({ mode, confirm: form.confirm, reason: form.reason, rules: { allowed_event_types: form.allowed_event_types, allowed_formations: form.allowed_formations, max_total: form.max_total } }) });
    if (!ok) return toast.error(body?.error || 'Falha.');
    toast.success(`Modo: ${MODE_LABELS[body.mode]}`);
    setForm((f) => ({ ...f, confirm: '' }));
    load();
  }
  return (
    <section className="space-y-2 rounded-3xl border border-slate-200 bg-white p-4 text-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold">Autonomia</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${state.mode === 'supervised' ? 'bg-slate-100 text-slate-700' : 'bg-violet-100 text-violet-800'}`}>{MODE_LABELS[state.mode]}</span>
        {state.mode !== 'supervised' ? <button type="button" onClick={() => save('supervised')} className={`${BTN} ml-auto bg-red-600 text-white`}>Voltar para supervisionado agora</button> : null}
      </div>
      <p className="text-xs text-slate-500">Supervisionado: todo link de pré-contrato passa pela sua aprovação. Assistido: só casos convencionais dentro das regras abaixo saem sozinhos. Autônomo: casos convencionais saem sozinhos. Exceções sempre vêm para você.</p>
      {state.is_owner ? (
        <div className="grid gap-2 sm:grid-cols-3 text-xs">
          <label>Modo<select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>{Object.entries(MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Tipos de evento (assistido)<input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1" value={form.allowed_event_types} onChange={(e) => setForm({ ...form, allowed_event_types: e.target.value })} placeholder="Casamento" /></label>
          <label>Formações (assistido)<input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1" value={form.allowed_formations} onChange={(e) => setForm({ ...form, allowed_formations: e.target.value })} placeholder="Duo, Trio" /></label>
          <label>Valor máximo (assistido)<input type="number" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1" value={form.max_total} onChange={(e) => setForm({ ...form, max_total: e.target.value })} /></label>
          <label>Motivo<input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
          <label>Confirmação<input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="LIBERAR AUTONOMIA" /></label>
          <div className="sm:col-span-3"><button type="button" onClick={() => save()} className={`${BTN} bg-slate-900 text-white`}>Salvar modo</button></div>
        </div>
      ) : <p className="text-xs text-slate-500">Somente o Owner libera autonomia.</p>}
      {state.events?.length ? <div className="text-[11px] text-slate-500">Histórico: {state.events.slice(0, 5).map((e) => `${new Date(e.created_at).toLocaleDateString('pt-BR')} ${MODE_LABELS[e.from_mode] || '—'}→${MODE_LABELS[e.to_mode]}`).join(' · ')}</div> : null}
    </section>
  );
}

export default function SupervisionCenter({ toast }) {
  const [q, setQ] = useState(null);
  const load = useCallback(async () => { const { ok, body } = await api('/api/ai/commercial/queues'); if (ok) setQ(body); }, []);
  useEffect(() => { const t = setTimeout(load, 0); const i = setInterval(load, 15000); return () => { clearTimeout(t); clearInterval(i); }; }, [load]);

  async function decideClosing(c, action) {
    if (action === 'approve' && !window.confirm('Aprovar e enviar o link desta versão do pré-contrato ao cliente?')) return;
    const reason = action === 'reject' ? window.prompt('Motivo (fica registrado):') || '' : undefined;
    const { ok, body } = await api(`/api/ai/closings/${c.closing_id}`, { method: 'POST', body: JSON.stringify({ action, approval_hash: c.approval_hash, reason }) });
    if (!ok) toast.error(body?.error || 'Falha.');
    else toast.success(action === 'approve' ? (body.send_status === 'sent' ? 'Link enviado.' : `Aprovado; envio: ${body.send_status}${body.send_error ? ` (${body.send_error})` : ''}`) : 'Rejeitado: conversa foi para você.');
    load();
  }
  async function decideApproval(c, decision) {
    const { ok, body } = await api(`/api/ai/approvals/${c.approval_id}`, { method: 'POST', body: JSON.stringify({ decision, ...(c.kind === 'participant_link' ? { permissions: ['repertoire', 'panel'] } : {}) }) });
    if (!ok) toast.error(body?.error || 'Falha.'); else load();
  }

  if (!q) return <p className="text-sm text-slate-500">Carregando…</p>;
  return (
    <div className="space-y-4">
      <AutonomyCard toast={toast} />
      <Section title={`Precisa de ${q.handoff_name || 'atenção humana'}`} count={q.marcos.length}>
        {q.marcos.map((c) => (
          <Card key={`${c.kind}-${c.approval_id || c.conversation_id}`} c={c}>
            {c.approval_id ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => decideApproval(c, 'approved')} className={`${BTN} bg-emerald-600 text-white`}>Aprovar</button>
                <button type="button" onClick={() => decideApproval(c, 'rejected')} className={`${BTN} border border-slate-300 text-slate-700`}>Recusar</button>
              </div>
            ) : null}
          </Card>
        ))}
      </Section>
      <Section title="Contratos para aprovar" count={q.contracts.length}>
        {q.contracts.map((c) => (
          <Card key={c.closing_id} c={c}>
            <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-2 font-sans text-xs text-slate-700">{c.summary_text}</pre>
            {c.snapshot ? <div className="text-[11px] text-slate-500">Pré-contrato: {c.snapshot.event_type || 'tipo?'} · {c.snapshot.formation} · total R$ {Number(c.snapshot.agreed_amount || 0).toLocaleString('pt-BR')} · modelo {c.snapshot.contract_template_id ? 'definido' : 'ausente'}</div> : null}
            {c.exceptions?.length ? <div className="text-xs text-amber-800">Exceções: {c.exceptions.map((e) => EXCEPTION_LABELS[e] || e).join(' • ')}</div> : <div className="text-xs text-emerald-700">Caso convencional</div>}
            {c.status === 'awaiting_approval' ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => decideClosing(c, 'approve')} className={`${BTN} bg-emerald-600 text-white`}>Aprovar e enviar link</button>
                <button type="button" onClick={() => decideClosing(c, 'reject')} className={`${BTN} border border-slate-300 text-slate-700`}>Rejeitar / assumir</button>
              </div>
            ) : <div className="text-xs text-slate-500">Aprovado — aguardando confirmação de envio.</div>}
          </Card>
        ))}
      </Section>
      <Section title="Acompanhamentos" count={q.followups.length}>
        {q.followups.map((c, i) => <Card key={`${c.kind}-${c.conversation_id}-${i}`} c={c} />)}
      </Section>
      <Section title="Aprendizado e aprovações de conteúdo" count={q.learning.suggestions + q.learning.knowledge + q.learning.pricing}>
        <p className="text-sm text-slate-700">{q.learning.suggestions} sugestão(ões) de aprendizado · {q.learning.knowledge} conhecimento(s) pendente(s) · {q.learning.pricing} proposta(s) de tabela.</p>
      </Section>
    </div>
  );
}
