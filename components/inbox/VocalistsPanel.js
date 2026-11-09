'use client';

import { useCallback, useEffect, useState } from 'react';

// Central → Vocalistas. A assistente só gerencia VOCALISTAS; instrumentistas aparecem apenas como aviso para o
// assistente operacional. Toda consulta/convite exige decisão explícita do Owner; aprovar NÃO dispara mensagem.
const KIND_LABELS = {
  vocalist_invite: 'Consulta/convite aguardando decisão',
  vocalist_conflict: 'Conflito de agenda do vocalista',
  vocalist_unassigned: 'Evento sem vocalista definido',
  vocalist_declined: 'Vocalista recusou — retornar à cliente',
  vocalist_no_response: 'Convite sem resposta',
};
const REASON_LABELS = { priority_duo: 'Prioridade (Duo)', priority_reception: 'Prioridade (receptivo)', client_choice: 'Escolha da cliente', owner_choice: 'Decisão do Owner', alternative: 'Alternativa' };
const STATUS_LABELS = {
  awaiting_approval: 'Aguardando sua decisão', approved_waiting_event: 'Aprovado (aguardando evento)', invite_created: 'Convite criado (sem disparo)',
  accepted: 'Aceito', declined: 'Recusado', expired: 'Expirado', conflict: 'Conflito', rejected: 'Rejeitado', cancelled: 'Cancelado', superseded: 'Substituído por outra escolha',
};

async function api(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok && body?.ok !== false, body };
}

export default function VocalistsPanel({ toast }) {
  const [data, setData] = useState({ pendencies: { owner: [], operational: [] }, requests: [], audit: [], is_owner: false });
  const load = useCallback(async () => { const { ok, body } = await api('/api/ai/vocalists'); if (ok) setData(body); }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  async function decide(req, decision, overrideConflict = false) {
    if (decision === 'approve') {
      const msg = overrideConflict
        ? `Há conflito de agenda. Confirmar que o vocalista fica NESTE evento (${req.event_date})? Nenhuma mensagem será enviada.`
        : `Aprovar a consulta/convite para ${req.event_date}? O convite é criado no Harmonics sem disparo; o envio continua manual em Convites.`;
      if (typeof window !== 'undefined' && !window.confirm(msg)) return;
    }
    const { ok, body } = await api(`/api/ai/vocalists/${req.id}`, { method: 'POST', body: JSON.stringify({ decision, confirm: decision === 'approve', override_conflict: overrideConflict }) });
    if (!ok) return toast.error(body?.status === 'conflict' ? 'Conflito de agenda: decida explicitamente em qual evento o vocalista fica.' : body?.error || 'Falha.');
    toast.success(decision === 'approve' ? 'Aprovado. Convite criado sem disparo.' : 'Rejeitado.');
    load();
  }

  const open = data.requests.filter((r) => ['awaiting_approval', 'conflict'].includes(r.status));
  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-3xl border border-slate-200 bg-white p-4 text-slate-900">
        <h2 className="text-base font-bold">Vocalistas — pendências</h2>
        <p className="text-xs text-slate-500">A assistente gerencia apenas vocalistas. Prioridade não é confirmação; nada é enviado a músicos ou clientes sem a sua aprovação explícita.</p>
        {!data.pendencies.owner.length ? <p className="text-sm text-slate-500">Nenhuma pendência.</p> : null}
        {data.pendencies.owner.map((p, i) => (
          <div key={`${p.kind}-${p.request_id || p.event_id || i}`} className="rounded-2xl border border-slate-100 p-2 text-xs">
            <strong>{KIND_LABELS[p.kind] || p.kind}</strong> · {p.date}{p.time ? ` às ${String(p.time).slice(0, 5)}` : ''}{p.vocalist ? ` · ${p.vocalist}` : ''}{p.client ? ` · ${p.client}` : ''}
            <div className="text-slate-500">Decisão: {p.decision}</div>
          </div>
        ))}
      </section>

      <section className="space-y-2 rounded-3xl border border-slate-200 bg-white p-4 text-slate-900">
        <h2 className="text-base font-bold">Consultas e convites aguardando decisão</h2>
        {!open.length ? <p className="text-sm text-slate-500">Nada aguardando.</p> : null}
        {open.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">{REASON_LABELS[r.reason] || r.reason}</span>
            <span>{r.event_date}{r.start_time ? ` às ${String(r.start_time).slice(0, 5)}` : ''} · {r.formation || 'formação a definir'}{r.reception_hours ? ` + ${r.reception_hours}h receptivo` : ''}{r.location ? ` · ${r.location}` : ''}</span>
            <span className="text-slate-500">Voz: {r.voice || '—'} · {STATUS_LABELS[r.status]}</span>
            {(r.conflicts || []).length ? <span className="basis-full text-rose-700">Conflitos: {(r.conflicts || []).map((c) => `${c.kind}${c.event_time ? ` ${c.event_time}–${c.until}` : ''}`).join(' · ')}</span> : null}
            {data.is_owner ? (
              <span className="ml-auto flex gap-1">
                {r.status === 'conflict'
                  ? <button type="button" onClick={() => decide(r, 'approve', true)} className="rounded-lg bg-amber-600 px-2 py-1 font-semibold text-white">Decidir: fica neste evento</button>
                  : <button type="button" onClick={() => decide(r, 'approve')} className="rounded-lg bg-emerald-600 px-2 py-1 font-semibold text-white">Aprovar</button>}
                <button type="button" onClick={() => decide(r, 'reject')} className="rounded-lg border border-slate-300 px-2 py-1">Rejeitar</button>
              </span>
            ) : null}
          </div>
        ))}
      </section>

      <section className="space-y-1 rounded-3xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
        <h3 className="text-sm font-bold text-slate-900">Para o assistente operacional (instrumentistas)</h3>
        {!data.pendencies.operational.length ? <p className="text-slate-500">Nenhuma escala instrumental incompleta.</p> : null}
        {data.pendencies.operational.map((p) => <div key={p.event_id}>{p.date} · {p.detail}</div>)}
      </section>

      <section className="space-y-1 rounded-3xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
        <h3 className="text-sm font-bold text-slate-900">Histórico</h3>
        {!data.audit.length ? <p className="text-slate-500">Sem registros.</p> : null}
        {data.audit.slice(0, 40).map((a, i) => <div key={i}>{new Date(a.created_at).toLocaleString('pt-BR')} · {a.action} · {a.actor === 'ai' ? 'assistente' : a.actor}</div>)}
      </section>
    </div>
  );
}
