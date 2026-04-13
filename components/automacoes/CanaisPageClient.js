'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';
import AutomationBackLink from '@/components/automacoes/AutomationBackLink';

const FORM_INICIAL = {
  name: '',
  provider: 'wasender',
  api_url: '',
  api_key: '',
  instance_id: '',
  is_active: true,
  is_default: false,
};

const PROVIDERS = [{ value: 'wasender', label: 'WaSender' }];

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
  const [canais, setCanais] = useState([]);
  const [carregando, setCarregando] = useState(true);
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

  const carregarCanais = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const response = await fetch('/api/automation/channels');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar canais');
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
      is_active: canal.is_active !== false,
      is_default: canal.is_default === true,
    });
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditandoId(null);
    setForm(FORM_INICIAL);
  }

  async function salvarCanal() {
    const missing = validateForm(form, Boolean(editandoId));
    if (missing.length) {
      alert(`Preencha os campos obrigatórios: ${missing.join(', ')}`);
      return;
    }

    if (form.is_default && canais.some((c) => c.is_default && c.id !== editandoId)) {
      const confirmou = window.confirm('Este canal será o novo padrão. Deseja continuar?');
      if (!confirmou) return;
    }

    try {
      setSalvando(true);
      const url = editandoId ? `/api/automation/channels/${editandoId}` : '/api/automation/channels';
      const method = editandoId ? 'PATCH' : 'POST';
      const payload = { ...form, provider: 'wasender' };
      if (!payload.api_key) delete payload.api_key;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar canal');

      await carregarCanais();
      fecharModal();
    } catch (error) {
      alert(error.message);
    } finally {
      setSalvando(false);
    }
  }

  async function testarConexao() {
    const missing = validateForm(form, Boolean(editandoId));
    if (missing.length) {
      alert(`Preencha os campos obrigatórios antes do teste: ${missing.join(', ')}`);
      return;
    }

    try {
      setTestandoConexao(true);
      const response = await fetch('/api/automation/channels/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, provider: 'wasender' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha no teste de conexão');
      alert(`Conexão OK (${data.status})`);
    } catch (error) {
      alert(error.message);
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
      alert(data.error || 'Erro ao atualizar status');
      return;
    }
    await carregarCanais();
  }

  async function definirPadrao(canalId) {
    const response = await fetch(`/api/automation/channels/${canalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_default: true }),
    });
    if (!response.ok) {
      const data = await response.json();
      alert(data.error || 'Erro ao definir padrão');
      return;
    }
    await carregarCanais();
  }

  async function excluirCanal(canalId) {
    const confirmou = window.confirm('Deseja realmente excluir este canal?');
    if (!confirmou) return;

    const response = await fetch(`/api/automation/channels/${canalId}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json();
      alert(data.error || 'Erro ao excluir canal');
      return;
    }
    await carregarCanais();
  }

  const total = canais.length;
  const ativos = canais.filter((c) => c.is_active).length;
  const canalPadrao = canais.find((c) => c.is_default);

  return (
    <div className="space-y-6">
      <AutomationBackLink />

      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">Canais</div>
            <h1 className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#0f172a]">Canais WhatsApp</h1>
          </div>
          <button onClick={abrirModalNovo} className="rounded-full bg-violet-600 px-5 py-2.5 text-[14px] font-bold text-white">+ Novo canal</button>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4">
        <AdminSummaryCard label="Total" value={carregando ? '–' : total} tone="default" />
        <AdminSummaryCard label="Ativos" value={carregando ? '–' : ativos} tone="success" />
        <AdminSummaryCard label="Canal padrão" value={carregando ? '–' : canalPadrao ? canalPadrao.name : '—'} tone="accent" />
      </section>

      {!carregando && !erro && canais.length === 0 && (
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-12 text-center">
          Nenhum canal cadastrado.
        </section>
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
                    <div><span className="font-semibold">Provider:</span> {canal.provider}</div>
                    <div><span className="font-semibold">API URL:</span> {canal.api_url || '—'}</div>
                    <div><span className="font-semibold">API Key:</span> {canal.has_api_key ? '•••••••• configurada' : 'não configurada'}</div>
                    <div><span className="font-semibold">Instance ID:</span> {canal.instance_id || '—'}</div>
                  </div>
                  <div className="mt-2 text-[12px] text-[#94a3b8]">Criado em {formatarData(canal.created_at)}</div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setCanalParaTestar(canal);
                      setTelefoneTest('');
                      setToastTest(null);
                    }}
                    className="rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-[13px] font-bold text-sky-700"
                  >
                    Testar envio
                  </button>
                  {!canal.is_default && <button onClick={() => definirPadrao(canal.id)} className="rounded-full border border-violet-200 px-4 py-1.5 text-[13px] font-bold text-violet-700">Definir padrão</button>}
                  <button onClick={() => abrirModalEditar(canal)} className="rounded-full border border-[#e2e8f0] px-4 py-1.5 text-[13px] font-bold text-[#475569]">Editar</button>
                  <button onClick={() => toggleAtivo(canal.id, canal.is_active)} className="rounded-full border border-gray-200 px-4 py-1.5 text-[13px] font-bold text-gray-600">{canal.is_active ? 'Desativar' : 'Ativar'}</button>
                  <button onClick={() => excluirCanal(canal.id)} className="rounded-full border border-red-200 px-4 py-1.5 text-[13px] font-bold text-red-700">Excluir</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40" onClick={fecharModal} />
          <div className="relative z-10 w-full max-w-lg rounded-t-[28px] bg-white p-6 sm:m-4 sm:rounded-[28px]">
            <h2 className="text-[20px] font-black text-[#0f172a]">{editandoId ? 'Editar canal' : 'Novo canal'}</h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">Nome *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px]" />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">Provider *</label>
                <select value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px]">
                  {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">API URL *</label>
                <input type="url" value={form.api_url} onChange={(e) => setForm((f) => ({ ...f, api_url: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px]" />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">API Key {!editandoId && '*'}</label>
                <input type="password" value={form.api_key} onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))} placeholder={editandoId ? 'Deixe em branco para manter' : ''} className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px]" />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">Instance ID *</label>
                <input type="text" value={form.instance_id} onChange={(e) => setForm((f) => ({ ...f, instance_id: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px]" />
              </div>

              <div className="flex gap-6">
                <label className="text-[13px] font-semibold"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="mr-2" />Ativo</label>
                <label className="text-[13px] font-semibold"><input type="checkbox" checked={form.is_default} onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} className="mr-2" />Padrão</label>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={testarConexao} disabled={testandoConexao} className="rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-[14px] font-bold text-sky-700">
                {testandoConexao ? 'Testando...' : 'Testar conexão'}
              </button>
              <button onClick={fecharModal} className="rounded-full border border-[#e2e8f0] px-5 py-2.5 text-[14px] font-bold text-[#475569]">Cancelar</button>
              <button onClick={salvarCanal} disabled={salvando} className="rounded-full bg-violet-600 px-5 py-2.5 text-[14px] font-bold text-white">{salvando ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {canalParaTestar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCanalParaTestar(null)} />
          <div className="relative z-10 w-full max-w-md rounded-t-[28px] bg-white p-6 sm:m-4 sm:rounded-[28px]">
            <h2 className="text-[20px] font-black text-[#0f172a]">Testar envio</h2>
            <p className="mt-0.5 text-[13px] text-[#64748b]"><span className="font-bold">{canalParaTestar.name}</span></p>
            <input type="tel" value={telefoneTest} onChange={(e) => setTelefoneTest(e.target.value)} placeholder="Ex: 5511999999999" className="mt-4 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px]" />
            {toastTest && <div className={`mt-3 rounded-xl px-4 py-3 text-[13px] font-semibold ${toastTest.type === 'success' ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-red-200 bg-red-50 text-red-700'}`}>{toastTest.message}</div>}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setCanalParaTestar(null)} className="rounded-full border border-[#e2e8f0] px-5 py-2.5 text-[14px] font-bold text-[#475569]">Cancelar</button>
              <button
                disabled={enviandoTeste || !telefoneTest.trim()}
                onClick={async () => {
                  setEnviandoTeste(true);
                  setToastTest(null);
                  try {
                    const res = await fetch('/api/automation/test-channel', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ channelId: canalParaTestar.id, phone: telefoneTest.trim() }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Erro ao enviar teste');
                    setToastTest({ message: 'Mensagem de teste enviada com sucesso!', type: 'success' });
                  } catch (err) {
                    setToastTest({ message: err.message, type: 'error' });
                  } finally {
                    setEnviandoTeste(false);
                  }
                }}
                className="rounded-full bg-sky-600 px-5 py-2.5 text-[14px] font-bold text-white"
              >
                {enviandoTeste ? 'Enviando...' : 'Enviar teste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
