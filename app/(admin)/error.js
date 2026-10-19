'use client';

import { useEffect } from 'react';

export default function AdminError({ error, reset }) {
  useEffect(() => {
    console.error('[ADMIN][ROUTE_ERROR]', { message: error?.message, digest: error?.digest || null });
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-[24px] border border-[#e4e7ec] bg-white p-6 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h1 className="text-xl font-black text-[#0f172a]">Não foi possível abrir esta tela</h1>
        <p className="mt-2 text-sm font-semibold text-[#64748b]">
          Pode ter sido uma instabilidade de conexão. Seus dados estão seguros.
          {error?.digest ? ` (código ${error.digest})` : ''}
        </p>
        <button type="button" onClick={() => reset()} className="mt-5 w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white">
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
