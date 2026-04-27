'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let mounted = true;

    async function bootstrapRecovery() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          window.history.replaceState({}, document.title, '/auth/reset-password');
        } else {
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
            window.history.replaceState({}, document.title, '/auth/reset-password');
          }
        }

        const { data, error: getSessionError } = await supabase.auth.getSession();
        if (getSessionError) throw getSessionError;

        if (!mounted) return;
        const hasSession = Boolean(data?.session?.user);
        setIsRecoverySession(hasSession);

        if (!hasSession) {
          setError('Seu link de redefinição é inválido ou expirou. Solicite um novo link na tela de login.');
        }
      } catch (err) {
        if (!mounted) return;
        console.error('[RESET_PASSWORD][BOOTSTRAP_ERROR]', err);
        setIsRecoverySession(false);
        setError('Seu link de redefinição é inválido ou expirou. Solicite um novo link na tela de login.');
      }
    }

    bootstrapRecovery();

    return () => {
      mounted = false;
    };
  }, []);

  const validationMessage = useMemo(() => {
    if (password && password.length < 8) {
      return 'A nova senha deve ter no mínimo 8 caracteres.';
    }

    if (confirmPassword && password !== confirmPassword) {
      return 'A confirmação da senha não confere.';
    }

    return '';
  }, [password, confirmPassword]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isRecoverySession || loading) return;

    setError('');
    setSuccess('');

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      await supabase.auth.signOut();
      localStorage.removeItem('harmonics_saved_admin_login');
      setSuccess('Senha atualizada com sucesso! Você será redirecionado para o login.');

      setTimeout(() => {
        router.push('/login');
      }, 3500);
    } catch (err) {
      setError(err?.message || 'Não foi possível atualizar sua senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05050c] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.24),_transparent_42%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.18),_transparent_30%),radial-gradient(circle_at_50%_100%,_rgba(245,158,11,0.16),_transparent_38%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md rounded-[28px] border border-white/20 bg-white/10 p-6 shadow-[0_18px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-200">Banda Harmonics</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">Definir nova senha</h1>
          <p className="mt-2 text-sm text-slate-300">
            Conclua seu primeiro acesso com uma senha forte para liberar seu painel administrativo.
          </p>

          {error && <div className="mt-4 rounded-xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
          {success && <div className="mt-4 rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div>}

          {isRecoverySession ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Nova senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                  placeholder="Mínimo de 8 caracteres"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Confirmar senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                  placeholder="Repita sua nova senha"
                />
              </div>

              {validationMessage && (
                <p className="text-xs font-semibold text-amber-200">{validationMessage}</p>
              )}

              <button
                type="submit"
                disabled={loading || Boolean(validationMessage)}
                className="w-full rounded-xl bg-gradient-to-r from-violet-500 via-indigo-500 to-amber-400 px-4 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Atualizando senha...' : 'Salvar nova senha'}
              </button>
            </form>
          ) : (
            <div className="mt-6">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-sm font-bold text-slate-100 transition hover:border-violet-300/60"
              >
                Voltar ao login
              </Link>
            </div>
          )}

          {success && (
            <div className="mt-4">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-sm font-bold text-slate-100 transition hover:border-violet-300/60"
              >
                Entrar no painel
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
