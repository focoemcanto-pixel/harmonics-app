'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

export default function AccountSettingsClient() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;

        const user = data?.user || null;
        setProfile(user);
        setName(
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          ''
        );
      } catch (err) {
        setError(err?.message || 'Erro ao carregar conta.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [supabase]);

  async function saveProfile() {
    setSaving(true);
    setNotice('');
    setError('');

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: name,
        },
      });

      if (error) throw error;

      setNotice('Perfil atualizado com sucesso.');
      router.refresh();
    } catch (err) {
      setError(err?.message || 'Não foi possível atualizar o perfil.');
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordReset() {
    setSendingReset(true);
    setNotice('');
    setError('');

    try {
      const email = profile?.email;
      if (!email) throw new Error('E-mail não encontrado.');

      const redirectTo = `${window.location.origin}/login?reset=done`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) throw error;

      setNotice('Link de redefinição enviado para seu e-mail.');
    } catch (err) {
      setError(err?.message || 'Não foi possível enviar o e-mail de redefinição.');
    } finally {
      setSendingReset(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (loading) {
    return (
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-8 text-[#64748b]">
        Carregando dados da conta...
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
      <section className="rounded-[30px] border border-[#dbe3ef] bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-700">
              Perfil
            </div>

            <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-[#0f172a]">
              Dados pessoais
            </h2>

            <p className="mt-2 max-w-xl text-[14px] font-semibold leading-6 text-[#64748b]">
              Atualize informações básicas da sua conta utilizada para acessar o painel do Harmonics.
            </p>
          </div>

          <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-violet-100 text-[22px] font-black text-violet-700">
            {(name || profile?.email || 'U').charAt(0).toUpperCase()}
          </div>
        </div>

        {(notice || error) ? (
          <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-bold ${
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}>
            {error || notice}
          </div>
        ) : null}

        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="text-[13px] font-black text-[#0f172a]">
              Nome do usuário
            </span>

            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#dbe3ef] px-4 py-3 text-[14px] font-semibold outline-none transition focus:border-violet-400"
              placeholder="Seu nome"
            />
          </label>

          <label className="block">
            <span className="text-[13px] font-black text-[#0f172a]">
              E-mail da conta
            </span>

            <input
              value={profile?.email || ''}
              disabled
              className="mt-2 w-full rounded-2xl border border-[#dbe3ef] bg-slate-50 px-4 py-3 text-[14px] font-semibold text-slate-500"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.24)] transition hover:bg-violet-500 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar perfil'}
            </button>

            <button
              type="button"
              onClick={sendPasswordReset}
              disabled={sendingReset}
              className="rounded-2xl border border-[#dbe3ef] bg-white px-5 py-3 text-sm font-black text-[#0f172a] transition hover:bg-slate-50 disabled:opacity-50"
            >
              {sendingReset ? 'Enviando...' : 'Redefinir senha'}
            </button>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-[30px] border border-[#dbe3ef] bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-700">
            Segurança
          </div>

          <h2 className="mt-2 text-[24px] font-black tracking-[-0.03em] text-[#0f172a]">
            Sessão ativa
          </h2>

          <div className="mt-5 rounded-2xl border border-[#dbe3ef] bg-slate-50 p-4">
            <div className="text-sm font-black text-[#0f172a]">
              Sessão autenticada
            </div>

            <p className="mt-2 text-[13px] font-semibold leading-6 text-[#64748b]">
              Sua sessão atual está vinculada ao Supabase Auth e protegida por autenticação do workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            className="mt-5 w-full rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-100"
          >
            Encerrar sessão
          </button>
        </section>

        <section className="rounded-[30px] border border-[#dbe3ef] bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-slate-500">
            Em breve
          </div>

          <h2 className="mt-2 text-[24px] font-black tracking-[-0.03em] text-[#0f172a]">
            Preferências avançadas
          </h2>

          <ul className="mt-5 space-y-3 text-[14px] font-semibold text-[#64748b]">
            <li>• Tema claro/escuro do painel</li>
            <li>• Sessões simultâneas</li>
            <li>• Histórico de acessos</li>
            <li>• Auditoria de login</li>
            <li>• 2FA / autenticação em duas etapas</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
