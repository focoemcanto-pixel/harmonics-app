'use client';

import Link from 'next/link';

/**
 * Componente reutilizável de "Voltar" para as subpáginas da Central de Automação.
 * Renderiza um link discreto mas claro apontando para /automacoes.
 */
export default function AutomationBackLink() {
  return (
    <Link
      href="/automacoes"
      className="inline-flex items-center gap-1.5 rounded-full border border-[#dbe3ef] bg-white px-4 py-2 text-[13px] font-semibold text-[#64748b] shadow-[0_2px_8px_rgba(17,24,39,0.04)] transition hover:border-violet-300 hover:text-violet-700 hover:shadow-[0_4px_12px_rgba(109,40,217,0.08)]"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
          clipRule="evenodd"
        />
      </svg>
      Voltar
    </Link>
  );
}
