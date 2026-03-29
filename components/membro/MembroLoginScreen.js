'use client';

export default function MembroLoginScreen({
  onGoogleLogin,
  loggingIn,
  error,
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050813] px-5 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.3),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.14),_transparent_28%)]" />

      <div className="relative w-full max-w-md overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),_rgba(15,23,42,0.98)_60%)] p-7 text-white shadow-[0_35px_90px_rgba(0,0,0,0.46)]">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-white/10 bg-black text-[26px] font-black italic text-white shadow-[0_0_50px_rgba(139,92,246,0.28)]">
          Harmonics
        </div>

        <div className="mt-7 text-center">
          <div className="inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-violet-200">
            Harmonics Member
          </div>

          <h1 className="mt-5 text-[34px] font-black tracking-[-0.05em]">
            Entrar no painel
          </h1>

          <p className="mt-3 text-[15px] leading-7 text-white/70">
            Acesse sua agenda, seus convites e seus repertórios com a mesma experiência premium do app.
          </p>
        </div>

        <button
          type="button"
          onClick={onGoogleLogin}
          disabled={loggingIn}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-[22px] bg-white px-5 py-4 text-[16px] font-black text-[#111827] shadow-[0_16px_36px_rgba(255,255,255,0.12)] disabled:opacity-60"
        >
          {loggingIn ? (
            'Entrando...'
          ) : (
            <>
              <span className="text-[20px]">G</span>
              <span>Continuar com Google</span>
            </>
          )}
        </button>

        {error ? (
          <div className="mt-4 rounded-[18px] border border-red-300/20 bg-red-400/10 px-4 py-3 text-[14px] font-semibold text-red-100">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
