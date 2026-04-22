'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import MembroHomeTab from '../../components/membro/MembroHomeTab';
import MembroSolicitacoesTab from '../../components/membro/MembroSolicitacoesTab';
import MembroEscalasTab from '../../components/membro/MembroEscalasTab';
import MembroRepertoriosTab from '../../components/membro/MembroRepertoriosTab';
import MembroPerfilTab from '../../components/membro/MembroPerfilTab';
import MembroBottomNav from '../../components/membro/MembroBottomNav';
import MiniPlayerBar from '../../components/membro/MiniPlayerBar';
import MembroPlayerModal from '../../components/membro/MembroPlayerModal';
import MembroEscalaModal from '../../components/membro/MembroEscalaModal';
import MembroRepertorioResumoModal from '../../components/membro/MembroRepertorioResumoModal';
import { buildMemberDashboardData } from '../../lib/membro/membro-invites';
import { useAppToast } from '../../components/ui/ToastProvider';
import { useGlobalPlayer } from '../../components/player/GlobalPlayerProvider';

const DESKTOP_TABS = [
  { key: 'home', label: 'Início', icon: '🏠' },
  { key: 'pendentes', label: 'Solicitações', icon: '📨' },
  { key: 'escalas', label: 'Escalas', icon: '🎼' },
  { key: 'repertorios', label: 'Repertórios', icon: '🎧' },
  { key: 'perfil', label: 'Perfil', icon: '👤' },
];
const REPERTOIRE_CONFIG_SELECT = [
  'id',
  'event_id',
  'status',
  'is_locked',
  'submitted_at',
  'repertoire_pdf_url',
  'has_ante_room',
  'ante_room_style',
  'ante_room_notes',
  'has_reception',
  'reception_duration',
  'reception_genres',
  'reception_artists',
  'reception_notes',
].join(', ');
const REPERTOIRE_ITEMS_SELECT = [
  'id',
  'event_id',
  'item_order',
  'song_name',
  'moment',
  'who_enters',
  'reference_link',
  'reference_video_id',
  'notes',
  'type',
  'label',
  'section',
  'genres',
  'artists',
].join(', ');
const CONTRACTS_SELECT = [
  'id',
  'precontract_id',
  'event_id',
  'status',
  'pdf_url',
  'doc_url',
  'signed_at',
].join(', ');

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEventDate(value) {
  if (!value) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function isActiveSystemEvent(event = {}) {
  const status = normalizeStatus(event?.status);
  if (!status) return true;
  return !['deleted', 'cancelled', 'canceled', 'arquivado', 'archived'].includes(status);
}

function isSignedContract(contract = {}) {
  if (contract?.signed_at) return true;
  const status = normalizeStatus(contract?.status);
  return status === 'signed';
}

function hasRepertoireMaterial(config = {}) {
  const status = String(config?.status || '').trim().toUpperCase();
  const hasPdf = Boolean(String(config?.repertoire_pdf_url || '').trim());
  const hasSubmitMark = Boolean(config?.submitted_at);
  const isLocked = Boolean(config?.is_locked);
  const statusSignalsActive = [
    'ENVIADO',
    'ENVIADO_TRANCADO',
    'FINALIZADO',
    'CONCLUIDO',
    'AGUARDANDO_REVISAO',
    'REABERTO',
    'LIBERADO_PARA_EDICAO',
    'REVISAO_SOLICITADA',
    'REVIEW_REQUESTED',
  ].includes(status);

  return hasPdf || hasSubmitMark || isLocked || statusSignalsActive;
}

function resolveTrackUrl(row) {
  const referenceLink = String(row?.referencia || row?.reference_link || '').trim();
  if (referenceLink) return referenceLink;

  const referenceVideoId = String(row?.reference_video_id || '').trim();
  if (!referenceVideoId) return '';

  return `https://www.youtube.com/watch?v=${referenceVideoId}`;
}

function normalizeBucketKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const SECTION_ORDER = {
  antesala: 1,
  cortejo: 2,
  cerimonia: 3,
  saida_dos_noivos: 4,
  receptivo: 5,
  referencia: 6,
};

const MOMENT_ORDER = {
  // Cortejo
  pais_noivo: 10,
  pais_noiva: 20,
  padrinhos: 30,
  daminhas: 40,
  noivo: 50,
  noiva: 60,
  florista: 70,
  celebrante: 80,
  // Cerimônia
  aliancas: 110,
  assinaturas: 120,
  comunhao: 130,
  louvor: 140,
  homilia: 150,
  // Saída
  cumprimento: 210,
  saida: 220,
  // Receptivo
  recepcao: 310,
  jantar: 320,
  festa: 330,
};

function resolveSectionFromItem(row = {}) {
  const section = normalizeBucketKey(row?.section || row?.tipo || row?.type || '');
  const moment = normalizeBucketKey(row?.momento || row?.moment || '');
  const whoEnters = normalizeBucketKey(row?.quemEntra || row?.who_enters || '');
  const label = normalizeBucketKey(row?.label || '');

  const probe = [section, moment, whoEnters, label].filter(Boolean).join(' ');

  if (probe.includes('antesala') || probe.includes('antessala') || probe.includes('ante room')) {
    return 'antesala';
  }

  if (probe.includes('cortejo') || probe.includes('entrada')) {
    return 'cortejo';
  }

  if (probe.includes('cerimonia')) {
    return 'cerimonia';
  }

  if (
    probe.includes('saida dos noivos') ||
    probe.includes('saida') ||
    probe.includes('recessional')
  ) {
    return 'saida_dos_noivos';
  }

  if (probe.includes('receptivo') || probe.includes('recepcao') || probe.includes('coquetel')) {
    return 'receptivo';
  }

  return 'referencia';
}

function toMomentKey(value) {
  const normalized = normalizeBucketKey(value).replace(/[^a-z0-9]+/g, '_');
  return normalized.replace(/^_+|_+$/g, '');
}

function getMomentOrder(row = {}) {
  const candidates = [
    row?.momento,
    row?.moment,
    row?.quemEntra,
    row?.who_enters,
    row?.label,
  ];

  for (const value of candidates) {
    const key = toMomentKey(value);
    if (key && MOMENT_ORDER[key] != null) {
      return MOMENT_ORDER[key];
    }
  }

  return 999;
}

function getDisplayLabel(row = {}, sectionKey) {
  if (sectionKey === 'antesala') return 'ANTESALA';

  const whoEnters = String(row?.quemEntra || row?.who_enters || '').trim();
  const moment = String(row?.momento || row?.moment || '').trim();
  const label = String(row?.label || '').trim();

  if (whoEnters) return whoEnters.toUpperCase();
  if (moment) return moment.toUpperCase();

  if (label) {
    const normalized = normalizeBucketKey(label);
    if (!normalized.startsWith('referencia')) {
      return label.toUpperCase();
    }
  }

  if (sectionKey === 'cortejo') return 'CORTEJO';
  if (sectionKey === 'cerimonia') return 'CERIMÔNIA';
  if (sectionKey === 'saida_dos_noivos') return 'SAÍDA DOS NOIVOS';
  if (sectionKey === 'receptivo') return 'RECEPTIVO';
  return 'REFERÊNCIAS';
}

function getDesktopTabMeta(activeTab) {
  if (activeTab === 'home') {
    return {
      eyebrow: 'Painel do membro',
      title: 'Visão geral',
      subtitle: 'Acompanhe suas confirmações, próximos eventos e repertórios em um só lugar.',
    };
  }

  if (activeTab === 'pendentes') {
    return {
      eyebrow: 'Convites e respostas',
      title: 'Solicitações pendentes',
      subtitle: 'Responda convites rapidamente e mantenha sua agenda atualizada.',
    };
  }

  if (activeTab === 'escalas') {
    return {
      eyebrow: 'Agenda operacional',
      title: 'Minhas escalas',
      subtitle: 'Veja detalhes dos eventos confirmados, mapas, escala e conclusão.',
    };
  }

  if (activeTab === 'repertorios') {
    return {
      eyebrow: 'Conteúdo de estudo',
      title: 'Repertórios',
      subtitle: 'Acesse PDFs, listas e player de apoio para cada evento.',
    };
  }

  return {
    eyebrow: 'Conta e acesso',
    title: 'Perfil',
    subtitle: 'Veja seus dados, métricas rápidas e encerre sua sessão com segurança.',
  };
}

function DesktopNavButton({
  item,
  active,
  badge,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center justify-between rounded-[20px] border px-4 py-3 text-left transition-all ${
        active
          ? 'border-violet-400/30 bg-violet-500/15 text-white shadow-[0_16px_36px_rgba(139,92,246,0.18)]'
          : 'border-white/8 bg-white/[0.03] text-white/72 hover:border-white/12 hover:bg-white/[0.05] hover:text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl text-[16px] ${
            active
              ? 'bg-white/10'
              : 'bg-black/20 group-hover:bg-white/10'
          }`}
        >
          <span>{item.icon}</span>
        </div>

        <div>
          <div className="text-[14px] font-black tracking-[-0.02em]">
            {item.label}
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-white/45">
            {item.key === 'home'
              ? 'Resumo do painel'
              : item.key === 'pendentes'
              ? 'Convites aguardando'
              : item.key === 'escalas'
              ? 'Eventos confirmados'
              : item.key === 'repertorios'
              ? 'Materiais e player'
              : 'Conta e métricas'}
          </div>
        </div>
      </div>

      {badge ? (
        <div className="rounded-full border border-violet-300/20 bg-violet-400/10 px-2.5 py-1 text-[11px] font-black text-violet-200">
          {badge}
        </div>
      ) : null}
    </button>
  );
}

function LoginScreen({ onGoogleLogin, loggingIn, error }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050814] px-5 py-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.45),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.18),_transparent_35%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,11,24,0.2)_0%,rgba(5,8,20,0.95)_70%)]" />

      <div className="relative z-10 w-full max-w-md rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(29,20,58,0.98),rgba(10,14,30,0.98))] p-7 shadow-[0_40px_120px_rgba(0,0,0,0.65)]">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-violet-300/20 bg-black shadow-[0_0_60px_rgba(139,92,246,0.35)]">
          <span className="font-serif text-[30px] italic tracking-[-0.02em] text-white">
            H
          </span>
        </div>

        <div className="mt-7 text-center">
          <div className="inline-flex rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-violet-200">
            Harmonics Member
          </div>

          <h1 className="mt-4 text-[36px] font-black tracking-[-0.05em]">
            Acesse seu painel
          </h1>

          <p className="mt-3 text-[15px] leading-7 text-white/60">
            Suas escalas, repertórios e solicitações em um só lugar.
          </p>
        </div>

        <button
          type="button"
          onClick={onGoogleLogin}
          disabled={loggingIn}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-[22px] bg-white px-5 py-4 text-[16px] font-black text-[#111827] shadow-[0_18px_40px_rgba(255,255,255,0.18)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        >
          <span className="text-[20px]">G</span>
          {loggingIn ? 'Entrando...' : 'Continuar com Google'}
        </button>

        {loggingIn && (
          <div className="mt-5 text-center text-[13px] text-white/50 animate-pulse">
            Validando acesso...
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-[18px] border border-red-300/15 bg-red-400/10 px-4 py-3 text-[14px] font-semibold text-red-100">
            {error}
          </div>
        )}

        <div className="mt-8 text-center text-[12px] text-white/40">
          Acesso liberado apenas para membros autorizados.
        </div>
      </div>
    </div>
  );
}

function WelcomeSplash({ visible, memberName }) {
  return (
    <div
      className={`fixed inset-0 z-[500] flex items-center justify-center bg-[#050814] px-6 transition-all duration-500 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.35),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.12),_transparent_32%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,11,24,0.15)_0%,rgba(5,8,20,0.96)_72%)]" />

      <div
        className={`relative z-10 w-full max-w-md rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(29,20,58,0.96),rgba(10,14,30,0.98))] px-7 py-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.55)] transition-all duration-500 ${
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.985] opacity-0'
        }`}
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-violet-300/20 bg-black shadow-[0_0_50px_rgba(139,92,246,0.28)]">
          <span className="font-serif text-[26px] italic tracking-[-0.02em] text-white">
            H
          </span>
        </div>

        <div className="mt-6 inline-flex rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-violet-200">
          Harmonics Member
        </div>

        <h2 className="mt-5 text-[30px] font-black tracking-[-0.05em] text-white">
          Bem-vindo de volta
        </h2>

        <p className="mt-2 text-[22px] font-bold tracking-[-0.03em] text-violet-200">
          {memberName || 'Membro Harmonics'}
        </p>

        <p className="mt-4 text-[14px] leading-7 text-white/55">
          Preparando seu painel, escalas e repertórios...
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-violet-300 [animation-delay:-0.2s]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.1s]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-violet-500" />
        </div>
      </div>
    </div>
  );
}

export default function MembroPage() {
  const authBootstrappedRef = useRef(false);

  const [sessionChecked, setSessionChecked] = useState(false);
  const [member, setMember] = useState(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState('');

  const [showWelcomeSplash, setShowWelcomeSplash] = useState(false);
  const toast = useAppToast();
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [lastWelcomedMemberId, setLastWelcomedMemberId] = useState(null);

  const [invites, setInvites] = useState([]);
  const [precontracts, setPrecontracts] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [activeTab, setActiveTab] = useState('home');
  const [loadingKey, setLoadingKey] = useState('');

  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [isMiniPlayerVisible, setIsMiniPlayerVisible] = useState(false);
  const [playerEventTitle, setPlayerEventTitle] = useState('');

  const {
    state: {
      isPlaying,
      currentTrackIndex: playerIndex,
      playlist: playerPlaylist,
      currentTrack,
      currentTime,
    },
    actions: {
      play,
      pause,
      next,
      prev,
      setTrack,
      setRenderTarget,
      replacePlaylist,
      closeSession,
    },
  } = useGlobalPlayer();

  const [scaleModalOpen, setScaleModalOpen] = useState(false);
  const [scaleModalEvent, setScaleModalEvent] = useState(null);
  const [scaleModalMusicians, setScaleModalMusicians] = useState([]);

  const [repertorioResumoOpen, setRepertorioResumoOpen] = useState(false);
  const [repertorioResumoItem, setRepertorioResumoItem] = useState(null);
  const [repertoireConfigs, setRepertoireConfigs] = useState([]);
  const [repertoireItems, setRepertoireItems] = useState([]);
  const [isModalRenderTargetReady, setIsModalRenderTargetReady] = useState(false);
  const [isMiniRenderTargetReady, setIsMiniRenderTargetReady] = useState(false);
  const shouldResumeAfterMinimizeRef = useRef(false);

 async function resolveMemberFromSession() {
  try {
    setError('');

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const sessionEmail = String(session?.user?.email || '')
      .trim()
      .toLowerCase();

    if (!sessionEmail) {
      setMember(null);
      return;
    }

    // ✅ VERIFICAR SE É ADMIN PRIMEIRO
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id, name')
      .eq('id', session.user.id)
      .maybeSingle();

    // Se for admin, permitir acesso direto
    if (!profileError && profile?.role === 'admin') {
      setMember({
        id: profile.id,
        name: profile.name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Admin',
        email: sessionEmail,
        phone: '',
        tag: 'admin',
        is_active: true,
        isAdmin: true, // ✅ FLAG para controlar comportamento
      });
      return;
    }

    // ✅ Se não é admin, continuar com validação normal em contacts
    const { data, error: memberError } = await supabase
      .from('contacts')
      .select('id, name, email, phone, tag, is_active')
      .eq('email', sessionEmail)
      .maybeSingle();

    if (memberError) {
      setMember(null);
      setError('Não foi possível validar seu acesso.');
      return;
    }

    if (!data) {
      setMember(null);
      setError('Este e-mail não está autorizado no painel do membro.');
      return;
    }

    if (data.is_active === false) {
      setMember(null);
      setError('Seu acesso está inativo no momento.');
      return;
    }

    setMember(data);
  } catch (e) {
    console.error('Erro ao resolver membro:', e);
    setMember(null);
    setError('Não foi possível validar seu acesso.');
  } finally {
    setSessionChecked(true);
    setLoggingIn(false);
  }
}

  async function loadDashboardData(currentMember) {
    if (!currentMember?.id) return;

    try {
      setLoadingData(true);
      setError('');

      // ✅ SE FOR ADMIN: Buscar TODOS os dados (sem filtro)
      if (currentMember.isAdmin) {
        const [
          scalesResp,
          invitesResp,
          precontractsResp,
          contractsResp,
          repertoireConfigsResp,
          repertoireItemsResp,
        ] = await Promise.all([
          supabase
            .from('event_musicians')
            .select('event_id'),
          supabase
            .from('invites')
            .select('event_id')
            .neq('status', 'removed'),

          supabase
            .from('precontracts')
            .select('id, event_id, public_token, reception_hours, has_sound, has_transport'),

          supabase
            .from('contracts')
            .select(CONTRACTS_SELECT),

          supabase
            .from('repertoire_config')
            .select(REPERTOIRE_CONFIG_SELECT),

          supabase
            .from('repertoire_items')
            .select(REPERTOIRE_ITEMS_SELECT)
            .order('item_order', { ascending: true }),
        ]);

        if (scalesResp.error) throw scalesResp.error;
        if (invitesResp.error) throw invitesResp.error;
        if (precontractsResp.error) throw precontractsResp.error;
        if (contractsResp.error) throw contractsResp.error;
        if (repertoireConfigsResp.error) throw repertoireConfigsResp.error;
        if (repertoireItemsResp.error) throw repertoireItemsResp.error;

        console.log('[MEMBRO_PANEL][RAW_QUERY_RESULT]', {
          mode: 'admin',
          scales: scalesResp.data?.length || 0,
          invites: invitesResp.data?.length || 0,
          precontracts: precontractsResp.data?.length || 0,
          contracts: contractsResp.data?.length || 0,
          repertoireConfigs: repertoireConfigsResp.data?.length || 0,
          repertoireItems: repertoireItemsResp.data?.length || 0,
        });

        const operationalEventIds = Array.from(
          new Set(
            [...(scalesResp.data || []), ...(invitesResp.data || [])]
              .map((item) => String(item?.event_id || '').trim())
              .filter(Boolean)
          )
        );
        const eventsResp = await supabase
          .from('events')
          .select(`
            id,
            created_at,
            *
          `)
          .order('event_date', { ascending: true })
          .order('event_time', { ascending: true });

        if (eventsResp.error) throw eventsResp.error;
        const signedContractEventIds = new Set(
          (contractsResp.data || [])
            .filter((row) => isSignedContract(row))
            .map((row) => String(row?.event_id || '').trim())
            .filter(Boolean)
        );
        const repertoireEventIds = new Set(
          (repertoireConfigsResp.data || [])
            .filter((row) => hasRepertoireMaterial(row))
            .map((row) => String(row?.event_id || '').trim())
            .filter(Boolean)
        );
        const operationalEventIdsSet = new Set(operationalEventIds);
        const relevantEventIds = new Set([
          ...signedContractEventIds,
          ...repertoireEventIds,
          ...operationalEventIdsSet,
        ]);

        const adminEvents = (Array.isArray(eventsResp.data) ? eventsResp.data : [])
          .filter((event) => {
            const eventId = String(event?.id || '').trim();
            if (!eventId) return false;
            if (!relevantEventIds.has(eventId)) return false;
            if (!isActiveSystemEvent(event)) return false;
            if (!isValidEventDate(event?.event_date)) return false;
            return true;
          });
        const adminInvites = adminEvents.map((event) => ({
          id: `admin-event-${event.id}`,
          event_id: event.id,
          contact_id: currentMember.id,
          suggested_role_name: '',
          message: '',
          status: 'confirmed',
          sent_at: event?.created_at || null,
          responded_at: event?.created_at || null,
          created_at: event?.created_at || null,
          events: event,
          source_flags: {
            contractSigned: signedContractEventIds.has(String(event?.id || '').trim()),
            repertoireReady: repertoireEventIds.has(String(event?.id || '').trim()),
            operationActive: operationalEventIdsSet.has(String(event?.id || '').trim()),
          },
        }));

        console.info('[MEMBER_PANEL][ADMIN_BYPASS]', {
          memberId: currentMember.id,
          totalEvents: adminEvents.length,
          sourceEventIds: operationalEventIds.length,
          signedContractEventIds: signedContractEventIds.size,
          repertoireEventIds: repertoireEventIds.size,
          relevantEventIds: relevantEventIds.size,
        });

        setInvites(adminInvites);
        setPrecontracts(Array.isArray(precontractsResp.data) ? precontractsResp.data : []);
        setContracts(Array.isArray(contractsResp.data) ? contractsResp.data : []);
        setRepertoireConfigs(Array.isArray(repertoireConfigsResp.data) ? repertoireConfigsResp.data : []);
        setRepertoireItems(Array.isArray(repertoireItemsResp.data) ? repertoireItemsResp.data : []);
        return;
      }

      // ✅ SE NÃO FOR ADMIN: Código original do membro (com filtro .eq('contact_id', currentMember.id))
     const [
  invitesResp,
  precontractsResp,
  contractsResp,
  repertoireConfigsResp,
  repertoireItemsResp,
] = await Promise.all([
  supabase
    .from('invites')
    .select(`
      id,
      event_id,
      contact_id,
      suggested_role_name,
      message,
      status,
      sent_at,
      responded_at,
      created_at,
      events (*)
    `)
    .eq('contact_id', currentMember.id)
    .neq('status', 'removed')
    .order('created_at', { ascending: false }),

        supabase
          .from('precontracts')
          .select('id, event_id, public_token, reception_hours, has_sound, has_transport'),

        supabase
        .from('contracts')
        .select(CONTRACTS_SELECT),

        supabase
          .from('repertoire_config')
          .select(REPERTOIRE_CONFIG_SELECT),

        supabase
          .from('repertoire_items')
          .select(REPERTOIRE_ITEMS_SELECT)
          .order('item_order', { ascending: true }),
      ]);

      if (invitesResp.error) throw invitesResp.error;
      if (precontractsResp.error) throw precontractsResp.error;
      if (contractsResp.error) throw contractsResp.error;
      if (repertoireConfigsResp.error) throw repertoireConfigsResp.error;
      if (repertoireItemsResp.error) throw repertoireItemsResp.error;

      console.log('[MEMBRO_PANEL][RAW_QUERY_RESULT]', {
        mode: 'member',
        invites: invitesResp.data?.length || 0,
        precontracts: precontractsResp.data?.length || 0,
        contracts: contractsResp.data?.length || 0,
        repertoireConfigs: repertoireConfigsResp.data?.length || 0,
        repertoireItems: repertoireItemsResp.data?.length || 0,
      });

      setInvites(Array.isArray(invitesResp.data) ? invitesResp.data : []);
      setPrecontracts(Array.isArray(precontractsResp.data) ? precontractsResp.data : []);
      setContracts(Array.isArray(contractsResp.data) ? contractsResp.data : []);
      setRepertoireConfigs(Array.isArray(repertoireConfigsResp.data) ? repertoireConfigsResp.data : []);
      setRepertoireItems(Array.isArray(repertoireItemsResp.data) ? repertoireItemsResp.data : []);
    } catch (e) {
      console.error('Erro ao carregar painel do membro:', e);
      setError(e?.message || 'Não foi possível carregar seu painel.');
      setInvites([]);
      setPrecontracts([]);
      setContracts([]);
      setRepertoireConfigs([]);
      setRepertoireItems([]);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
      try {
        setError('');

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!mounted) return;

        if (session?.user?.email) {
          await resolveMemberFromSession();
        } else {
          setSessionChecked(true);
          setLoggingIn(false);
        }
      } catch (e) {
        console.error('Erro no bootstrap de auth:', e);
        if (mounted) {
          setSessionChecked(true);
          setLoggingIn(false);
        }
      } finally {
        authBootstrappedRef.current = true;
      }
    }

    bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!authBootstrappedRef.current) return;
      if (!mounted) return;

      if (session?.user?.email) {
        await resolveMemberFromSession();
        return;
      }

      setMember(null);
      setInvites([]);
      setPrecontracts([]);
      setContracts([]);
      setRepertoireConfigs([]);
      setRepertoireItems([]);
      setSessionChecked(true);
      setLoggingIn(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!member?.id) return;
    loadDashboardData(member);
  }, [member]);

  useEffect(() => {
    if (!member?.id) return;
    if (loadingData) return;
    if (lastWelcomedMemberId === member.id) return;

    setShowWelcomeSplash(true);

    const enterTimer = setTimeout(() => {
      setWelcomeVisible(true);
    }, 30);

    const exitTimer = setTimeout(() => {
      setWelcomeVisible(false);
    }, 1350);

    const finishTimer = setTimeout(() => {
      setShowWelcomeSplash(false);
      setLastWelcomedMemberId(member.id);
    }, 1850);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
    };
  }, [member?.id, loadingData, lastWelcomedMemberId]);

  const dashboard = useMemo(() => {
    return buildMemberDashboardData({
      invites,
      contracts,
      precontracts,
      repertoireConfigs,
      repertoireItems,
    });
  }, [invites, contracts, precontracts, repertoireConfigs, repertoireItems]);

  const { confirmados, pendentes, proximosConfirmados, resumo } = useMemo(() => ({
    confirmados: Array.isArray(dashboard?.confirmados) ? dashboard.confirmados : [],
    pendentes: Array.isArray(dashboard?.pendentes) ? dashboard.pendentes : [],
    proximosConfirmados: Array.isArray(dashboard?.proximosConfirmados)
      ? dashboard.proximosConfirmados
      : [],
    resumo: dashboard?.resumo || {
      pendentes: 0,
      confirmados: 0,
      repertorios: 0,
    },
  }), [dashboard]);

  const repertorios = useMemo(() => {
    return confirmados.filter(
      (row) =>
        row?.repertorioPdfUrl ||
        row?.repertoireConfig?.submitted_at ||
        row?.repertoireConfig?.is_locked ||
        ['ENVIADO', 'ENVIADO_TRANCADO', 'FINALIZADO', 'CONCLUIDO', 'AGUARDANDO_REVISAO', 'REABERTO', 'LIBERADO_PARA_EDICAO', 'REVISAO_SOLICITADA', 'REVIEW_REQUESTED'].includes(
          String(row?.repertoireConfig?.status || '').trim().toUpperCase()
        ) ||
        (Array.isArray(row?.youtubeUrls) && row.youtubeUrls.length > 0) ||
        (Array.isArray(row?.repertorioItems) && row.repertorioItems.length > 0)
    );
  }, [confirmados]);

  useEffect(() => {
    console.log('[MEMBRO_PANEL][EVENTS_MONTH_RESULT]', {
      memberId: member?.id || null,
      isAdmin: Boolean(member?.isAdmin),
      currentMonth: new Date().toISOString().slice(0, 7),
      confirmados: confirmados.length,
      pendentes: pendentes.length,
      proximosConfirmados: proximosConfirmados.length,
    });
  }, [member?.id, member?.isAdmin, confirmados.length, pendentes.length, proximosConfirmados.length]);

  useEffect(() => {
    console.log('[MEMBRO_PANEL][REPERTOIRES_RESULT]', {
      memberId: member?.id || null,
      isAdmin: Boolean(member?.isAdmin),
      repertoriosAtivos: repertorios.length,
      confirmadosComMaterial: repertorios.filter((item) => item?.inviteStatus === 'confirmed').length,
    });
  }, [member?.id, member?.isAdmin, repertorios]);

  useEffect(() => {
    console.log('[MEMBRO_PANEL][COUNTS_RESULT]', {
      memberId: member?.id || null,
      isAdmin: Boolean(member?.isAdmin),
      pendentes: resumo?.pendentes || 0,
      confirmados: resumo?.confirmados || 0,
      repertorios: resumo?.repertorios || 0,
      proximosConfirmados: proximosConfirmados.length,
      concluidos: confirmados.filter((item) => item?.isDone).length,
    });
  }, [member?.id, member?.isAdmin, resumo, confirmados, proximosConfirmados.length]);

  useEffect(() => {
    console.log('[MEMBRO_PLAYER][PLAYBACK_STATE]', {
      isPlaying,
      currentIndex: playerIndex,
      currentTrack: currentTrack?.title || '',
      playlistSize: playerPlaylist.length,
    });
  }, [isPlaying, playerIndex, currentTrack?.title, playerPlaylist.length]);

  useEffect(() => {
    console.log('[MEMBRO_PLAYER][MINI_PLAYER_STATE]', {
      isMiniPlayerVisible,
      isPlayerModalOpen,
      isPlaying,
      currentTrack: currentTrack?.title || '',
      currentTrackIndex: playerIndex,
      playlistSize: playerPlaylist.length,
    });
  }, [
    isMiniPlayerVisible,
    isPlayerModalOpen,
    isPlaying,
    currentTrack?.title,
    playerIndex,
    playerPlaylist.length,
  ]);

  useEffect(() => {
    if (!isMiniPlayerVisible) return;
    console.log('[PLAYER_MINI][VISIBLE]', {
      visible: isMiniPlayerVisible,
      modalOpen: isPlayerModalOpen,
    });
    console.log('[PLAYER_MINI][STATE]', {
      isPlaying,
      currentTrack: currentTrack?.title || '',
      currentTrackIndex: playerIndex,
      currentTime,
    });
  }, [isMiniPlayerVisible, isPlayerModalOpen, isPlaying, currentTrack?.title, playerIndex, currentTime]);

  useEffect(() => {
    if (!shouldResumeAfterMinimizeRef.current) return;
    if (isPlayerModalOpen) return;
    if (!isMiniPlayerVisible || !isMiniRenderTargetReady) return;

    play();
    shouldResumeAfterMinimizeRef.current = false;

    console.log('[PLAYER_GLOBAL][IS_PLAYING_AFTER_MINIMIZE]', true);
    console.log('[PLAYER_GLOBAL][CURRENT_TIME_AFTER_MINIMIZE]', currentTime);
    console.log('[PLAYER_GLOBAL][CURRENT_TRACK_AFTER_MINIMIZE]', currentTrack?.title || '');
  }, [
    isPlayerModalOpen,
    isMiniPlayerVisible,
    isMiniRenderTargetReady,
    play,
    currentTime,
    currentTrack?.title,
  ]);

  useEffect(() => {
    console.log('[PLAYER][MODAL_OPEN]', isPlayerModalOpen);
    console.log('[PLAYER][MINIBAR_VISIBLE]', isMiniPlayerVisible);
    console.log('[PLAYER][IS_PLAYING]', isPlaying);
    console.log('[PLAYER][CURRENT_TIME]', currentTime);
    console.log('[PLAYER][CURRENT_TRACK]', currentTrack?.title || '');
  }, [isPlayerModalOpen, isMiniPlayerVisible, isPlaying, currentTime, currentTrack?.title]);

  useEffect(() => {
    if (isPlayerModalOpen && isModalRenderTargetReady) {
      const modalNode = document.querySelector('[data-player-modal-host="true"]');
      if (modalNode) {
        setRenderTarget(modalNode, 'modal_large');
      }
    } else if (!isPlayerModalOpen && isMiniPlayerVisible && isMiniRenderTargetReady) {
      const miniNode = document.querySelector('[data-player-mini-host="true"]');
      if (miniNode) {
        setRenderTarget(miniNode, 'mini_bar');
      }
    }

    console.log('[PLAYER][VIEW_SWITCH_SYNC]', {
      modalOpen: isPlayerModalOpen,
      miniVisible: isMiniPlayerVisible,
      currentTrack: currentTrack?.title || '',
      currentTime,
      isPlaying,
    });
  }, [
    isPlayerModalOpen,
    isMiniPlayerVisible,
    isModalRenderTargetReady,
    isMiniRenderTargetReady,
    setRenderTarget,
    currentTrack?.title,
    currentTime,
    isPlaying,
  ]);

  const desktopMeta = getDesktopTabMeta(activeTab);

  async function handleGoogleLogin() {
    try {
      setLoggingIn(true);
      setError('');

      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/membro`
          : undefined;

      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (authError) throw authError;
    } catch (e) {
      console.error('Erro no login Google:', e);
      setError(e?.message || 'Falha ao entrar com Google.');
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Erro ao sair:', e);
    } finally {
      setMember(null);
      setInvites([]);
      setPrecontracts([]);
      setContracts([]);
      setPlayerEventTitle('');
      setIsPlayerModalOpen(false);
      setIsMiniPlayerVisible(false);
      closeSession();
      setScaleModalOpen(false);
      setScaleModalEvent(null);
      setScaleModalMusicians([]);
      setRepertorioResumoOpen(false);
      setRepertorioResumoItem(null);
      setActiveTab('home');
      setRepertoireConfigs([]);
      setRepertoireItems([]);
      setShowWelcomeSplash(false);
      setWelcomeVisible(false);
      setLastWelcomedMemberId(null);
    }
  }

  async function updateInviteStatus(item, nextStatus) {
    const key = `${item.id}:${nextStatus === 'confirmed' ? 'accept' : 'decline'}`;

    try {
      setLoadingKey(key);
      setError('');

      const nowIso = new Date().toISOString();

      const { error: inviteError } = await supabase
        .from('invites')
        .update({
          status: nextStatus,
          responded_at: nowIso,
        })
        .eq('id', item.id);

      if (inviteError) throw inviteError;

      const musicianUpdate = {
        status: nextStatus,
      };

      if (nextStatus === 'confirmed') {
        musicianUpdate.confirmed_at = nowIso;
      }

      const { error: musicianError } = await supabase
        .from('event_musicians')
        .update(musicianUpdate)
        .eq('event_id', item.eventId)
        .eq('musician_id', member?.id);

      if (musicianError) throw musicianError;

      await loadDashboardData(member);

      if (nextStatus === 'confirmed') {
        toast.success('Convite aceito com sucesso.');
        setActiveTab('escalas');
      } else {
        toast.info('Convite recusado com sucesso.');
      }
    } catch (e) {
      console.error('Erro ao responder convite:', e);
      setError(e?.message || 'Não foi possível responder o convite.');
      toast.error(e?.message || 'Não foi possível responder o convite.');
    } finally {
      setLoadingKey('');
    }
  }

  function buildPlaylistFromRow(item) {
    if (!Array.isArray(item?.repertorioItems)) return [];
    const rawItems = item.repertorioItems;
    console.log('[MEMBRO_PLAYER][RAW_ITEMS]', rawItems);

    const orderInput = rawItems.map((row) => ({
      song: row?.musica || row?.song_name || '',
      section: row?.section || row?.tipo || row?.type || '',
      moment: row?.momento || row?.moment || '',
      whoEnters: row?.quemEntra || row?.who_enters || '',
      itemOrder: row?.item_order ?? row?.ordem ?? null,
      label: row?.label || '',
    }));
    console.log('[MEMBRO_PLAYER][ORDER_INPUT]', orderInput);

    const labelInput = rawItems.map((row) => ({
      song: row?.musica || row?.song_name || '',
      section: row?.section || '',
      moment: row?.momento || row?.moment || '',
      whoEnters: row?.quemEntra || row?.who_enters || '',
      label: row?.label || '',
    }));
    console.log('[MEMBRO_PLAYER][LABEL_INPUT]', labelInput);

    const orderedRows = rawItems
      .filter((row) => Boolean(resolveTrackUrl(row)))
      .map((row, index) => {
        const sectionKey = resolveSectionFromItem(row);
        const sectionOrder = SECTION_ORDER[sectionKey] ?? 99;
        const momentOrder = getMomentOrder(row);
        const itemOrder = Number(row?.item_order ?? row?.ordem ?? index + 1);

        return {
          row,
          index,
          sectionKey,
          sectionOrder,
          momentOrder,
          itemOrder,
        };
      })
      .sort((a, b) => {
        if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder;
        if (a.momentOrder !== b.momentOrder) return a.momentOrder - b.momentOrder;
        if (a.itemOrder !== b.itemOrder) return a.itemOrder - b.itemOrder;
        return a.index - b.index;
      });

    const playlist = orderedRows.map((entry, index) => {
      const row = entry.row;
      return {
        title: row?.musica || row?.song_name || `Faixa ${index + 1}`,
        subtitle: getDisplayLabel(row, entry.sectionKey),
        notes: row?.observacao || row?.notes || '',
        videoId: String(row?.reference_video_id || '').trim(),
        url: resolveTrackUrl(row),
        order: row?.ordem ?? row?.item_order ?? index + 1,
        sectionKey: entry.sectionKey,
      };
    });

    console.log('[MEMBRO_PLAYER][FINAL_PLAYLIST]', playlist);
    return playlist;
  }

  function openRepertoire(item, options = {}) {
    if (!item) return;

    const playlist = buildPlaylistFromRow(item);
    if (!playlist.length) {
      toast.info('Este repertório não possui faixas com referência de áudio.');
      return;
    }

    replacePlaylist(playlist, { autoplay: options.autoplay !== false, startIndex: 0 });
    setPlayerEventTitle(item?.clientName || 'Repertório');
    setIsMiniPlayerVisible(Boolean(options.autoplay !== false));
    console.log('[PLAYER][CURRENT_TRACK]', playlist[0]?.title || '');
    console.log('[PLAYER][IS_PLAYING]', options.autoplay !== false);

    if (options.autoplay !== false) {
      setIsPlayerModalOpen(true);
      setIsMiniPlayerVisible(false);
    }
  }

  function handleMinimizePlayer() {
    shouldResumeAfterMinimizeRef.current = Boolean(isPlaying);
    console.log('[PLAYER_MODAL][CLOSE_TO_MINI]', {
      wasPlaying: isPlaying,
      currentTrack: currentTrack?.title || '',
      currentTrackIndex: playerIndex,
      currentTime,
    });
    console.log('[MEMBRO_PLAYER][MINIMIZE_CLICK]', {
      isPlaying,
      currentTrack: currentTrack?.title || '',
      currentTrackIndex: playerIndex,
    });
    setIsPlayerModalOpen(false);
    setIsMiniPlayerVisible(true);
    console.log('[PLAYER][MODAL_OPEN]', false);
    console.log('[PLAYER][MINIBAR_VISIBLE]', true);
    console.log('[PLAYER][VIEW_SWITCH_SYNC]', {
      to: 'mini',
      currentTrack: currentTrack?.title || '',
      isPlaying,
    });
  }

  function handleClosePlayerSession() {
    console.log('[MEMBRO_PLAYER][CLOSE_CLICK]', {
      isPlaying,
      currentTrack: currentTrack?.title || '',
      currentTrackIndex: playerIndex,
    });
    setIsPlayerModalOpen(false);
    setIsMiniPlayerVisible(false);
    setPlayerEventTitle('');
    setRenderTarget(null, 'session_closed');
    closeSession();
  }

  function openPdf(item) {
    if (typeof window !== 'undefined') {
      const repertoirePdfUrl = item?.repertorioPdfUrl || '';

      if (repertoirePdfUrl) {
        window.open(repertoirePdfUrl, '_blank', 'noopener,noreferrer');
      }
    }
  }

  function openMaps(item) {
    const locationName = String(item?.locationName || '').trim();
    if (!locationName || typeof window === 'undefined') return;
    const query = encodeURIComponent(locationName);
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${query}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  async function handleOpenScale(item) {
    setScaleModalEvent(item || null);
    setScaleModalMusicians([]);
    setScaleModalOpen(true);

    try {
      setError('');
      if (!item?.eventId) {
        return;
      }

      const { data, error: scaleError } = await supabase
        .from('event_musicians')
        .select(`
          id,
          musician_id,
          role,
          status,
          notes,
          contacts (
            id,
            name,
            email,
            phone,
            tag
          )
        `)
        .eq('event_id', item.eventId);

      if (scaleError) throw scaleError;
      const musicians = (Array.isArray(data) ? data : []).map((row) => {
        const contact = Array.isArray(row?.contacts)
          ? row.contacts[0] || null
          : row?.contacts || null;

        return {
          id: row?.id,
          musician_id: row?.musician_id,
          role: row?.role || contact?.tag || '',
          status: row?.status || 'pending',
          musician_name: contact?.name || '',
          musician_email: contact?.email || '',
          musician_phone: contact?.phone || '',
          contact_tag_text: contact?.tag || '',
        };
      });

      setScaleModalEvent(item || null);
      setScaleModalMusicians(musicians);
    } catch (e) {
      console.error('Erro ao abrir escala:', e);
      setScaleModalMusicians([]);
      setError(e?.message || 'Não foi possível carregar a escala do evento.');
    }
  }

  function handleOpenRepertoireSummary(item) {
    if (!item) return;
    setRepertorioResumoItem(item);
    setRepertorioResumoOpen(true);
  }

  function handlePrevTrack() {
    prev();
    play();
    console.log('[PLAYER][NEXT_TRACK_AUTOPLAY]', { direction: 'prev', autoPlay: true });
    console.log('[MEMBRO_PLAYER][TRACK_CHANGE]', {
      action: 'prev',
      wasPlaying: isPlaying,
      total: playerPlaylist.length,
    });
  }

  function handleTogglePlaying() {
    if (isPlaying) {
      pause();
      console.log('[MEMBRO_PLAYER][PLAYBACK_STATE]', {
        action: 'toggle',
        previous: true,
        next: false,
      });
      return;
    }

    play();
    console.log('[MEMBRO_PLAYER][PLAYBACK_STATE]', {
      action: 'toggle',
      previous: false,
      next: true,
    });
  }

  function handleNextTrack(reason = 'manual') {
    next();
    play();
    console.log('[PLAYER][NEXT_TRACK_AUTOPLAY]', { direction: 'next', reason, autoPlay: true });
    console.log('[MEMBRO_PLAYER][TRACK_CHANGE]', {
      action: 'next',
      reason,
      wasPlaying: isPlaying,
      total: playerPlaylist.length,
    });
  }

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050814] text-white">
        <div className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-[15px] font-semibold">
          Carregando acesso...
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div>
        <LoginScreen
          onGoogleLogin={handleGoogleLogin}
          loggingIn={loggingIn}
          error={error}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1560px] gap-0 xl:px-4 xl:py-4">
        <aside className="hidden xl:flex xl:w-[320px] xl:flex-col">
          <div className="sticky top-4 flex h-[calc(100vh-32px)] flex-col overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.92),rgba(9,12,24,0.96))] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-4 border-b border-white/8 pb-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#7c3aed,#a855f7)] shadow-[0_18px_40px_rgba(124,58,237,0.26)]">
                <span className="font-serif text-[24px] italic text-white">H</span>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-200/80">
                  Harmonics Member
                </p>
                <h1 className="mt-1 text-[22px] font-black tracking-[-0.04em] text-white">
                  {member?.name || 'Membro'}
                </h1>
                <p className="mt-1 text-[13px] text-white/45">
                  {member?.isAdmin ? '🔑 Visão administrativa' : 'Painel premium do músico'}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/40">
                  Pendentes
                </p>
                <p className="mt-2 text-[22px] font-black tracking-[-0.04em] text-white">
                  {resumo?.pendentes || 0}
                </p>
              </div>

              <div className="rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/40">
                  Confirmados
                </p>
                <p className="mt-2 text-[22px] font-black tracking-[-0.04em] text-white">
                  {resumo?.confirmados || 0}
                </p>
              </div>

              <div className="col-span-2 rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(139,92,246,0.12),rgba(255,255,255,0.02))] px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-violet-200/80">
                  Repertórios ativos
                </p>
                <p className="mt-2 text-[24px] font-black tracking-[-0.04em] text-white">
                  {resumo?.repertorios || 0}
                </p>
              </div>
            </div>

            <nav className="mt-6 flex-1 space-y-3 overflow-y-auto pr-1">
              {DESKTOP_TABS.map((item) => (
                <DesktopNavButton
                  key={item.key}
                  item={item}
                  active={activeTab === item.key}
                  badge={item.key === 'pendentes' ? resumo?.pendentes || 0 : null}
                  onClick={() => setActiveTab(item.key)}
                />
              ))}
            </nav>

            <div className="mt-5 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
              <p className="text-[12px] font-black uppercase tracking-[0.14em] text-white/40">
                Sessão
              </p>
              <p className="mt-2 text-[14px] font-semibold text-white/72">
                {member?.email || 'Sem e-mail'}
              </p>

              <button
                type="button"
                onClick={handleLogout}
                className="mt-4 w-full rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-[14px] font-black text-white transition hover:bg-white/[0.08]"
              >
                Sair do painel
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-4 pt-4 pb-[220px] md:px-6 md:pt-6 md:pb-36 xl:max-w-none xl:px-8 xl:pt-8 xl:pb-28">
            <div className="hidden xl:block">
              <div className="mb-6 overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(124,58,237,0.18),rgba(17,24,39,0.55)_48%,rgba(59,130,246,0.10))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-3xl">
                    <p className="text-[12px] font-black uppercase tracking-[0.16em] text-violet-200/85">
                      {desktopMeta.eyebrow}
                    </p>
                    <h2 className="mt-3 text-[40px] font-black tracking-[-0.06em] text-white">
                      {desktopMeta.title}
                    </h2>
                    <p className="mt-3 max-w-2xl text-[15px] leading-7 text-white/65">
                      {desktopMeta.subtitle}
                    </p>
                  </div>

                  <div className="grid min-w-[250px] grid-cols-1 gap-3">
                    <div className="rounded-[22px] border border-white/10 bg-black/15 px-4 py-4 backdrop-blur">
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/40">
                        Próximos confirmados
                      </p>
                      <p className="mt-2 text-[26px] font-black tracking-[-0.04em] text-white">
                        {proximosConfirmados.length}
                      </p>
                    </div>

                    <div className="rounded-[22px] border border-white/10 bg-black/15 px-4 py-4 backdrop-blur">
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/40">
                        Painel pronto para uso
                      </p>
                      <p className="mt-2 text-[14px] font-semibold leading-6 text-white/70">
                        Desktop refinado com navegação lateral e área principal premium.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5 md:space-y-6">
              {error ? (
                <div className="rounded-[20px] border border-red-300/15 bg-red-400/10 px-4 py-3 text-[14px] font-semibold text-red-100">
                  {error}
                </div>
              ) : null}

              {loadingData ? (
                <div className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-6 text-[15px] font-semibold text-white/70">
                  Carregando seu painel...
                </div>
              ) : null}

              {!loadingData && activeTab === 'home' ? (
                <MembroHomeTab
                  resumo={resumo}
                  proximosConfirmados={proximosConfirmados}
                  onGoAgenda={() => setActiveTab('escalas')}
                  onGoPendentes={() => setActiveTab('pendentes')}
                  onGoRepertoire={(item) => {
                    if (item) {
                      handleOpenRepertoireSummary(item);
                      return;
                    }
                    setActiveTab('repertorios');
                  }}
                />
              ) : null}

              {!loadingData && activeTab === 'pendentes' ? (
                <MembroSolicitacoesTab
                  pendentes={pendentes}
                  onAccept={(item) => updateInviteStatus(item, 'confirmed')}
                  onDecline={(item) => updateInviteStatus(item, 'declined')}
                  loadingKey={loadingKey}
                />
              ) : null}

              {!loadingData && activeTab === 'escalas' ? (
                <MembroEscalasTab
  member={member}
  confirmados={confirmados}
  onOpenRepertoire={handleOpenRepertoireSummary}
  onOpenMaps={openMaps}
  onOpenScale={handleOpenScale}
/>
              ) : null}

              {!loadingData && activeTab === 'repertorios' ? (
                <MembroRepertoriosTab
                  repertorios={repertorios}
                  onOpenRepertoire={handleOpenRepertoireSummary}
                />
              ) : null}

              {!loadingData && activeTab === 'perfil' ? (
                <MembroPerfilTab
                  member={member}
                  onLogout={handleLogout}
                  stats={{
                    realizados: confirmados.filter((item) => item?.isDone).length,
                    pendentes: pendentes.length,
                    confirmados: confirmados.length,
                    repertorios: resumo?.repertorios || 0,
                  }}
                />
              ) : null}
            </div>
          </div>
        </main>
      </div>

      <div className="xl:hidden">
        <MembroBottomNav
          active={activeTab}
          onChange={setActiveTab}
          pendingCount={resumo?.pendentes || 0}
        />
      </div>

      <MembroEscalaModal
        open={scaleModalOpen}
        eventTitle={scaleModalEvent?.clientName || 'Escala'}
        musicians={scaleModalMusicians}
        onClose={() => {
          setScaleModalOpen(false);
          setScaleModalEvent(null);
          setScaleModalMusicians([]);
        }}
      />

      <MembroRepertorioResumoModal
        open={repertorioResumoOpen}
        item={repertorioResumoItem}
        onClose={() => {
          setRepertorioResumoOpen(false);
          setRepertorioResumoItem(null);
        }}
        onOpenPdf={(item) => {
          openPdf(item);
        }}
        onOpenPlayer={(item) => {
          setRepertorioResumoOpen(false);
          openRepertoire(item, { autoplay: true, source: 'repertoire_summary_modal' });
        }}
        onGoToRepertorios={() => {
          setRepertorioResumoOpen(false);
          setActiveTab('repertorios');
        }}
      />

      <MembroPlayerModal
        open={isPlayerModalOpen}
        eventTitle={playerEventTitle}
        playlist={playerPlaylist}
        currentIndex={playerIndex}
        isPlaying={isPlaying}
        onClose={handleMinimizePlayer}
        onSelectTrack={(index) => {
          setTrack(index);
          play();
          console.log('[PLAYER][NEXT_TRACK_AUTOPLAY]', { direction: 'select', autoPlay: true, targetIndex: index });
          console.log('[MEMBRO_PLAYER][TRACK_CHANGE]', {
            action: 'select',
            targetIndex: index,
            total: playerPlaylist.length,
          });
        }}
        onPrev={handlePrevTrack}
        onNext={handleNextTrack}
        onTogglePlay={handleTogglePlaying}
        playerContainerActive={isModalRenderTargetReady}
        onPlayerContainerReady={(node) => {
          setIsModalRenderTargetReady(Boolean(node));
          if (node && isPlayerModalOpen) {
            setRenderTarget(node, 'modal_large');
          }
        }}
      />

      <MiniPlayerBar
        isMiniPlayerVisible={isMiniPlayerVisible}
        currentTrack={currentTrack}
        eventTitle={playerEventTitle}
        isPlaying={isPlaying}
        onExpand={() => {
          setIsPlayerModalOpen(true);
          setIsMiniPlayerVisible(false);
          console.log('[MEMBRO_PLAYER][MODAL_REOPEN_STATE]', {
            isPlaying,
            currentTrack: currentTrack?.title || '',
            currentTrackIndex: playerIndex,
            playlistSize: playerPlaylist.length,
          });
        }}
        onCloseSession={handleClosePlayerSession}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        onTogglePlay={handleTogglePlaying}
        onPlayerContainerReady={(node) => {
          setIsMiniRenderTargetReady(Boolean(node));
          if (node && !isPlayerModalOpen && isMiniPlayerVisible) {
            setRenderTarget(node, 'mini_bar');
          }
        }}
      />

      {showWelcomeSplash ? (
        <WelcomeSplash
          visible={welcomeVisible}
          memberName={member?.name}
        />
      ) : null}
    </div>
  );
}
