import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const EVENT_DEPENDENCIES = [
  {
    table: 'event_musicians',
    column: 'event_id',
    message: 'Este evento possui músicos vinculados na escala.',
  },
  {
    table: 'invites',
    column: 'event_id',
    message: 'Este evento possui convites vinculados.',
  },
  {
    table: 'payments',
    column: 'event_id',
    message: 'Este evento possui pagamentos vinculados.',
  },
  {
    table: 'repertoire_items',
    column: 'event_id',
    message: 'Este evento possui repertório ativo.',
  },
  {
    table: 'repertoire_tokens',
    column: 'event_id',
    message: 'Este evento possui token de repertório ativo.',
  },
  {
    table: 'repertoire_config',
    column: 'event_id',
    message: 'Este evento possui painel de repertório ativo.',
  },
  {
    table: 'contracts',
    column: 'event_id',
    message: 'Este evento possui contrato gerado.',
  },
  {
    table: 'precontracts',
    column: 'event_id',
    message: 'Este evento possui pré-contrato vinculado.',
  },
  {
    table: 'automation_logs',
    column: 'event_id',
    message: 'Este evento possui logs de automação vinculados.',
  },
  {
    table: 'contract_adjustment_requests',
    column: 'event_id',
    message: 'Este evento possui solicitações de ajuste contratual.',
  },
];

async function checkDependency(supabase, eventId, dependency) {
  const { count, error } = await supabase
    .from(dependency.table)
    .select('*', { count: 'exact', head: true })
    .eq(dependency.column, eventId);

  if (error) {
    return {
      ...dependency,
      count: 0,
      skipped: true,
      error: error.message,
      code: error.code,
    };
  }

  return {
    ...dependency,
    count: Number(count || 0),
    blocked: Number(count || 0) > 0,
  };
}

export async function DELETE(_request, { params }) {
  const supabase = getSupabaseAdmin();
  const routeParams = await params;
  const eventId = String(routeParams?.id || '').trim();

  console.info('[EVENT_DELETE_API][INPUT]', { eventId });

  if (!eventId) {
    return NextResponse.json(
      { ok: false, error: 'ID do evento é obrigatório.' },
      { status: 400 }
    );
  }

  try {
    const dependencies = await Promise.all(
      EVENT_DEPENDENCIES.map((dependency) =>
        checkDependency(supabase, eventId, dependency)
      )
    );

    const blockedDependencies = dependencies.filter((item) => item.blocked);

    console.info('[EVENT_DELETE_API][DEPENDENCIES]', {
      eventId,
      dependencies,
      blockedDependencies,
    });

    if (blockedDependencies.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Não foi possível excluir: existem vínculos operacionais ativos neste evento.',
          dependencies: blockedDependencies,
        },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)
      .select('id')
      .maybeSingle();

    if (error) throw error;

    if (!data?.id) {
      return NextResponse.json(
        { ok: false, error: 'Evento não encontrado para exclusão.' },
        { status: 404 }
      );
    }

    console.info('[EVENT_DELETE_API][DELETE_RESULT]', {
      eventId,
      deletedId: data.id,
    });

    return NextResponse.json({
      ok: true,
      deletedId: data.id,
      dependencies,
    });
  } catch (error) {
    console.error('[EVENT_DELETE_API][ERROR]', {
      eventId,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Erro inesperado ao excluir evento no servidor.',
      },
      { status: 500 }
    );
  }
}
