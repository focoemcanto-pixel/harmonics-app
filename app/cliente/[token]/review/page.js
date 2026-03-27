import ClienteReview from '@/components/cliente/ClienteReview';

export default async function ClienteReviewPage({ params }) {
  const { token } = await params;

  const data = {
    clienteNome: 'Ana Souza',
    eventoTitulo: 'Casamento Ana & Lucas',
    eventoData: '2026-09-19',
    reviewSubmitted: false,
  };

  return <ClienteReview data={data} token={token} />;
}