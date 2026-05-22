'use client';
import { useToast } from '../ui/ToastProvider';
import { supabase } from '../../lib/supabase';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReferenceSearchInput from '../repertorio/ReferenceSearchInput';
import {
  formatDateBR,
  formatLongDateBR,
  getRepertorioDeadline,
  getRepertorioProgress,
  getRepertorioUiState,
  isRepertorioTravado,
} from '../../lib/cliente/repertorio';
import { getYoutubeVideoId } from '../../lib/youtube/getYoutubeVideoId';
import { buildWhatsAppUrl } from '../../lib/whatsapp/support-config';

const REPERTORIO_DRAFT_LOCAL_STORAGE_KEY = 'repertorio_draft_local';
const CLIENT_HOME_DEBUG =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEBUG_CLIENT_HOME === '1';
const DISABLE_REPERTOIRE_ALERT_DEBUG =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DISABLE_REPERTOIRE_ALERT_DEBUG === '1';
const SUGGESTION_SONGS_CACHE_TTL_MS = 5 * 60 * 1000;
let suggestionSongsCache = {
  loadedAt: 0,
  songs: [],
  cacheKey: '',
};
const ANTESALA_DURATION_OPTIONS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1h' },
  { minutes: 120, label: '2h' },
  { minutes: 180, label: '3h' },
];
const ANTESALA_STYLE_OPTIONS = ['Gospel', 'Internacional', 'MPB', 'Sertanejo'];
const CUSTOM_EVENT_STYLE_OPTIONS = ['Gospel', 'Internacional', 'MPB', 'Sertanejo'];
const CUSTOM_EVENT_MAX_SONGS = 8;


function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function getDefaultAntesalaState() {
  return {
    estilo: '',
    generos: '',
    artistas: '',
    observacao: '',
    durationMinutes: 30,
    styleTags: [],
    preferredArtistsEnabled: false,
    referenceEnabled: false,
    references: [],
    requestQuoteOpened: false,
    quoteMinutes: null,
    quotePriceIncrement: 0,
    requestedByClient: false,
  };
}

function getDefaultCustomSongState() {
  return {
    song_name: '',
    reference_link: '',
    reference_title: '',
    reference_channel: '',
    reference_thumbnail: '',
    reference_video_id: '',
  };
}

function getNumericOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function isRepertoireFinalizedStatus(status, isLocked = false) {
  return isRepertorioTravado(status, isLocked);
}

function daysUntilEvent(dateValue) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  ).getTime();
  return Math.round((targetStart - nowStart) / 86400000);
}

function toReferenceMeta(item = {}) {
  const url = item?.referencia || item?.reference_link || '';
  const videoId =
    item?.referenceMeta?.videoId ||
    item?.reference_video_id ||
    getYoutubeVideoId(url);

  return {
    videoId: videoId || '',
    title: item?.referenceMeta?.title || item?.reference_title || '',
    channelTitle:
      item?.referenceMeta?.channelTitle || item?.reference_channel || '',
    thumbnail:
      item?.referenceMeta?.thumbnail || item?.reference_thumbnail || '',
  };
}

function normalizeSuggestionSection(section = '') {
  const normalized = String(section || '')
    .trim()
    .toLowerCase();

  if (normalized.startsWith('cerim')) return 'cerimonia';
  if (normalized.startsWith('sa')) return 'saida';
  if (normalized.startsWith('ante')) return 'antessala';
  if (normalized.startsWith('recep')) return 'receptivo';
  return 'cortejo';
}

function getSectionMomentLabel(section = '') {
  if (section === 'saida') return 'Saída';
  if (section === 'cerimonia') return 'Cerimônia';
  if (section === 'antessala') return 'Antessala';
  if (section === 'receptivo') return 'Receptivo';
  return 'Entrada';
}

function buildSuggestionPayload(song, payload = {}) {
  const normalizedSection = normalizeSuggestionSection(payload.section);
  const youtubeVideoId = String(song?.youtubeId || '').trim();
  const referenceLink = youtubeVideoId
    ? `https://www.youtube.com/watch?v=${youtubeVideoId}`
    : '';
  return {
    song_name: String(song?.title || '').trim(),
    reference_link: referenceLink,
    reference_title: String(song?.title || '').trim(),
    reference_channel: String(song?.artist || '').trim(),
    reference_thumbnail: String(song?.thumbnailUrl || '').trim(),
    reference_video_id: youtubeVideoId,
    notes: String(payload?.notes || '').trim(),
    who_enters: String(payload?.label || '').trim(),
    moment: getSectionMomentLabel(normalizedSection),
    section: normalizedSection,
  };
}

function normalizeCompareText(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function isSameSongSelection({
  baseLabel = '',
  baseSongName = '',
  baseVideoId = '',
  candidateLabel = '',
  candidateSongName = '',
  candidateVideoId = '',
}) {
  const sameLabel = normalizeCompareText(baseLabel) === normalizeCompareText(candidateLabel);
  const sameSongName =
    normalizeCompareText(baseSongName) === normalizeCompareText(candidateSongName);
  const normalizedBaseVideoId = String(baseVideoId || '').trim();
  const normalizedCandidateVideoId = String(candidateVideoId || '').trim();
  const sameVideoId =
    normalizedBaseVideoId &&
    normalizedCandidateVideoId &&
    normalizedBaseVideoId === normalizedCandidateVideoId;

  return sameLabel && (sameSongName || sameVideoId);
}

function hasFilledField(value) {
  return String(value || '').trim().length > 0;
}

function hasUsefulCustomSongItem(item = {}) {
  return hasFilledField(item?.song_name) || hasFilledField(item?.reference_link);
}

function hasUsefulCustomEventContent(initialState = {}) {
  const hasCustomStyles =
    Array.isArray(initialState.selected_styles) && initialState.selected_styles.length > 0;
  const hasCustomArtists = hasFilledField(initialState.preferred_artists);
  const hasCustomSongs =
    Array.isArray(initialState.custom_songs) &&
    initialState.custom_songs.some((item) => hasUsefulCustomSongItem(item));

  return hasCustomStyles || hasCustomArtists || hasCustomSongs;
}

function hasInitialRepertorioFromBackend(initialState = {}) {
  const hasCortejo =
    Array.isArray(initialState.cortejo) &&
    initialState.cortejo.some((item) => hasUsefulListItem(item));
  const hasCerimonia =
    Array.isArray(initialState.cerimonia) &&
    initialState.cerimonia.some((item) => hasUsefulListItem(item));
  const hasSaida =
    !!initialState.saida &&
    (hasFilledField(initialState.saida.musica) ||
      hasFilledField(initialState.saida.referencia) ||
      hasFilledField(initialState.saida.observacao));
  const hasAntessala =
    !!initialState.antessala &&
    (hasFilledField(initialState.antessala.estilo) ||
      hasFilledField(initialState.antessala.generos) ||
      hasFilledField(initialState.antessala.artistas) ||
      hasFilledField(initialState.antessala.observacao) ||
      Boolean(initialState.antessala.requestedByClient) ||
      hasFilledField(initialState.antessala.requestStatus) ||
      Number(initialState.antessala.quoteMinutes || 0) > 0 ||
      Number(initialState.antessala.quotePriceIncrement || 0) > 0 ||
      (Array.isArray(initialState.antessala.styleTags) &&
        initialState.antessala.styleTags.length > 0) ||
      (Array.isArray(initialState.antessala.references) &&
        initialState.antessala.references.length > 0));
  const hasReceptivo =
    !!initialState.receptivo &&
    (hasFilledField(initialState.receptivo.duracao) ||
      hasFilledField(initialState.receptivo.generos) ||
      hasFilledField(initialState.receptivo.artistas) ||
      hasFilledField(initialState.receptivo.observacao));
  const hasCustomEventContent = hasUsefulCustomEventContent(initialState);

  return (
    hasCortejo ||
    hasCerimonia ||
    hasSaida ||
    hasAntessala ||
    hasReceptivo ||
    hasCustomEventContent
  );
}

function buildRepertorioSnapshot({
  mode,
  querAntessala,
  temReceptivo,
  antessala,
  cortejo,
  cerimonia,
  saida,
  receptivo,
  desiredSongs,
  generalNotes,
  selected_styles,
  preferred_artists,
  custom_songs,
}) {
  return {
    mode,
    querAntessala,
    temReceptivo,
    antessala,
    cortejo,
    cerimonia,
    saida,
    receptivo,
    desiredSongs,
    generalNotes,
    selected_styles,
    preferred_artists,
    custom_songs,
  };
}

function buildUnifiedRepertorioItems({ cortejo = [], cerimonia = [], saida = {} }) {
  const toUnifiedSectionItems = ({ list, section, idPrefix, defaultMoment }) =>
    (Array.isArray(list) ? list : [])
      .filter((item) => hasUsefulMusicalItem(item))
      .map((item, index) => ({
        id: String(item?.id || `${idPrefix}-${index}`),
        section,
        moment: String(item?.label || defaultMoment).trim(),
        song_name: String(item?.musica || '').trim(),
        reference_link: String(item?.referencia || '').trim(),
        notes: String(item?.observacao || '').trim(),
        source: item?.source === 'suggestion' ? 'suggestion' : 'manual',
        reference_title: String(item?.reference_title || '').trim(),
        reference_channel: String(item?.reference_channel || '').trim(),
        reference_thumbnail: String(item?.reference_thumbnail || '').trim(),
        reference_video_id: String(item?.reference_video_id || '').trim(),
      }));

  const cortejoItems = toUnifiedSectionItems({
    list: cortejo,
    section: 'cortejo',
    idPrefix: 'cortejo',
    defaultMoment: 'Entrada',
  });

  const cerimoniaItems = toUnifiedSectionItems({
    list: cerimonia,
    section: 'cerimonia',
    idPrefix: 'cerimonia',
    defaultMoment: 'Cerimônia',
  });

  const saidaItems =
    saida?.musica || saida?.referencia || saida?.observacao
      ? [
          {
            id: String(saida?.id || 'saida-0'),
            section: 'saida',
            moment: 'Saída dos noivos',
            song_name: String(saida?.musica || '').trim(),
            reference_link: String(saida?.referencia || '').trim(),
            notes: String(saida?.observacao || '').trim(),
            source: saida?.source === 'suggestion' ? 'suggestion' : 'manual',
            reference_title: String(saida?.reference_title || '').trim(),
            reference_channel: String(saida?.reference_channel || '').trim(),
            reference_thumbnail: String(saida?.reference_thumbnail || '').trim(),
            reference_video_id: String(saida?.reference_video_id || '').trim(),
          },
        ]
      : [];

  return [...cortejoItems, ...cerimoniaItems, ...saidaItems];
}

function debugClientHome(...args) {
  if (!CLIENT_HOME_DEBUG) return;
  console.log(...args);
}

function getRepertorioDraftStorageKey(token = '') {
  const normalizedToken = String(token || '').trim() || 'sem_token';
  return `${REPERTORIO_DRAFT_LOCAL_STORAGE_KEY}:${normalizedToken}`;
}

function hasUsefulListItem(item = {}) {
  return Boolean(
    hasFilledField(item?.label) ||
      hasFilledField(item?.musica) ||
      hasFilledField(item?.referencia) ||
      hasFilledField(item?.observacao) ||
      hasFilledField(item?.reference_title) ||
      hasFilledField(item?.reference_channel) ||
      hasFilledField(item?.reference_thumbnail) ||
      hasFilledField(item?.reference_video_id)
  );
}

function hasUsefulMusicalItem(item = {}) {
  return Boolean(
    hasFilledField(item?.musica) ||
      hasFilledField(item?.referencia) ||
      hasFilledField(item?.observacao) ||
      hasFilledField(item?.reference_title) ||
      hasFilledField(item?.reference_channel) ||
      hasFilledField(item?.reference_thumbnail) ||
      hasFilledField(item?.reference_video_id)
  );
}

function filterUsefulMusicalItems(list = []) {
  return (Array.isArray(list) ? list : []).filter((item) => hasUsefulMusicalItem(item));
}

function pickTraceItem(list = []) {
  const item = filterUsefulMusicalItems(list)[0];
  if (!item) return null;
  return {
    label: String(item?.label || '').trim(),
    musica: String(item?.musica || '').trim(),
    referencia: String(item?.referencia || '').trim(),
    observacao: String(item?.observacao || '').trim(),
    reference_video_id: String(item?.reference_video_id || '').trim(),
  };
}

function pickTracePayloadItem(items = [], section = '') {
  const item = (Array.isArray(items) ? items : []).find(
    (entry) =>
      String(entry?.section || '').trim() === section &&
      hasUsefulMusicalItem({
        musica: entry?.song_name,
        referencia: entry?.reference_link,
        observacao: entry?.notes,
        reference_title: entry?.reference_title,
        reference_channel: entry?.reference_channel,
        reference_thumbnail: entry?.reference_thumbnail,
        reference_video_id: entry?.reference_video_id,
      })
  );
  if (!item) return null;
  return {
    section: String(item?.section || '').trim(),
    item_order: Number(item?.item_order ?? 0),
    label: String(item?.label || '').trim(),
    song_name: String(item?.song_name || '').trim(),
    reference_link: String(item?.reference_link || '').trim(),
    notes: String(item?.notes || '').trim(),
    reference_video_id: String(item?.reference_video_id || '').trim(),
  };
}

function hasUsefulAntesalaState(state = {}) {
  const hasCustomDuration =
    Number(state?.durationMinutes || 0) > 0 &&
    Number(state?.durationMinutes || 0) !== getDefaultAntesalaState().durationMinutes;
  return Boolean(
    hasFilledField(state?.estilo) ||
      hasFilledField(state?.generos) ||
      hasFilledField(state?.artistas) ||
      hasFilledField(state?.observacao) ||
      hasCustomDuration ||
      Number(state?.quoteMinutes || 0) > 0 ||
      Number(state?.quotePriceIncrement || 0) > 0 ||
      Boolean(state?.requestedByClient) ||
      hasFilledField(state?.requestStatus) ||
      (Array.isArray(state?.styleTags) && state.styleTags.length > 0) ||
      (Array.isArray(state?.references) &&
        state.references.some((item) => hasUsefulListItem(item)))
  );
}

function mergeNonEmptyFields(base = {}, draft = {}, fields = []) {
  return fields.reduce((acc, field) => {
    const draftValue = draft?.[field];
    const baseValue = base?.[field];
    acc[field] = hasFilledField(draftValue) ? draftValue : baseValue || '';
    return acc;
  }, {});
}

function mergeAntesalaState(baseState = {}, draftState = {}) {
  const base = {
    ...getDefaultAntesalaState(),
    ...(baseState || {}),
  };
  const draft = draftState && typeof draftState === 'object' ? draftState : {};
  const draftHasField = (field) =>
    Object.prototype.hasOwnProperty.call(draft, field);
  const merged = {
    ...base,
    ...mergeNonEmptyFields(base, draft, ['estilo', 'generos', 'artistas', 'observacao']),
    styleTags:
      Array.isArray(draft.styleTags) && draft.styleTags.length > 0
        ? draft.styleTags
        : Array.isArray(base.styleTags)
        ? base.styleTags
        : [],
    references:
      Array.isArray(draft.references) && draft.references.length > 0
        ? draft.references
        : Array.isArray(base.references)
        ? base.references
        : [],
    preferredArtistsEnabled:
      typeof draft.preferredArtistsEnabled === 'boolean'
        ? draft.preferredArtistsEnabled
        : Boolean(base.preferredArtistsEnabled),
    referenceEnabled:
      typeof draft.referenceEnabled === 'boolean'
        ? draft.referenceEnabled
        : Boolean(base.referenceEnabled),
    requestQuoteOpened:
      typeof draft.requestQuoteOpened === 'boolean'
        ? draft.requestQuoteOpened
        : Boolean(base.requestQuoteOpened),
    requestedByClient:
      typeof draft.requestedByClient === 'boolean'
        ? draft.requestedByClient
        : Boolean(base.requestedByClient),
    requestStatus: hasFilledField(draft.requestStatus)
      ? String(draft.requestStatus)
      : String(base.requestStatus || ''),
    quoteMinutes:
      draftHasField('quoteMinutes') && getNumericOrNull(draft.quoteMinutes) !== null
        ? getNumericOrNull(draft.quoteMinutes)
        : getNumericOrNull(base.quoteMinutes),
    quotePriceIncrement:
      draftHasField('quotePriceIncrement') && Number.isFinite(Number(draft.quotePriceIncrement))
        ? Number(draft.quotePriceIncrement)
        : Number(base.quotePriceIncrement || 0),
    durationMinutes:
      draftHasField('durationMinutes') && getNumericOrNull(draft.durationMinutes) !== null
        ? Number(draft.durationMinutes)
        : Number(base.durationMinutes || getDefaultAntesalaState().durationMinutes),
  };

  return merged;
}

function applySuggestionToRepertorioState(state, suggestionItem = {}) {
  const nextState = {
    ...state,
    cortejo: Array.isArray(state.cortejo) ? [...state.cortejo] : [],
    cerimonia: Array.isArray(state.cerimonia) ? [...state.cerimonia] : [],
    saida: { ...(state.saida || {}) },
    antessala: { ...(state.antessala || {}) },
    receptivo: { ...(state.receptivo || {}) },
  };

  const section = normalizeSuggestionSection(suggestionItem.section || suggestionItem.targetSection);
  const songName = String(suggestionItem.song_name || suggestionItem.title || '').trim();
  const referenceLink = String(suggestionItem.reference_link || '').trim();
  const notes = String(suggestionItem.notes || '').trim();
  const referenceMeta = toReferenceMeta({
    referencia: referenceLink,
    reference_title: suggestionItem.reference_title || suggestionItem.title || '',
    reference_channel: suggestionItem.reference_channel || suggestionItem.artist || '',
    reference_thumbnail: suggestionItem.reference_thumbnail || suggestionItem.thumbnailUrl || '',
    reference_video_id: suggestionItem.reference_video_id || '',
  });

  if (section === 'cortejo') {
    const label = String(suggestionItem.who_enters || suggestionItem.targetLabel || 'Entrada').trim();
    const alreadyExists = nextState.cortejo.some((item) => {
      return isSameSongSelection({
        baseLabel: item.label,
        baseSongName: item.musica,
        baseVideoId: item.reference_video_id,
        candidateLabel: label,
        candidateSongName: songName,
        candidateVideoId: referenceMeta.videoId,
      });
    });

    if (!alreadyExists) {
      nextState.cortejo.push({
        id: `cortejo-suggestion-${Date.now()}-${nextState.cortejo.length}`,
        label,
        musica: songName,
        referencia: referenceLink,
        observacao: notes,
        referenceMeta,
        reference_title: suggestionItem.reference_title || '',
        reference_channel: suggestionItem.reference_channel || '',
        reference_thumbnail: suggestionItem.reference_thumbnail || '',
        reference_video_id: suggestionItem.reference_video_id || '',
        source: 'suggestion',
      });
    }
  } else if (section === 'cerimonia') {
    const label = String(suggestionItem.who_enters || suggestionItem.targetLabel || suggestionItem.moment || 'Cerimônia').trim();
    const alreadyExists = nextState.cerimonia.some((item) => {
      return isSameSongSelection({
        baseLabel: item.label,
        baseSongName: item.musica,
        baseVideoId: item.reference_video_id,
        candidateLabel: label,
        candidateSongName: songName,
        candidateVideoId: referenceMeta.videoId,
      });
    });

    if (!alreadyExists) {
      nextState.cerimonia.push({
        id: `cerimonia-suggestion-${Date.now()}-${nextState.cerimonia.length}`,
        label,
        musica: songName,
        referencia: referenceLink,
        observacao: notes,
        referenceMeta,
        reference_title: suggestionItem.reference_title || '',
        reference_channel: suggestionItem.reference_channel || '',
        reference_thumbnail: suggestionItem.reference_thumbnail || '',
        reference_video_id: suggestionItem.reference_video_id || '',
        source: 'suggestion',
      });
    }
  } else if (section === 'saida') {
    nextState.saida = {
      ...nextState.saida,
      id: nextState.saida.id || 'saida-0',
      musica: songName || nextState.saida.musica || '',
      referencia: referenceLink || nextState.saida.referencia || '',
      observacao: notes || nextState.saida.observacao || '',
      referenceMeta: referenceMeta.videoId ? referenceMeta : nextState.saida.referenceMeta || null,
      reference_title:
        suggestionItem.reference_title || nextState.saida.reference_title || '',
      reference_channel:
        suggestionItem.reference_channel || nextState.saida.reference_channel || '',
      reference_thumbnail:
        suggestionItem.reference_thumbnail || nextState.saida.reference_thumbnail || '',
      reference_video_id:
        suggestionItem.reference_video_id || nextState.saida.reference_video_id || '',
      source: 'suggestion',
    };
  } else if (section === 'antessala') {
    nextState.querAntessala = true;
    nextState.antessala = {
      ...nextState.antessala,
      estilo: songName || nextState.antessala.estilo || '',
      observacao: notes || nextState.antessala.observacao || '',
    };
  } else if (section === 'receptivo') {
    nextState.temReceptivo = true;
    nextState.receptivo = {
      ...nextState.receptivo,
      generos: suggestionItem.genre || nextState.receptivo.generos || '',
      artistas: suggestionItem.artist || nextState.receptivo.artistas || '',
      observacao: notes || nextState.receptivo.observacao || '',
    };
  }

  return nextState;
}

function StatusPill({ label, tone = 'neutral' }) {
  const toneMap = {
    neutral: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accent: 'bg-violet-50 text-violet-700 border-violet-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em]',
        toneMap[tone]
      )}
    >
      {label}
    </span>
  );
}

function SectionCard({ children, className }) {
  return (
    <section
      className={classNames(
        'rounded-[24px] border border-[#eadfd6] bg-white p-5 shadow-[0_10px_30px_rgba(36,26,20,0.06)]',
        className
      )}
    >
      {children}
    </section>
  );
}

function RowInfo({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-[#faf7f3] px-4 py-3">
      <div className="pt-0.5 text-base">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
          {label}
        </div>
        <div className="mt-1 break-words text-[15px] font-bold text-[#241a14]">
          {value || '—'}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ title, status }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={classNames(
          'flex h-7 w-7 items-center justify-center rounded-full text-xs font-black',
          status === 'done' && 'bg-emerald-100 text-emerald-700',
          status === 'current' && 'bg-violet-100 text-violet-700',
          status === 'upcoming' && 'bg-zinc-100 text-zinc-400'
        )}
      >
        {status === 'done' ? '✓' : status === 'current' ? '●' : '○'}
      </div>
      <div
        className={classNames(
          'text-[14px] font-semibold',
          status === 'done' && 'text-[#241a14]',
          status === 'current' && 'text-violet-700',
          status === 'upcoming' && 'text-zinc-400'
        )}
      >
        {title}
      </div>
    </div>
  );
}


function markOnboardingFlowState(patch = {}) {
  if (!patch || typeof patch !== 'object') return Promise.resolve(null);
  return supabase.auth.getSession()
    .then(({ data }) => {
      const accessToken = data?.session?.access_token;
      return fetch('/api/onboarding/flow-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ flowState: patch }),
      });
    })
    .catch((error) => {
      console.warn('[CLIENT_PANEL_GUIDE][FLOW_STATE_ERROR]', error?.message || error);
      return null;
    });
}

