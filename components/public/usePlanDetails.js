'use client';

import { useEffect, useState } from 'react';

// Nome/preço/limites do plano escolhido em /planos, só para exibição na jornada de cadastro.
// Nada aqui altera o plano da conta: a troca só acontece pelo checkout + webhook.
export function usePlanDetails(slug) {
  const [loaded, setLoaded] = useState({ slug: '', plan: null });

  useEffect(() => {
    if (!slug) return undefined;
    let active = true;
    fetch('/api/billing/plans', { cache: 'no-store' })
      .then((response) => response.json())
      .then((json) => {
        if (active) setLoaded({ slug, plan: (json?.plans || []).find((plan) => plan.slug === slug) || null });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [slug]);

  const details = slug && loaded.slug === slug ? loaded.plan : null;
  const name = details?.name || (slug ? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, ' ') : '');
  return { details, name };
}
