'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import WorkspaceModuleGuard from '@/components/workspace/WorkspaceModuleGuard';

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
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'viewer' });
  const [busyMemberId, setBusyMemberId] = useState('');

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
      setWorkspace(payload.workspace || null);
    } catch (err) {
      setError(err?.message || 'Erro ao carregar equipe.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarEquipe();
  }, [carregarEquipe]);

  async function atualizarMembro(memberId, patch) {
    setBusyMemberId(memberId);
    setError('');

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

      setSuccess('Permissão atualizada com sucesso.');
      await carregarEquipe();
    } catch (err) {
      setError(err?.message || 'Erro ao atualizar membro.');
    } finally {
      setBusyMemberId('');
    }
  }

  return (
    <AdminShell pageTitle="Equipe" activeItem="usuarios">
      <div className="mx-auto max-w-6xl space-y-6 px-0 py-2">
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-6 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">Workspace Team</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Equipe e permissões</h1>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/10 px-5 py-4 text-center">
              <div className="text-3xl font-black">{members.length}</div>
              <div className="text-xs uppercase text-slate-300">Membros</div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
        ) : null}

        {success ? (
          <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</div>
        ) : null}

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">Membros ativos</h2>
              <p className="mt-1 text-sm text-slate-500">Controle cargos e acessos do workspace.</p>
            </div>
          </div>

          <div className="mt-5">
            {loading ? (
              <LoadingSkeleton />
            ) : (
              <div className="space-y-3">
                {members.map((member) => {
                  const profile = member.profile || {};
                  const title = profile.name || profile.email || 'Usuário';
                  const isBusy = busyMemberId === member.id;

                  return (
                    <div key={member.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-sm font-black text-violet-700">
                            {getInitials(title)}
                          </div>

                          <div>
                            <div className="text-sm font-black text-slate-900">{title}</div>
                            <div className="text-xs text-slate-500">{profile.email}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <RoleBadge role={member.role} />
                          <StatusBadge status={member.status} />
                        </div>
                      </div>

                      <div className="mt-4">
                        <select
                          value={member.role}
                          disabled={isBusy}
                          onChange={(event) => atualizarMembro(member.id, { role: event.target.value })}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
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
