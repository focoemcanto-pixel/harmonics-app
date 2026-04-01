import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ClienteReview from '@/components/cliente/ClienteReview';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      'Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.'
    );
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function ClienteReviewPage({ params }) {
  const { token } = await params;
  const supabase = getAdminSupabase();

  const { data: precontract, error: precontractError } = await supabase
    .from('precontracts')
    .select('id, public_token, event_id')
    .eq('public_token', token)
    .maybeSingle();

  if (precontractError) throw precontractError;
  if (!precontract?.event_id) notFound();

  const [eventResp, reviewResp] = await Promise.all([
    supabase
      .from('events')
      .select('id, client_name, event_date')
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

  if (!event) notFound();

  const data = {
    clienteNome: event.client_name || 'Cliente',
    eventoTitulo: event.client_name
      ? `Evento • ${event.client_name}`
      : 'Evento',
    eventoData: event.event_date || '',
    reviewSubmitted: Boolean(review),
    existingReview: review
      ? {
          rating: review.rating || 0,
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
