import { normalizeTimeStrict } from '../time/normalize-time';

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function formatDateBR(value) {
  if (!value) return '-';
  const [y, m, d] = String(value).split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function formatTimeShort(value) {
  if (!value) return '--:--';
  return String(value).slice(0, 5);
}

export function formatDateTimeBR(dateValue, timeValue) {
  return `${formatDateBR(dateValue)} • ${formatTimeShort(timeValue)}`;
}

export function addHoursToTime(timeValue, deltaHours = 0) {
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

export function extractYoutubeUrlsFromText(text) {
  const source = String(text || '');
  if (!source) return [];

  const matches = source.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]{6,}|youtu\.be\/[\w-]{6,}|youtube\.com\/embed\/[\w-]{6,}|youtube\.com\/shorts\/[\w-]{6,})[^\s)"]*/gi
  );

  return Array.from(new Set(matches || []));
}

export function extractYoutubeId(url) {
  const value = String(url || '').trim();
  if (!value) return '';

  const patterns = [
    /youtu\.be\/([\w-]{6,})/i,
    /youtube\.com\/watch\?v=([\w-]{6,})/i,
    /youtube\.com\/embed\/([\w-]{6,})/i,
    /youtube\.com\/shorts\/([\w-]{6,})/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }

  return '';
}

export function buildYoutubeEmbedUrl(url) {
  const id = extractYoutubeId(url);
  if (!id) return '';
  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
}

export function getInviteTone(status) {
  const value = String(status || '').toLowerCase();

  if (value === 'confirmed') {
    return {
      label: 'Confirmado',
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      dot: 'bg-emerald-500',
    };
  }

  if (value === 'declined') {
    return {
      label: 'Recusado',
      badge: 'border-red-200 bg-red-50 text-red-700',
      dot: 'bg-red-500',
    };
  }

  return {
    label: 'Pendente',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  };
}

export function getEventMeta(event = {}) {
  const hasSound = Boolean(
    event?.has_sound ??
      event?.sound_included ??
      event?.hasSound ??
      false
  );

  const rawReception =
    event?.reception_hours ??
    event?.receptivo_duration ??
    event?.reception_duration ??
    event?.receptivo_horas ??
    event?.receptivo_hours ??
    '';

  const receptionHours =
    rawReception === '' || rawReception == null
      ? ''
      : String(rawReception).replace(/\.0$/, '');

  const hasReception = Boolean(
    event?.has_reception ??
      event?.has_receptivo ??
      event?.reception_enabled ??
      event?.hasReception ??
      (!!receptionHours && receptionHours !== '0')
  );

  const normalizedStatus = String(event?.status || '').toLowerCase();
  const isDone = normalizedStatus === 'done' || normalizedStatus === 'completed';

  return {
    hasSound,
    hasReception,
    receptionHours,
    isDone,
  };
}

export function getDaysUntil(dateValue) {
  if (!dateValue) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;

  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / 86400000);
}

export function getEventTimeBadge(row = {}) {
  const days = getDaysUntil(row?.eventDate);

  if (row?.isDone || days == null) {
    return {
      label: 'Concluído',
      tone: 'done',
    };
  }

  if (days < 0) {
    return {
      label: 'Já passou',
      tone: 'past',
    };
  }

  if (days === 0) {
    return {
      label: 'HOJE! ⚡',
      tone: 'today',
    };
  }

  if (days === 1) {
    return {
      label: 'Falta 1 dia',
      tone: 'soon',
    };
  }

  return {
    label: `Faltam ${days} dias`,
    tone: 'future',
  };
}

export function getWeekdayPTBR(dateValue) {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
}

