import ProtectedRoute from '@/components/ProtectedRoute';
import MobileLogsPayloadGuard from '@/components/automacoes/MobileLogsPayloadGuard';

export default function AutomacoesLayout({ children }) {
  return (
    <ProtectedRoute requiredRole="admin">
      <MobileLogsPayloadGuard />
      {children}
    </ProtectedRoute>
  );
}
