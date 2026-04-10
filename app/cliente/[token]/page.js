import { notFound, redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ClienteHome from '../../../components/cliente/ClienteHome';
import { resolveSupportWhatsAppConfig } from '../../../lib/whatsapp/support-config';

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

function addHoursToTime(timeValue, deltaHours = 0) {
  if (!timeValue) return '--:--';

  const [h, m] = String(timeValue)
    .split(':')
    .map((v) => Number(v || 0));

  const totalMinutes = h * 60 + m + deltaHours * 60;

  let normalized = totalMinutes % (24 * 60);
  if (normalized < 0) normalized += 24 * 60;

  const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mm = String(normalized % 60).padStart(2, '0');

  return `${hh}:${mm}`;
}

function mapStatusToUi(status, isLocked) {
  const normalized = String(status || '').toUpperCase();

  if (normalized === 'ENVIADO' || normalized === 'FINALIZADO' || isLocked) {
    return 'ENVIADO';
  }

  if (normalized === 'LIBERADO') {
    return 'LIBERADO';
  }

  if (normalized === 'RASCUNHO') {
    return 'RASCUNHO';
  }

  return 'NAO_INICIADO';
}

function computeEtapasPreenchidas(config, items) {
  let total = 0;

  const hasAnteRoom =
    config?.has_ante_room &&
    (config?.ante_room_style || config?.ante_room_notes);

  if (hasAnteRoom) total += 1;

  const cortejoCount = items.filter((item) => item.section === 'cortejo').length;
  if (cortejoCount > 0) total += 1;

  const cerimoniaCount = items.filter((item) => item.section === 'cerimonia').length;
  if (cerimoniaCount > 0) total += 1;

  if (config?.exit_song || config?.exit_reference || config?.exit_notes) {
    total += 1;
  }

  const hasReception =
    config?.has_reception &&
    (config?.reception_duration ||
      config?.reception_genres ||
      config?.reception_artists ||
      config?.reception_notes);

  if (hasReception) total += 1;

  return total;
}

function mapItemsToInitialState(items) {
  const cortejo = items
    .filter((item) => item.section === 'cortejo')
    .sort((a, b) => (a.item_order || 0) - (b.item_order || 0))
    .map((item) => ({
      label: item.label || item.who_enters || '',
      musica: item.song_name || '',
      referencia: item.reference_link || '',
      observacao: item.notes || '',
      reference_title: item.reference_title || '',
      reference_channel: item.reference_channel || '',
      reference_thumbnail: item.reference_thumbnail || '',
      reference_video_id: item.reference_video_id || '',
    }));

  const cerimonia = items
    .filter((item) => item.section === 'cerimonia')
    .sort((a, b) => (a.item_order || 0) - (b.item_order || 0))
    .map((item) => ({
      label: item.label || item.moment || '',
      musica: item.song_name || '',
      referencia: item.reference_link || '',
      observacao: item.notes || '',
      reference_title: item.reference_title || '',
      reference_channel: item.reference_channel || '',
      reference_thumbnail: item.reference_thumbnail || '',
      reference_video_id: item.reference_video_id || '',
    }));

  return {
    cortejo:
      cortejo.length > 0
        ? cortejo
        : [
            { label: 'Padrinhos', musica: '', referencia: '', observacao: '' },
            { label: 'Noiva', musica: '', referencia: '', observacao: '' },
          ],
    cerimonia:
      cerimonia.length > 0
        ? cerimonia
        : [{ label: 'Alianças', musica: '', referencia: '', observacao: '' }],
  };
}

function buildFinancialSummary(event) {
  const total = Number(event?.total_price || event?.amount || 0);
  const paid = Number(event?.amount_paid || event?.paid_amount || 0);
  const saldo = Math.max(total - paid, 0);

  const toBRL = (value) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value || 0));

  return {
    valorTotal: total > 0 ? toBRL(total) : 'A definir',
    valorPago: paid > 0 ? toBRL(paid) : 'A definir',
    saldo: total > 0 ? toBRL(saldo) : 'A definir',
    status:
      saldo <= 0 && total > 0
        ? 'Quitado'
        : paid > 0
        ? 'Em aberto'
        : 'Consulte a equipe',
  };
}

