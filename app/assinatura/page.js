import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AssinaturaPage() {
  const supabase = createClient();
  const { data: sub } = await supabase.from('workspace_subscriptions').select('*, plan:workspace_plans(*)').order('created_at', { ascending: false }).limit(1).maybeSingle();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-4xl font-black">Sua assinatura</h1>
      <div className="mt-6 rounded-3xl border p-6">
        <p><strong>Plano:</strong> {sub?.plan?.name || 'Free'}</p>
        <p><strong>Status:</strong> {sub?.status || 'active'}</p>
        <p><strong>Próxima cobrança:</strong> {sub?.next_billing_at || '—'}</p>
        <p><strong>Renovação:</strong> {sub?.current_period_end || '—'}</p>
        <div className="mt-6 flex gap-3">
          <form action="/api/billing/cancel" method="post"><button className="rounded-xl border px-4 py-2">Cancelar</button></form>
          <Link href="/assinar" className="rounded-xl bg-black px-4 py-2 text-white">Upgrade / Trocar plano</Link>
        </div>
      </div>
    </main>
  );
}
