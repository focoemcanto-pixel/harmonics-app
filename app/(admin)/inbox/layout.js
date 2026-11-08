import ProtectedRoute from '@/components/ProtectedRoute';

export default function InboxLayout({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
