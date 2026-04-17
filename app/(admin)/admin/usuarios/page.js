'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminShell from '@/components/admin/AdminShell';
import Link from 'next/link';

const AREAS_SISTEMA = [
  { key: 'eventos', label: 'Eventos' },
  { key: 'contratos', label: 'Contratos' },
  { key: 'pagamentos', label: 'Pagamentos' },
  { key: 'escalas', label: 'Escalas' },
  { key: 'repertorios', label: 'Repertórios' },
  { key: 'automacoes', label: 'Automações' },
];
const USERS_LIST_LIMIT = 200;
const USERS_SELECT_FIELDS = 'id, created_at, name, email, role, permissions';

function PencilIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function GestaoUsuariosContent() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingRole, setEditingRole] = useState('member');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '' });

  const [novoUsuario, setNovoUsuario] = useState({
    email: '',
    name: '',
    role: 'member',
  });
  const [permissoes, setPermissoes] = useState({
    acesso_total: true,
  });

  useEffect(() => {
    carregarUsuarios();
  }, []);

  async function carregarUsuarios() {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select(USERS_SELECT_FIELDS)
        .order('created_at', { ascending: false })
        .limit(USERS_LIST_LIMIT);

      if (err) throw err;
      setUsuarios(data || []);
    } catch (e) {
      setError('Erro ao carregar usuários: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }

  async function cadastrarUsuario(e) {
    e.preventDefault();
    if (!novoUsuario.email || !novoUsuario.name) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: novoUsuario.email,
          name: novoUsuario.name,
          role: novoUsuario.role,
          permissions: novoUsuario.role === 'admin' ? permissoes : null,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao cadastrar usuário');

      setSuccess('Usuário cadastrado com sucesso! Um e-mail de confirmação foi enviado.');
      setNovoUsuario({ email: '', name: '', role: 'member' });
      setPermissoes({ acesso_total: true });
      await carregarUsuarios();
    } catch (e) {
      setError('Erro ao cadastrar usuário: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  }

  async function atualizarRole(userId, novoRole) {
    setError('');
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({ role: novoRole })
        .eq('id', userId);

      if (err) throw err;
      setUsuarios((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: novoRole } : u))
      );
      setEditingId(null);
    } catch (e) {
      setError('Erro ao atualizar usuário: ' + (e.message || 'Erro desconhecido'));
    }
  }

  async function salvarEdicao() {
    if (!editingUser?.id || !editForm.name.trim()) {
      setError('Nome é obrigatório.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({ name: editForm.name.trim() })
        .eq('id', editingUser.id);

      if (err) throw err;

      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === editingUser.id ? { ...u, name: editForm.name.trim() } : u
        )
      );

      setSuccess('Usuário atualizado com sucesso!');
      closeEditModal();
    } catch (e) {
      setError('Erro ao atualizar usuário: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  }

  function openEditModal(user) {
    setEditingUser(user);
    setEditForm({ name: user.name || '' });
    setEditModalOpen(true);
  }

  function closeEditModal() {
    setEditModalOpen(false);
    setEditingUser(null);
    setEditForm({ name: '' });
  }

  return (
    <AdminShell pageTitle="Gestão de Usuários" activeItem="usuarios">
      <div className="max-w-4xl mx-auto px-0 py-2 space-y-6">
        <div className="mb-2">
          <Link
            href="/dashboard"
            className="text-sm text-violet-600 hover:text-violet-700 font-semibold"
          >
            ← Dashboard
          </Link>
          <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-900 mt-2">
            Gestão de Usuários
          </h1>
          <p className="text-slate-600 mt-1">
            Cadastre novos administradores e membros, configure permissões granulares.
          </p>
        </div>

        {error && (
          <div className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {success}
          </div>
        )}

        {/* Cadastro */}
        <div className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Cadastrar novo usuário</h2>

          <form onSubmit={cadastrarUsuario} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Nome completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={novoUsuario.name}
                  onChange={(e) => setNovoUsuario({ ...novoUsuario, name: e.target.value })}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder="João da Silva"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={novoUsuario.email}
                  onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder="joao@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Tipo de acesso
              </label>
              <select
                value={novoUsuario.role}
                onChange={(e) => {
                  setNovoUsuario({ ...novoUsuario, role: e.target.value });
                  if (e.target.value === 'member') {
                    setPermissoes({ acesso_total: true });
                  }
                }}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
              >
                <option value="member">👤 Membro</option>
                <option value="admin">🔑 Administrador</option>
              </select>
            </div>

            {novoUsuario.role === 'admin' && (
              <div className="rounded-[18px] border border-violet-100 bg-violet-50 p-4">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Configurar permissões:</h3>

                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!permissoes.acesso_total}
                    onChange={(e) =>
                      setPermissoes({ ...permissoes, acesso_total: e.target.checked })
                    }
                    className="h-4 w-4 rounded accent-violet-600"
                  />
                  <span className="text-sm font-bold text-slate-800">
                    ✅ Acesso total (todas as áreas)
                  </span>
                </label>

                {!permissoes.acesso_total && (
                  <div className="grid grid-cols-2 gap-2">
                    {AREAS_SISTEMA.map((area) => (
                      <label key={area.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!permissoes[area.key]}
                          onChange={(e) =>
                            setPermissoes({ ...permissoes, [area.key]: e.target.checked })
                          }
                          className="h-4 w-4 rounded accent-violet-600"
                        />
                        <span className="text-sm text-slate-700">{area.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-[18px] bg-violet-600 px-6 py-4 text-[15px] font-black text-white shadow-lg transition hover:bg-violet-700 disabled:opacity-60"
            >
              {saving ? 'Cadastrando...' : 'Cadastrar usuário'}
            </button>
          </form>
        </div>

        {/* Lista de usuários */}
        <div className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Usuários cadastrados
            {!loading && (
              <span className="ml-2 text-sm font-semibold text-slate-400">
                ({usuarios.length})
              </span>
            )}
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-[18px] bg-slate-100" />
              ))}
            </div>
          ) : usuarios.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Nenhum usuário cadastrado.
            </p>
          ) : (
            <div className="space-y-3">
              {usuarios.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-[18px] border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[13px] font-black text-violet-700">
                      {getInitials(user.name || user.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {user.name || '(sem nome)'}
                      </p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-3">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-black ${
                        user.role === 'admin'
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {user.role === 'admin' ? '🔑 Admin' : '👤 Membro'}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditModal(user)}
                      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-violet-300 hover:text-violet-600"
                      aria-label="Editar usuário"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') closeEditModal(); }}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-modal-title"
          >
            <h3 id="edit-user-modal-title" className="text-xl font-black text-slate-900 mb-4">
              Editar Usuário
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Nome completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder="João da Silva"
                />
              </div>

              <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">Email (não editável)</p>
                <p className="text-sm font-bold text-slate-700 mt-1">{editingUser?.email}</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeEditModal}
                className="flex-1 rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarEdicao}
                disabled={saving}
                className="flex-1 rounded-[16px] bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

export default function GestaoUsuariosPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <GestaoUsuariosContent />
    </ProtectedRoute>
  );
}
