'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';
import AutomationBackLink from '@/components/automacoes/AutomationBackLink';
import SmartEmptyState from '@/components/onboarding/SmartEmptyState';
import { cachedPromise, invalidateCache, readCachedValue } from '@/lib/client/light-cache';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import { useAppToast } from '@/components/ui/ToastProvider';
import AppModal from '@/components/ui/AppModal';
import { WHATSAPP_PROVIDER_REGISTRY, getWhatsappProvider } from '@/lib/automation/provider-registry';

const FORM_INICIAL = {
  name: '',
  provider: 'wasender',
  api_url: '',
  api_key: '',
  instance_id: '',
  admin_alert_number: '',
  is_active: true,
  is_default: false,
};

const CHANNELS_CACHE_KEY = 'automation:channels';

const PROVIDER_DEFAULTS = {
  wasender: {
    api_url: 'https://wasenderapi.com/api/send-message',
    instance_id_label: 'Instance ID',
    api_key_label: 'API Key',
    api_url_label: 'API URL',
  },
  evolution: {
    api_url: '',
    instance_id_label: 'Nome da instância',
    api_key_label: 'API Key / Token',
    api_url_label: 'Base URL da Evolution',
  },
  zapi: {
    api_url: '',
    instance_id_label: 'Instance ID',
    api_key_label: 'Token',
    api_url_label: 'URL da instância Z-API',
  },
  meta_cloud: {
    api_url: 'https://graph.facebook.com/v20.0',
    instance_id_label: 'Phone Number ID',
    api_key_label: 'Access Token',
    api_url_label: 'Graph API Base URL',
  },
  wppconnect: {
    api_url: '',
    instance_id_label: 'Session name',
    api_key_label: 'Secret / Token',
    api_url_label: 'Base URL do WPPConnect',
  },
  twilio: {
    api_url: 'https://api.twilio.com',
    instance_id_label: 'From / Sender ID',
    api_key_label: 'Auth Token',
    api_url_label: 'Twilio API URL',
  },
  ultramsg: {
    api_url: '',
    instance_id_label: 'Instance ID',
    api_key_label: 'Token',
    api_url_label: 'UltraMsg API URL',
  },
};

function getProviderDefaults(provider) {
  return PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.wasender;
}

function getProviderLabel(provider) {
  return getWhatsappProvider(provider)?.label || provider || 'Provider';
}

function formatarData(isoString) {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ isActive }) {
  return isActive ? (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">Ativo</span>
  ) : (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">Inativo</span>
  );
}

function validateForm(form, isEdit = false) {
  const missing = [];
  if (!form.name?.trim()) missing.push('Nome');
  if (!form.provider?.trim()) missing.push('Provider');
  if (!form.api_url?.trim()) missing.push('API URL');
  if (!isEdit && !form.api_key?.trim()) missing.push('API Key');
  if (!form.instance_id?.trim()) missing.push('Instance ID');
  return missing;
}

