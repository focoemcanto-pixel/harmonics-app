import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import ClienteReview from '@/components/cliente/ClienteReview';

export const dynamic = 'force-dynamic';

function formatDateBR(value) {
  if (!value) return '';
  const raw = String(value || '').slice(0, 10);
  const [year, month, day] = raw.split('-');
  if (!year || !month || !day) return String(value || '');
  return `${day}/${month}/${year}`;
}

function extractToken(params) {
  if (Array.isArray(params?.token)) {
    return String(params.token[0] || '').trim();
  }
  return String(params?.token || '').trim();
}

export default async function ClienteReviewPage({ params }) {
  const resolvedParams = typeof params?.then === 'function' ? await params : params;
  const token = extractToken(resolvedParams);

  if (!token) {
    notFound();
  }

  const supabase = getSupabaseAdmin();

  const { data: precontract, error: precontractError } = await supabase
    .from('precontracts')
    .select('id, public_token, event_id, client_name, event_date')
    .eq('public_token', token)
    .maybeSingle();

  if (precontractError) throw precontractError;
  if (!precontract?.id || !precontract?.event_id) notFound();

  const [eventResp, reviewResp] = await Promise.all([
    supabase
      .from('events')
      .select('id, client_name, event_date, event_type, location_name')
      .eq('id', precontract.event_id)
      .maybeSingle(),

    supabase
      .from('client_reviews')
      .select('*')
      .eq('event_id', precontract.event_id)
      .maybeSingle(),
  ]);

  if (eventResp.error) throw eventResp.error;
  if (reviewResp.error) throw reviewResp.error;

  const event = eventResp.data;
  const review = reviewResp.data;

  if (!event?.id) notFound();

  const clientName = event.client_name || precontract.client_name || 'Cliente';
  const eventDate = event.event_date || precontract.event_date || '';
  const eventType = event.event_type || 'Evento';

  const data = {
    clienteNome: clientName,
    eventoTitulo: `${eventType} • ${clientName}`,
    eventoData: formatDateBR(eventDate),
    reviewSubmitted: Boolean(review),
    existingReview: review
      ? {
          rating: Number(review.rating || 0),
          testimonial: review.testimonial || '',
          wouldRecommend:
            typeof review.would_recommend === 'boolean'
              ? review.would_recommend
              : true,
        }
      : null,
  };

  return <ClienteReview data={data} token={token} />;
}
