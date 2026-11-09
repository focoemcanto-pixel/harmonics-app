'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppToast } from '@/components/ui/ToastProvider';

const MODES = [
  { key: 'observe', label: 'Observação', help: 'Registra conversas no Inbox. A IA não responde.' },
  { key: 'draft', label: 'Rascunho', help: 'A IA sugere respostas; a equipe revisa e envia.' },
  { key: 'auto', label: 'Automático', help: 'A IA responde sozinha e transfere para humano quando necessário.' },
];

function Check({ ok, label }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-400'}`} />
      <span className={ok ? 'text-slate-700' : 'text-slate-500'}>{label}</span>
    </li>
  );
}

export default function InboxSettingsClient() {
  const toast = useAppToast();
  const [state, setState] = useState(null);
  const [settings, setSettings] = useState({});
  const [channel, setChannel] = useState({});
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  function hydrate(body) {
    setState(body);
    setSettings(body.settings || {});
    setChannel({
      phone_number_id: body.channel?.phone_number_id || '',
      waba_id: body.channel?.waba_id || '',
      display_phone: body.channel?.display_phone || '',
      status: body.channel?.status || 'draft',
    });
  }

  useEffect(() => {
    fetch('/api/ai/settings', { cache: 'no-store' }).then((r) => r.json()).then((body) => {
      if (body?.ok) hydrate(body); else toast.error(body?.error || 'Sem acesso.');
    });
  }, [toast]);

  async function save(extra = {}) {
    setSaving(true);
    const payload = {
      settings: { ...settings, ...(extra.settings || {}) },
      channel: { ...channel, ...(extra.channel || {}), ...(token ? { access_token: token } : {}) },
    };
    if (!payload.channel.phone_number_id) delete payload.channel;
    const response = await fetch('/api/ai/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok || !body?.ok) return toast.error(body?.error || 'Falha ao salvar.');
    setToken('');
    hydrate(body);
    toast.success('Configurações salvas.');
  }

  async function checkEligibility() {
    setChecking(true);
    const response = await fetch('/api/ai/channel/eligibility', { method: 'POST' });
    const body = await response.json().catch(() => ({}));
    setChecking(false);
    if (!body?.ok) return toast.error(body?.error || `Meta respondeu com erro (${body?.eligibility?.error || response.status}).`);
    toast.success('Diagnóstico atualizado.');
    setState((prev) => ({ ...prev, channel: { ...prev.channel, last_eligibility: body.eligibility } }));
  }

  if (!state) return <div className="p-6 text-sm text-slate-500">Carregando…</div>;
  const g = state.global || {};
  const elig = state.channel?.last_eligibility;
  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/whatsapp-cloud` : '/api/webhooks/whatsapp-cloud';

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <div className="flex gap-3"><Link href="/inbox" className="text-sm font-semibold text-violet-700">← Voltar ao Inbox</Link><Link href="/inbox/inteligencia" className="text-sm font-semibold text-slate-600">Inteligência Comercial</Link></div>

      {g.kill_switch ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Kill switch global ativo.</strong> Nenhuma resposta da IA é gerada ou enviada.
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-900">Pré-requisitos do servidor</h2>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          <Check ok={g.webhook_secret_configured} label="META_APP_SECRET (assinatura do webhook)" />
          <Check ok={g.verify_token_configured} label="META_WEBHOOK_VERIFY_TOKEN" />
          <Check ok={g.encryption_configured} label="AI_CHANNEL_ENCRYPTION_KEY (token criptografado)" />
          <Check ok={g.llm_configured} label="OPENAI_API_KEY (IA e transcrição)" />
          <Check ok={g.ai_enabled && !g.kill_switch} label="AI_INBOX_AI_ENABLED=true (liberação global)" />
        </ul>
        <p className="mt-3 text-xs text-slate-500">URL do webhook na Meta: <code className="rounded bg-slate-100 px-1">{webhookUrl}</code> — campos: messages, smb_message_echoes, history, smb_app_state_sync.</p>
      </section>

      <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-900">Canal WhatsApp Cloud API (Coexistence)</h2>
        <p className="text-xs text-slate-500">O número continua no app WhatsApp Business. O WaSender e as automações atuais não são alterados.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Phone Number ID
            <input value={channel.phone_number_id} onChange={(e) => setChannel({ ...channel, phone_number_id: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="text-sm">WABA ID
            <input value={channel.waba_id} onChange={(e) => setChannel({ ...channel, waba_id: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="text-sm">Número exibido
            <input value={channel.display_phone} onChange={(e) => setChannel({ ...channel, display_phone: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="text-sm">Token de acesso {state.channel?.has_token ? '(salvo — preencha só para trocar)' : ''}
            <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Status do canal:</span>
          {['draft', 'active', 'paused'].map((s) => (
            <button key={s} type="button" onClick={() => setChannel({ ...channel, status: s })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${channel.status === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {s === 'draft' ? 'Rascunho' : s === 'active' ? 'Ativo' : 'Pausado'}
            </button>
          ))}
          <span className="text-xs text-slate-500">Histórico: {state.channel?.history_sync_status || '—'} · Último webhook: {state.channel?.last_webhook_at ? new Date(state.channel.last_webhook_at).toLocaleString('pt-BR') : 'nunca'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={checking || !state.channel?.has_token} onClick={checkEligibility} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            {checking ? 'Consultando Meta…' : 'Verificar número / Coexistence'}
          </button>
          {elig ? (
            <span className="text-xs text-slate-600">
              {elig.ok ? `Nome: ${elig.verifiedName || '—'} · Qualidade: ${elig.qualityRating || '—'} · App Business: ${elig.isOnBizApp === true ? 'sim (Coexistence)' : elig.isOnBizApp === false ? 'não' : '—'}` : `Erro Meta: ${elig.error}`}
            </span>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Assistente</h2>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={Boolean(settings.ai_enabled)} onChange={(e) => setSettings({ ...settings, ai_enabled: e.target.checked })} />
            IA ligada neste workspace
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <button key={m.key} type="button" onClick={() => setSettings({ ...settings, mode: m.key })}
              className={`rounded-2xl border p-3 text-left ${settings.mode === m.key ? 'border-violet-500 bg-violet-50' : 'border-slate-200'}`}>
              <div className="text-sm font-semibold">{m.label}</div>
              <div className="text-xs text-slate-500">{m.help}</div>
            </button>
          ))}
        </div>
        <label className="block text-sm">Nome da assistente
          <input value={settings.assistant_name || ''} onChange={(e) => setSettings({ ...settings, assistant_name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="block text-sm">Como a assistente apresenta a empresa (ex.: “assistente da Sua Banda”)
          <input value={settings.assistant_company || ''} placeholder="Nome público do workspace" onChange={(e) => setSettings({ ...settings, assistant_company: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="block text-sm">Sobre a empresa (a IA só usa o que estiver aqui ou no sistema)
          <textarea rows={3} value={settings.business_description || ''} onChange={(e) => setSettings({ ...settings, business_description: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="block text-sm">Orientações de tom
          <textarea rows={2} value={settings.tone_notes || ''} onChange={(e) => setSettings({ ...settings, tone_notes: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
      </section>

      <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-900">Custos, limites e retenção</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['daily_ai_reply_limit', 'Respostas/dia'],
            ['daily_cost_limit_usd', 'Custo/dia (US$)'],
            ['monthly_cost_limit_usd', 'Custo/mês (US$)'],
            ['max_ai_turns_per_conversation', 'Turnos da IA por conversa'],
            ['retention_days', 'Retenção de mensagens (dias)'],
          ].map(([key, label]) => (
            <label key={key} className="text-sm">{label}
              <input type="number" step="any" value={settings[key] ?? ''} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
          ))}
        </div>
        {state.usage ? (
          <p className="text-xs text-slate-500">Hoje: {state.usage.day_replies} respostas · US$ {Number(state.usage.day_cost || 0).toFixed(4)} · Mês: US$ {Number(state.usage.month_cost || 0).toFixed(4)}</p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={saving} onClick={() => save()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button>
        <button type="button" disabled={saving} onClick={() => save({ settings: { ai_enabled: false } })} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Desligar IA agora</button>
      </div>
    </div>
  );
}