function ClientPanelGuide({ data, activeTab, setActiveTab }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [guideStyle, setGuideStyle] = useState({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
  const [isClosed, setIsClosed] = useState(false);
  const targetFoundRef = useRef(false);
  const mobileGuideStyle = useMemo(() => ({
    left: '12px',
    right: '12px',
    bottom: 'calc(env(safe-area-inset-bottom) + 88px)',
    top: 'auto',
    width: 'auto',
    maxWidth: 'none',
    maxHeight: '42dvh',
    overflowY: 'auto',
    transform: 'none',
  }), []);

  const steps = useMemo(() => ([
    { key: 'open-repertorio', tab: 'inicio', title: 'Abrir repertório', text: 'Clique em Abrir repertório para começar.', target: 'onboarding-open-repertorio', waitFor: 'click' },
    { key: 'select-section', tab: 'repertorio', title: 'Escolha a etapa', text: 'Escolha uma etapa da cerimônia para adicionar uma música.', target: 'onboarding-section-cortejo', waitFor: 'either-click', altTarget: 'onboarding-section-cerimonia' },
    { key: 'add-song', tab: 'repertorio', title: 'Adicionar entrada', text: 'Crie uma nova entrada musical.', target: 'onboarding-add-song-cortejo', waitFor: 'either-click', altTarget: 'onboarding-add-song-cerimonia' },
    { key: 'song-name', tab: 'repertorio', title: 'Nome da música', text: 'Digite um nome fictício para a música. Exemplo: Marcha Nupcial.', target: 'onboarding-song-name', waitFor: 'input-required' },
    { key: 'song-reference', tab: 'repertorio', title: 'Campo referência', text: 'Cole uma referência do YouTube ou Spotify.', target: 'onboarding-song-reference', waitFor: 'input-required' },
    { key: 'save-song', tab: 'repertorio', title: 'Salvar entrada', text: 'Agora salve a música adicionada.', target: 'onboarding-save-repertoire', waitFor: 'click' },
    { key: 'submit-repertoire', tab: 'repertorio', title: 'Finalizar repertório', text: 'Envie o repertório para concluir a simulação do cliente.', target: 'onboarding-submit-repertoire', waitFor: 'click' },
    { key: 'final', tab: 'inicio', title: 'Tour concluído', text: 'Fluxo concluído. Volte ao painel admin para continuar.', target: 'client-panel-root', waitFor: 'manual' },
  ]), []);

  const currentStep = steps[stepIndex] || steps[0];

  const openGuideTab = useCallback((nextTab) => {
    if (!nextTab) return;
    console.info('[CLIENT_PANEL_TAB_CLICK]', nextTab);
    setActiveTab(nextTab);
  }, [setActiveTab]);

  useEffect(() => {
    if (!currentStep?.tab || currentStep.key === 'final') return;
    if (activeTab !== currentStep.tab) openGuideTab(currentStep.tab);
  }, [activeTab, currentStep, openGuideTab]);
  const stepReady = !currentStep?.tab ? false : activeTab === currentStep.tab;

  useEffect(() => {
    void markOnboardingFlowState({ client_panel_opened: true });
  }, []);

  useEffect(() => {
    if (isClosed) return undefined;
    const isMobileViewport = () => typeof window !== 'undefined' && window.innerWidth < 768;
    const scheduleGuideStyle = (nextStyle) => {
      if (typeof window === 'undefined') return;
      window.requestAnimationFrame(() => setGuideStyle(nextStyle));
    };
    if (!currentStep?.target || typeof document === 'undefined') {
      targetFoundRef.current = false;
      scheduleGuideStyle(isMobileViewport() ? mobileGuideStyle : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
      return undefined;
    }
    const getTarget = () => document.querySelector(`[data-onboarding-tour="${currentStep.target}"]`);
    let target = getTarget();
    if (!target) {
      targetFoundRef.current = false;
      scheduleGuideStyle(isMobileViewport() ? mobileGuideStyle : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
      return undefined;
    }
    targetFoundRef.current = true;
    const spotlightClass = 'relative z-[9850] rounded-[22px] ring-4 ring-violet-400/80 animate-pulse shadow-[0_0_0_9999px_rgba(15,23,42,0.60),0_20px_60px_rgba(124,58,237,0.30)]';
    const classes = spotlightClass.split(' ');
    const applyClasses = () => {
      target = getTarget();
      if (target) target.classList.add(...classes);
    };
    const clearClasses = () => target?.classList.remove(...classes);
    applyClasses();
    target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    const placeGuide = () => {
      target = getTarget();
      if (!target) {
        targetFoundRef.current = false;
        setGuideStyle(isMobileViewport() ? mobileGuideStyle : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
        return;
      }
      targetFoundRef.current = true;
      const rect = target.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 16;
      if (vw < 768) {
        setGuideStyle(mobileGuideStyle);
        return;
      }
      const cw = Math.min(420, vw - margin * 2);
      const ch = 210;
      const placeRight = { top: Math.max(margin, Math.min(vh - ch - margin, rect.top)), left: Math.min(vw - cw - margin, rect.right + 12) };
      const placeLeft = { top: Math.max(margin, Math.min(vh - ch - margin, rect.top)), left: Math.max(margin, rect.left - cw - 12) };
      const placeTop = { top: Math.max(margin, rect.top - ch - 12), left: Math.max(margin, Math.min(vw - cw - margin, rect.left)) };
      const placeBottom = { top: Math.min(vh - ch - margin, rect.bottom + 12), left: Math.max(margin, Math.min(vw - cw - margin, rect.left)) };
      const pick = rect.left < vw / 2 ? placeRight : rect.right > vw / 2 ? placeLeft : rect.top > vh / 2 ? placeTop : placeBottom;
      setGuideStyle({ top: `${pick.top}px`, left: `${pick.left}px`, transform: 'none' });
    };
    placeGuide();
    window.addEventListener('resize', placeGuide);
    window.addEventListener('scroll', placeGuide, true);
    const observer = new MutationObserver(() => {
      targetFoundRef.current = false;
      clearClasses();
      applyClasses();
      placeGuide();
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    return () => {
      targetFoundRef.current = false;
      clearClasses();
      window.removeEventListener('resize', placeGuide);
      window.removeEventListener('scroll', placeGuide, true);
      observer.disconnect();
    };
  }, [currentStep, isClosed, mobileGuideStyle]);

  useEffect(() => {
    if (!stepReady || !currentStep?.target) return;
    const target = document.querySelector(`[data-onboarding-tour="${currentStep.target}"]`);
    const altTarget = currentStep.altTarget ? document.querySelector(`[data-onboarding-tour="${currentStep.altTarget}"]`) : null;
    const advance = () => setStepIndex((index) => Math.min(index + 1, steps.length - 1));
    if (currentStep.waitFor === 'click') {
      target?.addEventListener('click', advance, { once: true });
      return () => target?.removeEventListener('click', advance);
    }
    if (currentStep.waitFor === 'either-click') {
      target?.addEventListener('click', advance, { once: true });
      altTarget?.addEventListener('click', advance, { once: true });
      return () => {
        target?.removeEventListener('click', advance);
        altTarget?.removeEventListener('click', advance);
      };
    }
    if (currentStep.waitFor === 'input-required') {
      const onInput = (event) => {
        const value = String(event?.target?.value || '').toLowerCase();
        if (value.trim().length > 0) advance();
      };
      target?.addEventListener('input', onInput);
      return () => target?.removeEventListener('input', onInput);
    }
    return undefined;
  }, [currentStep, stepReady, steps.length]);


  useEffect(() => {
    console.info('[CLIENT_PANEL_GUIDE_RENDER]', {
      guideEnabled: true,
      guideReady: true,
      currentStep: currentStep?.key || null,
      hasCard: Boolean(currentStep),
      targetFound: targetFoundRef.current,
      activeTab,
    });
  }, [activeTab, currentStep, guideStyle]);

  const isFinal = currentStep.key === 'final';
  const returnTo = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('returnTo')
    : '';
  const eventId = data?.eventId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('eventId') : '');

  function closeGuide() {
    if (typeof window !== 'undefined') {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('guide');
      nextUrl.searchParams.delete('onboarding');
      window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }
    setIsClosed(true);
  }

  async function handleNext() {
    try {
      if (isFinal) {
        await markOnboardingFlowState({ client_panel_tour_completed: true, returned_to_admin: true });
        const target = returnTo
          ? `${returnTo}${returnTo.includes('?') ? '&' : '?'}guide=admin-repertoire${eventId ? `&eventId=${encodeURIComponent(eventId)}` : ''}`
          : eventId
            ? `/eventos/${encodeURIComponent(eventId)}?guide=admin-repertoire`
            : '/eventos?guide=admin-repertoire';
        window.location.href = target;
        return;
      }
      setStepIndex((index) => Math.min(index + 1, steps.length - 1));
    } catch (error) {
      console.error('[CLIENT_PANEL_GUIDE][NEXT_ERROR]', error);
    }
  }

  return (
    <>
      {!isClosed ? <div className="pointer-events-none fixed inset-0 z-[9800] bg-slate-950/25" /> : null}
      {!isClosed ? <aside style={guideStyle} className="pointer-events-auto fixed z-[9900] mx-auto w-[calc(100vw-2rem)] max-w-md rounded-[28px] border border-violet-200 bg-white/95 p-4 text-[#241a14] shadow-2xl shadow-violet-950/20 backdrop-blur md:w-full">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.20em] text-violet-600">Tour do painel do cliente</p>
            <h2 className="mt-1 text-xl font-black">{currentStep.title}</h2>
          </div>
          <button type="button" onClick={closeGuide} className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-bold text-zinc-500">×</button>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#6f5d51]">{currentStep.text}</p>
        <div className="mt-4 flex items-center justify-between text-xs font-black text-zinc-500">
          <span>Etapa {Math.min(stepIndex + 1, steps.length)} de {steps.length}</span>
          <span>{currentStep.target}</span>
        </div>
        <button type="button" onClick={handleNext} className="mt-4 w-full rounded-[18px] bg-violet-600 px-4 py-3 text-sm font-black text-white">
            {isFinal ? 'Voltar ao painel admin' : 'Próximo passo'}
          </button>
      </aside> : null}
    </>
  );
}

function ContratoTab({ data }) {
  const pdfUrl = data?.contratoPdfUrl || '';
  const docUrl = data?.contratoDocUrl || '';
  return (
    <div data-onboarding-tour="client-tab-contrato" className="space-y-4">
      <SectionCard>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">Contrato/PDF</div>
        <div className="mt-2 text-[20px] font-black text-[#241a14]">Contrato assinado</div>
        <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
          Revise aqui o contrato assinado e acesse o PDF entregue ao cliente.
        </div>
        {data?.contratoAssinadoEm ? (
          <div className="mt-3 rounded-[14px] bg-emerald-50 px-3 py-2 text-[12px] font-black text-emerald-700">Assinado em {formatDateBR(data.contratoAssinadoEm)}</div>
        ) : null}
        <div className="mt-5 flex flex-col gap-3">
          {pdfUrl ? <a href={pdfUrl} target="_blank" rel="noreferrer" className="rounded-[18px] bg-violet-600 px-4 py-3 text-center text-[14px] font-black text-white">Abrir PDF assinado</a> : <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-bold text-amber-800">PDF ainda não disponível.</div>}
          {docUrl ? <a href={docUrl} target="_blank" rel="noreferrer" className="rounded-[18px] border border-[#eadfd6] bg-[#faf7f3] px-4 py-3 text-center text-[14px] font-black text-[#241a14]">Abrir documento</a> : null}
        </div>
      </SectionCard>
    </div>
  );
}

function FooterNav({ activeTab, setActiveTab, hideSuggestions = false }) {
  const items = [
    { key: 'inicio', icon: '🏠', label: 'Início' },
    { key: 'repertorio', icon: '🎼', label: 'Repertório' },
    { key: 'financeiro', icon: '💰', label: 'Financeiro' },
    { key: 'contrato', icon: '📄', label: 'Contrato' },
  ];
  if (!hideSuggestions) {
    items.splice(2, 0, { key: 'sugestoes', icon: '✨', label: 'Sugestões' });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#eadfd6] bg-[rgba(248,244,239,0.94)] px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-10px_30px_rgba(36,26,20,0.06)] backdrop-blur-xl">
      <div
        className={classNames(
          'mx-auto grid w-full max-w-[520px] gap-2',
          hideSuggestions ? 'grid-cols-4' : 'grid-cols-5'
        )}
      >
        {items.map((item) => {
          const active = activeTab === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                console.info('[CLIENT_PANEL_TAB_CLICK]', item.key);
                setActiveTab(item.key);
              }}
              data-onboarding-tour={`client-tab-${item.key}`}
              className={classNames(
                'flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-center transition',
                active
  ? 'bg-violet-100 text-violet-700 shadow-[0_6px_18px_rgba(124,58,237,0.10)]'
  : 'text-[#9b8576]'
              )}
            >
              <span className="text-[20px] leading-none">{item.icon}</span>
              <span className="mt-1 text-[11px] font-black">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function RepertorioCard({ data, isClientPanelOnboarding = false }) {
  const uiState = getRepertorioUiState({
    status: data.repertorio.status,
    eventDate: data.dataEvento,
    liberadoParaEdicao: data.repertorio.liberadoParaEdicao,
    isLocked: data.repertorio.isLocked,
  });

  const progress = getRepertorioProgress({
    status: data.repertorio.status,
    etapasPreenchidas: data.repertorio.etapasPreenchidas,
    totalEtapas: data.repertorio.totalEtapas,
    isLocked: data.repertorio.isLocked,
  });

  const deadline = getRepertorioDeadline(data.dataEvento);
  const [lateModalDismissed, setLateModalDismissed] = useState(false);
  const lateModalStorageKey = `cliente_repertorio_late_modal_${data.token}`;
  const hasLateModalBeenShown =
    typeof window !== 'undefined' && sessionStorage.getItem(lateModalStorageKey) === '1';
  const showLateModal =
    !isClientPanelOnboarding &&
    uiState === 'atrasado' &&
    !lateModalDismissed &&
    !hasLateModalBeenShown;

  useEffect(() => {
    if (!showLateModal || typeof window === 'undefined') return;
    sessionStorage.setItem(lateModalStorageKey, '1');
  }, [showLateModal, lateModalStorageKey]);

  const stateMeta = useMemo(() => {
    const isAwaitingReview =
      String(data.repertorio.status || '').toUpperCase() === 'AGUARDANDO_REVISAO';

    switch (uiState) {
      case 'rascunho':
        return {
          pill: <StatusPill label="Em rascunho" tone="warning" />,
          title: 'Seu repertório já foi iniciado.',
          text: 'Você pode continuar de onde parou ou finalizar o envio quando estiver tudo certo.',
          deadlineText: deadline
            ? `Prazo para envio: ${formatDateBR(deadline)}`
            : 'Defina seu repertório com antecedência.',
          primaryLabel: 'Continuar preenchimento',
          primaryHref: data.repertorio.linkPreenchimento || '#',
          secondaryLabel: 'Finalizar envio',
          secondaryHref: data.repertorio.linkPreenchimento || '#',
          note: 'Após o envio, o repertório ficará travado para edição.',
        };
      case 'enviado':
        return {
          pill: (
            <StatusPill
              label={isAwaitingReview ? 'Aguardando revisão' : 'Enviado'}
              tone={isAwaitingReview ? 'warning' : 'success'}
            />
          ),
          title: isAwaitingReview
            ? 'Revisão solicitada, aguardando liberação.'
            : 'Seu repertório foi enviado com sucesso.',
          text: isAwaitingReview
            ? 'Seu repertório permanece bloqueado até que a equipe libere a edição no painel admin.'
            : 'A equipe Harmonics já recebeu suas escolhas e seguirá com o alinhamento do evento.',
          deadlineText: data.repertorio.enviadoEm
            ? `Enviado em ${formatDateBR(data.repertorio.enviadoEm)}`
            : 'Repertório finalizado.',
          primaryLabel: data.repertorio.podeSolicitarCorrecao
            ? 'Solicitar correção'
            : 'Ver repertório enviado',
          primaryHref: data.repertorio.linkVisualizacao || data.repertorio.linkPreenchimento || '#',
          secondaryLabel: data.repertorio.linkVisualizacao ? 'Visualizar repertório' : '',
          secondaryHref: data.repertorio.linkVisualizacao || '#',
          note: isAwaitingReview
            ? 'Enquanto aguarda liberação, os campos continuam bloqueados para edição.'
            : 'Após o envio final, alterações só podem ser feitas se a equipe liberar correção.',
        };
      case 'liberado':
        return {
          pill: <StatusPill label="Liberado para ajuste" tone="accent" />,
          title: 'Seu repertório foi liberado para correção.',
          text: 'Faça os ajustes solicitados e envie novamente quando estiver tudo certo.',
          deadlineText: deadline
            ? `Prazo operacional: ${formatDateBR(deadline)}`
            : 'Faça os ajustes o quanto antes.',
          primaryLabel: 'Editar repertório',
          primaryHref: data.repertorio.linkPreenchimento || '#',
          secondaryLabel: 'Enviar novamente',
          secondaryHref: data.repertorio.linkPreenchimento || '#',
          note: 'Depois do novo envio, o repertório volta a ficar travado.',
        };
      case 'atrasado':
        return {
          pill: <StatusPill label="Atrasado" tone="danger" />,
          title: 'O prazo de envio do repertório já foi atingido.',
          text: 'Envie o quanto antes para mantermos tudo alinhado para o seu evento.',
          deadlineText: deadline
            ? `Prazo encerrado em ${formatDateBR(deadline)}`
            : 'Prazo encerrado.',
          primaryLabel:
            String(data.repertorio.status || '').toUpperCase() === 'RASCUNHO'
              ? 'Continuar preenchimento'
              : 'Começar repertório',
          primaryHref: data.repertorio.linkPreenchimento || '#',
          secondaryLabel:
            String(data.repertorio.status || '').toUpperCase() === 'RASCUNHO'
              ? 'Finalizar envio'
              : '',
          secondaryHref: data.repertorio.linkPreenchimento || '#',
          note: 'Caso precise, salve em rascunho e finalize assim que concluir.',
        };
      case 'nao_iniciado':
      default:
        return {
          pill: <StatusPill label="Não iniciado" tone="neutral" />,
          title: 'Você ainda não enviou seu repertório.',
          text: 'Preencha aos poucos e finalize quando estiver tudo certo.',
          deadlineText: deadline
            ? `Prazo para envio: ${formatDateBR(deadline)}`
            : 'Defina seu repertório com antecedência.',
          primaryLabel: 'Começar repertório',
          primaryHref: data.repertorio.linkPreenchimento || '#',
          secondaryLabel: '',
          secondaryHref: '#',
          note: 'Você pode salvar como rascunho antes do envio final.',
        };
    }
  }, [uiState, data.repertorio, deadline]);

  return (
    <>
      <SectionCard className="border-violet-100 bg-[linear-gradient(180deg,#ffffff_0%,#fcfbff_100%)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[20px] font-black text-[#241a14]">Repertório do evento</div>
            <div className="mt-1 text-[14px] font-medium text-[#7e6d61]">
              Monte a trilha sonora da sua cerimônia
            </div>
          </div>
          <div className="shrink-0">{stateMeta.pill}</div>
        </div>

        <div className="mt-5 rounded-[20px] bg-[#faf7f3] px-4 py-4">
          <div className="text-[16px] font-black text-[#241a14]">{stateMeta.title}</div>
          <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">{stateMeta.text}</div>
        </div>

        <div
          className={classNames(
            'mt-4 rounded-[18px] border px-4 py-3',
            uiState === 'atrasado'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-[#eadfd6] bg-white text-[#7e6d61]'
          )}
        >
          <div className="flex items-center gap-2 text-[13px] font-bold">
            <span>📅</span>
            <span>{stateMeta.deadlineText}</span>
          </div>
        </div>

        {(uiState === 'rascunho' || uiState === 'atrasado') && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
              <span>Progresso do preenchimento</span>
              <span>
                {progress.preenchidas} de {progress.total}
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-[#eee6de]">
              <div
                className={classNames(
                  'h-full rounded-full transition-all duration-500',
                  uiState === 'atrasado'
                    ? 'bg-[linear-gradient(90deg,#ef4444_0%,#f97316_100%)]'
                    : 'bg-[linear-gradient(90deg,#7c3aed_0%,#a78bfa_100%)]'
                )}
                style={{ width: `${progress.percentual}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-5 space-y-3">
          <a
            href={stateMeta.primaryHref}
            className={classNames(
              'flex w-full items-center justify-center rounded-[18px] px-4 py-4 text-center text-[15px] font-black shadow-sm transition active:scale-[0.99]',
              uiState === 'atrasado'
                ? 'bg-[linear-gradient(135deg,#dc2626_0%,#ef4444_100%)] text-white'
                : 'bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] text-white'
            )}
          >
            {stateMeta.primaryLabel}
          </a>

          {stateMeta.secondaryLabel ? (
            <a
              href={stateMeta.secondaryHref}
              className="flex w-full items-center justify-center rounded-[18px] border border-[#e6d8ff] bg-white px-4 py-4 text-center text-[15px] font-black text-violet-700 transition active:scale-[0.99]"
            >
              {stateMeta.secondaryLabel}
            </a>
          ) : null}
        </div>

        <div className="mt-4 text-[13px] leading-5 text-[#8e7d71]">{stateMeta.note}</div>
      </SectionCard>

      {showLateModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,14,12,0.35)] p-4 sm:items-center">
          <div className="w-full max-w-md rounded-[28px] border border-red-100 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.20)]">
            <div className="text-2xl">⚠️</div>
            <div className="mt-3 text-[20px] font-black text-[#241a14]">Atenção ao repertório</div>
            <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
              O prazo de envio já foi atingido. Envie o quanto antes para mantermos tudo
              alinhado para o seu evento.
            </div>

            <div className="mt-5 space-y-3">
              <a
                href={data.repertorio.linkPreenchimento || '#'}
                className="flex w-full items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] px-4 py-4 text-center text-[15px] font-black text-white"
              >
                Enviar agora
              </a>

              <button
                type="button"
                onClick={() => setLateModalDismissed(true)}
                className="flex w-full items-center justify-center rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4 text-center text-[15px] font-black text-[#241a14]"
              >
                Depois
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <div className="text-[18px] font-black text-[#241a14]">{title}</div>
        {subtitle ? (
          <div className="mt-1 text-[13px] leading-5 text-[#7a6a5e]">{subtitle}</div>
        ) : null}
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
function TabHero({ badge, title, text, children }) {
  return (
    <SectionCard className="bg-[linear-gradient(180deg,#ffffff_0%,#fcfbff_100%)]">
      {badge ? (
        <div className="inline-flex rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
          {badge}
        </div>
      ) : null}

      <div className="mt-4 text-[22px] font-black text-[#241a14]">{title}</div>

      {text ? (
        <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">{text}</div>
      ) : null}

      {children ? <div className="mt-5">{children}</div> : null}
    </SectionCard>
  );
}

function formatClientRepertoireStatusLabel(status) {
  const normalized = String(status || '')
    .trim()
    .toUpperCase();

  if (normalized === 'AGUARDANDO_REVISAO') return 'Aguardando revisão';
  if (normalized === 'RASCUNHO') return 'Rascunho';
  if (normalized === 'ENVIADO' || normalized === 'ENVIADO_TRANCADO') return 'Enviado';
  if (normalized === 'FINALIZADO' || normalized === 'CONCLUIDO') return 'Finalizado';
  if (normalized === 'LIBERADO' || normalized === 'EM_EDICAO') return 'Liberado para ajustes';
  if (!normalized) return 'Aguardando';

  return normalized
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}


function InicioTab({ data, setActiveTab, selectedSongs }) {
  const supportWhatsAppUrl = buildWhatsAppUrl(
    data?.suporteWhatsapp,
    data?.suporteWhatsappMensagem || ''
  );
  const hasSupportWhatsApp = supportWhatsAppUrl !== '#';

  return (
    <div className="space-y-4">
        <TabHero
  badge="Visão geral"
  title="Tudo do seu evento em um só lugar"
  text="Acompanhe repertório, sugestões, financeiro e informações importantes de forma organizada."
/>
      <SectionCard>
        <div className="mb-4 text-[18px] font-black text-[#241a14]">Resumo do evento</div>

        <div className="grid grid-cols-1 gap-3">
          <RowInfo icon="📅" label="Data" value={formatDateBR(data.dataEvento)} />
          <RowInfo icon="🕒" label="Horário" value={data.horarioEvento || '—'} />
          <RowInfo icon="📍" label="Local" value={data.localEvento || '—'} />
          <RowInfo icon="🎻" label="Formação" value={data.formacao || '—'} />
          <RowInfo icon="🎶" label="Instrumentos" value={data.instrumentos || '—'} />
          {data.receptivoResumo ? (
            <RowInfo icon="🎤" label="Receptivo" value={data.receptivoResumo.replace(/^Receptivo:\s*/i, '')} />
          ) : null}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SectionCard>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
            Repertório
          </div>
          <div className="mt-2 min-w-0 whitespace-normal break-words text-[18px] font-black leading-tight text-[#241a14]">
            {formatClientRepertoireStatusLabel(data.repertorio.status)}
          </div>
          <div className="mt-2 whitespace-normal break-words text-[14px] text-[#6f5d51]">
            Acompanhe o preenchimento e finalize quando estiver tudo certo.
          </div>
          {selectedSongs.length > 0 ? (
  <div className="mt-3 whitespace-normal break-words rounded-[14px] bg-violet-50 px-3 py-2 text-[12px] font-black text-violet-700">
    {selectedSongs.length} música(s) já vieram da aba Sugestões
  </div>
) : null}
          <button
            type="button"
            onClick={() => setActiveTab('repertorio')}
            data-onboarding-tour="onboarding-open-repertorio"
            className="mt-4 w-full min-w-0 rounded-[18px] border border-[#e6d8ff] bg-violet-50 px-4 py-3 text-[14px] font-black text-violet-700"
          >
            Abrir repertório
          </button>
        </SectionCard>

        <SectionCard>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
            Financeiro
          </div>
          <div className="mt-2 text-[18px] font-black text-[#241a14]">Acompanhar pagamentos</div>
          <div className="mt-2 text-[14px] text-[#6f5d51]">
            Consulte saldo, comprovantes e andamento financeiro do evento.
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('financeiro')}
            className="mt-4 w-full rounded-[18px] border border-[#eadfd6] bg-[#faf7f3] px-4 py-3 text-[14px] font-black text-[#241a14]"
          >
            Abrir financeiro
          </button>
        </SectionCard>
      </div>

      <SectionCard>
        <div className="mb-4 text-[18px] font-black text-[#241a14]">Andamento do evento</div>

        <div className="space-y-3">
          <TimelineItem title="Contrato assinado" status="done" />
          <TimelineItem title="Evento confirmado" status="done" />
          <TimelineItem
            title={
              isRepertorioTravado(data.repertorio.status, data.repertorio.isLocked)
                ? 'Repertório concluído'
                : 'Repertório em andamento'
            }
            status="current"
          />
          <TimelineItem title="Ajustes finais" status="upcoming" />
          <TimelineItem title="Dia do evento" status="upcoming" />
        </div>
      </SectionCard>

      <SectionCard>
        <div className="mb-4 text-[18px] font-black text-[#241a14]">Informações importantes</div>

        <div className="space-y-3">
          <RowInfo icon="⏰" label="Chegada da equipe" value={data.horarioChegada || 'A definir'} />
          <RowInfo
            icon="📌"
            label="Observações"
            value={data.observacoes || 'Nenhuma observação no momento.'}
          />
        </div>
      </SectionCard>

      <SectionCard className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fff9_100%)]">
        <div className="text-[18px] font-black text-[#241a14]">Precisa de ajuda?</div>
        <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
          Fale com nossa equipe pelo WhatsApp para qualquer dúvida ou alinhamento.
        </div>

        <a
          href={supportWhatsAppUrl}
          target={hasSupportWhatsApp ? '_blank' : undefined}
          rel={hasSupportWhatsApp ? 'noreferrer' : undefined}
          aria-disabled={!hasSupportWhatsApp}
          onClick={(event) => {
            if (!hasSupportWhatsApp) event.preventDefault();
          }}
          className={classNames(
            'mt-5 flex w-full items-center justify-center rounded-[18px] px-4 py-4 text-center text-[15px] font-black',
            hasSupportWhatsApp
              ? 'bg-[linear-gradient(135deg,#16a34a_0%,#22c55e_100%)] text-white shadow-[0_10px_24px_rgba(34,197,94,0.22)]'
              : 'cursor-not-allowed bg-zinc-200 text-zinc-500'
          )}
        >
          Falar no WhatsApp
        </a>
      </SectionCard>
    </div>
  );
}
function InputField({ label, placeholder, value, onChange, textarea = false, rows = 3, disabled = false, inputProps = {} }) {
  if (textarea) {
    return (
      <div className="space-y-2">
        <label className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
          {label}
        </label>
        <textarea
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="min-h-[100px] w-full rounded-[16px] border border-[#eadfd6] bg-white px-4 py-4 text-[15px] font-semibold text-[#241a14] outline-none disabled:cursor-not-allowed disabled:bg-[#f4efea] disabled:text-[#a59588]"
          {...inputProps}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
        {label}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full rounded-[16px] border border-[#eadfd6] bg-white px-4 py-4 text-[15px] font-semibold text-[#241a14] outline-none disabled:cursor-not-allowed disabled:bg-[#f4efea] disabled:text-[#a59588]"
        {...inputProps}
      />
    </div>
  );
}

function LockedSectionCard({ title, text }) {
  return (
    <SectionCard className="border-dashed bg-[#fbf8f4]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-200 text-lg">
          🔒
        </div>
        <div>
          <div className="text-[17px] font-black text-[#241a14]">{title}</div>
          <div className="mt-2 text-[14px] leading-6 text-[#7a6a5e]">{text}</div>
        </div>
      </div>
    </SectionCard>
  );
}

function QuickOrderPill({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[#eadfd6] bg-white px-4 py-2 text-[12px] font-black text-[#6f5d51] transition active:scale-[0.97]"
    >
      {label}
    </button>
  );
}

function EntryCard({
  index,
  title,
  subtitle,
  item,
  onChange,
  onMoveUp,
  onMoveDown,
  onMoveLeft,
  onMoveRight,
  moveLeftTitle = 'Mover para anterior',
  moveRightTitle = 'Mover para próximo',
  onRemove,
  disabled = false,
}) {
  return (
    <div className="rounded-[22px] border border-[#eadfd6] bg-white p-4 shadow-[0_8px_24px_rgba(36,26,20,0.05)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
            {title} {index + 1}
          </div>
          {subtitle ? (
            <div className="mt-2 text-[13px] font-semibold text-[#8b786b]">{subtitle}</div>
          ) : null}
        </div>

        {!disabled ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onMoveUp}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#eadfd6] bg-[#faf7f3] text-sm"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#eadfd6] bg-[#faf7f3] text-sm"
            >
              ↓
            </button>
            {typeof onMoveLeft === 'function' ? (
              <button
                type="button"
                onClick={onMoveLeft}
                title={moveLeftTitle}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#eadfd6] bg-[#faf7f3] text-sm"
              >
                ←
              </button>
            ) : null}
            {typeof onMoveRight === 'function' ? (
              <button
                type="button"
                onClick={onMoveRight}
                title={moveRightTitle}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#eadfd6] bg-[#faf7f3] text-sm"
              >
                →
              </button>
            ) : null}
            <button
              type="button"
              onClick={onRemove}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-sm text-red-600"
            >
              ✕
            </button>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <InputField
          label="Quem entra / momento"
          placeholder="Ex: Padrinhos, Noiva, Alianças..."
          value={item.label}
          onChange={(e) => onChange({ ...item, label: e.target.value })}
          disabled={disabled}
        />
        <InputField
          label="Música"
          placeholder="Nome da música"
          value={item.musica}
          onChange={(e) => onChange({ ...item, musica: e.target.value })}
          inputProps={index === 0 ? { 'data-onboarding-tour': 'onboarding-song-name' } : {}}
          disabled={disabled}
        />
        <ReferenceSearchInput
          searchValue={item.musica || ''}
          referenceValue={item.referencia || ''}
          selectedReference={item.referenceMeta || null}
          disabled={disabled}
          manualInputProps={index === 0 ? { 'data-onboarding-tour': 'onboarding-song-reference' } : {}}
          onSearchValueChange={(value) => onChange({ ...item, musica: value })}
          onReferenceValueChange={(e) =>
            onChange({
              ...item,
              referencia: e.target.value,
              referenceMeta: null,
              reference_title: '',
              reference_channel: '',
              reference_thumbnail: '',
              reference_video_id: '',
            })
          }
          onSelectResult={(result) =>
            onChange({
              ...item,
              referencia: result.url,
              musica: result.title || item.musica || '',
              reference_title: result.title || '',
              reference_channel: result.channelTitle || '',
              reference_thumbnail: result.thumbnail || '',
              reference_video_id: result.videoId || '',
              referenceMeta: {
                videoId: result.videoId || '',
                title: result.title || '',
                channelTitle: result.channelTitle || '',
                thumbnail: result.thumbnail || '',
              },
            })
          }
          onClearReference={() =>
            onChange({
              ...item,
              referencia: '',
              referenceMeta: null,
              reference_title: '',
              reference_channel: '',
              reference_thumbnail: '',
              reference_video_id: '',
            })
          }
        />
        <InputField
          label="Observações"
          placeholder="Continuação da anterior, só instrumental, versão específica..."
          value={item.observacao}
          onChange={(e) => onChange({ ...item, observacao: e.target.value })}
          textarea
          rows={2}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function MiniStep({
  step,
  title,
  active,
  done,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        'min-w-[110px] rounded-[18px] border px-4 py-3 text-left transition',
        active && 'border-violet-200 bg-violet-50',
        done && !active && 'border-emerald-200 bg-emerald-50',
        !active && !done && 'border-[#eadfd6] bg-white',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
        Etapa {step}
      </div>
      <div className="mt-1 text-[13px] font-black text-[#241a14]">{title}</div>
    </button>
  );
}

function RepertorioTab({
  data,
  selectedSongs,
  setSelectedSongs,
  onSaved,
  onReviewRequested,
  persistedState,
  onPersistState,
  isClientPanelOnboarding = false,
}) {
  const suppressOperationalModals = isClientPanelOnboarding;
  const { showToast } = useToast();
  const statusNormalizado = String(data.repertorio.status || '').toUpperCase();
  const isWedding =
    data?.repertorio?.isWedding !== false &&
    data?.repertorio?.initialState?.mode !== 'custom';
  const isCustomEvent = !isWedding;
  const travado = isRepertorioTravado(statusNormalizado, data.repertorio.isLocked);
  void suppressOperationalModals;
  const shouldShowFinalState = travado;
  const aguardandoRevisao = statusNormalizado === 'AGUARDANDO_REVISAO';
  const receptivoContratadoHoras = Number(data?.repertorio?.receptivoContratadoHoras || 0);
  const receptivoDuracaoTravada = Boolean(data?.repertorio?.receptivoDuracaoTravada);
  const receptivoDuracaoLabel = `${receptivoContratadoHoras || 1}h`;
  const antesalaSupportWhatsAppUrl = buildWhatsAppUrl(
    data?.suporteWhatsapp,
    'Olá! Gostaria de solicitar a inclusão de antesala no meu evento.'
  );
  const hasAntesalaSupportWhatsApp = antesalaSupportWhatsAppUrl !== '#';
  

  const [step, setStep] = useState(1);

  const initialState = data?.repertorio?.initialState || {};
  const draftStorageKey = useMemo(
    () => getRepertorioDraftStorageKey(data?.token || ''),
    [data?.token]
  );
  useEffect(() => {
    debugClientHome('[CLIENT_HOME][SERVER_DATA]', {
      repertorioStatus: data?.repertorio?.status || '',
      repertorioLocked: Boolean(data?.repertorio?.isLocked),
      token: data?.token || '',
      hasBackendRepertorio: hasInitialRepertorioFromBackend(data?.repertorio?.initialState || {}),
    });
    console.log('[REPERTORIO][RELOAD]', data?.repertorio?.initialState || {});
  }, [data]);
  const hasBackendRepertorio = hasInitialRepertorioFromBackend(initialState);
  const initialCortejo = Array.isArray(initialState.cortejo)
    ? initialState.cortejo
        .map((item) => ({
          ...item,
          referenceMeta: toReferenceMeta(item),
        }))
        .filter((item) => hasUsefulMusicalItem(item))
    : null;
  const initialCerimonia = Array.isArray(initialState.cerimonia)
    ? initialState.cerimonia
        .map((item) => ({
          ...item,
          referenceMeta: toReferenceMeta(item),
        }))
        .filter((item) => hasUsefulMusicalItem(item))
    : null;
  const initialSaida = initialState.saida
    ? {
        ...initialState.saida,
        referenceMeta: toReferenceMeta(initialState.saida),
      }
    : null;
  const restoredState =
    persistedState && typeof persistedState === 'object' ? persistedState : null;
  const initialMode = initialState?.mode || (isWedding ? 'wedding' : 'custom');
  const [mode] = useState(
    restoredState?.mode || initialMode || (isWedding ? 'wedding' : 'custom')
  );

const [querAntessala, setQuerAntessala] = useState(
  restoredState?.querAntessala ?? initialState.querAntessala ?? null
);

const [temReceptivo, setTemReceptivo] = useState(
  restoredState?.temReceptivo ?? !!data.repertorio.temReceptivo
);

const [antessala, setAntessala] = useState(
  {
    ...getDefaultAntesalaState(),
    ...(restoredState?.antessala || {}),
    ...(initialState.antessala || {}),
    durationMinutes:
      Number(initialState?.antessala?.durationMinutes || data?.repertorio?.antesalaDurationMinutes || 30) || 30,
    requestedByClient: false,
    quotePriceIncrement: 0,
    quoteMinutes: null,
  }
);
  useEffect(() => {
    console.log('[ANTESALA_REOPEN][INITIAL_STATE]', {
      querAntessala: initialState.querAntessala ?? null,
      antessalaFromInitialState: initialState.antessala || null,
      antesalaDurationFromEvent: data?.repertorio?.antesalaDurationMinutes ?? null,
      finalInitialState: {
        ...getDefaultAntesalaState(),
        ...(initialState.antessala || {}),
        durationMinutes:
          Number(
            initialState?.antessala?.durationMinutes ||
              data?.repertorio?.antesalaDurationMinutes ||
              30
          ) || 30,
      },
    });
  }, [data?.repertorio?.antesalaDurationMinutes, initialState.antessala, initialState.querAntessala]);

const [cortejo, setCortejo] = useState(
  Array.isArray(restoredState?.cortejo)
    ? restoredState.cortejo
    : initialCortejo?.length
    ? initialCortejo
    : []
);

const [cerimonia, setCerimonia] = useState(
  Array.isArray(restoredState?.cerimonia)
    ? restoredState.cerimonia
    : initialCerimonia?.length
    ? initialCerimonia
    : []
);

const [saida, setSaida] = useState(
  restoredState?.saida || initialSaida || {
    musica: '',
    referencia: '',
    observacao: '',
    referenceMeta: null,
    reference_title: '',
    reference_channel: '',
    reference_thumbnail: '',
    reference_video_id: '',
  }
);

const [receptivo, setReceptivo] = useState({
  ...(restoredState?.receptivo || {}),
  ...(initialState.receptivo || {}),
  duracao: receptivoDuracaoTravada
    ? receptivoDuracaoLabel
    : initialState?.receptivo?.duracao || '1h',
  generos: initialState?.receptivo?.generos || '',
  artistas: initialState?.receptivo?.artistas || '',
  observacao: initialState?.receptivo?.observacao || '',
});
const [desiredSongs, setDesiredSongs] = useState(
  restoredState?.desiredSongs ?? (initialState.desiredSongs || '')
);
const [generalNotes, setGeneralNotes] = useState(
  restoredState?.generalNotes ?? (initialState.generalNotes || '')
);
const [selectedStyles, setSelectedStyles] = useState(
  Array.isArray(restoredState?.selected_styles)
    ? restoredState.selected_styles
    : Array.isArray(initialState?.selected_styles)
    ? initialState.selected_styles
    : []
);
const [preferredArtists, setPreferredArtists] = useState(
  restoredState?.preferred_artists ?? initialState?.preferred_artists ?? ''
);
const [customSongs, setCustomSongs] = useState(
  Array.isArray(restoredState?.custom_songs)
    ? restoredState.custom_songs.slice(0, CUSTOM_EVENT_MAX_SONGS)
    : Array.isArray(initialState?.custom_songs)
    ? initialState.custom_songs.slice(0, CUSTOM_EVENT_MAX_SONGS)
    : []
);

  const isAntesalaApproved = querAntessala === true;
  const isAntesalaPending =
    !isAntesalaApproved &&
    (Boolean(antessala?.requestedByClient) || hasFilledField(antessala?.requestStatus));

  const [showLocalDraftBanner, setShowLocalDraftBanner] = useState(false);
  const [savingMode, setSavingMode] = useState('');
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const firstAutosaveLoggedRef = useRef(false);
  const hadLocalDraftOnHydrationRef = useRef(false);
  const repertorioStateRef = useRef(
    buildRepertorioSnapshot({
      mode,
      querAntessala,
      temReceptivo,
      antessala,
      cortejo,
      cerimonia,
      saida,
      receptivo,
      desiredSongs,
      generalNotes,
      selected_styles: selectedStyles,
      preferred_artists: preferredArtists,
      custom_songs: customSongs,
    })
  );
  const appliedSuggestionKeysRef = useRef(new Set());
  const getSuggestionSelectionKey = useCallback((item = {}) => {
    return `${item.songId}::${normalizeSuggestionSection(
      item.section || item.targetSection
    )}::${normalizeCompareText(item.who_enters || item.targetLabel || item.moment || '')}`;
  }, []);

  const setCortejoWithLog = useCallback((nextValueOrUpdater, reason = 'unknown') => {
    setCortejo((prev) => {
      const nextValue =
        typeof nextValueOrUpdater === 'function'
          ? nextValueOrUpdater(prev)
          : nextValueOrUpdater;
      debugClientHome('[CLIENT_HOME][SET_CORTEJO]', {
        reason,
        prevCount: Array.isArray(prev) ? prev.length : 0,
        nextCount: Array.isArray(nextValue) ? nextValue.length : 0,
      });
      return nextValue;
    });
  }, []);

  const setCerimoniaWithLog = useCallback((nextValueOrUpdater, reason = 'unknown') => {
    setCerimonia((prev) => {
      const nextValue =
        typeof nextValueOrUpdater === 'function'
          ? nextValueOrUpdater(prev)
          : nextValueOrUpdater;
      debugClientHome('[CLIENT_HOME][SET_CERIMONIA]', {
        reason,
        prevCount: Array.isArray(prev) ? prev.length : 0,
        nextCount: Array.isArray(nextValue) ? nextValue.length : 0,
      });
      return nextValue;
    });
  }, []);

  const setAntessalaWithLog = useCallback((nextValueOrUpdater, reason = 'unknown') => {
    setAntessala((prev) => {
      const nextValue =
        typeof nextValueOrUpdater === 'function'
          ? nextValueOrUpdater(prev)
          : nextValueOrUpdater;
      debugClientHome('[CLIENT_HOME][SET_ANTESALA]', {
        reason,
        prevRequestedByClient: Boolean(prev?.requestedByClient),
        nextRequestedByClient: Boolean(nextValue?.requestedByClient),
        prevRequestStatus: String(prev?.requestStatus || ''),
        nextRequestStatus: String(nextValue?.requestStatus || ''),
      });
      return nextValue;
    });
  }, []);

  useEffect(() => {
    const nextSnapshot = buildRepertorioSnapshot({
      mode,
      querAntessala,
      temReceptivo,
      antessala,
      cortejo,
      cerimonia,
      saida,
      receptivo,
      desiredSongs,
      generalNotes,
      selected_styles: selectedStyles,
      preferred_artists: preferredArtists,
      custom_songs: customSongs,
    });
    repertorioStateRef.current = nextSnapshot;
    onPersistState?.(nextSnapshot);
    console.log('[REPERTORIO][STATE_AFTER_UPDATE]', nextSnapshot);
  }, [
    querAntessala,
    temReceptivo,
    antessala,
    cortejo,
    cerimonia,
    saida,
    receptivo,
    desiredSongs,
    generalNotes,
    mode,
    selectedStyles,
    preferredArtists,
    customSongs,
    onPersistState,
  ]);

  useEffect(() => {
    debugClientHome('[TRACE][CORTEJO][FINAL_STATE]', pickTraceItem(cortejo));
    debugClientHome('[TRACE][CERIMONIA][FINAL_STATE]', pickTraceItem(cerimonia));
  }, [cortejo, cerimonia]);

  const applyLocalDraft = useCallback((parsed) => {
    debugClientHome('[CLIENT_HOME][LOCAL_DRAFT]', parsed);
    const currentSnapshot = repertorioStateRef.current || {};
    const parsedCortejo = filterUsefulMusicalItems(parsed?.cortejo);
    const parsedCerimonia = filterUsefulMusicalItems(parsed?.cerimonia);
    const parsedAntesalaRaw =
      parsed?.antessala && typeof parsed?.antessala === 'object'
        ? parsed.antessala
        : {};
    const parsedAntesala = mergeAntesalaState(
      currentSnapshot?.antessala || {},
      parsedAntesalaRaw
    );
    const currentSaida = currentSnapshot?.saida || {
      musica: '',
      referencia: '',
      observacao: '',
      referenceMeta: null,
      reference_title: '',
      reference_channel: '',
      reference_thumbnail: '',
      reference_video_id: '',
    };
    const parsedSaida = parsed?.saida || {};
    const mergedSaida = {
      ...currentSaida,
      ...parsedSaida,
      ...mergeNonEmptyFields(currentSaida, parsedSaida, [
        'musica',
        'referencia',
        'observacao',
        'reference_title',
        'reference_channel',
        'reference_thumbnail',
        'reference_video_id',
      ]),
      referenceMeta:
        parsedSaida?.referenceMeta ||
        toReferenceMeta(parsedSaida) ||
        currentSaida.referenceMeta ||
        null,
    };
    const currentReceptivo = currentSnapshot?.receptivo || {
      duracao: '1h',
      generos: '',
      artistas: '',
      observacao: '',
    };
    const parsedReceptivo = parsed?.receptivo || {};
    const mergedReceptivo = {
      ...currentReceptivo,
      ...parsedReceptivo,
      ...mergeNonEmptyFields(currentReceptivo, parsedReceptivo, [
        'duracao',
        'generos',
        'artistas',
        'observacao',
      ]),
    };
    const shouldUseDraftCortejo = parsedCortejo.length > 0;
    const shouldUseDraftCerimonia = parsedCerimonia.length > 0;
    const shouldUseDraftAntesala = hasUsefulAntesalaState(parsedAntesalaRaw);
    const parsedSelectedStyles = Array.isArray(parsed?.selected_styles)
      ? parsed.selected_styles.filter((item) => hasFilledField(item))
      : [];
    const parsedCustomSongs = Array.isArray(parsed?.custom_songs)
      ? parsed.custom_songs
          .slice(0, CUSTOM_EVENT_MAX_SONGS)
          .filter((item) =>
            hasFilledField(item?.song_name) ||
            hasFilledField(item?.reference_link) ||
            hasFilledField(item?.reference_video_id)
          )
      : [];

    const restoredState = {
      mode: parsed?.mode || mode,
      querAntessala: parsed?.querAntessala ?? currentSnapshot.querAntessala ?? null,
      temReceptivo: parsed?.temReceptivo ?? !!data.repertorio.temReceptivo,
      cortejo:
        shouldUseDraftCortejo || !hasBackendRepertorio
          ? parsedCortejo
          : Array.isArray(currentSnapshot.cortejo)
          ? currentSnapshot.cortejo
          : [],
      cerimonia:
        shouldUseDraftCerimonia || !hasBackendRepertorio
          ? parsedCerimonia
          : Array.isArray(currentSnapshot.cerimonia)
          ? currentSnapshot.cerimonia
          : [],
      saida:
        mergedSaida,
      antessala:
        shouldUseDraftAntesala || !hasBackendRepertorio
          ? parsedAntesala
          : mergeAntesalaState(currentSnapshot?.antessala || {}, {}),
      receptivo:
        mergedReceptivo,
      desiredSongs: hasFilledField(parsed?.desiredSongs)
        ? parsed?.desiredSongs
        : currentSnapshot?.desiredSongs || '',
      generalNotes: hasFilledField(parsed?.generalNotes)
        ? parsed?.generalNotes
        : currentSnapshot?.generalNotes || '',
      selected_styles:
        parsedSelectedStyles.length > 0
          ? parsedSelectedStyles
          : Array.isArray(currentSnapshot?.selected_styles)
          ? currentSnapshot.selected_styles
          : [],
      preferred_artists: hasFilledField(parsed?.preferred_artists)
        ? parsed.preferred_artists
        : currentSnapshot?.preferred_artists || '',
      custom_songs:
        parsedCustomSongs.length > 0
          ? parsedCustomSongs
          : Array.isArray(currentSnapshot?.custom_songs)
          ? currentSnapshot.custom_songs
          : [],
    };

    console.log('[ANTESALA_REOPEN][MERGED_STATE]', {
      hasBackendRepertorio,
      parsedAntesalaRaw,
      parsedAntesalaMerged: parsedAntesala,
      shouldUseDraftAntesala,
      antessalaFromCurrentSnapshot: currentSnapshot?.antessala || null,
      restoredAntesala: restoredState.antessala,
    });
    debugClientHome('[REPERTORIO_AUTOSAVE] estados restaurados no draft local:', restoredState);

    setQuerAntessala(restoredState.querAntessala);
    setTemReceptivo(restoredState.temReceptivo);
    setCortejoWithLog(restoredState.cortejo, 'applyLocalDraft');
    setCerimoniaWithLog(restoredState.cerimonia, 'applyLocalDraft');
    setSaida(
      restoredState.saida
    );
    setAntessalaWithLog(restoredState.antessala, 'applyLocalDraft');
    setReceptivo(
      restoredState.receptivo
    );
    setDesiredSongs(restoredState.desiredSongs);
    setGeneralNotes(restoredState.generalNotes);
    setSelectedStyles(restoredState.selected_styles);
    setPreferredArtists(restoredState.preferred_artists);
    setCustomSongs(restoredState.custom_songs);
  }, [
    data.repertorio.temReceptivo,
    hasBackendRepertorio,
    mode,
    setAntessalaWithLog,
    setCerimoniaWithLog,
    setCortejoWithLog,
  ]);

  useEffect(() => {
    let hasSavedLocalDraft = false;

    try {
      const savedDraftRaw = localStorage.getItem(draftStorageKey);
      hasSavedLocalDraft = !!savedDraftRaw;
      hadLocalDraftOnHydrationRef.current = hasSavedLocalDraft;
      debugClientHome('[REPERTORIO_AUTOSAVE] conteúdo lido do localStorage:', savedDraftRaw);
      debugClientHome('[CLIENT_HOME][LOCAL_DRAFT]', savedDraftRaw);

      if (savedDraftRaw) {
        const parsed = JSON.parse(savedDraftRaw);
        console.log('[REPERTORIO][RELOAD]', parsed);
        const parsedCortejo = filterUsefulMusicalItems(parsed?.cortejo);
        const parsedCerimonia = filterUsefulMusicalItems(parsed?.cerimonia);
        const parsedAntesalaRaw =
          parsed?.antessala && typeof parsed?.antessala === 'object'
            ? parsed.antessala
            : {};
        const hasUsefulDraftCortejo = parsedCortejo.length > 0;
        const hasUsefulDraftCerimonia = parsedCerimonia.length > 0;
        const hasUsefulDraftAntesala = hasUsefulAntesalaState(parsedAntesalaRaw);
        const hasUsefulDraftCustomStyles =
          Array.isArray(parsed?.selected_styles) && parsed.selected_styles.length > 0;
        const hasUsefulDraftCustomArtists = hasFilledField(parsed?.preferred_artists);
        const hasUsefulDraftCustomSongs =
          Array.isArray(parsed?.custom_songs) &&
          parsed.custom_songs.some((item) => hasUsefulCustomSongItem(item));
        const shouldHydrateFromLocalDraft =
          !hasBackendRepertorio ||
          hasUsefulDraftCortejo ||
          hasUsefulDraftCerimonia ||
          hasUsefulDraftAntesala ||
          hasUsefulDraftCustomStyles ||
          hasUsefulDraftCustomArtists ||
          hasUsefulDraftCustomSongs;

        debugClientHome('[CLIENT_HOME][STATE_BEFORE_MERGE]', repertorioStateRef.current || {});
        debugClientHome('[CLIENT_HOME][LOCAL_DRAFT_DECISION]', {
          hasBackendRepertorio,
          hasUsefulDraftCortejo,
          hasUsefulDraftCerimonia,
          hasUsefulDraftAntesala,
          hasUsefulDraftCustomStyles,
          hasUsefulDraftCustomArtists,
          hasUsefulDraftCustomSongs,
          shouldHydrateFromLocalDraft,
        });

        if (shouldHydrateFromLocalDraft) {
          applyLocalDraft(parsed);
          console.log('[REPERTOIRE][STATE_AFTER_REHYDRATE]', {
            source: 'local_draft',
            parsed,
          });
          setShowLocalDraftBanner(false);
          debugClientHome('[CLIENT_HOME][STATE_AFTER_MERGE]', {
            ...repertorioStateRef.current,
            ...(parsed || {}),
          });
        } else {
          setShowLocalDraftBanner(!hasBackendRepertorio && hasSavedLocalDraft);
        }
      } else {
        setShowLocalDraftBanner(!hasBackendRepertorio && hasSavedLocalDraft);
      }
    } catch (error) {
      console.error('[REPERTORIO_AUTOSAVE] falha ao hidratar draft local:', error);
      setShowLocalDraftBanner(false);
    } finally {
      setDraftHydrated(true);
      setAutosaveReady(true);
    }
  }, [applyLocalDraft, draftStorageKey, hasBackendRepertorio]);

  useEffect(() => {
    if (!draftHydrated) return;

    if (hasBackendRepertorio) {
      setShowLocalDraftBanner(false);
      return;
    }

    const savedDraftRaw = localStorage.getItem(draftStorageKey);
    setShowLocalDraftBanner(!!savedDraftRaw);
  }, [draftStorageKey, hasBackendRepertorio, draftHydrated]);

  function handleRestoreLocalDraft() {
    const savedDraftRaw = localStorage.getItem(draftStorageKey);
    if (!savedDraftRaw) {
      setShowLocalDraftBanner(false);
      return;
    }

    try {
      const parsed = JSON.parse(savedDraftRaw);
      applyLocalDraft(parsed);
      setShowLocalDraftBanner(false);
      showToast('Rascunho local restaurado com sucesso.', 'success');
    } catch (error) {
      console.error('Não foi possível restaurar rascunho local do repertório:', error);
      showToast('Não foi possível restaurar o rascunho local.', 'error');
    }
  }

  function handleDiscardLocalDraft() {
    localStorage.removeItem(draftStorageKey);
    setShowLocalDraftBanner(false);
    showToast('Rascunho local descartado.', 'default');
  }

  useEffect(() => {
    console.log('[ANTESALA_REOPEN][FINAL_FORM_STATE]', {
      querAntessala,
      antessala,
    });
  }, [antessala, querAntessala]);

  useEffect(() => {
    if (!autosaveReady) {
      debugClientHome('[REPERTORIO_AUTOSAVE] proteção de hidratação ativa: autosave bloqueado antes da hidratação inicial.');
      return;
    }

    const draftPayload = {
      mode,
      querAntessala,
      temReceptivo,
      antessala,
      cortejo,
      cerimonia,
      saida,
      receptivo,
      desiredSongs,
      generalNotes,
      selected_styles: selectedStyles,
      preferred_artists: preferredArtists,
      custom_songs: customSongs,
    };

    localStorage.setItem(draftStorageKey, JSON.stringify(draftPayload));

    if (!firstAutosaveLoggedRef.current) {
      firstAutosaveLoggedRef.current = true;
      debugClientHome('[REPERTORIO_AUTOSAVE] primeiro save no localStorage:', draftPayload);

      if (
        hadLocalDraftOnHydrationRef.current &&
        !hasInitialRepertorioFromBackend(draftPayload)
      ) {
        debugClientHome(
          '[REPERTORIO_AUTOSAVE] possível sobrescrita precoce detectada: existia draft local e o primeiro save está vazio.'
        );
      }
    }
  }, [
    autosaveReady,
    querAntessala,
    temReceptivo,
    antessala,
    cortejo,
    cerimonia,
    saida,
    receptivo,
    desiredSongs,
    generalNotes,
    mode,
    selectedStyles,
    preferredArtists,
    customSongs,
    draftStorageKey,
  ]);

  useEffect(() => {
    if (isCustomEvent) return;
    if (!Array.isArray(selectedSongs) || selectedSongs.length === 0) return;

    const pendingSuggestions = selectedSongs.filter((item) => {
      const key = getSuggestionSelectionKey(item);
      return !appliedSuggestionKeysRef.current.has(key);
    });

    if (pendingSuggestions.length === 0) return;

    let nextSnapshot = repertorioStateRef.current;
    console.log('[REPERTOIRE][SOURCE_OF_TRUTH_BEFORE_ADD]', nextSnapshot);
    debugClientHome(
      '[CLIENT_HOME][STATE_BEFORE_MERGE]',
      nextSnapshot
    );

    pendingSuggestions.forEach((item) => {
      const songLike = {
        title: item.title,
        artist: item.artist,
        genre: item.genre,
        thumbnailUrl: item.thumbnailUrl,
        youtubeId: item.reference_video_id,
      };
      const payloadLike = {
        section: item.section || item.targetSection,
        label: item.who_enters || item.targetLabel,
        notes: item.notes,
      };
      const suggestionPayload = buildSuggestionPayload(songLike, payloadLike);
      const key = getSuggestionSelectionKey(item);
      console.log('[REPERTOIRE][SUGGESTION_ADD_INPUT]', {
        item,
        suggestionPayload,
        key,
      });

      debugClientHome('[SUGESTOES->REPERTORIO] destino escolhido:', payloadLike.section);
      debugClientHome('[SUGESTOES->REPERTORIO] item montado por buildSuggestionPayload:', suggestionPayload);
      debugClientHome('[SUGESTOES->REPERTORIO] estado do repertório antes da inserção:', nextSnapshot);

      nextSnapshot = applySuggestionToRepertorioState(nextSnapshot, {
        ...item,
        ...suggestionPayload,
      });

      debugClientHome('[SUGESTOES->REPERTORIO] estado do repertório depois da inserção:', nextSnapshot);
      console.log('[REPERTOIRE][STATE_AFTER_ADD]', nextSnapshot);
      appliedSuggestionKeysRef.current.add(key);
    });

    setQuerAntessala(nextSnapshot.querAntessala);
    setTemReceptivo(nextSnapshot.temReceptivo);
    debugClientHome(
      '[CLIENT_HOME][STATE_AFTER_MERGE]',
      nextSnapshot
    );
    setAntessalaWithLog(nextSnapshot.antessala, 'selectedSongsMerge');
    setCortejoWithLog(nextSnapshot.cortejo, 'selectedSongsMerge');
    setCerimoniaWithLog(nextSnapshot.cerimonia, 'selectedSongsMerge');
    setSaida(nextSnapshot.saida);
    setReceptivo(nextSnapshot.receptivo);
  }, [
    isCustomEvent,
    getSuggestionSelectionKey,
    selectedSongs,
    setAntessalaWithLog,
    setCerimoniaWithLog,
    setCortejoWithLog,
  ]);

  const renderedRepertorioItems = useMemo(() => {
    const cortejoItems = filterUsefulMusicalItems(cortejo)
      .map((item, index) => ({
        key: `cortejo-${index}`,
        section: 'Cortejo',
        label: item?.label || 'Entrada',
        title: item?.musica || 'Sem música definida',
        subtitle: item?.reference_channel || '',
        notes: item?.observacao || '',
      }));

    const cerimoniaItems = filterUsefulMusicalItems(cerimonia)
      .map((item, index) => ({
        key: `cerimonia-${index}`,
        section: 'Cerimônia',
        label: item?.label || 'Momento da cerimônia',
        title: item?.musica || 'Sem música definida',
        subtitle: item?.reference_channel || '',
        notes: item?.observacao || '',
      }));

    const saidaItems = saida?.musica || saida?.referencia
      ? [
          {
            key: 'saida',
            section: 'Saída',
            label: 'Saída dos noivos',
            title: saida?.musica || 'Sem música definida',
            subtitle: saida?.reference_channel || '',
            notes: saida?.observacao || '',
          },
        ]
      : [];

    return [...cortejoItems, ...cerimoniaItems, ...saidaItems];
  }, [cortejo, cerimonia, saida]);

  useEffect(() => {
    debugClientHome('[SUGESTOES->REPERTORIO][RENDER] fonte visual atual da aba Repertório:', {
      cortejo,
      cerimonia,
      saida,
      renderedRepertorioItems,
    });
  }, [cortejo, cerimonia, saida, renderedRepertorioItems]);

  function normalizeReferenceFields(reference = {}) {
    const referenceLink = String(
      reference.referencia || reference.link || reference.reference_link || ''
    ).trim();
    const referenceVideoId = getYoutubeVideoId(referenceLink);

    if (!referenceLink) {
      return {
        reference_link: '',
        reference_title: '',
        reference_channel: '',
        reference_thumbnail: '',
        reference_video_id: '',
      };
    }

    const selectedVideoId = String(reference.reference_video_id || '').trim();
    const metadataMatchesLink =
      !referenceVideoId ||
      !selectedVideoId ||
      selectedVideoId === referenceVideoId;

    return {
      reference_link: referenceLink,
      reference_title: metadataMatchesLink
        ? String(reference.reference_title || '').trim()
        : '',
      reference_channel: metadataMatchesLink
        ? String(reference.reference_channel || '').trim()
        : '',
      reference_thumbnail: metadataMatchesLink
        ? String(reference.reference_thumbnail || '').trim()
        : '',
      reference_video_id: referenceVideoId || selectedVideoId || '',
    };
  }

  const quickCortejo = [
    'Padrinhos',
    'Madrinhas',
    'Mademoiselles',
    'Segurança das Alianças',
    'Noivinhos',
    'Daminha / Florista',
    'Entrada da Bíblia',
    'Celebrante',
    'Pais dos Noivos',
    'Noiva 👰',
  ];

  const visibleSteps = isWedding
    ? [
    { id: 1, label: 'Boas-vindas' },
    { id: 2, label: 'Antessala' },
    { id: 3, label: 'Cortejo' },
    { id: 4, label: 'Cerimônia' },
    { id: 5, label: 'Saída' },
    { id: 6, label: 'Receptivo', locked: !data.repertorio.temReceptivo },
    { id: 7, label: 'Revisão' },
  ]
    : [{ id: 1, label: 'Repertório do evento' }];

  const progresso = Math.round((Math.min(step, visibleSteps.length) / visibleSteps.length) * 100);
function buildItemsPayload() {
  if (isCustomEvent) {
    const customEventItems = [
      {
        section: 'custom_event',
        item_order: 0,
        who_enters: '',
        moment: 'Repertório do evento',
        song_name: '',
        reference_link: '',
        notes: '',
        type: 'custom_event_meta',
        group_name: '',
        label: 'Repertório do evento',
        genres: Array.isArray(selectedStyles) ? selectedStyles.join(', ') : '',
        artists: preferredArtists || '',
      },
    ];

    (Array.isArray(customSongs) ? customSongs : [])
      .slice(0, CUSTOM_EVENT_MAX_SONGS)
      .forEach((song, index) => {
        customEventItems.push({
          section: 'custom_event',
          item_order: index + 1,
          who_enters: '',
          moment: `Música ${index + 1}`,
          song_name: String(song?.song_name || '').trim(),
          reference_link: String(song?.reference_link || '').trim(),
          reference_title: String(song?.reference_title || '').trim(),
          reference_channel: String(song?.reference_channel || '').trim(),
          reference_thumbnail: String(song?.reference_thumbnail || '').trim(),
          reference_video_id: String(song?.reference_video_id || '').trim(),
          notes: '',
          type: 'custom_event_song',
          group_name: '',
          label: `Música ${index + 1}`,
          genres: '',
          artists: '',
        });
      });

    return customEventItems;
  }

  const items = [];
  const repertorioItems = buildUnifiedRepertorioItems({ cortejo, cerimonia, saida });
  const cortejoItems = repertorioItems.filter((item) => item.section === 'cortejo');
  const cerimoniaItems = repertorioItems.filter((item) => item.section === 'cerimonia');
  const saidaItem = repertorioItems.find((item) => item.section === 'saida') || null;

  if (querAntessala === true) {
    items.push({
      section: 'antessala',
      item_order: 0,
      who_enters: '',
      moment: 'Antessala',
      song_name: antessala.estilo || '',
      reference_link: '',
      notes: antessala.observacao || '',
      type: 'ante_room',
      group_name: '',
      label: 'Antessala',
      genres:
        antessala.generos ||
        (Array.isArray(antessala.styleTags) ? antessala.styleTags.join(', ') : ''),
      artists: antessala.artistas || '',
    });

    const beforeRoomReferences = Array.isArray(antessala.references)
      ? antessala.references.slice(0, 5)
      : [];

    beforeRoomReferences.forEach((reference, index) => {
      const referenceFields = normalizeReferenceFields(reference);
      items.push({
        section: 'antessala',
        item_order: 100 + index,
        who_enters: '',
        moment: `Referência ${index + 1}`,
        song_name: reference.title || '',
        reference_link: referenceFields.reference_link,
        reference_title: referenceFields.reference_title,
        reference_channel: referenceFields.reference_channel,
        reference_thumbnail: referenceFields.reference_thumbnail,
        reference_video_id: referenceFields.reference_video_id,
        notes: '',
        type: 'ante_room',
        group_name: '',
        label: `Referência ${index + 1}`,
        genres: '',
        artists: '',
      });
    });
  }

  cortejoItems.forEach((item, index) => {
    const referenceFields = normalizeReferenceFields(item);

    items.push({
      section: 'cortejo',
      item_order: index,
      who_enters: item.moment || '',
      moment: 'Entrada',
      song_name: item.song_name || '',
      reference_link: referenceFields.reference_link,
      reference_title: item.reference_title || referenceFields.reference_title,
      reference_channel: item.reference_channel || referenceFields.reference_channel,
      reference_thumbnail: item.reference_thumbnail || referenceFields.reference_thumbnail,
      reference_video_id: item.reference_video_id || referenceFields.reference_video_id,
      notes: item.notes || '',
      type: 'entrada',
      group_name: '',
      label: item.moment || '',
      genres: '',
      artists: '',
      source: item.source || 'manual',
    });
  });

  cerimoniaItems.forEach((item, index) => {
    const referenceFields = normalizeReferenceFields(item);

    items.push({
      section: 'cerimonia',
      item_order: index,
      who_enters: '',
      moment: item.moment || 'Cerimônia',
      song_name: item.song_name || '',
      reference_link: referenceFields.reference_link,
      reference_title: item.reference_title || referenceFields.reference_title,
      reference_channel: item.reference_channel || referenceFields.reference_channel,
      reference_thumbnail: item.reference_thumbnail || referenceFields.reference_thumbnail,
      reference_video_id: item.reference_video_id || referenceFields.reference_video_id,
      notes: item.notes || '',
      type: 'cerimonia',
      group_name: '',
      label: item.moment || '',
      genres: '',
      artists: '',
      source: item.source || 'manual',
    });
  });

  if (saidaItem) {
    const exitReferenceFields = normalizeReferenceFields(saidaItem);

    items.push({
      section: 'saida',
      item_order: 0,
      who_enters: 'Saída dos noivos',
      moment: 'Saída',
      song_name: saidaItem.song_name || '',
      reference_link: exitReferenceFields.reference_link,
      reference_title: saidaItem.reference_title || exitReferenceFields.reference_title,
      reference_channel: saidaItem.reference_channel || exitReferenceFields.reference_channel,
      reference_thumbnail: saidaItem.reference_thumbnail || exitReferenceFields.reference_thumbnail,
      reference_video_id: saidaItem.reference_video_id || exitReferenceFields.reference_video_id,
      notes: saidaItem.notes || '',
      type: 'saida',
      group_name: '',
      label: 'Saída dos noivos',
      genres: '',
      artists: '',
      source: saidaItem.source || 'manual',
    });
  }

  if (temReceptivo) {
    items.push({
      section: 'receptivo',
      item_order: 0,
      who_enters: '',
      moment: 'Receptivo',
      song_name: '',
      reference_link: '',
      notes: receptivo.observacao || '',
      type: 'reception',
      group_name: '',
      label: 'Receptivo',
      genres: receptivo.generos || '',
      artists: receptivo.artistas || '',
    });
  }

  return items;
}

function buildConfigPayload() {
  if (isCustomEvent) {
    return {
      has_ante_room: false,
      ante_room_style: '',
      ante_room_notes: '',
      has_reception: false,
      reception_duration: '',
      reception_genres: '',
      reception_artists: '',
      reception_notes: '',
      exit_song: '',
      exit_reference: '',
      exit_reference_title: '',
      exit_reference_channel: '',
      exit_reference_thumbnail: '',
      exit_reference_video_id: '',
      exit_notes: '',
      desired_songs: '',
      general_notes: '',
    };
  }

  const exitReferenceFields = normalizeReferenceFields(saida);
  const antesalaIncluded = querAntessala === true;
  const mergedGenres =
    antessala.generos ||
    (Array.isArray(antessala.styleTags) ? antessala.styleTags.join(', ') : '');
  const mergedArtists =
    antessala.artistas ||
    (antessala.preferredArtistsEnabled ? antessala.artistas || '' : '');

  return {
    has_ante_room: antesalaIncluded,
    ante_room_style: antessala.estilo || '',
    ante_room_notes: [antessala.observacao || '', mergedGenres ? `Estilos: ${mergedGenres}` : '', mergedArtists ? `Artistas: ${mergedArtists}` : '']
      .filter(Boolean)
      .join('\n'),
    has_reception: temReceptivo,
    reception_duration: temReceptivo
      ? receptivoDuracaoTravada
        ? receptivoDuracaoLabel
        : receptivo.duracao || ''
      : '',
    reception_genres: temReceptivo ? receptivo.generos || '' : '',
    reception_artists: temReceptivo ? receptivo.artistas || '' : '',
    reception_notes: temReceptivo ? receptivo.observacao || '' : '',
    exit_song: saida.musica || '',
    exit_reference: exitReferenceFields.reference_link,
    exit_reference_title: exitReferenceFields.reference_title,
    exit_reference_channel: exitReferenceFields.reference_channel,
    exit_reference_thumbnail: exitReferenceFields.reference_thumbnail,
    exit_reference_video_id: exitReferenceFields.reference_video_id,
    exit_notes: saida.observacao || '',
    desired_songs: desiredSongs || '',
    general_notes: generalNotes || '',
  };
}

async function saveRepertorio(mode = 'draft') {
  try {
    setSavingMode(mode);
    debugClientHome('[TRACE][CORTEJO][STATE_BEFORE_SAVE]', pickTraceItem(cortejo));
    debugClientHome('[TRACE][CERIMONIA][STATE_BEFORE_SAVE]', pickTraceItem(cerimonia));
    const builtItemsPayload = buildItemsPayload();
    debugClientHome('[TRACE][CORTEJO][PAYLOAD]', pickTracePayloadItem(builtItemsPayload, 'cortejo'));
    debugClientHome('[TRACE][CERIMONIA][PAYLOAD]', pickTracePayloadItem(builtItemsPayload, 'cerimonia'));
    const configPayload = buildConfigPayload();

    const payload = {
      token: data.repertorio?.repertoireToken || data.token,
      repertoireToken: data.repertorio?.repertoireToken || '',
      clientToken: data.token || '',
      mode,
      eventMode: isCustomEvent ? 'custom' : 'wedding',
      selected_styles: isCustomEvent ? selectedStyles : undefined,
      preferred_artists: isCustomEvent ? preferredArtists : undefined,
      custom_songs: isCustomEvent ? customSongs.slice(0, CUSTOM_EVENT_MAX_SONGS) : undefined,
      config: configPayload,
      items: builtItemsPayload,
      antesalaFlow: {
        included: querAntessala === true,
        durationMinutes: Number(antessala.durationMinutes || 0) || null,
        requestedByClient: false,
        requestStatus: null,
        priceIncrement: 0,
      },
    };
    if (mode === 'draft') {
      debugClientHome('[ANTESALA][CLIENT_STATE_BEFORE_SAVE]', {
        querAntessala,
        requestedByClient: false,
        requestStatus: String(antessala?.requestStatus || ''),
        durationMinutes: Number(antessala?.durationMinutes || 0) || null,
        quoteMinutes: null,
        quotePriceIncrement: 0,
        included: querAntessala === true,
        priceIncrement: 0,
      });
      debugClientHome('[ANTESALA][POST_BODY]', {
        querAntessala,
        requestedByClient: false,
        requestStatus: String(payload?.antesalaFlow?.requestStatus || ''),
        durationMinutes: Number(payload?.antesalaFlow?.durationMinutes || 0) || null,
        quoteMinutes: null,
        quotePriceIncrement: 0,
        included: Boolean(payload?.antesalaFlow?.included),
        priceIncrement: 0,
      });
    }
    debugClientHome('[TRACE][CORTEJO][POST_BODY]', pickTracePayloadItem(payload.items, 'cortejo'));
    debugClientHome('[TRACE][CERIMONIA][POST_BODY]', pickTracePayloadItem(payload.items, 'cerimonia'));

    const payloadItemsBySection = payload.items.reduce((acc, item) => {
      const key = String(item?.section || 'sem_secao');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const expectedSections = ['antessala', 'cortejo', 'cerimonia', 'receptivo', 'saida'];
    const missingSections = expectedSections.filter((section) => !payloadItemsBySection[section]);
    const cortejoPayload = builtItemsPayload.filter((item) => item.section === 'cortejo');
    const cerimoniaPayload = builtItemsPayload.filter((item) => item.section === 'cerimonia');
    const saidaPayload = builtItemsPayload.filter((item) => item.section === 'saida');

    debugClientHome('[REPERTORIO_DRAFT] payload final enviado para persistência:', payload);
    console.log('[REPERTOIRE][SAVE_PAYLOAD]', payload);
    debugClientHome('[SUGESTOES][PERSIST_PAYLOAD]', {
      mode,
      token: payload.token,
      selectedSongsCount: selectedSongs.length,
      itemsCount: builtItemsPayload.length,
      suggestedItemsCount: builtItemsPayload.filter((item) => Number(item?.item_order) >= 1000).length,
    });
    debugClientHome('[REPERTORIO_DRAFT] quantidade de itens por seção:', payloadItemsBySection);
    debugClientHome('[REPERTORIO_DRAFT] seções ausentes no payload.itens:', missingSections);
    debugClientHome('[SAVE][CORTEJO_PAYLOAD]', cortejoPayload);
    debugClientHome('[SAVE][CERIMONIA_PAYLOAD]', cerimoniaPayload);
    debugClientHome('[SAVE][SAIDA_PAYLOAD]', saidaPayload);

    debugClientHome('[CLIENTE REPERTORIO] token URL (/cliente/[token]):', data.token);
    debugClientHome('[CLIENTE REPERTORIO] token enviado no payload.token:', payload.token);
    debugClientHome(
      '[CLIENTE REPERTORIO] repertoireToken enviado explicitamente:',
      payload.repertoireToken || '(vazio)'
    );
    debugClientHome(
      '[CLIENTE REPERTORIO] clientToken enviado explicitamente:',
      payload.clientToken || '(vazio)'
    );

    const response = await fetch('/api/cliente/repertorio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    debugClientHome('[CLIENT][SAVE_RESPONSE]', {
      httpStatus: response.status,
      body: result,
    });
    debugClientHome('[SUGESTOES][PERSIST_RESULT]', {
      ok: response.ok && Boolean(result?.ok),
      httpStatus: response.status,
      status: result?.status || null,
      locked: result?.locked === true,
      message: result?.error || null,
    });

    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || 'Não foi possível salvar o repertório.');
    }

    showToast(
      mode === 'final'
        ? 'Repertório finalizado com sucesso 💜'
        : 'Rascunho salvo com sucesso 💾',
      'success'
    );

    localStorage.removeItem(draftStorageKey);

    onSaved?.({
      mode,
      result,
    });

  } catch (error) {
    console.error('Erro ao salvar repertório:', error);
    showToast(
      error?.message || 'Não foi possível salvar o repertório.',
      'error'
    );
  } finally {
    setSavingMode('');
  }
}

async function handleRequestReview() {
  if (aguardandoRevisao) return;

  const reviewToken = data.repertorio?.repertoireToken || data.token;
  if (!reviewToken) {
    console.info('[UI][ACTION_ERROR_TOAST]', { source: 'cliente.review', reason: 'missing-token' });
    showToast('Erro ao solicitar revisão', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/cliente/repertorio/review/${reviewToken}`, {
      method: 'POST',
    });

    const result = await res.json();
    if (!res.ok || !result?.ok) throw new Error(result?.error || 'Erro ao solicitar revisão');

    onReviewRequested?.(result);
    console.info('[UI][ACTION_SUCCESS_TOAST]', { source: 'cliente.review' });
    showToast('Pedido de revisão enviado com sucesso!', 'success');
  } catch {
    console.info('[UI][ACTION_ERROR_TOAST]', { source: 'cliente.review' });
    showToast('Erro ao solicitar revisão', 'error');
  }
}

  function updateListItem(list, setter, index, value, section = '') {
    console.log('[REPERTORIO][MANUAL_INPUT]', {
      section,
      index,
      value,
    });
    setter(list.map((item, i) => (i === index ? { ...value, source: value?.source || 'manual' } : item)));
  }

  function moveItem(list, setter, index, dir) {
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= list.length) return;
    const clone = [...list];
    const temp = clone[index];
    clone[index] = clone[nextIndex];
    clone[nextIndex] = temp;
    setter(clone);
  }

  function moveItemBetweenSections(fromSection, index, direction) {
    if (fromSection === 'cortejo' && direction === 'right') {
      const source = Array.isArray(cortejo) ? [...cortejo] : [];
      const target = Array.isArray(cerimonia) ? [...cerimonia] : [];
      if (index < 0 || index >= source.length) return;
      const [movedItem] = source.splice(index, 1);
      setCortejoWithLog(source, 'moveToCerimonia');
      setCerimoniaWithLog([...target, { ...movedItem, source: movedItem?.source || 'manual' }], 'moveFromCortejo');
      return;
    }

    if (fromSection === 'cerimonia' && direction === 'left') {
      const source = Array.isArray(cerimonia) ? [...cerimonia] : [];
      const target = Array.isArray(cortejo) ? [...cortejo] : [];
      if (index < 0 || index >= source.length) return;
      const [movedItem] = source.splice(index, 1);
      setCerimoniaWithLog(source, 'moveToCortejo');
      setCortejoWithLog([...target, { ...movedItem, source: movedItem?.source || 'manual' }], 'moveFromCerimonia');
      return;
    }

    if (fromSection === 'cerimonia' && direction === 'right') {
      const source = Array.isArray(cerimonia) ? [...cerimonia] : [];
      if (index < 0 || index >= source.length) return;
      const [movedItem] = source.splice(index, 1);
      setCerimoniaWithLog(source, 'moveToSaida');
      setSaida({
        id: saida?.id || 'saida-0',
        label: 'Saída dos noivos',
        musica: movedItem?.musica || '',
        referencia: movedItem?.referencia || '',
        observacao: movedItem?.observacao || '',
        source: movedItem?.source || 'manual',
        reference_title: movedItem?.reference_title || '',
        reference_channel: movedItem?.reference_channel || '',
        reference_thumbnail: movedItem?.reference_thumbnail || '',
        reference_video_id: movedItem?.reference_video_id || '',
        referenceMeta: movedItem?.referenceMeta || null,
      });
      return;
    }
  }

  function moveSaidaToCerimonia() {
    if (!hasUsefulListItem(saida)) return;
    setCerimoniaWithLog(
      [
        ...cerimonia,
        {
          id: `cerimonia-manual-${Date.now()}-${cerimonia.length}`,
          label: saida?.label || 'Saída dos noivos',
          musica: saida?.musica || '',
          referencia: saida?.referencia || '',
          observacao: saida?.observacao || '',
          source: saida?.source || 'manual',
          reference_title: saida?.reference_title || '',
          reference_channel: saida?.reference_channel || '',
          reference_thumbnail: saida?.reference_thumbnail || '',
          reference_video_id: saida?.reference_video_id || '',
          referenceMeta: saida?.referenceMeta || null,
        },
      ],
      'moveFromSaida'
    );
    setSaida({
      id: saida?.id || 'saida-0',
      label: 'Saída dos noivos',
      musica: '',
      referencia: '',
      observacao: '',
      source: 'manual',
      reference_title: '',
      reference_channel: '',
      reference_thumbnail: '',
      reference_video_id: '',
      referenceMeta: null,
    });
  }

  function removeMatchingSuggestionFromSelection(removedItem = {}, sectionKey = '') {
    if (typeof setSelectedSongs !== 'function') return;

    setSelectedSongs((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const removedLabel = normalizeCompareText(removedItem?.label || '');
      const removedSongName = normalizeCompareText(removedItem?.musica || '');
      const removedVideoId = String(removedItem?.reference_video_id || '').trim();

      return safePrev.filter((entry) => {
        const sameSection =
          normalizeSuggestionSection(entry.section || entry.targetSection) === sectionKey;
        if (!sameSection) return true;

        return !isSameSongSelection({
          baseLabel: entry.who_enters || entry.targetLabel || '',
          baseSongName: entry.song_name || entry.title || '',
          baseVideoId: entry.reference_video_id || '',
          candidateLabel: removedLabel,
          candidateSongName: removedSongName,
          candidateVideoId: removedVideoId,
        });
      });
    });
  }

  function removeItem(list, setter, index, sectionKey = '') {
    const safeList = Array.isArray(list) ? list : [];
    const removedItem = safeList[index] || null;
    console.log('[REPERTOIRE][DELETE_INPUT]', {
      section: sectionKey,
      index,
      removedItem,
      sourceOfTruthBeforeDelete: repertorioStateRef.current || {},
    });

    setter(safeList.filter((_, i) => i !== index));

    if (removedItem && sectionKey) {
      removeMatchingSuggestionFromSelection(removedItem, sectionKey);
    }

    console.log('[REPERTOIRE][STATE_AFTER_DELETE]', {
      section: sectionKey,
      index,
      removedItem,
    });
  }

  function addCortejo(label = '') {
    setCortejoWithLog([
      ...cortejo,
      {
        id: `cortejo-manual-${Date.now()}-${cortejo.length}`,
        label,
        musica: '',
        referencia: '',
        observacao: '',
        referenceMeta: null,
        reference_title: '',
        reference_channel: '',
        reference_thumbnail: '',
        reference_video_id: '',
        source: 'manual',
      },
    ]);
  }

  function addCerimonia(label = '') {
    setCerimoniaWithLog([
      ...cerimonia,
      {
        id: `cerimonia-manual-${Date.now()}-${cerimonia.length}`,
        label,
        musica: '',
        referencia: '',
        observacao: '',
        referenceMeta: null,
        reference_title: '',
        reference_channel: '',
        reference_thumbnail: '',
        reference_video_id: '',
        source: 'manual',
      },
    ]);
  }

  function renderResumoCortejo() {
    const usefulCortejo = filterUsefulMusicalItems(cortejo);

    if (!usefulCortejo.length) {
      return (
        <EmptyStateCard
  title="Nenhuma entrada adicionada"
  text="Use os atalhos ou crie entradas personalizadas para montar a ordem do cortejo."
/>
      );
    }

    return (
      <div className="space-y-3">
        {usefulCortejo.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4"
          >
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
              Entrada {index + 1}
            </div>
            <div className="mt-1 text-[15px] font-black text-[#241a14]">
              {item.label || 'Sem identificação'}
            </div>
            <div className="mt-2 text-[14px] font-semibold text-[#6f5d51]">
              {item.musica || 'Sem música definida'}
            </div>
            {item.observacao ? (
              <div className="mt-2 text-[13px] leading-5 text-[#8a796d]">
                {item.observacao}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  const customSongsWithContent = (Array.isArray(customSongs) ? customSongs : []).filter((item) =>
    hasUsefulCustomSongItem(item)
  );
  const repertorioPdfUrl =
    data?.repertorio?.repertoire_pdf_url ||
    data?.repertorio?.repertoirePdfUrl ||
    data?.repertorio?.pdfUrl ||
    '';

  return (
    <div className="space-y-4">
      {!hasBackendRepertorio && showLocalDraftBanner ? (
        <section className="overflow-hidden rounded-[24px] border border-violet-200 bg-[linear-gradient(135deg,#f7f2ff_0%,#ffffff_58%,#f3ecff_100%)] p-4 shadow-[0_12px_30px_rgba(91,33,182,0.12)]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-lg">
              💾
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
                Rascunho local disponível
              </div>
              <div className="mt-1 text-[16px] font-black text-[#241a14]">
                Encontramos um rascunho local não salvo
              </div>
              <div className="mt-1 text-[13px] leading-5 text-[#6f5d51]">
                Você prefere restaurar esse conteúdo para continuar de onde parou ou descartar esse rascunho?
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRestoreLocalDraft}
                  className="rounded-[14px] bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] px-4 py-2 text-[13px] font-extrabold text-white shadow-[0_10px_20px_rgba(109,40,217,0.28)] transition hover:opacity-95"
                >
                  Restaurar
                </button>
                <button
                  type="button"
                  onClick={handleDiscardLocalDraft}
                  className="rounded-[14px] border border-[#dbcff5] bg-white px-4 py-2 text-[13px] font-bold text-[#5b3f85] transition hover:bg-[#f7f1ff]"
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

<TabHero
  badge="Repertório"
  title="Monte a trilha sonora do seu evento"
  text={
    isCustomEvent
      ? 'Escolha os estilos, artistas e músicas específicas do seu evento.'
      : 'Preencha com calma, revise tudo antes do envio final e acompanhe o que já veio das sugestões.'
  }
>
  {!travado ? (
    <div>
      <div className="mb-2 flex items-center justify-between text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
        <span>Progresso</span>
        <span>{progresso}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#eee6de]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#7c3aed_0%,#a78bfa_100%)] transition-all duration-500"
          style={{ width: `${progresso}%` }}
        />
      </div>
    </div>
  ) : (
    <div className="rounded-[18px] bg-emerald-50 px-4 py-4 text-[14px] font-bold text-emerald-700">
      Repertório finalizado e travado para edição.
    </div>
  )}
</TabHero>
{isWedding ? (
  <SectionCard>
    <div className="flex gap-3 overflow-x-auto pb-1">
      {visibleSteps.map((item) => (
        <MiniStep
          key={item.id}
          step={item.id}
          title={item.label}
          active={step === item.id}
          done={step > item.id}
          onClick={() => setStep(item.id)}
          disabled={false}
        />
      ))}
    </div>
  </SectionCard>
) : null}

      {isCustomEvent && !shouldShowFinalState ? (
        <SectionCard>
          <div className="text-[22px] font-black text-[#241a14]">Repertório do evento</div>
          <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
            Escolha os estilos musicais desejados e adicione até 8 músicas específicas.
          </div>

          <div className="mt-5">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
              Estilos musicais (obrigatório)
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {CUSTOM_EVENT_STYLE_OPTIONS.map((style) => {
                const selected = selectedStyles.includes(style);
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() =>
                      setSelectedStyles((prev) =>
                        selected
                          ? prev.filter((item) => item !== style)
                          : [...prev, style]
                      )
                    }
                    className={classNames(
                      'rounded-full border px-3 py-2 text-[12px] font-bold',
                      selected
                        ? 'border-violet-200 bg-violet-50 text-violet-700'
                        : 'border-[#eadfd6] bg-white text-[#6f5d51]'
                    )}
                  >
                    {style}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <InputField
              label="Artistas desejados"
              placeholder="Ex: Aline Barros, Hillsong, Isadora Pompeo"
              value={preferredArtists}
              onChange={(e) => setPreferredArtists(e.target.value)}
            />
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
                Músicas específicas
              </div>
              <div className="text-[11px] font-bold text-[#9b8576]">
                {customSongs.length}/{CUSTOM_EVENT_MAX_SONGS}
              </div>
            </div>

            <div className="mt-3 space-y-4">
              {customSongs.map((song, index) => (
                <div key={`custom-song-${index}`} className="rounded-[16px] border border-[#eadfd6] p-3">
                  <InputField
                    label={`Música ${index + 1}`}
                    placeholder="Nome da música"
                    value={song.song_name || ''}
                    onChange={(e) =>
                      setCustomSongs((prev) => {
                        const next = [...prev];
                        next[index] = { ...(next[index] || getDefaultCustomSongState()), song_name: e.target.value };
                        return next;
                      })
                    }
                  />
                  <ReferenceSearchInput
                    searchValue={song.song_name || ''}
                    referenceValue={song.reference_link || ''}
                    showManualInput={false}
                    selectedReference={
                      song.reference_video_id
                        ? {
                            videoId: song.reference_video_id || '',
                            title: song.reference_title || '',
                            channelTitle: song.reference_channel || '',
                            thumbnail: song.reference_thumbnail || '',
                          }
                        : null
                    }
                    onSearchValueChange={(value) =>
                      setCustomSongs((prev) => {
                        const next = [...prev];
                        next[index] = { ...(next[index] || getDefaultCustomSongState()), song_name: value };
                        return next;
                      })
                    }
                    onReferenceValueChange={(e) =>
                      setCustomSongs((prev) => {
                        const next = [...prev];
                        next[index] = {
                          ...(next[index] || getDefaultCustomSongState()),
                          reference_link: e.target.value,
                          reference_title: '',
                          reference_channel: '',
                          reference_thumbnail: '',
                          reference_video_id: '',
                        };
                        return next;
                      })
                    }
                    onSelectResult={(result) =>
                      setCustomSongs((prev) => {
                        const next = [...prev];
                        next[index] = {
                          ...(next[index] || getDefaultCustomSongState()),
                          reference_link: result.url,
                          song_name: result.title || next[index]?.song_name || '',
                          reference_title: result.title || '',
                          reference_channel: result.channelTitle || '',
                          reference_thumbnail: result.thumbnail || '',
                          reference_video_id: result.videoId || '',
                        };
                        return next;
                      })
                    }
                    onClearReference={() =>
                      setCustomSongs((prev) => {
                        const next = [...prev];
                        next[index] = {
                          ...(next[index] || getDefaultCustomSongState()),
                          reference_link: '',
                          reference_title: '',
                          reference_channel: '',
                          reference_thumbnail: '',
                          reference_video_id: '',
                        };
                        return next;
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setCustomSongs((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                    className="mt-2 text-[12px] font-bold text-rose-600"
                  >
                    Remover música
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={customSongs.length >= CUSTOM_EVENT_MAX_SONGS}
              onClick={() => setCustomSongs((prev) => [...prev, getDefaultCustomSongState()])}
              className="mt-4 w-full rounded-[16px] border border-dashed border-[#d9c8f7] px-4 py-3 text-[13px] font-black text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Adicionar música específica
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => saveRepertorio('draft')}
              disabled={savingMode !== '' || selectedStyles.length === 0}
              className="w-full rounded-[20px] border border-[#f1ddb1] bg-[#fff7e8] px-4 py-4 text-[15px] font-black text-[#9b6a17] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingMode === 'draft' ? 'Salvando rascunho...' : '💾 Salvar rascunho'}
            </button>

            <button
              type="button"
              onClick={() => saveRepertorio('final')}
              disabled={savingMode !== '' || selectedStyles.length === 0}
              className="w-full rounded-[20px] bg-[linear-gradient(135deg,#16a34a_0%,#22c55e_100%)] px-4 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(34,197,94,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingMode === 'final' ? 'Finalizando repertório...' : '✨ Finalizar repertório'}
            </button>
          </div>
        </SectionCard>
      ) : null}

      {isWedding && !travado && step === 1 && (
        <SectionCard>
          <div className="text-[22px] font-black text-[#241a14]">Bem-vindo! 💒</div>
          <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
            Aqui você monta a trilha sonora da sua cerimônia. Preencha cada etapa com facilidade e revise tudo antes de enviar.
          </div>

          <div className="mt-5 rounded-[22px] border border-[#eadfd6] bg-[#faf7f3] p-4">
            <div className="text-[15px] font-black text-[#241a14]">Como funciona</div>
            <div className="mt-3 space-y-2 text-[14px] font-semibold text-[#6f5d51]">
              <div>📝 Preencha cada etapa com as músicas desejadas</div>
              <div>🔗 Cole links do YouTube ou Spotify como referência</div>
              <div>💾 Salve como rascunho a qualquer momento</div>
              <div>✅ Quando estiver pronto, finalize o envio</div>
              <div>🔒 Depois do envio, o repertório ficará travado</div>
            </div>
          </div>
        </SectionCard>
      )}

     {isWedding && !travado && step === 2 && (
      <SectionCard>
        <div className="text-[22px] font-black text-[#241a14]">Antesala 🎶</div>
        <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
          Seu contrato possui antesala?
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => {
              setQuerAntessala(true);
              setAntessalaWithLog((prev) => ({ ...prev, requestedByClient: false }), 'disableAntesalaRequest');
            }}
            className={classNames(
              'flex-1 rounded-[18px] border px-4 py-4 text-[15px] font-black transition',
              querAntessala === true
                ? 'border-violet-200 bg-violet-50 text-violet-700'
                : 'border-[#eadfd6] bg-white text-[#241a14]'
            )}
          >
            Sim
          </button>
          <button
            type="button"
            onClick={() => setQuerAntessala(false)}
            className={classNames(
              'flex-1 rounded-[18px] border px-4 py-4 text-[15px] font-black transition',
              querAntessala === false
                ? 'border-zinc-200 bg-zinc-50 text-zinc-700'
                : 'border-[#eadfd6] bg-white text-[#241a14]'
            )}
          >
            Não
          </button>
        </div>

        {querAntessala === true ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-[18px] border border-[#eadfd6] bg-[#faf7f3] px-4 py-3 text-[13px] leading-5 text-[#6f5d51]">
              Essa opção adiciona um acréscimo ao valor acertado. Se esse ajuste já tiver sido combinado com nossa equipe, pode prosseguir normalmente.
            </div>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">Tempo da antesala</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {ANTESALA_DURATION_OPTIONS.map((option) => (
                  <button
                    key={option.minutes}
                    type="button"
                    onClick={() => setAntessalaWithLog({ ...antessala, durationMinutes: option.minutes }, 'setDurationMinutes')}
                    className={classNames(
                      'rounded-[14px] border px-3 py-3 text-[14px] font-black',
                      Number(antessala.durationMinutes || 0) === option.minutes
                        ? 'border-violet-200 bg-violet-50 text-violet-700'
                        : 'border-[#eadfd6] bg-white text-[#241a14]'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">Estilos desejados (opcional)</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {ANTESALA_STYLE_OPTIONS.map((style) => {
                  const selected = Array.isArray(antessala.styleTags) && antessala.styleTags.includes(style);
                  return (
                    <button
                      key={style}
                      type="button"
                      onClick={() =>
                        setAntessalaWithLog((prev) => ({
                          ...prev,
                          styleTags: selected
                            ? prev.styleTags.filter((item) => item !== style)
                            : [...(prev.styleTags || []), style],
                        }), 'toggleAntesalaStyleTag')
                      }
                      className={classNames(
                        'rounded-full border px-3 py-2 text-[12px] font-bold',
                        selected ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-[#eadfd6] bg-white text-[#6f5d51]'
                      )}
                    >
                      {style}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-[14px] font-semibold text-[#6f5d51]">
              <input type="checkbox" checked={!!antessala.preferredArtistsEnabled} onChange={(e) => setAntessalaWithLog({ ...antessala, preferredArtistsEnabled: e.target.checked }, 'togglePreferredArtists')} />
              Quero indicar artistas preferenciais
            </label>
            {antessala.preferredArtistsEnabled ? (
              <InputField
                label="Artistas preferenciais"
                placeholder="Ex.: Djavan, Jorge Vercilo, Marisa Monte"
                value={antessala.artistas || ''}
                onChange={(e) => setAntessalaWithLog({ ...antessala, artistas: e.target.value }, 'setPreferredArtists')}
              />
            ) : null}

            <label className="flex items-center gap-2 text-[14px] font-semibold text-[#6f5d51]">
              <input type="checkbox" checked={!!antessala.referenceEnabled} onChange={(e) => setAntessalaWithLog({ ...antessala, referenceEnabled: e.target.checked }, 'toggleReferenceEnabled')} />
              Quero adicionar referências específicas
            </label>
            {antessala.referenceEnabled ? (
              <div className="space-y-3">
                {(Array.isArray(antessala.references) ? antessala.references : []).slice(0, 5).map((reference, index) => (
                  <ReferenceSearchInput
                    key={`antesala-ref-${index}`}
                    searchValue={reference?.title || ''}
                    referenceValue={reference?.referencia || ''}
                    selectedReference={reference?.referenceMeta || null}
                    onSearchValueChange={(value) =>
                      setAntessalaWithLog((prev) => {
                        const next = [...(prev.references || [])];
                        next[index] = { ...(next[index] || {}), title: value };
                        return { ...prev, references: next };
                      })
                    }
                    onReferenceValueChange={(e) =>
                      setAntessalaWithLog((prev) => {
                        const next = [...(prev.references || [])];
                        next[index] = { ...(next[index] || {}), referencia: e.target.value };
                        return { ...prev, references: next };
                      })
                    }
                    onSelectResult={(result) =>
                      setAntessalaWithLog((prev) => {
                        const next = [...(prev.references || [])];
                        next[index] = {
                          referencia: result.url,
                          title: result.title || '',
                          reference_title: result.title || '',
                          reference_channel: result.channelTitle || '',
                          reference_thumbnail: result.thumbnail || '',
                          reference_video_id: result.videoId || '',
                          referenceMeta: {
                            videoId: result.videoId || '',
                            title: result.title || '',
                            channelTitle: result.channelTitle || '',
                            thumbnail: result.thumbnail || '',
                          },
                        };
                        return { ...prev, references: next };
                      })
                    }
                    onClearReference={() =>
                      setAntessalaWithLog((prev) => {
                        const next = [...(prev.references || [])];
                        next[index] = {};
                        return { ...prev, references: next };
                      })
                    }
                  />
                ))}
                {(antessala.references || []).length < 5 ? (
                  <button
                    type="button"
                    onClick={() => setAntessalaWithLog((prev) => ({ ...prev, references: [...(prev.references || []), {}] }), 'addAntesalaReference')}
                    className="rounded-[14px] border border-dashed border-[#d9c8f7] px-3 py-2 text-[12px] font-bold text-violet-700"
                  >
                    + Adicionar referência
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {querAntessala === false ? (
          <div className="mt-5 space-y-3">
            <div className="rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4 text-[14px] leading-6 text-[#7a6a5e]">
              Você pode seguir normalmente com o repertório sem antesala.
            </div>
            <a
              href={antesalaSupportWhatsAppUrl}
              target={hasAntesalaSupportWhatsApp ? '_blank' : undefined}
              rel={hasAntesalaSupportWhatsApp ? 'noreferrer' : undefined}
              aria-disabled={!hasAntesalaSupportWhatsApp}
              onClick={(event) => {
                if (!hasAntesalaSupportWhatsApp) event.preventDefault();
              }}
              className={classNames(
                'block w-full rounded-[16px] border px-4 py-3 text-center text-[14px] font-black transition',
                hasAntesalaSupportWhatsApp
                  ? 'border-[#d9c8f7] bg-[#fcfbff] text-violet-700 hover:bg-violet-50'
                  : 'cursor-not-allowed border-[#eadfd6] bg-zinc-100 text-zinc-400'
              )}
            >
              Solicitar à equipe
            </a>
          </div>
        ) : null}

        {isAntesalaApproved ? (
          <div className="mt-4 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-bold text-emerald-700">
            Antesala incluída • {ANTESALA_DURATION_OPTIONS.find((item) => item.minutes === Number(antessala.durationMinutes || 30))?.label || '30 min'}
          </div>
        ) : null}
      </SectionCard>
)}

      {isWedding && !travado && step === 3 && (
        <SectionCard>
          <div data-onboarding-tour="onboarding-section-cortejo" className="text-[22px] font-black text-[#241a14]">Cortejo 💒</div>
          <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
            Monte a ordem das entradas com facilidade. Use os atalhos abaixo ou crie entradas personalizadas.
          </div>

          <div className="mt-5">
            <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
              Atalhos de ordem
            </div>
            <div className="flex flex-wrap gap-2">
              {quickCortejo.map((item) => (
                <QuickOrderPill
                  key={item}
                  label={item}
                  onClick={() => addCortejo(item)}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {cortejo.map((item, index) => (
              <EntryCard
                key={`cortejo-${index}`}
                index={index}
                title="Entrada"
                subtitle="Personalize música, referência e observações"
                item={item}
                onChange={(value) => updateListItem(cortejo, setCortejoWithLog, index, value, 'cortejo')}
                onMoveUp={() => moveItem(cortejo, setCortejoWithLog, index, -1)}
                onMoveDown={() => moveItem(cortejo, setCortejoWithLog, index, 1)}
                onMoveRight={() => moveItemBetweenSections('cortejo', index, 'right')}
                moveRightTitle="Mover para Cerimônia"
                onRemove={() => removeItem(cortejo, setCortejoWithLog, index, 'cortejo')}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => addCortejo('')}
            data-onboarding-tour="onboarding-add-song-cortejo"
            className="mt-5 w-full rounded-[20px] border-2 border-dashed border-[#d9c8f7] bg-[#fcfbff] px-4 py-4 text-[15px] font-black text-violet-700"
          >
            + Adicionar entrada personalizada
          </button>
        </SectionCard>
      )}

      {isWedding && !travado && step === 4 && (
        <SectionCard>
          <div data-onboarding-tour="onboarding-section-cerimonia" className="text-[22px] font-black text-[#241a14]">Cerimônia ⛪</div>
          <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
            Cadastre os momentos musicais internos da cerimônia.
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {['Alianças', 'Assinatura', 'Momento de Gratidão', 'Comunhão'].map((item) => (
              <QuickOrderPill
                key={item}
                label={item}
                onClick={() => addCerimonia(item)}
              />
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {cerimonia.map((item, index) => (
              <EntryCard
                key={`cerimonia-${index}`}
                index={index}
                title="Momento"
                subtitle="Escolha a música e detalhe a referência"
                item={item}
                onChange={(value) => updateListItem(cerimonia, setCerimoniaWithLog, index, value, 'cerimonia')}
                onMoveUp={() => moveItem(cerimonia, setCerimoniaWithLog, index, -1)}
                onMoveDown={() => moveItem(cerimonia, setCerimoniaWithLog, index, 1)}
                onMoveLeft={() => moveItemBetweenSections('cerimonia', index, 'left')}
                onMoveRight={() => moveItemBetweenSections('cerimonia', index, 'right')}
                moveLeftTitle="Mover para Cortejo"
                moveRightTitle="Mover para Saída dos noivos"
                onRemove={() => removeItem(cerimonia, setCerimoniaWithLog, index, 'cerimonia')}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => addCerimonia('')}
            data-onboarding-tour="onboarding-add-song-cerimonia"
            className="mt-5 w-full rounded-[20px] border-2 border-dashed border-[#d9c8f7] bg-[#fcfbff] px-4 py-4 text-[15px] font-black text-violet-700"
          >
            + Adicionar momento personalizado
          </button>
        </SectionCard>
      )}

      {isWedding && !travado && step === 5 && (
        <SectionCard>
          <div className="text-[22px] font-black text-[#241a14]">Saída dos noivos 🎉</div>
          <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
            Defina a música da saída e observações gerais do repertório.
          </div>

          <div className="mt-5 space-y-4">
            {hasUsefulListItem(saida) ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={moveSaidaToCerimonia}
                  title="Mover para Cerimônia"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#eadfd6] bg-[#faf7f3] text-sm"
                >
                  ←
                </button>
              </div>
            ) : null}
            <InputField
              label="Música da saída"
              placeholder="Ex: Signed, Sealed, Delivered"
              value={saida.musica}
              onChange={(e) => {
                const nextSaida = { ...saida, musica: e.target.value, source: 'manual' };
                console.log('[REPERTORIO][MANUAL_INPUT]', { section: 'saida', value: nextSaida });
                setSaida(nextSaida);
              }}
            />
            <ReferenceSearchInput
              searchValue={saida.musica || ''}
              referenceValue={saida.referencia || ''}
              selectedReference={saida.referenceMeta || null}
              onSearchValueChange={(value) => {
                const nextSaida = { ...saida, musica: value, source: 'manual' };
                console.log('[REPERTORIO][MANUAL_INPUT]', { section: 'saida', value: nextSaida });
                setSaida(nextSaida);
              }}
              onReferenceValueChange={(e) =>
                setSaida({
                  ...saida,
                  referencia: e.target.value,
                  referenceMeta: null,
                  reference_title: '',
                  reference_channel: '',
                  reference_thumbnail: '',
                  reference_video_id: '',
                  source: 'manual',
                })
              }
              onSelectResult={(result) =>
                setSaida({
                  ...saida,
                  referencia: result.url,
                  musica: result.title || saida.musica || '',
                  reference_title: result.title || '',
                  reference_channel: result.channelTitle || '',
                  reference_thumbnail: result.thumbnail || '',
                  reference_video_id: result.videoId || '',
                  referenceMeta: {
                    videoId: result.videoId || '',
                    title: result.title || '',
                    channelTitle: result.channelTitle || '',
                    thumbnail: result.thumbnail || '',
                  },
                })
              }
              onClearReference={() =>
                setSaida({
                  ...saida,
                  referencia: '',
                  referenceMeta: null,
                  reference_title: '',
                  reference_channel: '',
                  reference_thumbnail: '',
                  reference_video_id: '',
                  source: 'manual',
                })
              }
            />
            <InputField
              label="Observações"
              placeholder="Algo especial para esse momento?"
              value={saida.observacao}
              onChange={(e) => {
                const nextSaida = { ...saida, observacao: e.target.value, source: 'manual' };
                console.log('[REPERTORIO][MANUAL_INPUT]', { section: 'saida', value: nextSaida });
                setSaida(nextSaida);
              }}
              textarea
              rows={3}
            />
          </div>
        </SectionCard>
      )}

      {isWedding && !travado && step === 6 && (
        <>
          {data.repertorio.temReceptivo ? (
            <SectionCard>
              <div className="text-[22px] font-black text-[#241a14]">Receptivo 🎤</div>
              <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
                Personalize o repertório do momento de recepção, se este serviço estiver incluído.
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-[16px] border border-violet-200 bg-violet-50 px-4 py-3 text-[14px] font-black text-violet-700">
                  Receptivo incluído: {receptivoDuracaoLabel}
                </div>

                <InputField
                  label="Gêneros preferidos"
                  placeholder="Ex: MPB, Bossa Nova, Pop Internacional..."
                  value={receptivo.generos}
                  onChange={(e) =>
                    setReceptivo({ ...receptivo, generos: e.target.value })
                  }
                />
                <InputField
                  label="Artistas de referência"
                  placeholder="Ex: Marisa Monte, Michael Bublé, Tim Maia..."
                  value={receptivo.artistas}
                  onChange={(e) =>
                    setReceptivo({ ...receptivo, artistas: e.target.value })
                  }
                  textarea
                  rows={3}
                />
                <InputField
                  label="Observações"
                  placeholder="Preferências, restrições ou clima desejado..."
                  value={receptivo.observacao}
                  onChange={(e) =>
                    setReceptivo({ ...receptivo, observacao: e.target.value })
                  }
                  textarea
                  rows={3}
                />
              </div>
            </SectionCard>
          ) : (
            <LockedSectionCard
              title="Receptivo não incluído"
              text="Essa etapa está bloqueada porque não consta no contrato deste evento."
            />
          )}
        </>
      )}

      {isWedding && !travado && step === 7 && (
        <div className="space-y-4">
          <SectionCard>
            <div className="text-[22px] font-black text-[#241a14]">Revisão final 📋</div>
            <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
              Confira tudo com calma antes do envio definitivo. Após finalizar, o repertório ficará travado.
            </div>
          </SectionCard>

          <SectionCard>
            <div className="mb-4 text-[18px] font-black text-[#241a14]">Resumo do cortejo</div>
            {renderResumoCortejo()}
          </SectionCard>

          <SectionCard>
            <div className="mb-4 text-[18px] font-black text-[#241a14]">Resumo geral</div>
            <div className="space-y-3">
              <RowInfo
  icon="🎶"
  label="Antessala"
  value={
    isAntesalaPending
      ? 'Solicitada • aguardando confirmação'
      : isAntesalaApproved
      ? `Incluída • ${ANTESALA_DURATION_OPTIONS.find((item) => item.minutes === Number(antessala.durationMinutes || 30))?.label || '30 min'}`
      : querAntessala === false
      ? 'Sem antesala'
      : 'Não definido'
  }
/>
              <RowInfo icon="💒" label="Entradas no cortejo" value={String(filterUsefulMusicalItems(cortejo).length)} />
              <RowInfo icon="⛪" label="Momentos da cerimônia" value={String(filterUsefulMusicalItems(cerimonia).length)} />
              <RowInfo icon="🎉" label="Música da saída" value={saida.musica || 'Não definida'} />
              <RowInfo
                icon="🎤"
                label="Receptivo"
                value={
                  temReceptivo
                    ? (
                      data?.event?.reception_formation &&
                      data?.event?.reception_instruments
                        ? `${data.event.reception_formation} (${data.event.reception_instruments}) — ${Number(data?.event?.reception_hours || 0)}h`
                        : `Sim — ${Number(data?.event?.reception_hours || 0)}h`
                    )
                    : 'Não incluído'
                }
              />
              <RowInfo icon="✨" label="Músicas no repertório" value={String(renderedRepertorioItems.length)} />
            </div>
          </SectionCard>

          <div className="space-y-3">
<button
  type="button"
  onClick={() => saveRepertorio('draft')}
  data-onboarding-tour="onboarding-save-repertoire"
  disabled={savingMode !== ''}
  className="w-full rounded-[20px] border border-[#f1ddb1] bg-[#fff7e8] px-4 py-4 text-[15px] font-black text-[#9b6a17] disabled:cursor-not-allowed disabled:opacity-60"
>
  {savingMode === 'draft' ? 'Salvando rascunho...' : '💾 Salvar rascunho'}
</button>

<button
  type="button"
  onClick={() => saveRepertorio('final')}
  data-onboarding-tour="onboarding-submit-repertoire"
  disabled={savingMode !== ''}
  className="w-full rounded-[20px] bg-[linear-gradient(135deg,#16a34a_0%,#22c55e_100%)] px-4 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(34,197,94,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
>
  {savingMode === 'final' ? 'Finalizando repertório...' : '✨ Finalizar repertório'}
</button>
          </div>
        </div>
      )}

      {shouldShowFinalState && (
        <div className="space-y-4">
          <SectionCard className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fff9_100%)]">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl">
                ✅
              </div>
              <div>
                <div className="text-[22px] font-black text-[#241a14]">
                  {aguardandoRevisao ? 'Revisão solicitada' : 'Repertório enviado'}
                </div>
                <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
                  {aguardandoRevisao
                    ? 'Recebemos seu pedido de revisão. O repertório segue bloqueado até liberação da equipe.'
                    : 'Seu repertório já foi enviado e agora está travado para edição. Caso precise ajustar algo, solicite revisão.'}
                </div>
              </div>
            </div>
          </SectionCard>

          {isWedding ? (
            <SectionCard>
              <div className="mb-4 text-[18px] font-black text-[#241a14]">Resumo do cortejo</div>
              {renderResumoCortejo()}
            </SectionCard>
          ) : (
            <SectionCard>
              <div className="mb-4 text-[18px] font-black text-[#241a14]">Resumo do evento</div>
              <div className="space-y-3">
                <RowInfo
                  icon="🎼"
                  label="Estilos selecionados"
                  value={
                    Array.isArray(selectedStyles) && selectedStyles.length > 0
                      ? selectedStyles.join(', ')
                      : 'Não informado'
                  }
                />
                <RowInfo
                  icon="🎤"
                  label="Artistas desejados"
                  value={preferredArtists || 'Não informado'}
                />
                <RowInfo
                  icon="🎵"
                  label="Músicas específicas"
                  value={String(customSongsWithContent.length)}
                />
              </div>
            </SectionCard>
          )}
          {isWedding && renderedRepertorioItems.length > 0 && (
            <SectionCard>
              <div className="mb-4 text-[18px] font-black text-[#241a14]">
                Músicas no repertório
              </div>

              <div className="space-y-3">
                {renderedRepertorioItems.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4"
                  >
                    <div className="text-[15px] font-black text-[#241a14]">
                      {item.title}
                    </div>
                    <div className="mt-1 text-[13px] font-semibold text-[#7a6a5e]">
                      {item.subtitle || item.section}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#faf7f3] px-2 py-1 text-[10px] font-black text-[#7a6a5e]">
                        {item.section}
                      </span>
                      {item.label ? (
                        <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-black text-violet-700">
                          {item.label}
                        </span>
                      ) : null}
                    </div>
                    {item.notes ? (
                      <div className="mt-2 text-[13px] leading-5 text-[#8a796d]">
                        {item.notes}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          <div className="space-y-3">
            {repertorioPdfUrl ? (
              <a
                href={repertorioPdfUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  debugClientHome(
                    '[CLIENTE REPERTORIO UI] URL usada no botão Baixar PDF:',
                    repertorioPdfUrl || '(vazio)'
                  );
                }}
                className="flex w-full items-center justify-center rounded-[20px] border border-[#e6d8ff] bg-violet-50 px-4 py-4 text-center text-[15px] font-black text-violet-700"
              >
                📄 Baixar PDF do repertório
              </a>
            ) : null}

            <button
              type="button"
              data-onboarding-tour="client-review-action"
              onClick={handleRequestReview}
              disabled={aguardandoRevisao}
              className="w-full rounded-[20px] bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] px-4 py-4 text-[15px] font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aguardandoRevisao
                ? 'Revisão solicitada, aguardando liberação'
                : 'Solicitar revisão'}
            </button>
          </div>
        </div>
      )}

      {isWedding && !travado && (
  <div className="flex gap-3">
    <button
      type="button"
      onClick={() => setStep((prev) => Math.max(1, prev - 1))}
      className="flex-1 rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4 text-[15px] font-black text-[#241a14]"
    >
      ← Voltar
    </button>

    {step < 7 ? (
      <button
        type="button"
        onClick={() => setStep((prev) => Math.min(7, prev + 1))}
        className="flex-1 rounded-[18px] bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] px-4 py-4 text-[15px] font-black text-white"
      >
        Próximo →
      </button>
    ) : null}
  </div>
)}
    </div>
  );
}

function extractYoutubeEmbedUrl(videoId) {
  if (!videoId) return '';
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`;
}

function getPlayerVideoId(item) {
  if (!item) return '';

  return (
    String(item?.reference_video_id || '').trim() ||
    String(item?.referenceVideoId || '').trim() ||
    String(item?.youtubeId || '').trim() ||
    getYoutubeVideoId(item?.reference_link || item?.url || '')
  );
}

function SuggestionChipBar({ items, active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => {
        const selected = active === item;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={classNames(
              'whitespace-nowrap rounded-full px-4 py-2 text-[12px] font-black transition',
              selected
                ? 'bg-violet-100 text-violet-700'
                : 'border border-[#eadfd6] bg-white text-[#6f5d51]'
            )}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
function getEditorialBadges(item) {
  const badges = [];

  if (item.isAdded) {
    badges.push({
      label: 'Já adicionada',
      tone: 'success',
    });
  }

  if (item.isFavorite) {
    badges.push({
      label: 'Favorita',
      tone: 'favorite',
    });
  }

  if (item.featured) {
    badges.push({
      label: 'Muito escolhida',
      tone: 'highlight',
    });
  }

  if (item.genre === 'Gospel') {
    badges.push({
      label: 'Gospel nacional',
      tone: 'gospel',
    });
  }

  if (item.genre === 'Gospel Instrumental' || item.genre === 'Instrumental') {
    badges.push({
      label: 'Instrumental elegante',
      tone: 'soft',
    });
  }

  if (
    item.moment === 'Entrada' &&
    (item.tags || []).some((tag) =>
      ['noiva', 'entrada', 'romantica', 'emocionante'].includes(
        String(tag).toLowerCase()
      )
    )
  ) {
    badges.push({
      label: 'Entrada perfeita',
      tone: 'romantic',
    });
  }

  if (
    (item.tags || []).some((tag) =>
      ['moderno', 'casamento', 'adoracao'].includes(String(tag).toLowerCase())
    )
  ) {
    badges.push({
      label: 'Em alta',
      tone: 'trend',
    });
  }

  return badges.slice(0, 3);
}

function EditorialBadge({ badge }) {
  const toneMap = {
    success: 'bg-emerald-500 text-white',
    favorite: 'bg-pink-100 text-pink-700',
    highlight: 'bg-amber-100 text-amber-800',
    gospel: 'bg-violet-100 text-violet-700',
    soft: 'bg-sky-100 text-sky-700',
    romantic: 'bg-rose-100 text-rose-700',
    trend: 'bg-[#241a14] text-white',
  };

  return (
    <span
      className={classNames(
        'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]',
        toneMap[badge.tone] || 'bg-zinc-100 text-zinc-700'
      )}
    >
      {badge.label}
    </span>
  );
}

function CollectionCard({ item, onPlay, onFav, onAdd }) {
      const editorialBadges = getEditorialBadges(item);
  return (
    <div className="min-w-[260px] overflow-hidden rounded-[26px] border border-[#eadfd6] bg-white shadow-[0_12px_30px_rgba(36,26,20,0.08)]">
      <div className="relative h-[156px] overflow-hidden bg-[#f3ece5]">
        <img
          src={item.thumbnailUrl || '/images/song-placeholder.jpg'}
          alt={item.title}
          className="h-full w-full object-cover transition duration-500"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(20,14,12,0.80)] via-[rgba(20,14,12,0.12)] to-transparent" />

        <div className="absolute left-3 top-3">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#241a14] shadow-sm">
            {item.moment}
          </span>
        </div>

        <button
          type="button"
          onClick={onFav}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-[18px] shadow-sm transition active:scale-95"
        >
          {item.isFavorite ? '💜' : '🤍'}
        </button>

        {item.isAdded ? (
          <div className="absolute bottom-3 left-3">
            <span className="rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-sm">
              Adicionada
            </span>
          </div>
        ) : null}
      </div>

      <div className="p-4">
        <div className="line-clamp-1 text-[16px] font-black text-[#241a14]">
          {item.title}
        </div>

        <div className="mt-1 line-clamp-1 text-[13px] font-semibold text-[#7a6a5e]">
          {item.artist}
        </div>

        {item.description ? (
          <div className="mt-3 line-clamp-2 text-[13px] leading-5 text-[#8a796d]">
            {item.description}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
  <span className="rounded-full bg-[#faf7f3] px-2.5 py-1 text-[10px] font-black text-[#7a6a5e]">
    {item.genre}
  </span>
  <span className="rounded-full bg-[#f4efff] px-2.5 py-1 text-[10px] font-black text-violet-700">
    {item.moment}
  </span>

  {editorialBadges.map((badge) => (
    <EditorialBadge key={badge.label} badge={badge} />
  ))}
</div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPlay}
            className="rounded-[15px] bg-[#241a14] px-3 py-3 text-[12px] font-black text-white shadow-sm transition active:scale-[0.98]"
          >
            ▶ Ouvir
          </button>

          <button
            type="button"
            onClick={onAdd}
            className="rounded-[15px] bg-violet-600 px-3 py-3 text-[12px] font-black text-white shadow-sm transition active:scale-[0.98]"
          >
            {item.isAdded ? '✓ Adicionada' : '+ Repertório'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SongListCard({ item, onPlay, onFav, onAdd }) {
      const editorialBadges = getEditorialBadges(item);
  return (
    <div className="overflow-hidden rounded-[24px] border border-[#eadfd6] bg-white shadow-[0_10px_26px_rgba(36,26,20,0.06)]">
      <div className="flex gap-4 p-4">
        <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[18px] bg-[#f3ece5]">
          <img
            src={item.thumbnailUrl || '/images/song-placeholder.jpg'}
            alt={item.title}
            className="h-full w-full object-cover"
          />

          {item.isAdded ? (
            <div className="absolute bottom-2 left-2">
              <span className="rounded-full bg-emerald-500 px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-white shadow-sm">
                Adicionada
              </span>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="line-clamp-1 text-[16px] font-black text-[#241a14]">
                {item.title}
              </div>
              <div className="mt-1 line-clamp-1 text-[13px] font-semibold text-[#7a6a5e]">
                {item.artist}
              </div>
            </div>

            <button
              type="button"
              onClick={onFav}
              className="shrink-0 rounded-full bg-[#faf7f3] p-2 text-[18px] transition active:scale-95"
            >
              {item.isFavorite ? '💜' : '🤍'}
            </button>
          </div>

         <div className="mt-3 flex flex-wrap gap-2">
  <span className="rounded-full bg-[#faf7f3] px-2.5 py-1 text-[10px] font-black text-[#7a6a5e]">
    {item.genre}
  </span>
  <span className="rounded-full bg-[#f4efff] px-2.5 py-1 text-[10px] font-black text-violet-700">
    {item.moment}
  </span>

  {editorialBadges.map((badge) => (
    <EditorialBadge key={badge.label} badge={badge} />
  ))}
</div>

          {item.description ? (
            <div className="mt-3 line-clamp-2 text-[13px] leading-5 text-[#8b786b]">
              {item.description}
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-[#f1e8e1] bg-[#fffdfa] px-4 py-3">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onPlay}
            className="rounded-[14px] bg-[#241a14] px-3 py-3 text-[12px] font-black text-white transition active:scale-[0.98]"
          >
            ▶ Ouvir
          </button>

          <button
            type="button"
            onClick={onFav}
            className="rounded-[14px] border border-[#eadfd6] bg-white px-3 py-3 text-[12px] font-black text-[#241a14] transition active:scale-[0.98]"
          >
            {item.isFavorite ? 'Favorita' : 'Favoritar'}
          </button>

          <button
            type="button"
            onClick={onAdd}
            className={classNames(
              'rounded-[14px] px-3 py-3 text-[12px] font-black text-white transition active:scale-[0.98]',
              item.isAdded ? 'bg-emerald-600' : 'bg-violet-600'
            )}
          >
            {item.isAdded ? '✓ Adicionada' : '+ Repertório'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniMusicPlayer({ current, onClose, onExpand }) {
  if (!current) return null;

  return (
    <div className="fixed bottom-[96px] left-0 right-0 z-40 px-4">
      <div className="mx-auto max-w-[520px] overflow-hidden rounded-[24px] border border-white/30 bg-[rgba(255,255,255,0.88)] shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <div className="flex items-center gap-3 px-3 pb-2 pt-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[16px] bg-[#f3ece5]">
            <img
              src={current.thumbnailUrl}
              alt={current.title}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-emerald-700">
                Tocando agora
              </span>
            </div>

            <div className="mt-1 line-clamp-1 text-[14px] font-black text-[#241a14]">
              {current.title}
            </div>
            <div className="mt-0.5 line-clamp-1 text-[12px] font-semibold text-[#7a6a5e]">
              {current.artist}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExpand}
              className="rounded-[14px] bg-violet-50 px-3 py-2 text-[12px] font-black text-violet-700 transition active:scale-95"
            >
              Abrir
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-[14px] border border-[#eadfd6] bg-white px-3 py-2 text-[12px] font-black text-[#241a14] transition active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-3 pb-3">
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-[#9b8576]">
            <span>Harmonics player</span>
            <span>YouTube interno</span>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-[#ece4dc]">
            <div className="h-full w-[38%] rounded-full bg-[linear-gradient(90deg,#7c3aed_0%,#a78bfa_100%)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
function PlayerModal({ current, onClose, onFav, onAdd }) {
  if (!current) return null;
  const editorialBadges = current ? getEditorialBadges(current) : [];
  const videoId = getPlayerVideoId(current);
  const embedUrl = extractYoutubeEmbedUrl(videoId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,14,12,0.52)] p-4 sm:items-center">
      <div className="w-full max-w-[560px] overflow-hidden rounded-[30px] border border-[#eadfd6] bg-white shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
        <div className="relative h-[180px] overflow-hidden bg-[#f3ece5]">
          <img
            src={current.thumbnailUrl}
            alt={current.title}
            className="h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(20,14,12,0.84)] via-[rgba(20,14,12,0.18)] to-transparent" />

          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/92 px-3 py-2 text-[12px] font-black text-[#241a14] shadow-sm"
          >
            Fechar
          </button>

          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex flex-wrap gap-2">
  <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#241a14]">
    {current.genre}
  </span>
  <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#241a14]">
    {current.moment}
  </span>

  {editorialBadges.map((badge) => (
    <span
      key={badge.label}
      className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#241a14]"
    >
      {badge.label}
    </span>
  ))}
</div>

            <div className="mt-3 text-[22px] font-black leading-tight text-white">
              {current.title}
            </div>
            <div className="mt-1 text-[14px] font-semibold text-white/85">
              {current.artist}
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="overflow-hidden rounded-[22px] bg-black shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
            <div className="aspect-video w-full">
              {embedUrl ? (
                <iframe
                  key={videoId}
                  title={current.title}
                  src={embedUrl}
                  className="h-full w-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-4 text-center text-[14px] font-semibold text-white/75">
                  Sem vídeo disponível
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-emerald-700">
                Tocando no painel
              </span>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-[#ece4dc]">
              <div className="h-full w-[52%] rounded-full bg-[linear-gradient(90deg,#7c3aed_0%,#a78bfa_100%)]" />
            </div>
          </div>

          {current.description ? (
            <div className="mt-5 rounded-[20px] bg-[#faf7f3] px-4 py-4 text-[14px] leading-6 text-[#6f5d51]">
              {current.description}
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onFav}
              className="rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4 text-[14px] font-black text-[#241a14] transition active:scale-[0.98]"
            >
              {current.isFavorite ? '💜 Favorita' : '🤍 Favoritar'}
            </button>

            <button
              type="button"
              onClick={onAdd}
              className={classNames(
                'rounded-[18px] px-4 py-4 text-[14px] font-black text-white transition active:scale-[0.98]',
                current.isAdded ? 'bg-emerald-600' : 'bg-violet-600'
              )}
            >
              {current.isAdded ? '✓ Já adicionada' : '+ Adicionar ao repertório'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddSongSheetInner({ music, onClose, onConfirm }) {
  const [section, setSection] = useState('Cortejo');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');

  if (!music) return null;

  const options = ['Cortejo', 'Cerimônia', 'Saída', 'Antessala', 'Receptivo'];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[rgba(20,14,12,0.35)]">
      <div className="w-full rounded-t-[28px] border border-[#eadfd6] bg-white p-5 shadow-[0_-20px_60px_rgba(0,0,0,0.18)]">
        <div className="text-[20px] font-black text-[#241a14]">Adicionar ao repertório</div>

        <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
          {music.title} — {music.artist}
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
              Onde deseja usar esta música?
            </div>

            <div className="grid grid-cols-2 gap-2">
              {options.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSection(item)}
                  className={classNames(
                    'rounded-[16px] border px-4 py-4 text-[13px] font-black',
                    section === item
                      ? 'border-violet-200 bg-violet-50 text-violet-700'
                      : 'border-[#eadfd6] bg-white text-[#241a14]'
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <InputField
            label="Momento / identificação"
            placeholder="Ex: Entrada da noiva, alianças, padrinhos..."
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />

          <InputField
            label="Observações"
            placeholder="Algo específico sobre essa escolha?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            textarea
            rows={3}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4 text-[14px] font-black text-[#241a14]"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => onConfirm({ section, label, notes })}
            className="rounded-[18px] bg-violet-600 px-4 py-4 text-[14px] font-black text-white"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

function AddSongSheet({ music, onClose, onConfirm }) {
  if (!music) return null;

  const musicKey = [music.id, music.title, music.artist].filter(Boolean).join('::') || 'music';

  return (
    <AddSongSheetInner
      key={musicKey}
      music={music}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function SugestoesTab({
  selectedSongs,
  setSelectedSongs,
  favoriteSongIds,
  setFavoriteSongIds,
  repertorioStatus = '',
  repertorioLocked = false,
  clientToken = '',
  eventId = '',
}) {
  const safeSelectedSongs = useMemo(
    () => (Array.isArray(selectedSongs) ? selectedSongs : []),
    [selectedSongs]
  );
  const safeFavoriteSongIds = useMemo(
    () => (Array.isArray(favoriteSongIds) ? favoriteSongIds : []),
    [favoriteSongIds]
  );

  function mapSuggestionSongFromCatalog(song = {}) {
    const title = String(song?.title || '').trim();
    if (!title) return null;

    const youtubeId =
      String(song?.youtube_id || '').trim() || getYoutubeVideoId(song?.youtube_url) || '';

    return {
      id: String(song?.id || ''),
      title,
      artist: String(song?.artist || '').trim() || 'Artista não informado',
      genre: String(song?.genre?.name || '').trim() || 'Outros',
      moment: String(song?.moment?.name || '').trim() || 'Cerimônia',
      youtubeId,
      thumbnailUrl:
        String(song?.thumbnail_url || '').trim() ||
        (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : ''),
      description: String(song?.description || '').trim(),
      isFavorite: false,
      isAdded: false,
      featured: Boolean(song?.is_featured || song?.is_recommended),
      tags: [],
    };
  }

   const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState('Todos');
  const [genreFilter, setGenreFilter] = useState('Todos');
  const [momentFilter, setMomentFilter] = useState('Todos');
  const hasActiveFilters =
  search.trim() !== '' ||
  quickFilter !== 'Todos' ||
  genreFilter !== 'Todos' ||
  momentFilter !== 'Todos';


  const [songs, setSongs] = useState([]);
  const [isLoadingSongs, setIsLoadingSongs] = useState(true);
  const [songsError, setSongsError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  const suggestionCacheKey = useMemo(() => {
    const tokenKey = String(clientToken || '').trim();
    const eventKey = String(eventId || '').trim();
    return `${tokenKey || 'sem_token'}::${eventKey || 'sem_evento'}`;
  }, [clientToken, eventId]);

  const handleRetryLoadSongs = useCallback(() => {
    setLoadAttempt((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const hasWarmCache =
      Array.isArray(suggestionSongsCache.songs) &&
      suggestionSongsCache.songs.length > 0 &&
      suggestionSongsCache.cacheKey === suggestionCacheKey;
    const cacheAgeMs = Date.now() - Number(suggestionSongsCache.loadedAt || 0);
    const isCacheFresh = hasWarmCache && cacheAgeMs < SUGGESTION_SONGS_CACHE_TTL_MS;

    if (hasWarmCache) {
      setSongs(suggestionSongsCache.songs);
      setIsLoadingSongs(false);
    }

    if (isCacheFresh && loadAttempt === 0) {
      return () => {
        isMounted = false;
      };
    }

    async function loadSuggestionSongs() {
      try {
        if (!hasWarmCache) {
          setIsLoadingSongs(true);
        }
        setSongsError('');
        const query = new URLSearchParams();
        if (String(clientToken || '').trim()) query.set('token', String(clientToken || '').trim());
        if (String(eventId || '').trim()) query.set('event_id', String(eventId || '').trim());
        const endpoint = `/api/cliente/sugestoes${query.toString() ? `?${query.toString()}` : ''}`;
        const response = await fetch(endpoint, { cache: 'no-store' });
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (!response.ok || payload?.ok === false) {
          throw new Error(
            payload?.error || 'Falha ao carregar catálogo de sugestões.'
          );
        }

        const catalogSongs = Array.isArray(payload?.songs)
          ? payload.songs
              .map(mapSuggestionSongFromCatalog)
              .filter(Boolean)
          : [];

        if (isMounted) {
          setSongs(catalogSongs);
          suggestionSongsCache = {
            loadedAt: Date.now(),
            songs: catalogSongs,
            cacheKey: suggestionCacheKey,
          };
        }
      } catch (error) {
        console.error('[SUGESTOES] não foi possível carregar catálogo editorial:', error);
        if (isMounted) {
          setSongsError(
            'Não conseguimos carregar as sugestões agora. Tente novamente em instantes.'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingSongs(false);
        }
      }
    }

    loadSuggestionSongs();
    return () => {
      isMounted = false;
    };
  }, [loadAttempt, clientToken, eventId, suggestionCacheKey]);
  const hydratedSongs = useMemo(() => {
    return songs.map((song) => ({
      ...song,
      isFavorite: safeFavoriteSongIds.includes(song.id),
      isAdded: safeSelectedSongs.some((item) => item.songId === song.id),
    }));
  }, [songs, safeFavoriteSongIds, safeSelectedSongs]);

  const [currentSong, setCurrentSong] = useState(null);
  const [expandedSong, setExpandedSong] = useState(null);
  const [sheetSong, setSheetSong] = useState(null);

  const quickFilters = ['Todos', 'Favoritas', 'Mais escolhidas', 'Já adicionadas'];
  const genres = [
  'Todos',
  'Gospel',
  'Gospel Instrumental',
  'Clássico',
  'Instrumental',
  'Romântico',
  'Pop',
];

const moments = [
  'Todos',
  'Entrada',
  'Cortejo',
  'Cerimônia',
  'Saída',
  'Antessala',
  'Receptivo',
];

    function toggleFavorite(songId) {
    const isFav = safeFavoriteSongIds.includes(songId);

    if (isFav) {
      setFavoriteSongIds((prev) => prev.filter((id) => id !== songId));
      showToast('Removida das favoritas', 'default');
    } else {
      setFavoriteSongIds((prev) => [...prev, songId]);
      showToast('Adicionada às favoritas 💜', 'success');
    }
  }

  const repertorioTravado = useMemo(
    () => isRepertorioTravado(repertorioStatus, repertorioLocked),
    [repertorioStatus, repertorioLocked]
  );

  function markAdded(songId, payload) {
    debugClientHome('[SUGESTOES][ADD_ATTEMPT]', { songId, payload });
    debugClientHome('[SUGESTOES][LOCK_STATE]', {
      status: repertorioStatus,
      isLocked: Boolean(repertorioLocked),
      travado: repertorioTravado,
    });

    if (repertorioTravado) {
      debugClientHome('[SUGESTOES][BLOCKED_ADD]', {
        songId,
        reason: 'repertorio_locked',
      });
      showToast('Solicite revisão do repertório para realizar essa ação.', 'error');
      return;
    }

    const alreadyExists = safeSelectedSongs.some((item) => item.songId === songId);

    if (alreadyExists) {
      showToast('Essa música já foi adicionada ao repertório', 'info');
      return;
    }

    const song = hydratedSongs.find((item) => item.id === songId);
    const suggestionPayload = buildSuggestionPayload(song, payload);

    debugClientHome('[SUGESTOES] sugestão selecionada:', song);
    debugClientHome('[SUGESTOES] momento escolhido:', payload);
    debugClientHome('[SUGESTOES] payload criado:', suggestionPayload);
    setSelectedSongs((prev) => {
      debugClientHome('[SUGESTOES] repertório antes da inserção:', prev);
      const next = [
        ...prev,
        {
          songId,
          title: song?.title || '',
          artist: song?.artist || '',
          genre: song?.genre || '',
          moment: song?.moment || '',
          thumbnailUrl: song?.thumbnailUrl || '',
          targetSection: payload.section,
          targetLabel: payload.label,
          notes: payload.notes,
          ...suggestionPayload,
        },
      ];
      debugClientHome('[SUGESTOES] repertório depois da inserção:', next);
      return next;
    });

    showToast('Música adicionada ao repertório 🎶', 'success');
  }
const favoriteSongs = hydratedSongs.filter((song) => song.isFavorite);

const mostChosenSongs = [...hydratedSongs]
  .filter((song) => song.featured || song.isFavorite || song.isAdded)
  .sort((a, b) => {
    const scoreA =
      (a.featured ? 3 : 0) +
      (a.isFavorite ? 2 : 0) +
      (a.isAdded ? 1 : 0);

    const scoreB =
      (b.featured ? 3 : 0) +
      (b.isFavorite ? 2 : 0) +
      (b.isAdded ? 1 : 0);

    return scoreB - scoreA;
  });

function getPriorityScore(song) {
  let score = 0;

  if (song.genre === 'Gospel') score += 6;
  if (song.genre === 'Gospel Instrumental') score += 5;
  if (song.featured) score += 4;
  if (song.isFavorite) score += 3;
  if (song.isAdded) score += 2;
  if (song.moment === 'Entrada') score += 1;

  return score;
}
  const filteredSongs = hydratedSongs
  .filter((song) => {
    const q = search.trim().toLowerCase();
    

    const matchesSearch =
      !q ||
      song.title.toLowerCase().includes(q) ||
      song.artist.toLowerCase().includes(q) ||
      song.genre.toLowerCase().includes(q) ||
      song.moment.toLowerCase().includes(q) ||
      (song.description || '').toLowerCase().includes(q) ||
      (song.tags || []).some((tag) => tag.toLowerCase().includes(q));

    const matchesQuick =
      quickFilter === 'Todos' ||
      (quickFilter === 'Favoritas' && song.isFavorite) ||
      (quickFilter === 'Mais escolhidas' && (song.featured || song.isFavorite || song.isAdded)) ||
      (quickFilter === 'Já adicionadas' && song.isAdded);

    const matchesGenre =
      genreFilter === 'Todos' || song.genre === genreFilter;

    const matchesMoment =
      momentFilter === 'Todos' || song.moment === momentFilter;

    return matchesSearch && matchesQuick && matchesGenre && matchesMoment;
  })
  .sort((a, b) => getPriorityScore(b) - getPriorityScore(a));

const brideEntranceSongs = hydratedSongs.filter((song) => song.moment === 'Entrada');
const ceremonySongs = hydratedSongs.filter((song) => song.moment === 'Cerimônia');
const gospelSongs = hydratedSongs.filter((song) =>
  ['Gospel', 'Gospel Instrumental'].includes(song.genre)
);
  
const gospelEntranceSongs = hydratedSongs.filter(
  (song) =>
    ['Gospel', 'Gospel Instrumental'].includes(song.genre) &&
    song.moment === 'Entrada'
);
  const gospelCeremonySongs = songs.filter(
  (song) =>
    ['Gospel', 'Gospel Instrumental'].includes(song.genre) &&
    song.moment === 'Cerimônia'
);

   function handleAddConfirm(payload) {
    debugClientHome('[SUGESTOES] confirmação de adição recebida:', payload);
    if (sheetSong) {
      markAdded(sheetSong.id, payload);
    }

    setSheetSong(null);
  }
  return (
    <div className="space-y-4 pb-28">
      <TabHero
  badge="Curadoria Harmonics"
  title="Sugestões musicais"
  text="Explore músicas por estilo, momento e artista. Ouça, favorite e adicione ao seu repertório sem sair do painel."
>
  <div className="flex items-center gap-3 rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4">
    <span className="text-base">🔎</span>
    <input
      type="text"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Buscar música, artista, gênero ou momento..."
      className="w-full bg-transparent text-[15px] font-semibold text-[#241a14] outline-none placeholder:text-[#a28f82]"
    />
  </div>
</TabHero>

      <SectionCard>
        <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
          Filtros rápidos
        </div>
        <SuggestionChipBar
          items={quickFilters}
          active={quickFilter}
          onChange={setQuickFilter}
        />

        <div className="mb-3 mt-5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
          Gêneros
        </div>
        <SuggestionChipBar
          items={genres}
          active={genreFilter}
          onChange={setGenreFilter}
        />

        <div className="mb-3 mt-5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
          Momentos
        </div>
        <SuggestionChipBar
          items={moments}
          active={momentFilter}
          onChange={setMomentFilter}
        />
      </SectionCard>

      {isLoadingSongs ? (
        <SectionCard className="overflow-hidden">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#ede9fe_0%,transparent_60%)] opacity-70" />
            <div className="relative">
              <div className="text-[18px] font-black text-[#241a14]">Carregando catálogo</div>
              <div className="mt-1 text-[13px] leading-5 text-[#7a6a5e]">
                Buscando sugestões oficiais para o seu evento.
              </div>
              <div className="mt-5 space-y-3">
                <div className="h-20 animate-pulse rounded-[18px] bg-[#f5efe9]" />
                <div className="h-20 animate-pulse rounded-[18px] bg-[#f5efe9]" />
                <div className="h-20 animate-pulse rounded-[18px] bg-[#f5efe9]" />
              </div>
              <div className="mt-4 inline-flex rounded-full bg-white/90 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#7a6a5e]">
                Fonte: Catálogo oficial Harmonics
              </div>
            </div>
          </div>
        </SectionCard>
      ) : songsError ? (
        <SectionCard className="border-[#f5d0d6] bg-[#fff7f8]">
          <div className="text-[28px]">⚠️</div>
          <div className="mt-3 text-[20px] font-black text-[#7f1d1d]">Falha ao carregar sugestões</div>
          <div className="mt-2 text-[14px] leading-6 text-[#7a3b3b]">{songsError}</div>
          <button
            type="button"
            onClick={handleRetryLoadSongs}
            className="mt-4 rounded-[14px] border border-[#f3c3cb] bg-white px-4 py-2 text-[13px] font-black text-[#7f1d1d]"
          >
            Tentar novamente
          </button>
        </SectionCard>
      ) : songs.length === 0 ? (
        <SectionCard className="overflow-hidden border-[#e8dcff] bg-[linear-gradient(160deg,#ffffff_0%,#faf5ff_100%)]">
          <div className="text-[30px]">🎼</div>
          <div className="mt-3 text-[20px] font-black text-[#241a14]">Nenhuma sugestão disponível</div>
          <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
            Ainda não existem músicas publicadas para este painel. Quando novas faixas forem cadastradas,
            elas aparecerão aqui automaticamente.
          </div>
        </SectionCard>
      ) : (
        <>
     {!hasActiveFilters && (
  <>
    {favoriteSongs.length > 0 && (
      <SectionCard>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[18px] font-black text-[#241a14]">Suas favoritas</div>
            <div className="mt-1 text-[13px] leading-5 text-[#7a6a5e]">
              As músicas que você marcou e pode revisar rapidamente.
            </div>
          </div>

          <div className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-violet-700">
            {favoriteSongs.length} favorita(s)
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {favoriteSongs.map((song) => (
            <CollectionCard
              key={song.id}
              item={song}
              onPlay={() => {
                setCurrentSong(song);
                setExpandedSong(song);
              }}
              onFav={() => toggleFavorite(song.id)}
              onAdd={() => setSheetSong(song)}
            />
          ))}
        </div>
      </SectionCard>
    )}

    <SectionCard>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[18px] font-black text-[#241a14]">Mais escolhidas</div>
          <div className="mt-1 text-[13px] leading-5 text-[#7a6a5e]">
            Ranking dinâmico com destaque para as músicas mais fortes da curadoria.
          </div>
        </div>

        <div className="rounded-full bg-[#faf7f3] px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#7a6a5e]">
          Top {Math.min(mostChosenSongs.length, 10)}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {mostChosenSongs.slice(0, 10).map((song) => (
          <CollectionCard
            key={song.id}
            item={song}
            onPlay={() => {
              setCurrentSong(song);
              setExpandedSong(song);
            }}
            onFav={() => toggleFavorite(song.id)}
            onAdd={() => setSheetSong(song)}
          />
        ))}
      </div>
    </SectionCard>

    <SectionCard>
      <div className="mb-4 text-[18px] font-black text-[#241a14]">Para entrada da noiva</div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {brideEntranceSongs.map((song) => (
          <CollectionCard
            key={song.id}
            item={song}
            onPlay={() => {
              setCurrentSong(song);
              setExpandedSong(song);
            }}
            onFav={() => toggleFavorite(song.id)}
            onAdd={() => setSheetSong(song)}
          />
        ))}
      </div>
    </SectionCard>

    <SectionCard>
      <div className="mb-4 text-[18px] font-black text-[#241a14]">Gospel para casamento</div>
      <div className="mb-4 text-[13px] leading-5 text-[#7a6a5e]">
        Seleção pensada para cerimônias cristãs e momentos de adoração no casamento.
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {gospelSongs.map((song) => (
          <CollectionCard
            key={song.id}
            item={song}
            onPlay={() => {
              setCurrentSong(song);
              setExpandedSong(song);
            }}
            onFav={() => toggleFavorite(song.id)}
            onAdd={() => setSheetSong(song)}
          />
        ))}
      </div>
    </SectionCard>

    <SectionCard>
      <div className="mb-4 text-[18px] font-black text-[#241a14]">Gospel para entrada</div>
      <div className="mb-4 text-[13px] leading-5 text-[#7a6a5e]">
        Músicas e instrumentais com atmosfera forte para entrada da noiva e momentos marcantes.
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {gospelEntranceSongs.map((song) => (
          <CollectionCard
            key={song.id}
            item={song}
            onPlay={() => {
              setCurrentSong(song);
              setExpandedSong(song);
            }}
            onFav={() => toggleFavorite(song.id)}
            onAdd={() => setSheetSong(song)}
          />
        ))}
      </div>
    </SectionCard>

    <SectionCard>
      <div className="mb-4 text-[18px] font-black text-[#241a14]">Gospel para cerimônia</div>
      <div className="mb-4 text-[13px] leading-5 text-[#7a6a5e]">
        Sugestões cristãs para momentos centrais da cerimônia, oração, aliança e gratidão.
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {gospelCeremonySongs.map((song) => (
          <CollectionCard
            key={song.id}
            item={song}
            onPlay={() => {
              setCurrentSong(song);
              setExpandedSong(song);
            }}
            onFav={() => toggleFavorite(song.id)}
            onAdd={() => setSheetSong(song)}
          />
        ))}
      </div>
    </SectionCard>

    <SectionCard>
      <div className="mb-4 text-[18px] font-black text-[#241a14]">Cerimônia</div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {ceremonySongs.map((song) => (
          <CollectionCard
            key={song.id}
            item={song}
            onPlay={() => {
              setCurrentSong(song);
              setExpandedSong(song);
            }}
            onFav={() => toggleFavorite(song.id)}
            onAdd={() => setSheetSong(song)}
          />
        ))}
      </div>
    </SectionCard>
  </>
)}

<SectionCard>
  <div className="mb-4 flex items-center justify-between gap-3">
    <div className="text-[18px] font-black text-[#241a14]">
      {hasActiveFilters ? 'Resultados da busca' : 'Todas as músicas'}
    </div>
    <div className="text-[12px] font-black text-[#9b8576]">
      {filteredSongs.length} resultado(s)
    </div>
  </div>

  <div className="space-y-3">
    {filteredSongs.length ? (
      filteredSongs.map((song) => (
        <SongListCard
          key={song.id}
          item={song}
          onPlay={() => {
            setCurrentSong(song);
            setExpandedSong(song);
          }}
          onFav={() => toggleFavorite(song.id)}
          onAdd={() => setSheetSong(song)}
        />
      ))
    ) : (
      <EmptyStateCard
        title="Nenhuma música encontrada"
        text="Tente ajustar os filtros ou buscar por outro nome, artista, gênero ou momento."
      />
    )}
  </div>
</SectionCard>
        </>
      )}

      <MiniMusicPlayer
        current={currentSong}
        onClose={() => setCurrentSong(null)}
        onExpand={() => setExpandedSong(currentSong)}
      />

      <PlayerModal
        current={expandedSong}
        onClose={() => setExpandedSong(null)}
        onFav={() => toggleFavorite(expandedSong.id)}
        onAdd={() => {
          setSheetSong(expandedSong);
          setExpandedSong(null);
        }}
      />

      <AddSongSheet
        music={sheetSong}
        onClose={() => setSheetSong(null)}
        onConfirm={handleAddConfirm}
      />
    </div>
  );
}
function FinanceSummaryCard({ label, value, tone = 'default' }) {
  const toneMap = {
    default: 'bg-white text-[#241a14] border-[#eadfd6]',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    accent: 'bg-violet-50 text-violet-700 border-violet-200',
  };

  return (
    <div
      className={classNames(
        'rounded-[22px] border p-4 shadow-[0_8px_22px_rgba(36,26,20,0.04)]',
        toneMap[tone]
      )}
    >
      <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] opacity-80">
        {label}
      </div>
      <div className="mt-2 text-[22px] font-black">{value}</div>
    </div>
  );
}

function PaymentStatusPill({ status }) {
  const s = String(status || '').trim().toUpperCase();

  const map = {
    PAGO: 'bg-emerald-100 text-emerald-700',
    PENDENTE: 'bg-amber-100 text-amber-800',
    VENCIDO: 'bg-red-100 text-red-700',
    ENVIADO: 'bg-violet-100 text-violet-700',
    EM_ANALISE: 'bg-sky-100 text-sky-700',
  };

  return (
    <span
      className={classNames(
        'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em]',
        map[s] || 'bg-zinc-100 text-zinc-700'
      )}
    >
      {status || '—'}
    </span>
  );
}

function PaymentTimelineItem({
  title,
  dueDate,
  amount,
  status,
  description,
}) {
  return (
    <div className="rounded-[22px] border border-[#eadfd6] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-black text-[#241a14]">{title}</div>
          <div className="mt-1 text-[13px] font-semibold text-[#7a6a5e]">
            Vencimento: {dueDate || '—'}
          </div>
        </div>

        <PaymentStatusPill status={status} />
      </div>

      <div className="mt-3 text-[18px] font-black text-[#241a14]">
        {amount || '—'}
      </div>

      {description ? (
        <div className="mt-2 text-[13px] leading-5 text-[#8b786b]">
          {description}
        </div>
      ) : null}
    </div>
  );
}

function PaymentHistoryItem({ item }) {
  const statusKey = String(item?.status || '')
    .trim()
    .toUpperCase();
  const isConfirmed = ['CONFIRMADO', 'APROVADO', 'PAGO'].includes(statusKey);
  const hasProof = Boolean(item?.proofUrl || item?.fileName);
  const proofStatusLabel = hasProof
    ? isConfirmed
      ? 'Comprovante validado'
      : 'Arquivo enviado para análise'
    : null;

  return (
    <div className="rounded-[20px] border border-[#eadfd6] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-black text-[#241a14]">
            {item.label || 'Pagamento'}
          </div>
          <div className="mt-1 text-[13px] font-semibold text-[#7a6a5e]">
            {item.date || '—'}
          </div>
        </div>

        <PaymentStatusPill status={item.status} />
      </div>

      <div className="mt-3 text-[18px] font-black text-[#241a14]">
        {item.amount || '—'}
      </div>

      {item.note ? (
        <div className="mt-2 text-[13px] leading-5 text-[#8b786b]">
          {item.note}
        </div>
      ) : null}

      {proofStatusLabel ? (
        <div className="mt-3 rounded-[14px] bg-[#faf7f3] px-3 py-2 text-[12px] font-bold text-[#6f5d51]">
          📎 {proofStatusLabel}
          {item.proofUrl ? (
            <>
              {' '}
              ·{' '}
              <a
                href={item.proofUrl}
                target="_blank"
                rel="noreferrer"
                className="text-violet-700 underline"
              >
                Ver comprovante
              </a>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FinanceiroTab({ data, paymentHistory, setPaymentHistory, onPaymentRegistered }) {
  const [paymentValue, setPaymentValue] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentFile, setPaymentFile] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const { showToast } = useToast();

  const financeiro = data?.financeiro;
  const resumo = useMemo(
    () => ({
      valorTotal: financeiro?.resumo?.valorTotal || 'Não informado',
      valorPago: financeiro?.resumo?.valorPago || 'Sem lançamento ainda',
      saldo: financeiro?.resumo?.saldo || 'Em definição com a equipe',
      status: financeiro?.resumo?.status || 'Consulte a equipe',
      overpaidAmount: financeiro?.resumo?.overpaidAmount || null,
    }),
    [financeiro]
  );

  const vencimentos = useMemo(() => {
    if (Array.isArray(financeiro?.vencimentos) && financeiro.vencimentos.length > 0) {
      return financeiro.vencimentos;
    }
    return [
      {
        title: 'Sem vencimentos lançados',
        dueDate: 'Não informado',
        amount: 'Não informado',
        status: 'PENDENTE',
        description: 'Assim que houver lançamento, os próximos vencimentos aparecerão aqui.',
      },
    ];
  }, [financeiro]);

  const regrasFinanceiras = useMemo(() => {
    if (Array.isArray(financeiro?.regras) && financeiro.regras.length > 0) {
      return financeiro.regras;
    }
    return [
      '50% do valor deve ser quitado até 14 dias antes do evento.',
      'O saldo final deve ser quitado até 48 horas antes da data do evento.',
      'Após enviar um comprovante, ele ficará em análise até a confirmação.',
    ];
  }, [financeiro]);

  const situacaoTone = useMemo(() => {
    const status = String(resumo.status || '').toLowerCase();
    if (status.includes('pago')) return 'success';
    if (status.includes('parcial')) return 'accent';
    if (status.includes('pendente')) return 'warning';
    return 'default';
  }, [resumo.status]);

  const historico =
  paymentHistory && paymentHistory.length
    ? paymentHistory
    : [
    {
      label: 'Sem lançamento ainda',
      date: '—',
      amount: 'Não informado',
      status: 'PENDENTE',
      note: 'Nenhum comprovante foi enviado até o momento.',
      fileName: '',
    },
  ];

  return (
    <div className="space-y-4 pb-24">
      <TabHero
  badge="Financeiro do evento"
  title="Acompanhe seus pagamentos"
  text="Consulte valores, vencimentos, histórico e envie comprovantes de forma simples e organizada."
/>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FinanceSummaryCard label="Valor total" value={resumo.valorTotal} />
        <FinanceSummaryCard label="Valor pago" value={resumo.valorPago} tone="success" />
        <FinanceSummaryCard label="Saldo" value={resumo.saldo} tone="warning" />
        <FinanceSummaryCard label="Situação" value={resumo.status} tone={situacaoTone} />
      </div>

      {resumo.overpaidAmount ? (
        <SectionCard className="border-emerald-200 bg-emerald-50">
          <div className="text-[14px] font-black text-emerald-700">
            Pagamento acima do valor contratado
          </div>
          <div className="mt-1 text-[14px] leading-6 text-emerald-700">
            Foi identificado crédito de {resumo.overpaidAmount}. Nossa equipe vai considerar este valor na conciliação.
          </div>
        </SectionCard>
      ) : null}

      <SectionCard>
        <div className="mb-4 text-[18px] font-black text-[#241a14]">
          Próximos vencimentos
        </div>

        <div className="space-y-3">
          {vencimentos.map((item, index) => (
            <PaymentTimelineItem
              key={`${item.title}-${index}`}
              title={item.title}
              dueDate={item.dueDate}
              amount={item.amount}
              status={item.status}
              description={item.description}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard className="bg-[#fffaf0] border-[#f3e1b7]">
        <div className="text-[16px] font-black text-[#8b5a14]">
          Regras financeiras do evento
        </div>

        <div className="mt-3 space-y-2 text-[14px] leading-6 text-[#7b5d2d]">
          {regrasFinanceiras.map((regra, index) => (
            <div key={`${regra}-${index}`}>• {regra}</div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <div className="text-[18px] font-black text-[#241a14]">
          Enviar comprovante
        </div>

        <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
          Preencha os dados abaixo e anexe seu comprovante para análise.
        </div>

        <div className="mt-5 space-y-4">
          <InputField
            label="Valor pago"
            placeholder="Ex: 2000,00"
            value={paymentValue}
            onChange={(e) => setPaymentValue(e.target.value)}
          />

          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
              Data do pagamento
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full rounded-[16px] border border-[#eadfd6] bg-white px-4 py-4 text-[15px] font-semibold text-[#241a14] outline-none"
            />
          </div>

          <InputField
            label="Observação"
            placeholder="Ex: pagamento referente ao sinal"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            textarea
            rows={3}
          />

          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
              Forma de pagamento
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-[16px] border border-[#eadfd6] bg-white px-4 py-4 text-[15px] font-semibold text-[#241a14] outline-none"
            >
              <option value="pix">Pix</option>
              <option value="transferencia">Transferência</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao">Cartão</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
              Comprovante
            </label>

            <label className="flex cursor-pointer items-center justify-center rounded-[18px] border-2 border-dashed border-[#d9c8f7] bg-[#fcfbff] px-4 py-5 text-center text-[14px] font-bold text-violet-700">
              <input
                type="file"
                className="hidden"
                onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
              />
              {paymentFile ? `📎 ${paymentFile.name}` : 'Selecionar comprovante'}
            </label>
          </div>

          <button
  type="button"
  disabled={isSubmittingPayment}
  onClick={async () => {
    if (!paymentValue || !paymentDate) {
      showToast('Preencha valor e data antes de enviar', 'warning');
      return;
    }

    try {
      setIsSubmittingPayment(true);
      const formData = new FormData();
      formData.append('token', data.token || '');
      formData.append('amount', paymentValue);
      formData.append('paymentDate', paymentDate);
      formData.append('notes', paymentNote || '');
      formData.append('paymentMethod', paymentMethod || 'pix');
      if (paymentFile) {
        formData.append('proofFile', paymentFile);
      }

      const response = await fetch('/api/cliente/pagamentos', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result?.ok) {
        showToast(result?.error || 'Não foi possível registrar o pagamento.', 'error');
        return;
      }

      const novoItem = {
        label: 'Comprovante enviado',
        date: paymentDate,
        amount: `R$ ${paymentValue}`,
        status: 'EM_ANALISE',
        note: paymentNote || 'Aguardando conferência da equipe.',
        fileName: paymentFile?.name || 'comprovante-anexado',
        proofUrl: result?.payment?.proof_file_url || '',
      };

      setPaymentHistory((prev) => [novoItem, ...prev]);
      onPaymentRegistered?.(result);

      setPaymentValue('');
      setPaymentDate('');
      setPaymentNote('');
      setPaymentFile(null);
      setPaymentMethod('pix');

      showToast('Comprovante enviado com sucesso', 'success');
    } finally {
      setIsSubmittingPayment(false);
    }
  }}
  className="w-full rounded-[20px] bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] px-4 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.24)] disabled:cursor-not-allowed disabled:opacity-70"
>
  {isSubmittingPayment ? 'Enviando...' : 'Enviar comprovante'}
</button>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="mb-4 text-[18px] font-black text-[#241a14]">
          Histórico de pagamentos
        </div>

        <div className="space-y-3">
          {historico.length ? (
            historico.map((item, index) => (
              <PaymentHistoryItem key={`${item.label}-${index}`} item={item} />
            ))
          ) : (
            <EmptyStateCard
  title="Nenhum pagamento registrado"
  text="Assim que um comprovante for enviado, ele aparecerá aqui para acompanhamento."
/>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
function ClienteLoadingScreen() {
  return (
    <main className="min-h-screen bg-[#f8f4ef] px-4 py-6">
      <div className="mx-auto max-w-[520px]">
        <div className="overflow-hidden rounded-[30px] border border-[#eadfd6] bg-white p-6 shadow-[0_16px_40px_rgba(36,26,20,0.06)]">
          <div className="h-4 w-28 animate-pulse rounded-full bg-[#ece4dc]" />
          <div className="mt-5 h-8 w-3/4 animate-pulse rounded-full bg-[#ece4dc]" />
          <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-[#f2ebe4]" />
          <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-[#f2ebe4]" />

          <div className="mt-8 grid grid-cols-1 gap-3">
            <div className="h-20 animate-pulse rounded-[22px] bg-[#f7f2ed]" />
            <div className="h-20 animate-pulse rounded-[22px] bg-[#f7f2ed]" />
            <div className="h-20 animate-pulse rounded-[22px] bg-[#f7f2ed]" />
          </div>
        </div>
      </div>
    </main>
  );
}

function ClienteBlockedScreen() {
  return (
    <main className="min-h-screen bg-[#f8f4ef] px-4 py-6">
      <div className="mx-auto max-w-[520px]">
        <SectionCard className="text-center">
          <div className="text-4xl">🔒</div>
          <div className="mt-4 text-[24px] font-black text-[#241a14]">
            Painel ainda não liberado
          </div>
          <div className="mt-3 text-[14px] leading-6 text-[#6f5d51]">
            Assim que as etapas anteriores forem concluídas, este painel ficará disponível para acompanhamento.
          </div>
        </SectionCard>
      </div>
    </main>
  );
}

function ClienteInvalidScreen() {
  return (
    <main className="min-h-screen bg-[#f8f4ef] px-4 py-6">
      <div className="mx-auto max-w-[520px]">
        <SectionCard className="text-center">
          <div className="text-4xl">😕</div>
          <div className="mt-4 text-[24px] font-black text-[#241a14]">
            Link inválido
          </div>
          <div className="mt-3 text-[14px] leading-6 text-[#6f5d51]">
            Este acesso não foi encontrado ou não está mais disponível.
          </div>
        </SectionCard>
      </div>
    </main>
  );
}

function EmptyStateCard({ title, text }) {
  return (
    <div className="rounded-[20px] bg-[#faf7f3] px-4 py-5 text-center">
      <div className="text-[16px] font-black text-[#241a14]">{title}</div>
      <div className="mt-2 text-[14px] leading-6 text-[#7a6a5e]">{text}</div>
    </div>
  );
}

export default function ClienteHome({ data, initialTab = 'inicio', guideQuery = '' }) {
  const [panelData, setPanelData] = useState(data);
  const [activeTab, setActiveTab] = useState('inicio');
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [favoriteSongIds, setFavoriteSongIds] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState(
    data?.financeiro?.historico || []
  );
  const [dismissedRepertoireAlert, setDismissedRepertoireAlert] = useState(false);
  const [repertorioDraftState, setRepertorioDraftState] = useState(null);
  const isCustomEvent =
    panelData?.repertorio?.isWedding === false ||
    panelData?.repertorio?.initialState?.mode === 'custom' ||
    panelData?.repertorio?.isCustomEvent === true;
  const resolvedActiveTab =
    isCustomEvent && activeTab === 'sugestoes' ? 'repertorio' : activeTab;
  const loading = !panelData;
  const isClientPanelOnboarding =
    guideQuery === 'client-panel' ||
    guideQuery === 'onboarding-client-panel' ||
    (typeof window !== 'undefined' &&
      ['client-panel', 'onboarding-client-panel'].includes(
        new URLSearchParams(window.location.search).get('guide') ||
          new URLSearchParams(window.location.search).get('onboarding')
      ));
  useEffect(() => {
    if (initialTab && initialTab !== 'inicio') {
      setActiveTab(initialTab);
    }
  }, [initialTab]);


  const handleRepertorioSaved = useCallback(
    ({ mode, result }) => {
      if (!result?.ok) return;

      setPanelData((prev) => {
        if (!prev) return prev;

        const nextStatus = result?.status || prev.repertorio?.status || '';
        const isLockedByBackend = result?.locked === true;
        const isFinalizedByStatus = isRepertoireFinalizedStatus(nextStatus, isLockedByBackend);
        const isFinalized = mode === 'final' || isFinalizedByStatus;
        const nextPdfUrl =
          result?.repertoire_pdf_url ||
          result?.pdfUrl ||
          prev.repertorio?.repertoire_pdf_url ||
          prev.repertorio?.pdfUrl ||
          (prev.token ? `/api/cliente/repertorio/pdf/${prev.token}` : '');

        return {
          ...prev,
          repertorio: {
            ...prev.repertorio,
            status: nextStatus,
            isLocked: isLockedByBackend || isFinalizedByStatus,
            liberadoParaEdicao: !isFinalized,
            enviadoEm: isFinalized
              ? new Date().toISOString()
              : prev.repertorio?.enviadoEm || null,
            pdfUrl: nextPdfUrl,
            repertoire_pdf_url: nextPdfUrl,
            podeSolicitarCorrecao: isFinalized,
          },
        };
      });

      if (mode === 'final') {
        setActiveTab('repertorio');

        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search || '');
          if (params.get('guide') === 'client-panel') {
            const eventId = params.get('eventId') || panelData?.eventId || panelData?.repertorio?.eventId || '';
            const next = new URL('/configuracoes/equipe', window.location.origin);
            next.searchParams.set('guide', 'fake-members');
            if (eventId) next.searchParams.set('eventId', eventId);
            window.location.assign(next.toString());
          }
        }
      }
    },
    [panelData]
  );

  const handleReviewRequested = useCallback(() => {
    setPanelData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        repertorio: {
          ...prev.repertorio,
          status: 'AGUARDANDO_REVISAO',
          isLocked: true,
          liberadoParaEdicao: false,
          podeSolicitarCorrecao: false,
        },
      };
    });
  }, []);

  const handlePaymentRegistered = useCallback((result) => {
    setPanelData((prev) => {
      if (!prev) return prev;
      const financeiro = result?.financeiro || {};
      const toMoney = (value) =>
        new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(Number(value || 0));

      return {
        ...prev,
        financeiro: {
          ...prev.financeiro,
          resumo: {
            valorTotal: toMoney(financeiro.valorTotal),
            valorPago: toMoney(financeiro.valorPago),
            saldo: toMoney(financeiro.saldo),
            status: financeiro.status || prev.financeiro?.resumo?.status || 'Em aberto',
          },
        },
      };
    });
  }, []);

  const daysToEvent = useMemo(
    () => daysUntilEvent(panelData?.dataEvento),
    [panelData?.dataEvento]
  );

  const shouldShowRepertoire15DaysAlert =
    !isClientPanelOnboarding &&
    !dismissedRepertoireAlert &&
    daysToEvent !== null &&
    daysToEvent <= 15 &&
    !isRepertoireFinalizedStatus(
      panelData?.repertorio?.status,
      panelData?.repertorio?.isLocked
    );


  useEffect(() => {
    try {
      const hasContract = Boolean(panelData?.contratoPdfUrl || panelData?.contratoDocUrl);
      const hasPrecontract = Boolean(panelData?.eventId || panelData?.clienteNome || panelData?.dataEvento);
      const hasEvent = Boolean(panelData?.eventoTitulo || panelData?.eventId || panelData?.dataEvento);

      console.info('[CLIENT_PANEL_GUIDE_VISIBILITY]', {
        guideQuery,
        isClientPanelOnboarding,
        loading,
        hasPanelData: Boolean(panelData),
      });

      console.info('[CLIENT_PANEL_RENDER_STATE]', {
        guideQuery,
        loading,
        activeTab: resolvedActiveTab,
        hasEvent,
        hasPrecontract,
        hasContract,
      });
    } catch (error) {
      console.error('[CLIENT_PANEL_RENDER_STATE][LOG_ERROR]', error);
    }
  }, [activeTab, guideQuery, isClientPanelOnboarding, loading, panelData, resolvedActiveTab]);

  useEffect(() => {
    if (isClientPanelOnboarding || !shouldShowRepertoire15DaysAlert || !panelData?.token) return;
    if (DISABLE_REPERTOIRE_ALERT_DEBUG) {
      debugClientHome(
        '[CLIENTE HOME][DEBUG] Automação /api/cliente/alertas/repertorio-pendente desabilitada por NEXT_PUBLIC_DISABLE_REPERTOIRE_ALERT_DEBUG=1.'
      );
      return;
    }

    fetch('/api/cliente/alertas/repertorio-pendente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: panelData.token }),
    }).catch((error) => {
      console.error('[CLIENTE HOME] Falha ao disparar automação de alerta de repertório:', error);
    });
  }, [isClientPanelOnboarding, panelData?.token, shouldShowRepertoire15DaysAlert]);

  if (!panelData) {
    return <ClienteLoadingScreen />;
  }

  if (panelData.invalid) {
    return <ClienteInvalidScreen />;
  }

  if (panelData.blocked) {
    return <ClienteBlockedScreen />;
  }

  return (
    <main className="min-h-screen bg-[#f8f4ef] text-[#241a14]" data-onboarding-tour="client-panel-root">
      {shouldShowRepertoire15DaysAlert ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f1427]/55 px-4">
          <div className="w-full max-w-[520px] rounded-[28px] border border-red-200 bg-white p-6 shadow-[0_20px_60px_rgba(36,26,20,0.28)]">
            <div className="inline-flex rounded-full bg-red-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-red-700">
              Ação obrigatória
            </div>
            <div className="mt-4 text-[24px] font-black text-[#241a14]">
              Faltam {Math.max(daysToEvent ?? 0, 0)} dias para o seu evento e seu repertório ainda não foi enviado.
            </div>
            <div className="mt-3 text-[15px] leading-7 text-[#6f5d51]">
              Envie o quanto antes para que nossa equipe tenha tempo hábil para se preparar.
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setDismissedRepertoireAlert(true);
                  setActiveTab('repertorio');
                }}
                className="flex-1 rounded-[18px] bg-[linear-gradient(135deg,#dc2626_0%,#ef4444_100%)] px-4 py-3 text-[14px] font-black text-white"
              >
                Ir para repertório
              </button>
              <a
                href={`https://wa.me/${(panelData?.suporteWhatsapp || '').replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-[18px] border border-[#eadfd6] bg-[#faf7f3] px-4 py-3 text-center text-[14px] font-black text-[#6f5d51]"
              >
                Falar com equipe
              </a>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-[520px] px-4 pb-32 pt-4">
        <section className="overflow-hidden rounded-[30px] border border-[#2f2231] bg-[linear-gradient(135deg,#1e1723_0%,#2d1c4b_52%,#5b21b6_100%)] px-5 py-6 text-white shadow-[0_16px_50px_rgba(37,25,52,0.24)]">
          <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/90">
            Painel do cliente
          </div>

          <div className="mt-4 text-[28px] font-black leading-tight">
            {panelData.eventoTitulo || 'Seu evento'}
          </div>

          <div className="mt-2 text-[15px] font-medium leading-6 text-white/80">
            Acompanhe tudo de forma organizada e tenha as informações principais do seu evento em um só lugar.
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <StatusPill label={panelData.statusContrato || 'Em andamento'} tone="success" />
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[12px] font-bold text-white/90">
              📅 {formatLongDateBR(panelData.dataEvento)}
            </div>
          </div>

          <div className="mt-6 rounded-[22px] border border-white/10 bg-white/8 p-4">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/70">
              Cliente
            </div>
            <div className="mt-1 text-[18px] font-black">{panelData.clienteNome}</div>
          </div>
        </section>

        <div className="mt-4">
          {resolvedActiveTab === 'inicio' && (
            <InicioTab
              data={panelData}
              setActiveTab={setActiveTab}
              selectedSongs={selectedSongs}
            />
          )}

          {resolvedActiveTab === 'repertorio' && (
            <RepertorioTab
              data={panelData}
              selectedSongs={selectedSongs}
              setSelectedSongs={setSelectedSongs}
              onSaved={handleRepertorioSaved}
              onReviewRequested={handleReviewRequested}
              persistedState={repertorioDraftState}
              onPersistState={setRepertorioDraftState}
              isClientPanelOnboarding={isClientPanelOnboarding}
            />
          )}

          {!isCustomEvent && resolvedActiveTab === 'sugestoes' && (
            <SugestoesTab
              selectedSongs={selectedSongs}
              setSelectedSongs={setSelectedSongs}
              favoriteSongIds={favoriteSongIds}
              setFavoriteSongIds={setFavoriteSongIds}
              repertorioStatus={panelData?.repertorio?.status || ''}
              repertorioLocked={Boolean(panelData?.repertorio?.isLocked)}
              clientToken={panelData?.token || ''}
              eventId={panelData?.eventId || ''}
            />
          )}

          {resolvedActiveTab === 'financeiro' && (
            <div data-onboarding-tour="client-tab-financeiro">
            <FinanceiroTab
              data={panelData}
              paymentHistory={paymentHistory}
              setPaymentHistory={setPaymentHistory}
              onPaymentRegistered={handlePaymentRegistered}
            />
            </div>
          )}
          {resolvedActiveTab === 'contrato' && (
            <ContratoTab data={panelData} />
          )}
        </div>
      </div>

      {isClientPanelOnboarding && !loading && panelData ? (
        <ClientPanelGuide
          data={panelData}
          activeTab={resolvedActiveTab}
          setActiveTab={setActiveTab}
        />
      ) : null}

      <FooterNav
        activeTab={resolvedActiveTab}
        setActiveTab={setActiveTab}
        hideSuggestions={isCustomEvent}
      />
    </main>
  );
}
