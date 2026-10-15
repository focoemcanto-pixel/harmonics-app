'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

// Ajustes de DOM que só valem para páginas públicas específicas. Antes eram montados em todas
// as rotas (inclusive admin e login), observando o documento inteiro com MutationObserver.
const ClientRepertoireHotfixes = dynamic(() => import('@/components/cliente/ClientRepertoireHotfixes'), { ssr: false });
const ContractPreviewMobileFix = dynamic(() => import('@/components/contratos/ContractPreviewMobileFix'), { ssr: false });

export default function RouteScopedEnhancements() {
  const pathname = usePathname() || '';
  if (/^\/cliente\/[^/]+\/repertorio/.test(pathname)) return <ClientRepertoireHotfixes />;
  if (pathname.startsWith('/contrato/')) return <ContractPreviewMobileFix />;
  return null;
}
