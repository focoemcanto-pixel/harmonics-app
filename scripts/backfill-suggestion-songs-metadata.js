#!/usr/bin/env node
import { getSupabaseAdmin } from '../lib/supabase-admin.js';
import { backfillSuggestionSongsMetadata } from '../lib/sugestoes/backfill-suggestion-songs-metadata.js';

async function main() {
  const supabase = getSupabaseAdmin();

  const [{ count: total, error: totalError }, { count: withThumb, error: thumbError }] = await Promise.all([
    supabase.from('suggestion_songs').select('*', { count: 'exact', head: true }),
    supabase
      .from('suggestion_songs')
      .select('*', { count: 'exact', head: true })
      .not('thumbnail_url', 'is', null)
      .neq('thumbnail_url', ''),
  ]);

  if (totalError) throw totalError;
  if (thumbError) throw thumbError;

  console.log('[sugestoes] auditoria inicial', {
    total: total || 0,
    withThumb: withThumb || 0,
    withoutThumb: Math.max((total || 0) - (withThumb || 0), 0),
  });

  const result = await backfillSuggestionSongsMetadata(supabase, { logger: console });
  console.log('[sugestoes] backfill finalizado', result);
}

main().catch((error) => {
  console.error('[sugestoes] erro no backfill', error);
  process.exit(1);
});
