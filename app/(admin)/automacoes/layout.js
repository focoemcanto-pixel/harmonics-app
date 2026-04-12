import ProtectedRoute from '@/components/ProtectedRoute';

export default function AutomacoesLayout({ children }) {
  return <ProtectedRoute requiredRole="admin">{children}</ProtectedRoute>;
}
