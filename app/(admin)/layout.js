'use client';

import { AuthProvider } from '@/contexts/AuthContext';

export default function AdminLayout({ children }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
