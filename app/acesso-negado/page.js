'use client';

import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ShieldAlertIcon } from 'lucide-react';

export default function AcessoNegadoPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="p-8 text-center">
          <div className="mb-6">
            <ShieldAlertIcon className="w-16 h-16 text-red-500 mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Acesso Negado
          </h1>
          <p className="text-slate-600 mb-6">
            Você não tem permissão para acessar esta página.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="ghost" onClick={() => router.back()}>
              Voltar
            </Button>
            <Button onClick={() => router.push('/dashboard')}>
              Ir para Dashboard
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
