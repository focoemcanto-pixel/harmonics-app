import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';
import { importStripeMember } from '@/src/lib/migration/import-member';

export const runtime = 'nodejs';

export async function POST(request) {
  const supabase = getSupabaseAdmin();
  const auth = await requireWorkspaceAdmin({ supabase, request, logPrefix: '[MIGRATION_IMPORT]' });
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });

  const body = await request.json().catch(() => ({}));
  const members = Array.isArray(body?.members) ? body.members : [];
  const results = [];

  for (const member of members) {
    try {
      if (!member?.email || !member?.stripe_customer_id || !member?.stripe_subscription_id || !member?.plan) {
        results.push({ email: member?.email || null, status: 'inválido', error: 'Campos obrigatórios ausentes.' });
        continue;
      }
      const outcome = await importStripeMember({ ...member, workspace_id: auth.workspaceId });
      results.push({ email: member.email, ...outcome });
    } catch (error) {
      await supabase.from('migration_logs').insert({ email: member?.email || 'desconhecido', status: 'falha', details: { error: error?.message } });
      results.push({ email: member?.email || null, status: 'falha', error: error?.message || 'Erro na importação' });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
