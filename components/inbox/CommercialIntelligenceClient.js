'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppToast } from '@/components/ui/ToastProvider';
import SupervisionCenter from '@/components/inbox/SupervisionCenter';
import ManualPricingPanel from '@/components/inbox/ManualPricingPanel';
import PriceRulesPanel from '@/components/inbox/PriceRulesPanel';
import VocalistsPanel from '@/components/inbox/VocalistsPanel';
import ChatSimulationPanel from '@/components/inbox/ChatSimulationPanel';

const TABS = [
  { key: 'center', label: 'Central' },
  { key: 'teach', label: 'Ensinar à IA' },
  { key: 'tables', label: 'Tabelas' },
  { key: 'vocalists', label: 'Vocalistas' },
  { key: 'manual', label: 'Manual e propostas' },
  { key: 'learning', label: 'Aprendizado' },
  { key: 'areas', label: 'Localidades' },
  { key: 'venues', label: 'Espaços' },
  { key: 'musicians', label: 'Músicos' },
  { key: 'sales', label: 'Vendas e remarketing' },
  { key: 'pipeline', label: 'Negociações' },
  { key: 'simulator', label: 'Calculadora' },
  { key: 'chat', label: 'Chat de Testes' },
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
    <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 text-slate-900">
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
    const item = items.find((x) => x.id === id);
    const review = item?.metadata?.review;
    let confirmReview = false;
    if (action === 'approve' && review?.required) {
      const ok = window.confirm(`Este item foi marcado para revisão:\n\n- ${(review.reasons || []).join('\n- ')}\n\nConfirma que revisou o texto e quer aprovar?`);
      if (!ok) return;
      confirmReview = true;
    }
    const { ok, body } = await api(`/api/ai/knowledge/${id}`, { method: 'POST', body: JSON.stringify({ action, confirm_review: confirmReview }) });
    if (!ok) return toast.error(body?.error || 'Falha.');
    load();
  }

  const latest = new Map();
  // Versão vigente: a ativa; sem ativa, a pendente/mais recente.
  const rank = (i) => (i.status === 'active' ? 2 : i.status === 'pending_approval' ? 1 : 0);
  for (const i of items) {
    const cur = latest.get(i.item_key);
    if (!cur || rank(i) > rank(cur) || (rank(i) === rank(cur) && i.version > cur.version)) latest.set(i.item_key, i);
  }
  const shown = filter === 'current' ? [...latest.values()] : items.filter((i) => i.status === 'pending_approval');

  return (
    <div className="space-y-4">
      <BootstrapCard toast={toast} onDone={() => { setFilter('pending'); load(); }} />
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
          {[['current', 'Versões atuais'], ['pending', 'Pendentes']].map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 font-semibold ${filter === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{l}</button>)}
        </div>
      )}>
        {!shown.length ? <p className="text-sm text-slate-500">Nada por aqui.</p> : null}
        {shown.map((i) => {
          const versions = items.filter((x) => x.item_key === i.item_key).sort((a, b) => b.version - a.version);
          return (
            <div key={i.id} className="rounded-2xl border border-slate-100 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{KIND_LABELS[i.kind]}</span>
                <strong>{i.title}</strong>
                <ReviewBadges meta={i.metadata} />
                <span className="text-xs text-slate-500">v{i.version} · {STATUS_LABELS[i.status]} · prioridade {i.priority}{i.source === 'learned' ? ' · aprendido' : ''}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{i.content}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {i.status === 'pending_approval' ? <><button type="button" onClick={() => act(i.id, 'approve')} className="rounded-lg bg-emerald-600 px-2 py-1 font-semibold text-white">Aprovar</button><button type="button" onClick={() => act(i.id, 'reject')} className="rounded-lg border border-slate-300 px-2 py-1 text-slate-700">Rejeitar</button></> : null}
                {i.status === 'active' ? <button type="button" onClick={() => act(i.id, 'archive')} className="rounded-lg border border-slate-300 px-2 py-1 text-slate-700">Arquivar</button> : null}
                {versions.filter((v) => v.status === 'pending_approval' && v.id !== i.id).map((v) => (
                  <button key={v.id} type="button" onClick={() => act(v.id, 'approve')} className="rounded-lg bg-emerald-600 px-2 py-1 font-semibold text-white">Aprovar v{v.version} pendente</button>
                ))}
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
            <select className="rounded-lg border border-slate-300 px-2 py-1 text-slate-700" value={edits[s.id]?.kind || (s.occurrences >= 3 ? 'faq' : 'example')} onChange={(e) => setEdits({ ...edits, [s.id]: { ...(edits[s.id] || {}), kind: e.target.value } })}>
              <option value="example">Exemplo de estilo</option><option value="faq">FAQ</option><option value="response">Resposta por intenção</option>
            </select>
            <button type="button" onClick={() => decide(s, 'approved')} className="rounded-lg bg-emerald-600 px-2 py-1 font-semibold text-white">Aprovar</button>
            <button type="button" onClick={() => decide(s, 'rejected')} className="rounded-lg border border-slate-300 px-2 py-1 text-slate-700">Descartar</button>
          </div>
        </div>
      ))}
    </Card>
  );
}

