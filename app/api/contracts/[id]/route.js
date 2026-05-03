import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { resolveContractStoragePath } from '@/lib/contracts/contract-storage';

export async function DELETE(request, context) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[CONTRACT_DELETE_ONE]' });
    if (!auth.ok) return NextResponse.json(auth, { status: auth.status || 401 });

    const resolvedParams = await context?.params;
    const contractId = String(resolvedParams?.id || '').trim();
    console.log('[CONTRACT_DELETE_ONE][PARAMS]', {
      rawParams: context?.params,
      resolvedParams,
      contractId,
    });
    if (!contractId) {
      return NextResponse.json({ ok: false, error: 'ID do contrato é obrigatório.' }, { status: 400 });
    }

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, event_id, pdf_url')
      .eq('id', contractId)
      .maybeSingle();

    if (contractError) throw contractError;

    if (!contract?.id) {
      return NextResponse.json({ ok: false, error: 'Contrato não encontrado.' }, { status: 404 });
    }

    if (contract.pdf_url) {
      const parsed = resolveContractStoragePath(contract.pdf_url, 'contract-pdfs');
      if (parsed.bucket && parsed.path) {
        const { error: storageError } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
        if (storageError) {
          console.warn('[CONTRACT_DELETE_ONE][STORAGE_WARN]', {
            contractId,
            bucket: parsed.bucket,
            path: parsed.path,
            message: storageError.message,
          });
        }
      }
    }

    const { error: deleteError } = await supabase.from('contracts').delete().eq('id', contractId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true, deletedId: contractId, eventId: contract.event_id || null });
  } catch (error) {
    console.error('[CONTRACT_DELETE_ONE][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao excluir contrato.' }, { status: 500 });
  }
}