export function buildMapsUrl(locationName) {
  if (!locationName) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName)}`;
}

function normalizeEventRelation(eventRelation) {
  if (Array.isArray(eventRelation)) {
    return eventRelation[0] || {};
  }

  if (eventRelation && typeof eventRelation === 'object') {
    return eventRelation;
  }

  return {};
}

function extractRepertorioFromText(text) {
  const source = String(text || '').trim();
  if (!source) return [];

  const lines = source
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    const youtube = extractYoutubeUrlsFromText(line)[0] || '';

    return {
      ordem: index + 1,
      musica: line.replace(youtube, '').trim() || `Faixa ${index + 1}`,
      momento: '',
      quemEntra: '',
      referencia: youtube,
      observacao: '',
      tipo: '',
      label: '',
    };
  });
}

function mapStoredRepertoireItems(items = [], config = null) {
  const ordered = [...items].sort(
    (a, b) => Number(a?.item_order || 0) - Number(b?.item_order || 0)
  );

  const mapped = ordered.map((item, index) => ({
    ordem: Number(item?.item_order ?? index) + 1,
    musica: item?.song_name || '',
    momento: item?.moment || '',
    quemEntra: item?.who_enters || '',
    referencia: item?.reference_link || '',
    observacao: item?.notes || '',
    tipo: item?.type || '',
    label: item?.label || '',
    section: item?.section || '',
    genres: item?.genres || '',
    artists: item?.artists || '',
  }));

  if (config?.has_ante_room && !mapped.some((item) => item.section === 'antessala')) {
    mapped.unshift({
      ordem: 0,
      musica: config?.ante_room_style || '',
      momento: 'Antessala',
      quemEntra: '',
      referencia: '',
      observacao: config?.ante_room_notes || '',
      tipo: 'ante_room',
      label: 'Antessala',
      section: 'antessala',
      genres: '',
      artists: '',
    });
  }

  return mapped.map((item, index) => ({
    ...item,
    ordem: index + 1,
  }));
}

function extractYoutubeUrlsFromRepertoireItems(items = []) {
  const urls = items
    .map((item) => String(item?.referencia || '').trim())
    .filter(Boolean)
    .filter((url) => /youtu\.be|youtube\.com/i.test(url));

  return Array.from(new Set(urls));
}

export function buildMemberDashboardData({
  invites = [],
  contracts = [],
  precontracts = [],
  repertoireConfigs = [],
  repertoireItems = [],
}) {
  const safeInvites = Array.isArray(invites) ? invites : [];
  const safeContracts = Array.isArray(contracts) ? contracts : [];
  const safePrecontracts = Array.isArray(precontracts) ? precontracts : [];
  const safeConfigs = Array.isArray(repertoireConfigs) ? repertoireConfigs : [];
  const safeItems = Array.isArray(repertoireItems) ? repertoireItems : [];

  const contractsByPreId = new Map(
    safeContracts.map((item) => [String(item?.precontract_id), item])
  );

  const contractByEventId = new Map();

  for (const pre of safePrecontracts) {
    const contract = contractsByPreId.get(String(pre?.id));
    const eventId = contract?.event_id || pre?.event_id;

    if (!eventId) continue;

    contractByEventId.set(String(eventId), {
      precontractId: pre?.id || null,
      contractId: contract?.id || null,
      publicToken: pre?.public_token || contract?.public_token || '',
      pdfUrl: contract?.pdf_url || '',
      docUrl: contract?.doc_url || '',
      signedAt: contract?.signed_at || '',
    });
  }

  const configByEventId = new Map(
    safeConfigs.map((item) => [String(item?.event_id), item])
  );

  const itemsByEventId = safeItems.reduce((acc, item) => {
    const key = String(item?.event_id || '');
    if (!key) return acc;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(item);
    return acc;
  }, new Map());

  const rows = safeInvites.map((invite) => {
    const event = normalizeEventRelation(invite?.events);
    const contractInfo = contractByEventId.get(String(invite?.event_id)) || null;
    const meta = getEventMeta(event);

    const repertoireConfig = configByEventId.get(String(invite?.event_id)) || null;
    const storedItems = itemsByEventId.get(String(invite?.event_id)) || [];

    const textSources = [invite?.message, event?.observations]
      .filter(Boolean)
      .join('\n');

    const repertorioItems =
      storedItems.length > 0 || repertoireConfig
        ? mapStoredRepertoireItems(storedItems, repertoireConfig)
        : extractRepertorioFromText(textSources);

    const youtubeUrls =
      repertorioItems.length > 0
        ? extractYoutubeUrlsFromRepertoireItems(repertorioItems)
        : extractYoutubeUrlsFromText(textSources);

    return {
      id: invite?.id,
      inviteStatus: invite?.status || 'pending',
      respondedAt: invite?.responded_at || null,
      sentAt: invite?.sent_at || invite?.created_at || null,
      suggestedRoleName: invite?.suggested_role_name || '',
      message: invite?.message || '',

      eventId: invite?.event_id,
      clientName: event?.client_name || 'Evento',
      eventDate: event?.event_date || '',
      eventTime: event?.event_time || '',
      locationName: event?.location_name || '',
      formation: event?.formation || '',
      instruments: event?.instruments || '',
      observations: event?.observations || '',
      hasSound: meta.hasSound,
      hasReception: meta.hasReception,
      receptionHours: meta.receptionHours,
      eventStatus: event?.status || '',
      isDone: meta.isDone,
      weekday: getWeekdayPTBR(event?.event_date),
      mapsUrl: buildMapsUrl(event?.location_name),

      contractInfo,
      repertoireConfig,
      repertorioPdfUrl:
        repertoireConfig?.repertoire_pdf_url || repertoireConfig?.pdf_url || '',
      repertorioItems,
      youtubeUrls,
      youtubePrimary: youtubeUrls[0] || '',
    };
  });

  const pendentes = rows.filter((row) => row.inviteStatus === 'pending');
  const confirmados = rows.filter((row) => row.inviteStatus === 'confirmed');
  const recusados = rows.filter((row) => row.inviteStatus === 'declined');

  const proximosConfirmados = [...confirmados].sort((a, b) => {
    const aDate = `${a?.eventDate || ''}T${normalizeTimeStrict(a?.eventTime) || '00:00'}`;
    const bDate = `${b?.eventDate || ''}T${normalizeTimeStrict(b?.eventTime) || '00:00'}`;
    return new Date(aDate).getTime() - new Date(bDate).getTime();
  });

  return {
    pendentes,
    confirmados,
    recusados,
    proximosConfirmados,
    resumo: {
      pendentes: pendentes.length,
      confirmados: confirmados.length,
      repertorios: confirmados.filter(
        (row) =>
          row?.repertorioPdfUrl ||
          (Array.isArray(row?.youtubeUrls) && row.youtubeUrls.length > 0) ||
          (Array.isArray(row?.repertorioItems) && row.repertorioItems.length > 0)
      ).length,
    },
  };
}
