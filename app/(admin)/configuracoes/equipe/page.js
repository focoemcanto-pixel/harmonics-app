'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import WorkspaceModuleGuard from '@/components/workspace/WorkspaceModuleGuard';
import { invalidateWorkspaceMeCache } from '@/hooks/useWorkspaceMe';

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner', description: 'Controle total do workspace.' },
  { value: 'admin', label: 'Admin', description: 'Gerencia operação e configurações.' },
  { value: 'financeiro', label: 'Financeiro', description: 'Foco em pagamentos e contratos.' },
  { value: 'operacional', label: 'Operacional', description: 'Eventos, escalas, convites e repertórios.' },
  { value: 'editor', label: 'Editor', description: 'Conteúdo, repertórios e contatos.' },
  { value: 'viewer', label: 'Visualizador', description: 'Acesso de leitura.' },
];

const ROLE_LABELS = ROLE_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const ROLE_BADGES = {
  owner: 'bg-violet-100 text-violet-700 border-violet-200',
  admin: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  financeiro: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  operacional: 'bg-blue-100 text-blue-700 border-blue-200',
  editor: 'bg-amber-100 text-amber-700 border-amber-200',
  viewer: 'bg-slate-100 text-slate-700 border-slate-200',
};

function getInitials(nameOrEmail) {
  const raw = String(nameOrEmail || '?').trim();
  if (!raw) return '?';
  const source = raw.includes('@') ? raw.split('@')[0] : raw;
  return source
    .split(/\s+|[._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function RoleBadge({ role }) {
  const value = String(role || 'viewer').toLowerCase();
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${ROLE_BADGES[value] || ROLE_BADGES.viewer}`}>
      {ROLE_LABELS[value] || value}
    </span>
  );
}

function StatusBadge({ status }) {
  const value = String(status || '').toLowerCase();
  const active = value === 'active' || value === 'pending';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
      {value === 'pending' ? 'Pendente' : value === 'active' ? 'Ativo' : value || '—'}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-24 animate-pulse rounded-[24px] bg-slate-100" />
      ))}
    </div>
  );
}

function EquipeContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [currentMember, setCurrentMember] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'viewer' });
  const [busyMemberId, setBusyMemberId] = useState('');

  const activeMembers = useMemo(
    () => members.filter((member) => String(member.status || '').toLowerCase() === 'active'),
    [members]
  );

  const pendingInvites = useMemo(
    () => invites.filter((invite) => String(invite.status || '').toLowerCase() === 'pending'),
    [invites]
  );

  const carregarEquipe = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/workspace/team', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Erro ao carregar equipe.');
      }

      setMembers(payload.members || []);
      setInvites(payload.invites || []);
      setWorkspace(payload.workspace || null);
      setCurrentMember(payload.current_member || null);
    } catch (err) {
      setError(err?.message || 'Erro ao carregar equipe.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarEquipe();
  }, [carregarEquipe]);

  async function convidarMembro(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/workspace/team', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Erro ao convidar membro.');
      }

      if (payload.mode === 'member_added_existing_profile') {
        setSuccess('Usuário existente adicionado à equipe.');
      } else if (payload.mode === 'member_reactivated') {
        setSuccess('Membro reativado com sucesso.');
      } else {
        setSuccess('Convite criado com sucesso.');
      }

      setInviteForm({ email: '', role: 'viewer' });
      invalidateWorkspaceMeCache();
      await carregarEquipe();
    } catch (err) {
      setError(err?.message || 'Erro ao convidar membro.');
    } finally {
      setSaving(false);
    }
  }

  async function atualizarMembro(memberId, patch) {
    setBusyMemberId(memberId);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/workspace/team/${memberId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Erro ao atualizar membro.');
      }

      setSuccess('Membro atualizado com sucesso.');
      invalidateWorkspaceMeCache();
      await carregarEquipe();
    } catch (err) {
      setError(err?.message || 'Erro ao atualizar membro.');
    } finally {
      setBusyMemberId('');
    }
  }

  async function removerMembro(member) {
    const name = member?.profile?.name || member?.profile?.email || 'este membro';
    const confirmed = window.confirm(`Remover acesso de ${name}?`);
    if (!confirmed) return;

    setBusyMemberId(member.id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/workspace/team/${member.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Erro ao remover membro.');
      }

      setSuccess('Acesso removido com sucesso.');
      invalidateWorkspaceMeCache();
      await carregarEquipe();
    } catch (err) {
      setError(err?.message || 'Erro ao remover membro.');
    } finally {
      setBusyMemberId('');
    }
  }

  return (
    <AdminShell pageTitle="Equipe" activeItem="usuarios">
      <div className="mx-auto max-w-6xl space-y-6 px-0 py-2">
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-6 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">Workspace Team</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Equipe e permissões</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Gerencie quem pode acessar o painel, quais cargos estão ativos e quais convites ainda estão pendentes.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-white/10 bg-white/10 p-2 backdrop-blur">
              <div className="rounded-[18px] bg-white/10 px-4 py-3 text-center">
                <p className="text-2xl font-black">{activeMembers.length}</p>
                <p className="text-[11px] font-bold uppercase text-slate-300">ativos</p>
              </div>
              <div className="rounded-[18px] bg-white/10 px-4 py-3 text-center">
                <p className="text-2xl font-black">{pendingInvites.length}</p>
                <p className="text-[11px] font-bold uppercase text-slate-300">convites</p>
              </div>
              <div className="rounded-[18px] bg-white/10 px-4 py-3 text-center">
                <p className="text-2xl font-black">{workspace?.plan_key || '—'}</p>
                <p className="text-[11px] font-bold uppercase text-slate-300">plano</p>
              </div>
            </div>
          </div>
        </div>

        {error ? <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
        {success ? <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</div> : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <h2 className="text-lg font-black text-slate-900">Convidar membro</h2>
            <p className="mt-1 text-sm text-slate-500">Adicione um usuário existente ou gere um convite pendente.</p>

            <form onSubmit={convidarMembro} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">E-mail</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="pessoa@email.com"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">Cargo</label>
                <select
                  value={inviteForm.role}
                  onChange={(event) => setInviteForm((prev) => ({ ...prev, role: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                >
                  {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                </select>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Permissão do cargo</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {ROLE_OPTIONS.find((role) => role.value === inviteForm.role)?.description || 'Permissão personalizada.'}
                </p>
              </div>

              <button type="submit" disabled={saving} className="w-full rounded-[18px] bg-violet-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? 'Salvando...' : 'Convidar / adicionar'}
              </button>
            </form>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900">Membros ativos</h2>
                <p className="mt-1 text-sm text-slate-500">Controle cargos e acessos do workspace.</p>
              </div>
              <button type="button" onClick={carregarEquipe} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50">Atualizar</button>
            </div>

            <div className="mt-5">
              {loading ? <LoadingSkeleton /> : activeMembers.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">Nenhum membro ativo encontrado.</div>
              ) : (
                <div className="space-y-3">
                  {activeMembers.map((member) => {
                    const profile = member.profile || {};
                    const title = profile.name || profile.email || 'Usuário sem perfil';
                    const isBusy = busyMemberId === member.id;
                    const isCurrent = currentMember?.id === member.id;

                    return (
                      <div key={member.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-sm font-black text-violet-700">{getInitials(title)}</div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-black text-slate-900">{title}</p>
                                {isCurrent ? <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase text-white">Você</span> : null}
                              </div>
                              <p className="truncate text-xs font-semibold text-slate-500">{profile.email || 'E-mail não encontrado'}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <RoleBadge role={member.role} />
                            <StatusBadge status={member.status} />
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                          <select
                            value={member.role}
                            disabled={isBusy}
                            onChange={(event) => atualizarMembro(member.id, { role: event.target.value })}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100 disabled:opacity-60"
                          >
                            {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                          </select>

                          <button type="button" onClick={() => removerMembro(member)} disabled={isBusy || isCurrent} className="rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
                            {isBusy ? 'Processando...' : 'Remover acesso'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <h2 className="text-lg font-black text-slate-900">Convites pendentes</h2>
          <p className="mt-1 text-sm text-slate-500">Convites criados para usuários que ainda não possuem perfil ou não aceitaram.</p>

          <div className="mt-5">
            {loading ? <LoadingSkeleton /> : pendingInvites.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">Nenhum convite pendente.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">{invite.email}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">Expira em {formatDate(invite.expires_at)}</p>
                      </div>
                      <RoleBadge role={invite.role} />
                    </div>
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Token do convite</p>
                      <p className="mt-1 break-all text-xs font-semibold text-slate-600">{invite.token}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

export default function EquipePage() {
  return (
    <WorkspaceModuleGuard moduleKey="usuarios" requireAdmin>
      <EquipeContent />
    </WorkspaceModuleGuard>
  );
}
