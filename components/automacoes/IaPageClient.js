'use client';
import { useEffect, useState } from 'react';
import AutomationBackLink from '@/components/automacoes/AutomationBackLink';
import { useAppToast } from '@/components/ui/ToastProvider';

export default function IaPageClient() {
  const toast = useAppToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [form, setForm] = useState({ ai_enabled: false, ai_provider: 'openai', api_key: '', ai_model: 'gpt-4.1-mini', ai_fallback_only: true, ai_monthly_limit: '' });

  useEffect(() => { (async () => {
    const res = await fetch('/api/automation/ai-config');
    const payload = await res.json();
    if (res.ok) {
      setForm((f) => ({ ...f, ...payload.config, api_key: '' , ai_monthly_limit: payload.config.ai_monthly_limit ?? ''}));
      setHasApiKey(Boolean(payload.config?.hasApiKey));
    }
    setLoading(false);
  })(); }, []);

  async function save() {
    setSaving(true);
    const res = await fetch('/api/automation/ai-config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const payload = await res.json();
    setSaving(false);
    if (!res.ok) return toast.error(payload.error || 'Erro ao salvar IA');
    if (form.api_key) setHasApiKey(true);
    setForm((f) => ({ ...f, api_key: '' }));
    toast.success('Configuração de IA salva.');
  }

  if (loading) return <div className="p-6">Carregando...</div>;
  return <div className="space-y-4"><AutomationBackLink />
    <section className="rounded-xl border bg-white p-6 space-y-3">
      <h1 className="text-xl font-bold">Configuração de IA</h1>
      <label className="block"><input type="checkbox" checked={form.ai_enabled} onChange={(e)=>setForm({...form, ai_enabled:e.target.checked})}/> Ativar IA</label>
      <label className="block">Provedor<input className="border ml-2" value="OpenAI" disabled /></label>
      <label className="block">API Key<input className="border ml-2" value={form.api_key} onChange={(e)=>setForm({...form, api_key:e.target.value})} placeholder={hasApiKey ? 'Já configurada (digite para substituir)' : 'sk-...'} /></label>
      <label className="block">Modelo<input className="border ml-2" value={form.ai_model} onChange={(e)=>setForm({...form, ai_model:e.target.value})} /></label>
      <label className="block"><input type="checkbox" checked={form.ai_fallback_only} onChange={(e)=>setForm({...form, ai_fallback_only:e.target.checked})}/> Usar apenas como fallback</label>
      <label className="block">Limite mensal opcional<input type="number" className="border ml-2" value={form.ai_monthly_limit} onChange={(e)=>setForm({...form, ai_monthly_limit:e.target.value})} /></label>
      <button onClick={save} disabled={saving} className="rounded bg-slate-900 text-white px-4 py-2">{saving ? 'Salvando...' : 'Salvar'}</button>
    </section>
  </div>;
}
