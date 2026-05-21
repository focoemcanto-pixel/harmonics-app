'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PLANS = [
  { slug: 'free', name: 'Free', price: 'R$ 0', features: ['Base operacional'], highlight: false },
  { slug: 'plus', name: 'Plus', price: 'R$ 97/mês', features: ['Equipe ampliada', 'Automação'], highlight: false },
  { slug: 'premium', name: 'Premium', price: 'R$ 197/mês', features: ['White-label', 'Prioridade'], highlight: true },
];

export default function AssinarPage() {
  const [loading, setLoading] = useState('');
  const router = useRouter();

  async function assinar(planSlug) {
    setLoading(planSlug);
    const res = await fetch('/api/billing/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ planSlug }) });
    const json = await res.json();
    setLoading('');
    if (!res.ok) return alert(json.error || 'Erro no checkout.');
    if (json.checkoutUrl) window.location.assign(json.checkoutUrl);
    else router.push('/assinatura');
  }

  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-5xl font-black tracking-tight">Escolha seu plano</h1>
        <p className="mt-3 text-white/70">Checkout premium Harmonics com cobrança recorrente real via Asaas.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <article key={plan.slug} className={`rounded-3xl border p-6 ${plan.highlight ? 'border-violet-400 bg-gradient-to-b from-violet-900/30 to-black' : 'border-white/15 bg-white/5'}`}>
              <h2 className="text-2xl font-black">{plan.name}</h2>
              <div className="mt-2 text-3xl font-black">{plan.price}</div>
              <ul className="mt-5 space-y-2 text-sm text-white/80">{plan.features.map((f) => <li key={f}>• {f}</li>)}</ul>
              <button onClick={() => assinar(plan.slug)} disabled={loading === plan.slug} className="mt-8 w-full rounded-xl bg-white px-4 py-3 font-black text-black disabled:opacity-60">
                {loading === plan.slug ? 'Processando...' : 'Assinar'}
              </button>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
