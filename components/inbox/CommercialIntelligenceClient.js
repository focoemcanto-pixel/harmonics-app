'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppToast } from '@/components/ui/ToastProvider';

const TABS = [
  { key: 'teach', label: 'Ensinar à IA' },
  { key: 'learning', label: 'Aprendizado' },
  { key: 'areas', label: 'Localidades' },
  { key: 'musicians', label: 'Músicos' },
  { key: 'sales', label: 'Vendas e remarketing' },
  { key: 'pipeline', label: 'Negociações' },
  { key: 'simulator', label: 'Simulador' },
];
const KIND_LABELS = { rule: 'Regra', faq: 'FAQ', policy: 'Política', rider: 'Rider técnico', example: 'Exemplo', style: 'Estilo', response: 'Resposta por intenção', post_sale: 'Pós-venda' };
const STATUS_LABELS = { pending_approval: 'Aguardando aprovação', active: 'Ativa', archived: 'Arquivada', rejected: 'Rejeitada' };
const STAGE_LABELS = { new: 'Novo', qualifying: 'Qualificação', proposal: 'Proposta', negotiation: 'Negociação', closing: 'Fechamento', contract_sent: 'Pré-contrato enviado', won: 'Ganho', lost: 'Perdido', post_sale: 'Pós-venda' };
const STRATEGY_LABELS = { discovery: 'Descoberta (SPIN)', empathy: 'Empatia tática (Voss)', calibrated_questions: 'Perguntas calibradas', price_objection: 'Objeção de preço', comparison_objection: 'Comparação', stall_objection: '"Vou pensar"', closing: 'Fechamento', post_sale: 'Pós-venda' };
const INPUT = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm';

async function api(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok && body?.ok !== false, body };
}

function Field({ label, children }) {
  return <label className="block text-xs font-semibold text-slate-600">{label}<div className="mt-1 font-normal">{children}</div></label>;
}

function Card({ title, children, actions }) {
  return (
    <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2"><h2 className="text-base font-bold text-slate-900">{title}</h2>{actions}</div>
      {children}
    </section>
  );
}

