'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProtectedRoute from '@/components/ProtectedRoute';

function NovoEventoPageContent() {
  const [error] = useState('Esta tela legada foi desativada. Use o cadastro na página principal de Eventos.');
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Novo Evento</h1>
        <p className="text-slate-600 mt-2">Preencha os dados básicos do evento</p>
      </div>

      <Card>
        <div className="p-6 space-y-6">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">{error}</p>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={() => router.push('/admin/eventos')}
            >
              Ir para Eventos
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
            >
              Voltar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function NovoEventoPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <NovoEventoPageContent />
    </ProtectedRoute>
  );
}
