import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BATCH_SIZE = 10;

function normalizeLimit(value) {
  const parsed = Number(value || 5);
  if (!Number.isFinite(parsed) || parsed <= 0) return 5;
  return Math.min(Math.trunc(parsed), MAX_BATCH_SIZE);
}

function getFileExtension(pathOrUrl) {
  const clean = String(pathOrUrl || '').split('?')[0].split('#')[0];
  const match = clean.match(/\.([a-zA-Z0-9]{1,12})$/);
  return match?.[1] ? `.${match[1].toLowerCase()}` : '';
}

function ensureExtension(newPath, oldPath) {
  if (/\.[a-zA-Z0-9]{1,12}$/.test(String(newPath || ''))) return newPath;
  const extension = getFileExtension(oldPath);
  return extension ? `${newPath}${extension}` : newPath;
}

async function updateMigrationStatus(supabase, id, payload) {
  await supabase
    .from('storage_asset_migrations')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
}

async function copyStorageObject({ supabase, bucketId, oldPath, newPath }) {
  const sourcePath = String(oldPath || '').trim().replace(/^\/+/, '');
  const targetPath = String(newPath || '').trim().replace(/^\/+/, '');

  if (!sourcePath || !targetPath) {
    throw new Error('Path de origem ou destino inválido.');
  }

  const { data: downloaded, error: downloadError } = await supabase.storage
    .from(bucketId)
    .download(sourcePath);

  if (downloadError || !downloaded) {
    throw new Error(downloadError?.message || 'Não foi possível baixar asset antigo.');
  }

  const contentType = downloaded?.type || 'application/octet-stream';
  const arrayBuffer = await downloaded.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(bucketId)
    .upload(targetPath, arrayBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    const message = String(uploadError?.message || 'Falha no upload do asset migrado.');
    if (!message.toLowerCase().includes('already exists')) {
      throw new Error(message);
    }
  }

  return { path: targetPath, contentType, bytes: arrayBuffer.byteLength };
}

async function updateEntityReference({ supabase, migration, newPath }) {
  if (migration.entity_type === 'contract') {
    const { error } = await supabase
      .from('contracts')
      .update({ pdf_url: newPath })
      .eq('id', migration.entity_id)
      .eq('workspace_id', migration.workspace_id);

    if (error) throw error;
    return;
  }

  if (migration.entity_type === 'payment_proof') {
    const { error } = await supabase
      .from('payments')
      .update({ proof_file_url: newPath })
      .eq('id', migration.entity_id)
      .eq('workspace_id', migration.workspace_id);

    if (error) throw error;
    return;
  }

  throw new Error(`Tipo de entidade não suportado: ${migration.entity_type}`);
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      allowedRoles: ['owner', 'admin', 'administrador'],
      logPrefix: '[STORAGE_MIGRATION_RUNNER]',
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    }

    const body = await request.json().catch(() => ({}));
    const limit = normalizeLimit(body?.limit);

    const { data: migrations, error } = await supabase
      .from('storage_asset_migrations')
      .select('*')
      .eq('workspace_id', auth.workspaceId)
      .eq('migration_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    const results = [];

    for (const migration of migrations || []) {
      const migrationId = migration.id;
      const targetPath = ensureExtension(migration.new_path, migration.old_path || migration.old_public_url);

      try {
        await updateMigrationStatus(supabase, migrationId, {
          migration_status: 'running',
          migration_error: null,
        });

        const copied = await copyStorageObject({
          supabase,
          bucketId: migration.bucket_id,
          oldPath: migration.old_path,
          newPath: targetPath,
        });

        await updateEntityReference({ supabase, migration, newPath: copied.path });

        await updateMigrationStatus(supabase, migrationId, {
          new_path: copied.path,
          migration_status: 'completed',
          migration_error: null,
          migrated_at: new Date().toISOString(),
        });

        results.push({
          id: migrationId,
          entityType: migration.entity_type,
          entityId: migration.entity_id,
          status: 'completed',
          newPath: copied.path,
          bytes: copied.bytes,
        });
      } catch (itemError) {
        const message = itemError?.message || 'Erro ao migrar asset.';
        await updateMigrationStatus(supabase, migrationId, {
          migration_status: 'failed',
          migration_error: message,
        });

        results.push({
          id: migrationId,
          entityType: migration.entity_type,
          entityId: migration.entity_id,
          status: 'failed',
          error: message,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      workspaceId: auth.workspaceId,
      processed: results.length,
      completed: results.filter((item) => item.status === 'completed').length,
      failed: results.filter((item) => item.status === 'failed').length,
      results,
    });
  } catch (error) {
    console.error('[STORAGE_MIGRATION_RUNNER][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao executar migração de storage.' },
      { status: 500 }
    );
  }
}