function TeachTab({ toast }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ kind: 'faq', title: '', content: '', intents: '', priority: 50, formation: '', service: 'cerimonia' });
  const [filter, setFilter] = useState('current');
  const load = useCallback(async () => { const { ok, body } = await api('/api/ai/knowledge'); if (ok) setItems(body.items || []); }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  async function save() {
    const { ok, body } = await api('/api/ai/knowledge', { method: 'POST', body: JSON.stringify(form) });
    if (!ok) return toast.error(body?.error || 'Falha ao salvar.');
    toast.success(`Versão ${body.version} criada — aprove para entrar em vigor.`);
    if (body.conflicts?.length) toast.warning(`Possível conflito com: ${body.conflicts.map((c) => c.title).join(', ')}`);
    setForm({ ...form, title: '', content: '' });
    load();
  }
  async function act(id, action) {
    const { ok, body } = await api(`/api/ai/knowledge/${id}`, { method: 'POST', body: JSON.stringify({ action }) });
    if (!ok) return toast.error(body?.error || 'Falha.');
    load();
  }
  const latest = new Map();
  for (const i of items) if (!latest.has(i.item_key) || latest.get(i.item_key).version < i.version) latest.set(i.item_key, i);
  const shown = filter === 'current' ? [...latest.values()] : items.filter((i) => i.status === 'pending_approval');

  return (
    <div className="space-y-4">
      <Card title="Ensinar em linguagem natural">
        <p className="text-xs text-slate-500">Regras, FAQs, políticas, rider e exemplos. Toda versão nova fica pendente até aprovação; versões antigas ficam guardadas para rollback.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tipo"><select className={INPUT} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Intenções (vírgula)"><input className={INPUT} placeholder="pricing, repertoire" value={form.intents} onChange={(e) => setForm({ ...form, intents: e.target.value })} /></Field>
          <Field label="Prioridade (0–100)"><input type="number" className={INPUT} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></Field>
        </div>
        {form.kind === 'rider' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Formação"><input className={INPUT} placeholder="trio" value={form.formation} onChange={(e) => setForm({ ...form, formation: e.target.value })} /></Field>
            <Field label="Serviço"><select className={INPUT} value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}><option value="cerimonia">Cerimônia</option><option value="receptivo">Receptivo</option></select></Field>
          </div>
        ) : null}
        <Field label="Título"><input className={INPUT} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Conteúdo"><textarea rows={4} className={INPUT} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
        <button type="button" onClick={save} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Salvar como nova versão</button>
      </Card>
      <Card title="Conhecimento" actions={(
        <div className="flex gap-1 text-xs">
          {[['current', 'Versões atuais'], ['pending', 'Pendentes']].map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 font-semibold ${filter === k ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>{l}</button>)}
        </div>
      )}>
        {!shown.length ? <p className="text-sm text-slate-500">Nada por aqui.</p> : null}
        {shown.map((i) => {
          const versions = items.filter((x) => x.item_key === i.item_key).sort((a, b) => b.version - a.version);
          return (
            <div key={i.id} className="rounded-2xl border border-slate-100 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold">{KIND_LABELS[i.kind]}</span>
                <strong>{i.title}</strong>
                <span className="text-xs text-slate-500">v{i.version} · {STATUS_LABELS[i.status]} · prioridade {i.priority}{i.source === 'learned' ? ' · aprendido' : ''}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{i.content}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {i.status === 'pending_approval' ? <><button type="button" onClick={() => act(i.id, 'approve')} className="rounded-lg bg-emerald-600 px-2 py-1 font-semibold text-white">Aprovar</button><button type="button" onClick={() => act(i.id, 'reject')} className="rounded-lg border px-2 py-1">Rejeitar</button></> : null}
                {i.status === 'active' ? <button type="button" onClick={() => act(i.id, 'archive')} className="rounded-lg border px-2 py-1">Arquivar</button> : null}
                {versions.filter((v) => v.status === 'archived' && v.id !== i.id).slice(0, 3).map((v) => (
                  <button key={v.id} type="button" onClick={() => act(v.id, 'rollback')} className="rounded-lg border border-amber-300 px-2 py-1 text-amber-800">Voltar para v{v.version}</button>
                ))}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function LearningTab({ toast }) {
  const [list, setList] = useState([]);
  const [edits, setEdits] = useState({});
  const load = useCallback(async () => { const { ok, body } = await api('/api/ai/learning'); if (ok) setList(body.suggestions || []); }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);
  async function decide(s, decision) {
    const e = edits[s.id] || {};
    const { ok } = await api(`/api/ai/learning/${s.id}`, { method: 'POST', body: JSON.stringify({ decision, ...e }) });
    if (!ok) return toast.error('Falha ao registrar.');
    toast.success(decision === 'approved' ? 'Aprendizado aprovado e ativo.' : 'Sugestão descartada.');
    load();
  }
  return (
    <Card title="Sugestões de aprendizado (supervisionado)">
      <p className="text-xs text-slate-500">Geradas a partir de respostas da equipe e de correções em rascunhos da IA. Nada muda sem sua aprovação.</p>
      {!list.length ? <p className="text-sm text-slate-500">Sem sugestões pendentes.</p> : null}
      {list.map((s) => (
        <div key={s.id} className="space-y-2 rounded-2xl border border-slate-100 p-3 text-sm">
          <div className="text-xs text-slate-500">{s.kind === 'correction' ? 'Correção de rascunho' : 'Resposta da equipe'} · {s.occurrences >= 3 ? `padrão recorrente (${s.occurrences}x)` : `${s.occurrences}x`}</div>
          <div><strong>Cliente:</strong> {s.customer_text}</div>
          {s.ai_text ? <div className="text-slate-500"><strong>IA sugeriu:</strong> {s.ai_text}</div> : null}
          <textarea rows={3} className={INPUT} value={edits[s.id]?.content ?? `Cliente: ${s.customer_text}\nResposta aprovada: ${s.human_text}`} onChange={(e) => setEdits({ ...edits, [s.id]: { ...(edits[s.id] || {}), content: e.target.value } })} />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select className="rounded-lg border px-2 py-1" value={edits[s.id]?.kind || (s.occurrences >= 3 ? 'faq' : 'example')} onChange={(e) => setEdits({ ...edits, [s.id]: { ...(edits[s.id] || {}), kind: e.target.value } })}>
              <option value="example">Exemplo de estilo</option><option value="faq">FAQ</option><option value="response">Resposta por intenção</option>
            </select>
            <button type="button" onClick={() => decide(s, 'approved')} className="rounded-lg bg-emerald-600 px-2 py-1 font-semibold text-white">Aprovar</button>
            <button type="button" onClick={() => decide(s, 'rejected')} className="rounded-lg border px-2 py-1">Descartar</button>
          </div>
        </div>
      ))}
    </Card>
  );
}

const EMPTY_AREA = { name: '', status: 'served', match_terms: '', distance_km: '', travel_minutes: '', travel_fee: '', toll_fee: '', lodging_required: false, lodging_fee: '', notes: '' };

function AreasTab({ toast }) {
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState(EMPTY_AREA);
  const load = useCallback(async () => { const { ok, body } = await api('/api/ai/service-areas'); if (ok) setAreas(body.areas || []); }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);
  async function save() {
    const { ok, body } = await api('/api/ai/service-areas', { method: 'POST', body: JSON.stringify(form) });
    if (!ok) return toast.error(body?.error || 'Falha.');
    setForm(EMPTY_AREA); load();
  }
  return (
    <div className="space-y-4">
      <Card title="Localidade">
        <p className="text-xs text-slate-500">Atendida (taxas abaixo; sem taxa = região base), condicional (exige aprovação) ou bloqueada. Sem cadastro, a IA usa a regra de km com distância rodoviária ou pede revisão humana.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nome"><input className={INPUT} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Status"><select className={INPUT} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="served">Atendida</option><option value="conditional">Condicional</option><option value="blocked">Bloqueada</option></select></Field>
          <Field label="Termos (cidades/bairros, vírgula)"><input className={INPUT} value={form.match_terms} onChange={(e) => setForm({ ...form, match_terms: e.target.value })} /></Field>
          {[['distance_km', 'Distância (km)'], ['travel_minutes', 'Tempo (min)'], ['travel_fee', 'Deslocamento (R$)'], ['toll_fee', 'Pedágios (R$)'], ['lodging_fee', 'Hospedagem (R$)']].map(([k, l]) => (
            <Field key={k} label={l}><input type="number" step="any" className={INPUT} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></Field>
          ))}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.lodging_required} onChange={(e) => setForm({ ...form, lodging_required: e.target.checked })} />Exige hospedagem</label>
        </div>
        <Field label="Observações"><input className={INPUT} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <button type="button" onClick={save} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Salvar localidade</button>
      </Card>
      <Card title="Localidades cadastradas">
        {areas.filter((a) => a.active).map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-2 text-sm">
            <strong>{a.name}</strong>
            <span className="text-xs text-slate-500">{({ served: 'Atendida', conditional: 'Condicional', blocked: 'Bloqueada' })[a.status]} · {(a.match_terms || []).join(', ')}</span>
            <span className="ml-auto text-xs">{[a.travel_fee && `desl. R$${a.travel_fee}`, a.toll_fee && `pedágio R$${a.toll_fee}`, a.lodging_required && `hosp. ${a.lodging_fee ? `R$${a.lodging_fee}` : 'sem valor'}`].filter(Boolean).join(' · ') || 'sem taxa'}</span>
            <button type="button" onClick={() => setForm({ ...EMPTY_AREA, ...a, match_terms: (a.match_terms || []).join(', ') })} className="rounded-lg border px-2 py-1 text-xs">Editar</button>
            <button type="button" onClick={async () => { await api(`/api/ai/service-areas?id=${a.id}`, { method: 'DELETE' }); load(); }} className="rounded-lg border px-2 py-1 text-xs">Desativar</button>
          </div>
        ))}
      </Card>
    </div>
  );
}

function MusiciansTab({ toast }) {
  const [data, setData] = useState({ profiles: [], contacts: [] });
  const [form, setForm] = useState({ contact_id: '', display_name: '', instruments: '', roles: '', is_primary_vocal: false, fee: '', video_urls: '', portfolio_url: '' });
  const load = useCallback(async () => { const { ok, body } = await api('/api/ai/musicians'); if (ok) setData(body); }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);
  async function save() {
    const { ok, body } = await api('/api/ai/musicians', { method: 'POST', body: JSON.stringify(form) });
    if (!ok) return toast.error(body?.error || 'Falha.');
    toast.success('Músico salvo.'); load();
  }
  return (
    <div className="space-y-4">
      <Card title="Catálogo de músicos">
        <p className="text-xs text-slate-500">Ligado aos contatos e à escala do Harmonics. O vocalista principal é consultado em silêncio; outras vozes só são oferecidas com conflito confirmado ou pedido do cliente.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Contato"><select className={INPUT} value={form.contact_id} onChange={(e) => { const c = data.contacts.find((x) => x.id === e.target.value); setForm({ ...form, contact_id: e.target.value, display_name: form.display_name || c?.name || '' }); }}><option value="">Selecione…</option>{data.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Nome exibido"><input className={INPUT} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></Field>
          <Field label="Cachê (R$)"><input type="number" className={INPUT} value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} /></Field>
          <Field label="Instrumentos"><input className={INPUT} placeholder="voz, violão" value={form.instruments} onChange={(e) => setForm({ ...form, instruments: e.target.value })} /></Field>
          <Field label="Funções"><input className={INPUT} placeholder="vocal, instrumental" value={form.roles} onChange={(e) => setForm({ ...form, roles: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_primary_vocal} onChange={(e) => setForm({ ...form, is_primary_vocal: e.target.checked })} />Vocalista principal</label>
        </div>
        <Field label="Vídeos (URLs https, vírgula)"><input className={INPUT} value={form.video_urls} onChange={(e) => setForm({ ...form, video_urls: e.target.value })} /></Field>
        <Field label="Portfólio (https)"><input className={INPUT} value={form.portfolio_url} onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })} /></Field>
        <button type="button" onClick={save} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Salvar músico</button>
      </Card>
      <Card title="Perfis">
        {data.profiles.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-2 text-sm">
            <strong>{p.display_name}</strong>{p.is_primary_vocal ? <span className="rounded-full bg-violet-100 px-2 text-[11px] font-semibold text-violet-700">Vocalista principal</span> : null}
            <span className="text-xs text-slate-500">{(p.instruments || []).join(', ')} · {(p.roles || []).join(', ')} · {(p.video_urls || []).length} vídeo(s)</span>
            <button type="button" onClick={() => setForm({ ...p, instruments: (p.instruments || []).join(', '), roles: (p.roles || []).join(', '), video_urls: (p.video_urls || []).join(', '), fee: p.fee ?? '', portfolio_url: p.portfolio_url || '' })} className="ml-auto rounded-lg border px-2 py-1 text-xs">Editar</button>
          </div>
        ))}
      </Card>
    </div>
  );
}

