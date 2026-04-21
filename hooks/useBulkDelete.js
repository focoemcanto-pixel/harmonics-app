'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useBulkDelete() {
  const [loading, setLoading] = useState(false);

  async function run({ endpoint, idsKey, ids }) {
    const targetIds = Array.from(new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean)));
    if (!endpoint || !idsKey || targetIds.length === 0) {
      return { ok: false, error: 'Selecione ao menos um item.' };
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ [idsKey]: targetIds }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Falha ao processar exclusão.');
      }

      return payload;
    } catch (error) {
      return {
        ok: false,
        error: error?.message || 'Falha ao excluir itens.',
      };
    } finally {
      setLoading(false);
    }
  }

  return { loading, run };
}
