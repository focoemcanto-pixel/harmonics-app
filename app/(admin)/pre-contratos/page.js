import { Suspense } from 'react';
import PreContratosClient from './PreContratosClient';

export default function PreContratosPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Carregando pré-contratos...</div>}>
      <PreContratosClient />
    </Suspense>
  );
}
