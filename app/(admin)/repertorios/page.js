import { Suspense } from 'react';
import RepertoriosPageClient from './RepertoriosPageClient';

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <RepertoriosPageClient />
    </Suspense>
  );
}
