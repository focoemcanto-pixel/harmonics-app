import { redirect } from 'next/navigation';
import ClienteHome from '../../../components/cliente/ClienteHome';

function parseLocalDate(value) {
  if (!value) return null;

  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    return new Date(year, month, day);
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(dateInput, days) {
  const d = new Date(dateInput);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export default async function ClienteTokenPage({ params }) {
  const { token } = await params;

  const data = {
    token,
    clienteNome: 'Ana Souza',
    eventoTitulo: 'Casamento Ana & Lucas',
    dataEvento: '2026-09-19',
    horarioEvento: '16:00',
    localEvento: 'Igreja São José',
    formacao: 'Quarteto',
    instrumentos: 'Violino, Viola, Violoncelo e Piano',
    statusContrato: 'Contrato assinado',
    statusEvento: 'Confirmado',
    observacoes:
      'Alinhar com a assessoria a ordem correta do cortejo e o roteiro enviado à equipe.',
    horarioChegada: '14:00',
    suporteWhatsapp: '5571999999999',

    reviewSubmitted: false,

    repertorio: {
      status: 'RASCUNHO',
      etapasPreenchidas: 5,
      totalEtapas: 7,
      liberadoParaEdicao: false,
      enviadoEm: null,
      linkPreenchimento: `/cliente/${token}/repertorio`,
      linkVisualizacao: `/cliente/${token}/repertorio/resumo`,
      podeSolicitarCorrecao: true,
      temAntessala: true,
      temReceptivo: false,
      pdfUrl: '#',
    },

    financeiro: {
      resumo: {
        valorTotal: 'R$ 4.000,00',
        valorPago: 'R$ 2.000,00',
        saldo: 'R$ 2.000,00',
        status: 'Em aberto',
      },
      vencimentos: [
        {
          title: 'Primeiro pagamento',
          dueDate: '05/09/2026',
          amount: 'R$ 2.000,00',
          status: 'PAGO',
          description: '50% do valor total até 14 dias antes do evento.',
        },
        {
          title: 'Pagamento final',
          dueDate: '17/09/2026',
          amount: 'R$ 2.000,00',
          status: 'PENDENTE',
          description: 'Saldo final até 48h antes do evento.',
        },
      ],
      historico: [
        {
          label: 'Sinal recebido',
          date: '01/09/2026',
          amount: 'R$ 2.000,00',
          status: 'PAGO',
          note: 'Pagamento confirmado com sucesso.',
          fileName: 'comprovante-pix-setembro.pdf',
        },
      ],
    },
  };

  const now = startOfDay(new Date());
  const eventDate = parseLocalDate(data.dataEvento);
  const reviewStartsAt = eventDate ? startOfDay(addDays(eventDate, 1)) : null;

  const shouldRedirectToReview =
    !!reviewStartsAt &&
    (now.getTime() > reviewStartsAt.getTime() || data.reviewSubmitted === true);

  if (shouldRedirectToReview) {
    redirect(`/cliente/${token}/review`);
  }

  return <ClienteHome data={data} />;
}