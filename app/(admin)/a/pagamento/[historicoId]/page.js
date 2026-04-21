import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdminPagamentoDeepLinkPage({ params }) {
  const historicoId = String(params?.historicoId || '').trim();

  console.log('[ADMIN_PAYMENT_LINK][INPUT]', {
    historicoId,
  });

  if (!historicoId) {
    redirect('/pagamentos');
  }

  const nextTarget = `/a/pagamento/${encodeURIComponent(historicoId)}`;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log('[ADMIN_PAYMENT_LINK][AUTH_STATE]', {
      hasUser: false,
      role: null,
      action: 'redirect_login',
    });
    redirect(`/login?next=${encodeURIComponent(nextTarget)}`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role || null;

  console.log('[ADMIN_PAYMENT_LINK][AUTH_STATE]', {
    hasUser: true,
    role,
    action: role === 'admin' ? 'resolve_target' : 'redirect_denied',
  });

  if (role !== 'admin') {
    redirect('/acesso-negado');
  }

  const { data: payment } = await supabase
    .from('payments')
    .select('id, event_id')
    .eq('id', historicoId)
    .maybeSingle();

  console.log('[ADMIN_PAYMENT_LINK][TARGET_PAYMENT]', {
    historicoId,
    found: Boolean(payment?.id),
    eventId: payment?.event_id || null,
  });

  if (!payment?.id) {
    redirect('/pagamentos');
  }

  redirect(`/pagamentos?historico=${encodeURIComponent(historicoId)}`);
}