export default async function ClienteTokenPage({ params }) {
  const { token } = await params;
  const supabase = getAdminSupabase();

  const { data: precontract, error: precontractError } = await supabase
    .from('precontracts')
    .select('id, public_token, event_id')
    .eq('public_token', token)
    .maybeSingle();

  if (precontractError) throw precontractError;
  if (!precontract) notFound();

  const eventId = precontract.event_id;
  if (!eventId) notFound();

  const [
    eventResp,
    configResp,
    itemsResp,
    contractsResp,
    repertoireTokenResp,
  ] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle(),

    supabase
      .from('repertoire_config')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle(),

    supabase
      .from('repertoire_items')
      .select('*')
      .eq('event_id', eventId)
      .order('item_order', { ascending: true }),

    supabase
      .from('contracts')
      .select('id, event_id, precontract_id, pdf_url, doc_url, signed_at')
      .eq('event_id', eventId)
      .maybeSingle(),

    supabase
      .from('repertoire_tokens')
      .select('id, token, event_id, status, expires_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (eventResp.error) throw eventResp.error;
  if (configResp.error) throw configResp.error;
  if (itemsResp.error) throw itemsResp.error;
  if (contractsResp.error) throw contractsResp.error;
  if (repertoireTokenResp.error) throw repertoireTokenResp.error;

  const event = eventResp.data;
  if (!event) notFound();

  const config = configResp.data || null;
  const items = Array.isArray(itemsResp.data) ? itemsResp.data : [];
  const contract = contractsResp.data || null;
  const repertoireToken = repertoireTokenResp.data || null;
  const configClientToken = String(config?.client_public_token || '').trim();
  const clientToken = configClientToken || token;

  console.log('[CLIENTE PAGE] URL PDF contrato:', contract?.pdf_url || '(vazio)');
  console.log(
    '[CLIENTE PAGE] URL PDF repertório:',
    config?.repertoire_pdf_url || config?.pdf_url || '(vazio)'
  );

  const eventDate = parseLocalDate(event.event_date);
  const now = startOfDay(new Date());
  const reviewStartsAt = eventDate ? startOfDay(addDays(eventDate, 1)) : null;

  const shouldRedirectToReview =
    !!reviewStartsAt && now.getTime() > reviewStartsAt.getTime();

  if (shouldRedirectToReview) {
    redirect(`/cliente/${clientToken}/review`);
  }

  const initialLists = mapItemsToInitialState(items);

  const repertorioTokenValue = repertoireToken?.token || token;
  const repertorioPdfToken = clientToken;
  const repertorioPdfUrl = repertorioPdfToken
    ? `/api/cliente/repertorio/pdf/${repertorioPdfToken}`
    : null;

  console.log('[CLIENTE PAGE] token da rota do cliente:', token || '(vazio)');
  console.log('[CLIENTE PAGE] token usado na URL do PDF:', repertorioPdfToken || '(vazio)');
  console.log(
    '[CLIENTE PAGE] tokens da rota e PDF são idênticos?',
    String(token || '') === String(repertorioPdfToken || '')
  );

  const supportConfig = resolveSupportWhatsAppConfig();

  const data = {
    token: clientToken,
    clienteNome: event.client_name || 'Cliente',
    eventoTitulo: event.client_name
      ? `Evento • ${event.client_name}`
      : 'Evento',
    dataEvento: event.event_date || '',
    horarioEvento: event.event_time || '',
    localEvento: event.location_name || '',
    formacao: event.formation || '',
    instrumentos: event.instruments || '',
    statusContrato: contract?.signed_at ? 'Contrato assinado' : 'Contrato pendente',
    statusEvento: event.status || 'Confirmado',
    observacoes:
      event.observations ||
      'Alinhar com a assessoria a ordem correta do cortejo e o roteiro enviado à equipe.',
    horarioChegada: addHoursToTime(event.event_time, -2),
    suporteWhatsapp: supportConfig.phone,
    suporteWhatsappMensagem: supportConfig.message,
    reviewSubmitted: false,

    repertorio: {
      status: mapStatusToUi(config?.status, config?.is_locked),
      etapasPreenchidas: computeEtapasPreenchidas(config, items),
      totalEtapas: 7,
      liberadoParaEdicao: !config?.is_locked,
      enviadoEm: config?.submitted_at || null,
      linkPreenchimento: `/cliente/${clientToken}/repertorio`,
      linkVisualizacao: `/cliente/${clientToken}/repertorio`,
      podeSolicitarCorrecao: true,
      temAntessala: Boolean(
        config?.has_ante_room ??
          event?.has_ante_room ??
          event?.has_antessala ??
          false
      ),
      temReceptivo: Boolean(
        config?.has_reception ??
          event?.has_reception ??
          event?.has_receptivo ??
          false
      ),
      pdfUrl: repertorioPdfUrl,
      repertoireToken: repertorioTokenValue,

      initialState: {
        querAntessala: config?.has_ante_room ?? null,
        antessala: {
          estilo: config?.ante_room_style || '',
          generos: '',
          artistas: '',
          observacao: config?.ante_room_notes || '',
        },
        cortejo: initialLists.cortejo,
        cerimonia: initialLists.cerimonia,
        saida: {
          musica: config?.exit_song || '',
          referencia: config?.exit_reference || '',
          observacao: config?.exit_notes || '',
          reference_title: config?.exit_reference_title || '',
          reference_channel: config?.exit_reference_channel || '',
          reference_thumbnail: config?.exit_reference_thumbnail || '',
          reference_video_id: config?.exit_reference_video_id || '',
        },
        receptivo: {
          duracao: config?.reception_duration || '1h',
          generos: config?.reception_genres || '',
          artistas: config?.reception_artists || '',
          observacao: config?.reception_notes || '',
        },
        desiredSongs: config?.desired_songs || '',
        generalNotes: config?.general_notes || '',
      },
    },

    financeiro: {
      resumo: buildFinancialSummary(event),
      vencimentos: [],
      historico: [],
    },
  };

  return <ClienteHome data={data} />;
}