const REVIEW_LABELS = { number_word_mismatch: 'Número x extenso divergente', unclassified_scope: 'Modelo sem tipo de evento', contract_specific_terms: 'Condição específica do modelo', divergent_templates: 'Modelos divergentes' };

function ReviewBadges({ meta }) {
  const types = meta?.scope?.event_types || [];
  const review = meta?.review;
  return (
    <span className="flex flex-wrap items-center gap-1 text-[11px]">
      {meta?.scope ? <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-800">{types.length ? `Somente: ${types.join(', ')}` : 'Escopo não classificado'}</span> : null}
      {(review?.flags || []).map((f) => <span key={f} className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800" title={(review.reasons || []).join(' • ')}>{REVIEW_LABELS[f] || f}</span>)}
      {review?.required ? <span className="w-full text-amber-800">{(review.reasons || []).join(' • ')}</span> : null}
    </span>
  );
}

const ORIGIN_LABELS = { event_types: 'Tipos de evento', contract_templates: 'Modelo de contrato', message_templates: 'Mensagens oficiais', suggestion_moments: 'Catálogo de repertório', harmonics_product: 'Funcionalidades do Harmonics' };

function BootstrapCard({ toast, onDone }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  async function run(apply) {
    setBusy(true);
    const { ok, body } = await api('/api/ai/knowledge/bootstrap', { method: apply ? 'POST' : 'GET' });
    setBusy(false);
    if (!ok) return toast.error(body?.error || 'Falha na inicialização.');
    if (apply) {
      toast.success(`${body.created.length} sugestões criadas (pendentes de aprovação).`);
      setPreview(null);
      onDone();
    } else setPreview(body);
  }
  return (
    <Card title="Inicializar com dados do Harmonics">
      <p className="text-xs text-slate-500">Lê tipos de evento, modelos de contrato, mensagens oficiais e catálogo de repertório e cria sugestões versionadas com a origem identificada. Preços, datas e variáveis são removidos (continuam vindo das fontes oficiais). Nada é ativado sem sua aprovação; itens já importados não se repetem.</p>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => run(false)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{busy && !preview ? 'Analisando…' : 'Ver prévia'}</button>
        {preview?.needsReview ? <span className="self-center text-xs text-amber-700">{preview.needsReview} marcada(s) para revisão</span> : null}
        {preview?.created?.length ? <button type="button" disabled={busy} onClick={() => run(true)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Criar {preview.created.length} sugestões</button> : null}
      </div>
      {preview ? (
        <div className="space-y-2 text-sm">
          {!preview.created.length ? <p className="text-slate-500">Nada novo para importar.</p> : null}
          {preview.created.map((c) => (
            <div key={c.item_key} className="rounded-2xl border border-slate-100 p-3">
              <div className="text-xs text-slate-500">{KIND_LABELS[c.kind]} · origem: {ORIGIN_LABELS[c.origin.table] || c.origin.table}{c.removed_dynamic?.length ? ` · removido: ${c.removed_dynamic.join(', ')}` : ''}</div>
              <strong>{c.title}</strong>
              <ReviewBadges meta={{ scope: c.scope, review: c.review }} />
              <p className="text-slate-700">{c.content}</p>
            </div>
          ))}
          {preview.skipped.length ? <p className="text-xs text-slate-500">Ignorados: {preview.skipped.map((s) => `${s.title} (${s.reason === 'already_imported' ? 'já importado' : 'conteúdo repetido'})`).join('; ')}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}

const EMPTY_AREA = { name: '', status: 'served', match_terms: '', price_tier: '', distance_km: '', travel_minutes: '', travel_fee: '', toll_fee: '', sound_travel_fee: '', lodging_required: false, lodging_fee: '', notes: '' };

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function AreasTab({ toast }) {
  const [areas, setAreas] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [refDate, setRefDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState(EMPTY_AREA);
  const [history, setHistory] = useState([]);
  const load = useCallback(async () => {
    const [{ ok, body }, preview] = await Promise.all([api(`/api/ai/service-areas?date=${refDate}`), api('/api/ai/knowledge/bootstrap')]);
    if (ok) { setAreas(body.areas || []); setTiers(body.tiers || []); }
    if (preview.ok) setHistory(preview.body.areaSuggestions || []);
  }, [refDate]);
  async function reactivate(a) {
    const { ok, body } = await api('/api/ai/service-areas', { method: 'POST', body: JSON.stringify({ ...a, match_terms: a.match_terms || [], active: true }) });
    if (!ok) return toast.error(body?.error || 'Falha.');
    toast.success(`${a.name} reativada.`); load();
  }
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
          <Field label="Faixa de preço (herda os valores de Tabelas → Por faixa)"><select className={INPUT} value={form.price_tier || ''} onChange={(e) => setForm({ ...form, price_tier: e.target.value })}>
            <option value="">Região-base</option>
            {tiers.filter((t) => t.slug !== 'base').map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}
            {form.price_tier && !tiers.some((t) => t.slug === form.price_tier) ? <option value={form.price_tier}>{form.price_tier}</option> : null}
          </select></Field>
          {[['distance_km', 'Distância (km)'], ['travel_minutes', 'Tempo (min)'], ['travel_fee', 'Deslocamento da banda (R$)'], ['sound_travel_fee', 'Deslocamento do som (R$)'], ['toll_fee', 'Pedágios (R$)'], ['lodging_fee', 'Hospedagem (R$)']].map(([k, l]) => (
            <Field key={k} label={l}><input type="number" step="any" className={INPUT} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></Field>
          ))}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.lodging_required} onChange={(e) => setForm({ ...form, lodging_required: e.target.checked })} />Exige hospedagem</label>
        </div>
        <Field label="Observações"><input className={INPUT} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <button type="button" onClick={save} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Salvar localidade</button>
      </Card>
      {history.length ? (
        <Card title="Sugeridas pelo histórico de eventos">
          <p className="text-xs text-slate-500">Cidades onde já houve eventos. Revise status e taxas antes de salvar — nada é cadastrado automaticamente.</p>
          <div className="flex flex-wrap gap-2">{history.map((h) => (
            <button key={h.name} type="button" onClick={() => setForm({ ...EMPTY_AREA, name: h.name, match_terms: h.name.split(' - ')[0] })} className="rounded-full bg-slate-100 px-3 py-1 text-xs">{h.name} ({h.events})</button>
          ))}</div>
        </Card>
      ) : null}
      <Card title="Localidades cadastradas">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Preços herdados da faixa e deslocamento calculados pelo mesmo motor da Nara.</span>
          <label className="ml-auto flex items-center gap-1">Vigência em<input type="date" className="rounded border border-slate-200 px-1" value={refDate} onChange={(e) => setRefDate(e.target.value || new Date().toISOString().slice(0, 10))} /></label>
        </div>
        {[...areas].sort((x, y) => Number(y.active !== false) - Number(x.active !== false)).map((a) => {
          const p = a.preview || {};
          return (
            <div key={a.id} className={`space-y-1 border-b border-slate-100 py-2 text-sm ${a.active === false ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <strong>{a.name}</strong>
                <span className="rounded-full bg-slate-100 px-2 text-xs">{p.tier_label || 'Região-base'}</span>
                <span className="text-xs text-slate-500">{({ served: 'Atendida', conditional: 'Condicional', blocked: 'Bloqueada' })[a.status]}{a.active === false ? ' · inativa' : ''} · {(a.match_terms || []).join(', ')}{a.distance_km ? ` · ${a.distance_km} km` : ''}</span>
                <span className="ml-auto flex gap-1">
                  <button type="button" onClick={() => setForm({ ...EMPTY_AREA, ...a, price_tier: a.price_tier || '', match_terms: (a.match_terms || []).join(', ') })} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700">Editar</button>
                  {a.active === false
                    ? <button type="button" onClick={() => reactivate(a)} className="rounded-lg border border-emerald-300 px-2 py-1 text-xs text-emerald-700">Reativar</button>
                    : <button type="button" onClick={async () => { await api(`/api/ai/service-areas?id=${a.id}`, { method: 'DELETE' }); load(); }} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700">Desativar</button>}
                </span>
              </div>
              <div className="text-xs text-slate-700">Cerimônia: {(p.prices || []).map((x) => `${x.formation} ${x.amount != null ? brl(x.amount) : '—'}`).join(' · ')}</div>
              <div className="text-xs text-slate-500">
                Deslocamento: {p.travel?.amount ? `${brl(p.travel.amount)} (${p.travel.label})` : p.travel?.label}
                {' · '}Som: {p.sound_travel?.amount ? `${brl(p.sound_travel.amount)} (${p.sound_travel.label})` : p.sound_travel?.label}
                {a.toll_fee ? ` · pedágio ${brl(a.toll_fee)}` : ''}{a.lodging_required ? ` · hospedagem ${a.lodging_fee ? brl(a.lodging_fee) : 'sem valor'}` : ''}
              </div>
              {(p.issues || []).map((i) => <div key={i.code} className="text-xs text-amber-700">⚠ {i.text}</div>)}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

const EMPTY_VENUE = { id: null, name: '', aliases: '', address: '', city: '', uf: 'BA', lat: '', lng: '', area_id: '', notes: '' };
const VENUE_STATUS = { verified: 'Verificado', client_reported: 'Informado por cliente (conferir)', rejected: 'Rejeitado' };
const VENUE_SOURCE = { owner: 'equipe', client_message: 'mensagem da cliente', whatsapp_location: 'localização do WhatsApp', maps: 'mapas' };

function VenuesTab({ toast }) {
  const [venues, setVenues] = useState([]);
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState(EMPTY_VENUE);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    const { ok, body } = await api('/api/ai/venues');
    if (!ok) { setError(body?.error || 'Falha ao carregar.'); return; }
    setError(null); setVenues(body.venues || []); setAreas(body.areas || []);
  }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);
  async function save(payload, msg) {
    const { ok, body } = await api('/api/ai/venues', { method: 'POST', body: JSON.stringify(payload) });
    if (!ok) return toast.error(body?.error || 'Falha.');
    toast.success(msg); setForm(EMPTY_VENUE); load();
  }
  const edit = (v) => setForm({ ...EMPTY_VENUE, ...v, aliases: (v.aliases || []).join(', '), lat: v.lat ?? '', lng: v.lng ?? '', area_id: v.area_id || '', address: v.address || '', notes: v.notes || '' });
  return (
    <div className="space-y-4">
      <Card title={form.id ? 'Conferir / editar espaço' : 'Novo espaço'}>
        <p className="text-xs text-slate-500">Espaços verificados são reutilizados pela Nara sem perguntar de novo. Mesmo nome em cidades diferentes são espaços diferentes: sem a cidade, a Nara pergunta. Relatos de clientes só valem depois de verificados aqui.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nome do espaço"><input className={INPUT} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Apelidos (vírgula)"><input className={INPUT} value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} /></Field>
          <Field label="Endereço"><input className={INPUT} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Cidade"><input className={INPUT} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="UF"><input className={INPUT} maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} /></Field>
          <Field label="Localidade (faixa)"><select className={INPUT} value={form.area_id} onChange={(e) => setForm({ ...form, area_id: e.target.value })}>
            <option value="">Pela cidade</option>
            {areas.filter((a) => a.active !== false).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></Field>
          <Field label="Latitude"><input className={INPUT} value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></Field>
          <Field label="Longitude"><input className={INPUT} value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></Field>
          <Field label="Observações"><input className={INPUT} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => save({ ...form, status: 'verified', source: form.source === 'maps' ? 'maps' : 'owner' }, 'Espaço verificado.')} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Salvar como verificado</button>
          {form.id ? <button type="button" onClick={() => setForm(EMPTY_VENUE)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm">Cancelar</button> : null}
        </div>
      </Card>
      <Card title="Espaços na memória">
        {error ? <p className="text-sm text-amber-700">{error}</p> : null}
        {!venues.length && !error ? <p className="text-sm text-slate-500">Nenhum espaço ainda.</p> : null}
        {venues.map((v) => (
          <div key={v.id} className={`space-y-1 border-b border-slate-100 py-2 text-sm ${v.status === 'rejected' ? 'opacity-50' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              <strong>{v.name}</strong>
              <span className="text-xs text-slate-500">{v.city} - {v.uf}{v.address ? ` · ${v.address}` : ''}</span>
              <span className={`rounded-full px-2 text-xs ${v.status === 'verified' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{VENUE_STATUS[v.status]}</span>
              <span className="ml-auto flex gap-1">
                <button type="button" onClick={() => edit(v)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700">{v.status === 'verified' ? 'Editar' : 'Conferir'}</button>
                {v.status !== 'rejected' ? <button type="button" onClick={() => save({ ...v, aliases: v.aliases || [], status: 'rejected' }, 'Espaço rejeitado.')} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700">Rejeitar</button> : null}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              Fonte: {VENUE_SOURCE[v.source] || v.source}{v.verified_at ? ` · verificado em ${new Date(v.verified_at).toLocaleDateString('pt-BR')}` : ''}
              {(v.aliases || []).length ? ` · apelidos: ${v.aliases.join(', ')}` : ''}
              {v.lat != null ? ` · ${v.lat}, ${v.lng}` : ''}{v.mentions > 1 ? ` · citado ${v.mentions}x` : ''}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function MusiciansTab({ toast }) {
  const [data, setData] = useState({ profiles: [], contacts: [] });
  const [form, setForm] = useState({ contact_id: '', display_name: '', instruments: '', roles: '', is_primary_vocal: false, fee: '', video_urls: '', portfolio_url: '', voice: '', client_presentable: false, presentation_urls: '' });
  const load = useCallback(async () => { const { ok, body } = await api('/api/ai/musicians'); if (ok) setData(body); }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);
  async function save() {
    const { ok, body } = await api('/api/ai/musicians', { method: 'POST', body: JSON.stringify(form) });
    if (!ok) return toast.error(body?.error || 'Falha.');
    toast.success(body?.warning ? `Músico salvo. ${body.warning}` : 'Músico salvo.'); load();
  }
  return (
    <div className="space-y-4">
      <Card title="Catálogo de músicos">
        <p className="text-xs text-slate-500">Ligado aos contatos e à escala do Harmonics. A assistente só gerencia vocalistas; a disponibilidade vem sempre da escala real. Só aparece para a cliente quem estiver autorizado e com links de apresentação.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Contato"><select className={INPUT} value={form.contact_id} onChange={(e) => { const c = data.contacts.find((x) => x.id === e.target.value); setForm({ ...form, contact_id: e.target.value, display_name: form.display_name || c?.name || '' }); }}><option value="">Selecione…</option>{data.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Nome exibido"><input className={INPUT} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></Field>
          <Field label="Cachê (R$)"><input type="number" className={INPUT} value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} /></Field>
          <Field label="Instrumentos"><input className={INPUT} placeholder="voz, violão" value={form.instruments} onChange={(e) => setForm({ ...form, instruments: e.target.value })} /></Field>
          <Field label="Funções"><input className={INPUT} placeholder="vocal, instrumental" value={form.roles} onChange={(e) => setForm({ ...form, roles: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_primary_vocal} onChange={(e) => setForm({ ...form, is_primary_vocal: e.target.checked })} />Vocalista principal</label>
          <Field label="Voz"><select className={INPUT} value={form.voice || ''} onChange={(e) => setForm({ ...form, voice: e.target.value })}><option value="">—</option><option value="masculino">Masculina</option><option value="feminino">Feminina</option></select></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.client_presentable)} onChange={(e) => setForm({ ...form, client_presentable: e.target.checked })} />Autorizado a ser apresentado à cliente</label>
        </div>
        <Field label="Links individuais de apresentação (https, vírgula)"><input className={INPUT} value={form.presentation_urls} onChange={(e) => setForm({ ...form, presentation_urls: e.target.value })} /></Field>
        <Field label="Vídeos (URLs https, vírgula)"><input className={INPUT} value={form.video_urls} onChange={(e) => setForm({ ...form, video_urls: e.target.value })} /></Field>
        <Field label="Portfólio (https)"><input className={INPUT} value={form.portfolio_url} onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })} /></Field>
        <button type="button" onClick={save} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Salvar músico</button>
      </Card>
      <Card title="Perfis">
        {data.profiles.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-2 text-sm">
            <strong>{p.display_name}</strong>{p.is_primary_vocal ? <span className="rounded-full bg-violet-100 px-2 text-[11px] font-semibold text-violet-700">Vocalista principal</span> : null}
            <span className="text-xs text-slate-500">{(p.instruments || []).join(', ')} · {(p.roles || []).join(', ')} · {(p.video_urls || []).length} vídeo(s)</span>
            <button type="button" onClick={() => setForm({ ...p, instruments: (p.instruments || []).join(', '), roles: (p.roles || []).join(', '), video_urls: (p.video_urls || []).join(', '), presentation_urls: (p.presentation_urls || []).join(', '), voice: p.voice || '', fee: p.fee ?? '', portfolio_url: p.portfolio_url || '' })} className="ml-auto rounded-lg border px-2 py-1 text-xs">Editar</button>
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
        <p className="text-xs text-slate-500">Cadência do Manual: 2 dias (vai conversar com parceiro) ou 3 dias (comparando/indeciso) e última tentativa 5 dias depois; máximo de {s.followup_max ?? 2} abordagens. Para quando o cliente responde, contrata, recusa, pede para parar ou alguém da equipe assume.</p>
        <Field label="Máximo de abordagens proativas (0–2)"><input type="number" min="0" max="2" className={INPUT} value={s.followup_max ?? 2} onChange={(e) => setS({ ...s, followup_max: Number(e.target.value) })} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(s.signature_reminders_enabled)} onChange={(e) => setS({ ...s, signature_reminders_enabled: e.target.checked })} />Lembretes de assinatura do pré-contrato (templates Meta)</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dias após o envio (vírgula)"><input className={INPUT} value={(s.signature_reminder_days || [2, 7, 12]).join(', ')} onChange={(e) => setS({ ...s, signature_reminder_days: e.target.value.split(',').map((x) => Number(x.trim())).filter(Boolean) })} /></Field>
          <Field label="Templates por lembrete (vírgula)"><input className={INPUT} value={(s.signature_reminder_templates || []).join(', ')} onChange={(e) => setS({ ...s, signature_reminder_templates: e.target.value.split(',').map((x) => x.trim()) })} /></Field>
        </div>
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
  const [f, setF] = useState({ date: '', time: '', formation: 'Trio', instruments: '', hasSound: false, receptionFormation: '', receptionHours: 0, location: '', modality: 'ceremony', hours: 0 });
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
        <Field label="Modalidade"><select className={INPUT} value={f.modality} onChange={(e) => setF({ ...f, modality: e.target.value })}><option value="ceremony">Cerimônia</option><option value="show">Por tempo (avulso)</option></select></Field>
        {f.modality === 'show' ? <Field label="Horas"><input type="number" className={INPUT} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></Field> : null}
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
  const [tab, setTab] = useState('center');
  // Link direto (?tab=tables), lido após montar para não divergir da renderização do servidor.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab');
    if (TABS.some((t) => t.key === wanted)) { const t = setTimeout(() => setTab(wanted), 0); return () => clearTimeout(t); }
    return undefined;
  }, []);
  const Tab = { center: SupervisionCenter, tables: PriceRulesPanel, vocalists: VocalistsPanel, manual: ManualPricingPanel, teach: TeachTab, learning: LearningTab, areas: AreasTab, venues: VenuesTab, musicians: MusiciansTab, sales: SalesTab, pipeline: PipelineTab, simulator: SimulatorTab, chat: ChatSimulationPanel }[tab];
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
