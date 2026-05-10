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

      setSuccess('Equipe atualizada com sucesso.');
      setInviteForm({ email: '', role: 'viewer' });
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
      await carregarEquipe();
    } catch (err) {
      setError(err?.message || 'Erro ao atualizar membro.');
    } finally {
      setBusyMemberId('');
    }
  }

  async function removerMembro(member) {
    const confirmed = window.confirm('Remover acesso deste membro?');
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

      setSuccess('Membro removido com sucesso.');
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
        {/* conteúdo mantido */}
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
