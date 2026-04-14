import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('suggestion_songs')
      .select('id, source_type, created_at, is_active');

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];

    const distribution = rows.reduce(
      (acc, row) => {
        const raw = row?.source_type;
        const key =
          raw == null
            ? '__null__'
            : String(raw).trim() === ''
              ? '__empty__'
              : String(raw);
        if (!acc[key]) {
          acc[key] = { total: 0, active: 0 };
        }
        acc[key].total += 1;
        if (row?.is_active) acc[key].active += 1;
        return acc;
      },
      {}
    );

    return NextResponse.json({
      ok: true,
      total: rows.length,
      distribution,
      review: {
        legacyNullCount: (distribution.__null__?.total || 0) + (distribution.__empty__?.total || 0),
        clientCount: distribution.client?.total || 0,
      },
    });
  } catch (error) {
    console.error('[admin/suggestions/source-audit] error', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Falha ao auditar source_type em suggestion_songs.' },
      { status: 500 }
    );
  }
}
