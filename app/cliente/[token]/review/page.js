import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import ClienteReview from '@/components/cliente/ClienteReview';

export const dynamic = 'force-dynamic';

function formatDateBR(value) {
  if (!value) return '';
  const raw = String(value || '').slice(0, 10);
  const [year, month, day] = raw.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export default async function ClienteReviewPage({ params }) {
  const token = String(params?.token || '').trim();

  if (!token) {
    notFound();
  }

  const supabase = getSupabaseAdmin();

  // 1. buscar precontract
  const { data: precontract } = await supabase
    .from('precontracts')
    .select('id, event_id, client_name, event_date')
    .eq('public_token', token)
    .maybeSingle();

  if (!precontract?.event_id) {
    notFound();
  }

  // 2. buscar evento + review
  const [eventResp, reviewResp] = await Promise.all([
    supabase
      .from('events')
      .select('id, client_name, event_date, event_type')
      .eq('id', precontract.event_id)
      .maybeSingle(),

    supabase
      .from('client_reviews')
      .select('*')
      .eq('event_id', precontract.event_id)
      .maybeSingle(),
  ]);

  const event = eventResp.data;
  const review = reviewResp.data;

  if (!event) {
    notFound();
  }

  const clientName = event.client_name || precontract.client_name || 'Cliente';

  const data = {
    clienteNome: clientName,
    eventoTitulo: `${event.event_type || 'Evento'} • ${clientName}`,
    eventoData: formatDateBR(event.event_date || precontract.event_date),
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
