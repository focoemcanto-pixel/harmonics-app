import { AdminContentSkeleton } from '@/components/layout/AppShellSkeleton';

// Renderizado dentro do frame persistente: só a área de conteúdo mostra o carregamento.
export default function AdminLoading() {
  return <AdminContentSkeleton label="Abrindo página" />;
}
