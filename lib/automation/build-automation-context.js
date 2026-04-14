import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '../supabase-admin';
import { buildClientReviewLink } from '../cliente/review-link';

/**
 * Monta variáveis de contexto para renderização de template
 * @param {string} eventType
 * @param {string} entityId
 * @param {Object} recipientData - dados retornados por resolveRecipient
 * @returns {Promise<Object>} contexto com variáveis
 */
export async function buildAutomationContext(eventType, entityId, recipientData) {
  const baseUrl = String(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_BASE_URL ||
      'https://app.bandaharmonics.com'
  )
    .trim()
    .replace(/\/+$/, '');

  function formatDateBR(value) {
    if (!value) return '';
    const [y, m, d] = String(value).split('-');
    if (!y || !m || !d) return value;
    return `${d}/${m}/${y}`;
  }

  function formatTime(value) {
    return value ? String(value).slice(0, 5) : '';
  }

  function buildMemberPanelLink(inviteToken) {
    if (!inviteToken) return `${baseUrl}/membro`;
    return `${baseUrl}/membro/${inviteToken}`;
  }

  function buildMemberPanelInviteQueryLink(inviteToken) {
    if (!inviteToken) return `${baseUrl}/membro`;
    return `${baseUrl}/membro?invite=${encodeURIComponent(inviteToken)}`;
  }

  const context = {};
  const setContextValue = (key, value) => {
    const finalValue = value ?? '';
    context[key] = finalValue;
    context[`{${key}}`] = finalValue;
  };

  if (eventType === 'invite_member') {
    const { invite } = recipientData.contextData || {};
    if (!invite) return context;

    const event = invite.event || {};

    // Garantir que o token de convite existe
    let inviteToken = invite.invite_token;
    if (!inviteToken) {
      // Gerar token caso não exista
      const supabaseAdmin = getSupabaseAdmin();
      inviteToken = randomUUID();
      await supabaseAdmin
        .from('invites')
        .update({ invite_token: inviteToken })
        .eq('id', invite.id);
    }

    setContextValue('cliente_nome', invite.contact?.name || '');
    setContextValue('nome_musico', invite.contact?.name || '');
    setContextValue('nome_membro', invite.contact?.name || '');
    setContextValue('nome_empresa', 'Harmonics');
    setContextValue('evento_nome', event.client_name || '');
    setContextValue('evento_data', formatDateBR(event.event_date));
    setContextValue('evento_horario', formatTime(event.event_time));
    setContextValue('evento_local', event.location_name || '');
    const memberPanelLink = buildMemberPanelLink(inviteToken);
    const memberPanelInviteQueryLink = buildMemberPanelInviteQueryLink(inviteToken);

    // Variável oficial para painel do membro (novo)
    setContextValue('link_painel_membro', memberPanelLink);
    setContextValue('painel_membro', memberPanelLink);
    // Alias legado de convite para compatibilidade
    setContextValue('link_convite', memberPanelInviteQueryLink);
    // Compat legado com templates antigos que ainda usam painel_cliente em convite de membro
    setContextValue('link_painel_cliente', memberPanelLink);

    console.info('[automation][invite_member][context_debug]', {
      eventType,
      entityId,
      baseUrlResolved: baseUrl,
      inviteToken: inviteToken || null,
      contactName: invite.contact?.name || '',
      linkPainelMembro: memberPanelLink,
      context,
    });

    return context;
  }

  if (eventType === 'contract_signed_client') {
    const { precontract } = recipientData.contextData || {};
    if (!precontract) return context;

    setContextValue('cliente_nome', precontract.client_name || '');
    setContextValue(
      'link_painel_cliente',
      precontract.public_token ? `${baseUrl}/cliente/${precontract.public_token}` : ''
    );

    return context;
  }

  // Tipos baseados em evento (entityId = event_id) com destinatário cliente
  const CLIENT_EVENT_TYPES = [
    'repertoire_pending_15_days_client',
    'payment_pending_2_days_client',
    'post_event_review_request_client',
  ];

  if (CLIENT_EVENT_TYPES.includes(eventType)) {
    const { event, precontract } = recipientData.contextData || {};

    setContextValue('cliente_nome', precontract?.client_name || event?.client_name || '');
    setContextValue('nome_empresa', 'Harmonics');
    setContextValue('evento_nome', event?.client_name || '');
    setContextValue('evento_data', formatDateBR(event?.event_date));
    setContextValue('evento_horario', formatTime(event?.event_time));
    setContextValue('evento_local', event?.location_name || '');
    const painelClienteLink = precontract?.public_token
      ? `${baseUrl}/cliente/${precontract.public_token}`
      : '';
    setContextValue('link_painel_cliente', painelClienteLink);
    const reviewLink = buildClientReviewLink(precontract?.public_token || '', baseUrl);
    setContextValue('link_review', reviewLink);
    setContextValue('review_link', reviewLink);

    return context;
  }

  if (eventType === 'schedule_pending_15_days_admin') {
    const { event, pendingInvites } = recipientData.contextData || {};

    setContextValue('evento_nome', event?.client_name || '');
    setContextValue('evento_data', formatDateBR(event?.event_date));
    setContextValue('evento_horario', formatTime(event?.event_time));
    setContextValue('evento_local', event?.location_name || '');
    setContextValue('pendencias_escala', String((pendingInvites || []).length));
    setContextValue('link_admin', `${baseUrl}/escalas`);

    return context;
  }

  return context;
}
