'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import useCurrentWorkspace from '@/hooks/useCurrentWorkspace';

function normalizePhone(value) {
  return String(value || '').replace(/\D+/g, '');
}

export default function WorkspaceSettingsClient() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);
  const { workspace, loading } = useCurrentWorkspace();

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [form, setForm] = useState({
    publicName: '',
    supportWhatsapp: '',
    primaryColor: '#7c3aed',
  });

  const currentName = workspace?.displayName || workspace?.workspace?.name || 'Workspace';
  const currentColor = workspace?.primaryColor || '#7c3aed';

  useMemo(() => {
    if (!workspace) return;

    setForm({
      publicName: workspace?.settings?.public_name || workspace?.settings?.company_name || workspace?.workspace?.name || '',
      supportWhatsapp: workspace?.supportWhatsapp || '',
      primaryColor: workspace?.primaryColor || '#7c3aed',
    });
  }, [workspace]);

  function updateField(field, value) {
    setError('');
    setSuccess('');
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function getToken() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }

  async function saveBranding() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          publicName: form.publicName.trim(),
          supportWhatsapp: normalizePhone(form.supportWhatsapp),
          primaryColor: form.primaryColor,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Não foi possível salvar o workspace.');
      }

      setSuccess('Configurações salvas com sucesso. Atualize a página se a cor não mudar imediatamente em algum ponto antigo.');
      router.refresh();
    } catch (err) {
      setError(err?.message || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteWorkspace() {
    if (confirmDelete !== 'DELETE') {
      setError('Digite DELETE para confirmar a exclusão do workspace.');
      return;
    }

    setDeleting(true);
    setError('');
    setSuccess('');

    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const response = await fetch('/api/workspace/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmation: confirmDelete }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Não foi possível excluir o workspace.');
      }

      await supabase?.auth?.signOut?.();
      router.replace('/workspace-deleted');
    } catch (err) {
      setError(err?.message || 'Erro ao excluir workspace.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-8 text-[#64748b]">
        Carregando configurações do workspace...
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-[#dbe3ef] bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.14em]" style={{ color: currentColor }}>
              Configurações do workspace
            </div>
            <h1 className="mt-2 text-[30px] font-black tracking-[-0.04em] text-[#0f172a]">
              {currentName}
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] font-semibold leading-6 text-[#64748b]">
              Gerencie identidade visual, dados básicos e ações críticas do tenant atual.
            </p>
          </div>

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black text-white" style={{ background: currentColor }}>
            {workspace?.initials || 'W'}
          </div>
        </div>
      </section>

      {(error || success) ? (
        <section className={`rounded-[22px] border px-5 py-4 text-[14px] font-bold ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || success}
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[30px] border border-[#dbe3ef] bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <div>
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[#0f172a]">Identidade e tema</h2>
            <p className="mt-2 text-[14px] font-semibold leading-6 text-[#64748b]">
              Essas informações aparecem no menu lateral, topbar mobile e pontos de branding do painel.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <label className="block">
              <span className="text-[13px] font-black text-[#0f172a]">Nome público</span>
              <input
                value={form.publicName}
                onChange={(event) => updateField('publicName', event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#dbe3ef] px-4 py-3 text-[14px] font-semibold outline-none transition focus:border-slate-400"
                placeholder="Ex: Rocha Worship"
              />
            </label>

            <label className="block">
              <span className="text-[13px] font-black text-[#0f172a]">WhatsApp de suporte/admin</span>
              <input
                value={form.supportWhatsapp}
                onChange={(event) => updateField('supportWhatsapp', event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#dbe3ef] px-4 py-3 text-[14px] font-semibold outline-none transition focus:border-slate-400"
                placeholder="Ex: 71999999999"
                inputMode="tel"
              />
            </label>

            <label className="block">
              <span className="text-[13px] font-black text-[#0f172a]">Cor principal selecionável</span>
              <div className="mt-2 flex gap-3">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(event) => updateField('primaryColor', event.target.value)}
                  className="h-12 w-16 rounded-2xl border border-[#dbe3ef] bg-white p-1"
                />
                <input
                  value={form.primaryColor}
                  onChange={(event) => updateField('primaryColor', event.target.value)}
                  className="flex-1 rounded-2xl border border-[#dbe3ef] px-4 py-3 text-[14px] font-semibold outline-none transition focus:border-slate-400"
                />
              </div>
            </label>

            <button
              type="button"
              disabled={saving}
              onClick={saveBranding}
              className="rounded-2xl px-5 py-3 text-[14px] font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: form.primaryColor || currentColor }}
            >
              {saving ? 'Salvando...' : 'Salvar identidade'}
            </button>
          </div>
        </div>

        <div className="rounded-[30px] border border-red-200 bg-red-50 p-6 shadow-[0_12px_28px_rgba(127,29,29,0.06)]">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-red-700">
              Zona de perigo
            </div>
            <h2 className="mt-2 text-[22px] font-black tracking-[-0.03em] text-red-950">
              Excluir workspace
            </h2>
            <p className="mt-2 text-[14px] font-semibold leading-6 text-red-800">
              Esta ação remove permanentemente este tenant e os dados vinculados a ele. Use apenas para workspaces de teste ou quando tiver certeza absoluta.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-red-200 bg-white/70 p-4 text-[13px] font-semibold leading-6 text-red-800">
            Ao confirmar, serão removidos dados como eventos, contratos, contatos, automações, canais, pagamentos, repertórios, membros e configurações do workspace.
          </div>

          <label className="mt-5 block">
            <span className="text-[13px] font-black text-red-950">Digite DELETE para confirmar</span>
            <input
              value={confirmDelete}
              onChange={(event) => setConfirmDelete(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-[14px] font-black text-red-950 outline-none transition focus:border-red-400"
              placeholder="DELETE"
            />
          </label>

          <button
            type="button"
            disabled={deleting || confirmDelete !== 'DELETE'}
            onClick={deleteWorkspace}
            className="mt-4 w-full rounded-2xl bg-red-600 px-5 py-3 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(220,38,38,0.24)] transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? 'Excluindo workspace...' : 'Excluir workspace permanentemente'}
          </button>
        </div>
      </section>
    </div>
  );
}