export default function CanaisPageClient() {
  const [canais, setCanais] = useState(() => readCachedValue(CHANNELS_CACHE_KEY)?.channels || []);
  const [carregando, setCarregando] = useState(() => !readCachedValue(CHANNELS_CACHE_KEY));
  const [erro, setErro] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [testandoConexao, setTestandoConexao] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [canalParaTestar, setCanalParaTestar] = useState(null);
  const [telefoneTest, setTelefoneTest] = useState('');
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [toastTest, setToastTest] = useState(null);
  const { confirm } = useConfirm() || {};
  const toast = useAppToast();

  const providerDefaults = getProviderDefaults(form.provider);

  const carregarCanais = useCallback(async ({ force = false } = {}) => {
    try {
      if (!readCachedValue(CHANNELS_CACHE_KEY) || force) {
        setCarregando(true);
      }
      setErro(null);
      const data = await cachedPromise(
        CHANNELS_CACHE_KEY,
        async () => {
          const response = await fetch('/api/automation/channels');
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'Erro ao carregar canais');
          return payload;
        },
        { ttlMs: 60_000, force }
      );
      setCanais(data.channels || []);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarCanais();
  }, [carregarCanais]);

  function abrirModalNovo() {
    setEditandoId(null);
    setForm(FORM_INICIAL);
    setModalAberto(true);
  }

  function abrirModalEditar(canal) {
    setEditandoId(canal.id);
    setForm({
      name: canal.name || '',
      provider: canal.provider || 'wasender',
      api_url: canal.api_url || '',
      api_key: '',
      instance_id: canal.instance_id || '',
      admin_alert_number: canal.admin_alert_number || '',
      is_active: canal.is_active !== false,
      is_default: canal.is_default === true,
    });
    setModalAberto(true);
  }

  function handleProviderChange(provider) {
    const defaults = getProviderDefaults(provider);
    setForm((current) => ({
      ...current,
      provider,
      api_url: current.api_url && current.provider === provider ? current.api_url : defaults.api_url || '',
    }));
  }

  function fecharModal() {
    setModalAberto(false);
    setEditandoId(null);
    setForm(FORM_INICIAL);
  }

  async function salvarCanal() {
    const missing = validateForm(form, Boolean(editandoId));
    if (missing.length) {
      toast.warning(`Preencha os campos obrigatórios: ${missing.join(', ')}`);
      return;
    }

    if (form.is_default && canais.some((c) => c.is_default && c.id !== editandoId)) {
      const confirmou = await confirm?.({ title: 'Definir canal padrão?', description: 'Este canal substituirá o padrão atual para envios automáticos.', confirmText: 'Definir como padrão', cancelText: 'Cancelar' });
      if (!confirmou) return;
    }

    try {
      setSalvando(true);
      const isCreating = !editandoId;
      const url = editandoId ? `/api/automation/channels/${editandoId}` : '/api/automation/channels';
      const method = editandoId ? 'PATCH' : 'POST';
      const payload = { ...form };
      if (!payload.api_key) delete payload.api_key;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar canal');

      invalidateCache(CHANNELS_CACHE_KEY);
      await carregarCanais({ force: true });
      fecharModal();
      toast.success(isCreating ? 'Canal criado com sucesso. Próximo passo: teste o envio e ative suas automações.' : 'Canal atualizado com sucesso.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível concluir a ação');
    } finally {
      setSalvando(false);
    }
  }

  async function testarConexao() {
    const missing = validateForm(form, Boolean(editandoId));
    if (missing.length) {
      toast.warning(`Preencha os campos obrigatórios antes do teste: ${missing.join(', ')}`);
      return;
    }

    try {
      setTestandoConexao(true);
      const response = await fetch('/api/automation/channels/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha no teste de conexão');
      toast.success(`Conexão OK (${data.status})`);
    } catch (error) {
      toast.error(error.message || 'Não foi possível concluir a ação');
    } finally {
      setTestandoConexao(false);
    }
  }

  async function toggleAtivo(canalId, isActive) {
    const response = await fetch(`/api/automation/channels/${canalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    });
    if (!response.ok) {
      const data = await response.json();
      toast.error(data.error || 'Erro ao atualizar status');
      return;
    }
    invalidateCache(CHANNELS_CACHE_KEY);
    await carregarCanais({ force: true });
    toast.success('Status do canal atualizado.');
  }

  async function definirPadrao(canalId) {
    const response = await fetch(`/api/automation/channels/${canalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_default: true }),
    });
    if (!response.ok) {
      const data = await response.json();
      toast.error(data.error || 'Erro ao definir padrão');
      return;
    }
    invalidateCache(CHANNELS_CACHE_KEY);
    await carregarCanais({ force: true });
    toast.success('Canal padrão atualizado com sucesso.');
  }

  async function excluirCanal(canalId) {
    const confirmou = await confirm?.({ title: 'Excluir canal?', description: 'Esta ação removerá o canal e não poderá ser desfeita.', confirmText: 'Excluir canal', cancelText: 'Cancelar', tone: 'destructive' });
    if (!confirmou) return;

    const response = await fetch(`/api/automation/channels/${canalId}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json();
      toast.error(data.error || 'Erro ao excluir canal');
      return;
    }
    invalidateCache(CHANNELS_CACHE_KEY);
    await carregarCanais({ force: true });
    toast.success('Canal excluído com sucesso.');
  }

  const total = canais.length;
  const ativos = canais.filter((c) => c.is_active).length;
  const canalPadrao = canais.find((c) => c.is_default);
  const adminConfigurado = Boolean(canalPadrao?.admin_alert_number);

  return (
    <div className="space-y-6">
      <AutomationBackLink />

      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">Canais</div>
            <h1 className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#0f172a]">Canais WhatsApp</h1>
            <p className="mt-2 max-w-2xl text-[14px] font-semibold leading-6 text-[#64748b]">
              Conecte a API WhatsApp do próprio workspace. O Harmonics organiza os disparos, mas cada cliente pode usar seu provedor preferido.
            </p>
          </div>
          <button type="button" onClick={abrirModalNovo} className="rounded-full bg-violet-600 px-5 py-2.5 text-[14px] font-bold text-white">+ Novo canal</button>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4">
        <AdminSummaryCard label="Total" value={carregando ? '–' : total} tone="default" />
        <AdminSummaryCard label="Ativos" value={carregando ? '–' : ativos} tone="success" />
        <AdminSummaryCard label="Canal padrão" value={carregando ? '–' : canalPadrao ? canalPadrao.name : '—'} tone="accent" />
      </section>

      <section className="rounded-[20px] border border-[#dbe3ef] bg-white px-5 py-4 text-[13px] text-[#475569]">
        <span className="font-semibold">Status admin:</span>{' '}
        <span className={adminConfigurado ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
          {adminConfigurado ? 'Admin configurado' : 'Admin não configurado'}
        </span>
      </section>

      {!carregando && !erro && canais.length === 0 && (
        <SmartEmptyState
          eyebrow="Automação"
          title="Você ainda não conectou um canal WhatsApp."
          description="Conecte um provedor para liberar convites, lembretes, mensagens operacionais e alertas automáticos dentro do workspace."
          bullets={['Convites automáticos', 'Lembretes de evento', 'Alertas para administradores', 'Logs de envio']}
          primaryHref="/automacoes/canais"
          primaryLabel="Conectar primeiro canal"
          icon="📲"
        />
      )}

      {!carregando && erro && <section className="rounded-[28px] border border-red-200 bg-red-50 p-8">{erro}</section>}

      {!carregando && !erro && canais.length > 0 && (
        <section className="space-y-4">
          {canais.map((canal) => (
            <div key={canal.id} className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-black text-[#0f172a]">{canal.name}</span>
                    <StatusBadge isActive={canal.is_active} />
                    {canal.is_default && <span className="rounded-full bg-violet-600 px-3 py-1 text-[11px] font-bold text-white">Padrão</span>}
                  </div>
                  <div className="mt-2 text-[13px] text-[#64748b] space-y-0.5">
                    <div><span className="font-semibold">Provider:</span> {getProviderLabel(canal.provider)}</div>
                    <div><span className="font-semibold">API URL:</span> {canal.api_url || '—'}</div>
                    <div><span className="font-semibold">API Key:</span> {canal.has_api_key ? '•••••••• configurada' : 'não configurada'}</div>
                    <div><span className="font-semibold">Instance ID:</span> {canal.instance_id || '—'}</div>
                    <div><span className="font-semibold">WhatsApp do admin:</span> {canal.admin_alert_number || '—'}</div>
                  </div>
                  <div className="mt-2 text-[12px] text-[#94a3b8]">Criado em {formatarData(canal.created_at)}</div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button type="button" onClick={() => { setCanalParaTestar(canal); setTelefoneTest(''); setToastTest(null); }} className="rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-[13px] font-bold text-sky-700">Testar envio</button>
                  {!canal.is_default && <button type="button" onClick={() => definirPadrao(canal.id)} className="rounded-full border border-violet-200 px-4 py-1.5 text-[13px] font-bold text-violet-700">Definir padrão</button>}
                  <button type="button" onClick={() => abrirModalEditar(canal)} className="rounded-full border border-[#e2e8f0] px-4 py-1.5 text-[13px] font-bold text-[#475569]">Editar</button>
                  <button type="button" onClick={() => toggleAtivo(canal.id, canal.is_active)} className="rounded-full border border-gray-200 px-4 py-1.5 text-[13px] font-bold text-gray-600">{canal.is_active ? 'Desativar' : 'Ativar'}</button>
                  <button type="button" onClick={() => excluirCanal(canal.id)} className="rounded-full border border-red-200 px-4 py-1.5 text-[13px] font-bold text-red-700">Excluir</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <AppModal open={modalAberto} onClose={fecharModal} title={editandoId ? 'Editar canal' : 'Novo canal'} maxWidthClass="max-w-2xl" footer={(<div className="flex gap-3 justify-end"><button type="button" onClick={fecharModal} className="rounded-full border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-bold text-[#475569]">Cancelar</button><button type="button" onClick={testarConexao} disabled={testandoConexao} className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-[13px] font-bold text-violet-700 disabled:cursor-not-allowed disabled:opacity-60">{testandoConexao ? 'Testando...' : 'Testar conexão'}</button><button type="button" onClick={salvarCanal} disabled={salvando} className="rounded-full bg-violet-600 px-4 py-2 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{salvando ? 'Salvando...' : 'Salvar canal'}</button></div>)}>
        <div className="space-y-5">
          <div>
            <label className="block text-[13px] font-bold text-[#0f172a]">Nome *</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px]" />
          </div>

          <div>
            <label className="block text-[13px] font-bold text-[#0f172a]">Provider *</label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {WHATSAPP_PROVIDER_REGISTRY.map((provider) => (
                <button key={provider.key} type="button" onClick={() => handleProviderChange(provider.key)} className={`rounded-2xl border px-4 py-3 text-left transition ${form.provider === provider.key ? 'border-violet-300 bg-violet-50 text-violet-900' : 'border-[#e2e8f0] bg-white text-[#334155] hover:border-violet-200'}`}>
                  <div className="text-[13px] font-black">{provider.label}</div>
                  <div className="mt-1 text-[11px] font-semibold leading-4 opacity-75">{provider.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-bold text-[#0f172a]">{providerDefaults.api_url_label} *</label>
            <input type="url" value={form.api_url} onChange={(e) => setForm((f) => ({ ...f, api_url: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px]" />
          </div>

          <div>
            <label className="block text-[13px] font-bold text-[#0f172a]">{providerDefaults.api_key_label} {!editandoId && '*'}</label>
            <input type="password" value={form.api_key} onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))} placeholder={editandoId ? 'Deixe em branco para manter' : ''} className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px]" />
          </div>

          <div>
            <label className="block text-[13px] font-bold text-[#0f172a]">{providerDefaults.instance_id_label} *</label>
            <input type="text" value={form.instance_id} onChange={(e) => setForm((f) => ({ ...f, instance_id: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px]" />
          </div>

          <div>
            <label className="block text-[13px] font-bold text-[#0f172a]">WhatsApp do admin para alertas do sistema</label>
            <input type="tel" value={form.admin_alert_number} onChange={(e) => setForm((f) => ({ ...f, admin_alert_number: e.target.value }))} placeholder="+55 71 99999-9999" className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px]" />
          </div>

          <div className="flex gap-6">
            <label className="text-[13px] font-semibold"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="mr-2" />Ativo</label>
            <label className="text-[13px] font-semibold"><input type="checkbox" checked={form.is_default} onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} className="mr-2" />Padrão</label>
          </div>
        </div>
      </AppModal>

      <AppModal open={Boolean(canalParaTestar)} onClose={() => setCanalParaTestar(null)} title="Testar envio" subtitle={canalParaTestar?.name} maxWidthClass="max-w-md" footer={(<div className="flex gap-3 justify-end"><button type="button" onClick={() => setCanalParaTestar(null)} className="rounded-full border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-bold text-[#475569]">Cancelar</button><button type="button" disabled={enviandoTeste || !telefoneTest.trim()} onClick={async () => { setEnviandoTeste(true); setToastTest(null); try { const res = await fetch('/api/automation/test-channel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId: canalParaTestar.id, phone: telefoneTest.trim() }), }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Erro ao enviar teste'); setToastTest({ message: 'Mensagem de teste enviada com sucesso!', type: 'success' }); } catch (err) { setToastTest({ message: err.message, type: 'error' }); } finally { setEnviandoTeste(false); } }} className="rounded-full bg-violet-600 px-4 py-2 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{enviandoTeste ? 'Enviando...' : 'Enviar teste'}</button></div>)}>
        <input type="tel" value={telefoneTest} onChange={(e) => setTelefoneTest(e.target.value)} placeholder="Ex: 5511999999999" className="mt-4 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px]" />
        {toastTest && <div className={`mt-3 rounded-xl px-4 py-3 text-[13px] font-semibold ${toastTest.type === 'success' ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-red-200 bg-red-50 text-red-700'}`}>{toastTest.message}</div>}
      </AppModal>
    </div>
  );
}