function SalesTab({ toast }) {
  const [s, setS] = useState(null);
  useEffect(() => { const t = setTimeout(async () => { const { ok, body } = await api('/api/ai/settings'); if (ok) setS(body.settings); }, 0); return () => clearTimeout(t); }, []);
  if (!s) return <p className="text-sm text-slate-500">Carregando…</p>;
  const rules = s.logistics_rules || {};
  async function save() {
    const { ok, body } = await api('/api/ai/settings', { method: 'PUT', body: JSON.stringify({ settings: s }) });
    if (!ok) return toast.error(body?.error || 'Falha.');
    setS(body.settings); toast.success('Configurações salvas.');
  }
  const toggle = (key) => setS({ ...s, strategies_enabled: (s.strategies_enabled || []).includes(key) ? s.strategies_enabled.filter((k) => k !== key) : [...(s.strategies_enabled || []), key] });
  return (
    <div className="space-y-4">
      <Card title="Estratégias de venda (sob demanda)">
        <div className="flex flex-wrap gap-2">{Object.entries(STRATEGY_LABELS).map(([k, l]) => (
          <button key={k} type="button" onClick={() => toggle(k)} className={`rounded-full px-3 py-1 text-xs font-semibold ${(s.strategies_enabled || []).includes(k) ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{l}</button>
        ))}</div>
        <p className="text-xs text-slate-500">Até 2 estratégias entram por resposta, conforme etapa e sinais da conversa. Nunca desconto ou urgência artificial.</p>
      </Card>
      <Card title="Remarketing (follow-ups)">
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(s.followup_enabled)} onChange={(e) => setS({ ...s, followup_enabled: e.target.checked })} />Follow-ups automáticos (exige modo Automático e templates aprovados na Meta)</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dias (vírgula)"><input className={INPUT} value={(s.followup_days || []).join(', ')} onChange={(e) => setS({ ...s, followup_days: e.target.value.split(',').map((x) => Number(x.trim())).filter(Boolean) })} /></Field>
          <Field label="Templates Meta por passo (vírgula)"><input className={INPUT} value={(s.followup_templates || []).join(', ')} onChange={(e) => setS({ ...s, followup_templates: e.target.value.split(',').map((x) => x.trim()) })} /></Field>
        </div>
        <p className="text-xs text-slate-500">Para automaticamente quando o cliente responde, contrata, recusa, pede para parar ou alguém da equipe assume.</p>
      </Card>
      <Card title="Fechamento e transferência">
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(s.autonomous_closing_enabled)} onChange={(e) => setS({ ...s, autonomous_closing_enabled: e.target.checked })} />Gerar pré-contrato automaticamente após confirmação expressa</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(s.notify_admin_on_handoff)} onChange={(e) => setS({ ...s, notify_admin_on_handoff: e.target.checked })} />Avisar o responsável no WhatsApp administrativo ao transferir</label>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Responsável pelas exceções"><input className={INPUT} value={s.handoff_contact_name || ''} onChange={(e) => setS({ ...s, handoff_contact_name: e.target.value })} /></Field>
          <Field label="Margem mínima (%)"><input type="number" className={INPUT} value={s.min_margin_pct ?? ''} onChange={(e) => setS({ ...s, min_margin_pct: e.target.value })} /></Field>
          <Field label="Folga de agenda (min)"><input type="number" className={INPUT} value={s.schedule_buffer_minutes ?? 90} onChange={(e) => setS({ ...s, schedule_buffer_minutes: e.target.value })} /></Field>
        </div>
      </Card>
      <Card title="Regras de logística (quando a localidade não tem taxa cadastrada)">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Origem"><input className={INPUT} value={rules.origin || ''} onChange={(e) => setS({ ...s, logistics_rules: { ...rules, origin: e.target.value } })} /></Field>
          {[['free_radius_km', 'Raio sem custo (km)'], ['per_km_rate', 'R$ por km'], ['toll_per_km', 'Pedágio R$/km'], ['lodging_over_km', 'Hospedagem acima de (km)'], ['lodging_fee_per_musician', 'Hospedagem por músico (R$)']].map(([k, l]) => (
            <Field key={k} label={l}><input type="number" step="any" className={INPUT} value={rules[k] ?? ''} onChange={(e) => setS({ ...s, logistics_rules: { ...rules, [k]: e.target.value } })} /></Field>
          ))}
        </div>
      </Card>
      <button type="button" onClick={save} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Salvar</button>
    </div>
  );
}

function PipelineTab() {
  const [data, setData] = useState(null);
  useEffect(() => { const t = setTimeout(async () => { const { ok, body } = await api('/api/ai/commercial/pipeline?days=30'); if (ok) setData(body); }, 0); return () => clearTimeout(t); }, []);
  if (!data) return <p className="text-sm text-slate-500">Carregando…</p>;
  const m = data.metrics;
  const tile = (label, value) => <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="text-lg font-bold text-slate-900">{value}</div></div>;
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-4">
        {tile('Conversas (30d)', m.leads)}{tile('Conversão até pré-contrato', `${m.conversionRate}%`)}
        {tile('Follow-ups enviados / recuperados', `${m.followups.sent} / ${m.followups.recovered}`)}{tile('Custo IA (US$) · tokens', `${m.cost.usd} · ${m.cost.tokensIn + m.cost.tokensOut}`)}
        {tile('Mensagens da IA', m.quality.aiMessages)}{tile('Rascunhos descartados', m.quality.discardedDrafts)}
        {tile('Transferências pendentes', m.quality.handoffs)}{tile('Aprovações pendentes', m.quality.pendingApprovals)}
      </div>
      <Card title="Funil">
        <div className="flex flex-wrap gap-2 text-xs">{Object.entries(m.byStage).map(([k, v]) => <span key={k} className="rounded-full bg-slate-100 px-3 py-1">{STAGE_LABELS[k]}: <strong>{v}</strong></span>)}</div>
        <div className="text-xs text-slate-600">Objeções: {Object.entries(m.objections).map(([k, v]) => `${k} (${v})`).join(', ') || '—'} · Perdas: {Object.entries(m.lostReasons).map(([k, v]) => `${k} (${v})`).join(', ') || '—'}</div>
      </Card>
      <Card title="Negociações">
        {data.deals.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-2 text-sm">
            <strong>{d.contact_name || `•••${d.phone_tail}`}</strong><span className="text-xs text-slate-500">{STAGE_LABELS[d.sales_stage]}</span>
            {d.deal_value ? <span className="text-xs">R$ {Number(d.deal_value).toLocaleString('pt-BR')}</span> : null}
            {(d.objections || []).length ? <span className="text-xs text-amber-700">{d.objections.join(', ')}</span> : null}
            {d.opted_out ? <span className="text-xs text-slate-400">opt-out</span> : null}
            <Link href="/inbox" className="ml-auto text-xs font-semibold text-violet-700">Abrir no Inbox</Link>
          </div>
        ))}
      </Card>
      <Card title="Aprovações pendentes">
        {data.approvals.filter((a) => a.status === 'pending').map((a) => <div key={a.id} className="border-b border-slate-100 py-2 text-sm"><strong>{a.kind}</strong> — {a.summary}</div>)}
      </Card>
    </div>
  );
}

function SimulatorTab() {
  const [f, setF] = useState({ date: '', time: '', formation: 'Trio', instruments: '', hasSound: false, receptionFormation: '', receptionHours: 0, location: '' });
  const [r, setR] = useState(null);
  async function run() { const { body } = await api('/api/ai/commercial/quote-preview', { method: 'POST', body: JSON.stringify(f) }); setR(body); }
  return (
    <Card title="Simulador (o que a IA calcularia)">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Data"><input type="date" className={INPUT} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Horário"><input type="time" className={INPUT} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        <Field label="Formação"><input className={INPUT} value={f.formation} onChange={(e) => setF({ ...f, formation: e.target.value })} /></Field>
        <Field label="Instrumentos"><input className={INPUT} value={f.instruments} onChange={(e) => setF({ ...f, instruments: e.target.value })} /></Field>
        <Field label="Receptivo (formação)"><input className={INPUT} value={f.receptionFormation} onChange={(e) => setF({ ...f, receptionFormation: e.target.value })} /></Field>
        <Field label="Receptivo (horas)"><input type="number" className={INPUT} value={f.receptionHours} onChange={(e) => setF({ ...f, receptionHours: e.target.value })} /></Field>
        <Field label="Local"><input className={INPUT} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.hasSound} onChange={(e) => setF({ ...f, hasSound: e.target.checked })} />Com som</label>
      </div>
      <button type="button" onClick={run} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Calcular</button>
      {r?.quote ? (
        <div className="space-y-1 rounded-2xl bg-slate-50 p-3 text-sm">
          {r.quote.ok ? <>
            {r.quote.items.map((i) => <div key={i.key}>{i.label}: R$ {i.amount.toLocaleString('pt-BR')}</div>)}
            <div className="font-bold">Total: R$ {r.quote.total.toLocaleString('pt-BR')} {r.quote.final ? '(final)' : '(não final)'}</div>
            {r.quote.unresolved.length ? <div className="text-amber-700">Pendências: {r.quote.unresolved.join(', ')}</div> : null}
            {r.quote.approvals.length ? <div className="text-amber-700">Exige aprovação: {r.quote.approvals.join(', ')}</div> : null}
            {r.quote.margin !== null ? <div className="text-xs text-slate-500">Margem estimada: {r.quote.margin}%</div> : null}
          </> : <div className="text-red-700">Local bloqueado.</div>}
          {r.vocal ? <div className="text-xs text-slate-500">Agenda do vocalista principal: {r.vocal.status}</div> : null}
        </div>
      ) : null}
    </Card>
  );
}

export default function CommercialIntelligenceClient() {
  const toast = useAppToast();
  const [tab, setTab] = useState('teach');
  const Tab = { teach: TeachTab, learning: LearningTab, areas: AreasTab, musicians: MusiciansTab, sales: SalesTab, pipeline: PipelineTab, simulator: SimulatorTab }[tab];
  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/inbox" className="text-sm font-semibold text-violet-700">← Inbox</Link>
        <Link href="/inbox/configuracoes" className="text-sm font-semibold text-slate-600">Canal e IA</Link>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${tab === t.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{t.label}</button>)}
      </div>
      <Tab toast={toast} />
    </div>
  );
}
