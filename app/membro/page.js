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
import MembroEscalaModal from '../../components/membro/MembroEscalaModal';
import MembroRepertorioResumoModal from '../../components/membro/MembroRepertorioResumoModal';
import { buildMemberDashboardData } from '../../lib/membro/membro-invites';

const DESKTOP_TABS = [
  { key: 'home', label: 'Início', icon: '🏠' },
  { key: 'pendentes', label: 'Solicitações', icon: '📨' },
  { key: 'escalas', label: 'Escalas', icon: '🎼' },
  { key: 'repertorios', label: 'Repertórios', icon: '🎧' },
  { key: 'perfil', label: 'Perfil', icon: '👤' },
];

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
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [lastWelcomedMemberId, setLastWelcomedMemberId] = useState(null);

  const [invites, setInvites] = useState([]);
  const [precontracts, setPrecontracts] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [activeTab, setActiveTab] = useState('home');
  const [loadingKey, setLoadingKey] = useState('');

  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [playerPlaylist, setPlayerPlaylist] = useState([]);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [playerEventTitle, setPlayerEventTitle] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);

  const currentTrack = playerPlaylist[playerIndex] || null;

  const [scaleModalOpen, setScaleModalOpen] = useState(false);
  const [scaleModalEvent, setScaleModalEvent] = useState(null);
  const [scaleModalMusicians, setScaleModalMusicians] = useState([]);

  const [repertorioResumoOpen, setRepertorioResumoOpen] = useState(false);
  const [repertorioResumoItem, setRepertorioResumoItem] = useState(null);
  const [repertoireConfigs, setRepertoireConfigs] = useState([]);
  const [repertoireItems, setRepertoireItems] = useState([]);

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

      // Check if user is admin — admins access the member panel directly
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileData?.role === 'admin') {
        setMember({
          id: profileData.id,
          name: profileData.name || profileData.email,
          email: profileData.email || sessionEmail,
          isAdmin: true,
        });
        return;
      }

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

      const invitesQuery = supabase
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
        .neq('status', 'removed')
        .order('created_at', { ascending: false });

      const [
        invitesResp,
        precontractsResp,
        contractsResp,
        repertoireConfigsResp,
        repertoireItemsResp,
      ] = await Promise.all([
        currentMember.isAdmin
          ? invitesQuery
          : invitesQuery.eq('contact_id', currentMember.id),

        supabase
          .from('precontracts')
          .select('id, event_id, public_token'),

        supabase
          .from('contracts')
          .select('id, precontract_id, event_id, pdf_url, doc_url, signed_at'),

        supabase
          .from('repertoire_config')
          .select('*'),

        supabase
          .from('repertoire_items')
          .select('*')
          .order('item_order', { ascending: true }),
      ]);

      if (invitesResp.error) throw invitesResp.error;
      if (precontractsResp.error) throw precontractsResp.error;
      if (contractsResp.error) throw contractsResp.error;
      if (repertoireConfigsResp.error) throw repertoireConfigsResp.error;
      if (repertoireItemsResp.error) throw repertoireItemsResp.error;

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
  }, [member?.id]);

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

  const confirmados = Array.isArray(dashboard?.confirmados) ? dashboard.confirmados : [];
  const pendentes = Array.isArray(dashboard?.pendentes) ? dashboard.pendentes : [];
  const proximosConfirmados = Array.isArray(dashboard?.proximosConfirmados)
    ? dashboard.proximosConfirmados
    : [];
  const resumo = dashboard?.resumo || {
    pendentes: 0,
    confirmados: 0,
    repertorios: 0,
  };

  const repertorios = useMemo(() => {
    return confirmados.filter(
      (row) =>
        row?.contractInfo?.pdfUrl ||
        (Array.isArray(row?.youtubeUrls) && row.youtubeUrls.length > 0) ||
        (Array.isArray(row?.repertorioItems) && row.repertorioItems.length > 0)
    );
  }, [confirmados]);

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
      setPlayerPlaylist([]);
      setPlayerIndex(0);
      setPlayerEventTitle('');
      setPlayerExpanded(false);
      setIsPlaying(false);
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
        setActiveTab('escalas');
      }
    } catch (e) {
      console.error('Erro ao responder convite:', e);
      setError(e?.message || 'Não foi possível responder o convite.');
    } finally {
      setLoadingKey('');
    }
  }

  function buildPlaylistFromRow(item) {
    if (!Array.isArray(item?.repertorioItems)) return [];

    return item.repertorioItems
      .filter((row) => !!(row?.referencia || row?.reference_link))
      .sort((a, b) => Number(a?.ordem ?? a?.item_order ?? 0) - Number(b?.ordem ?? b?.item_order ?? 0))
      .map((row, index) => ({
        title: row?.musica || row?.song_name || `Faixa ${index + 1}`,
        subtitle:
          row?.quemEntra ||
          row?.momento ||
          row?.label ||
          row?.section ||
          '',
        notes: row?.observacao || row?.notes || '',
        url: row?.referencia || row?.reference_link || '',
        order: row?.ordem ?? row?.item_order ?? index + 1,
      }));
  }

  function openRepertoire(item, options = {}) {
    if (!item) return;

    const playlist = buildPlaylistFromRow(item);
    if (!playlist.length) return;

    setPlayerPlaylist(playlist);
    setPlayerIndex(0);
    setPlayerEventTitle(item?.clientName || 'Repertório');
    setIsPlaying(true);

    if (options.autoplay !== false) {
      setPlayerExpanded(true);
    }
  }

  function openPdf(item) {
    if (item?.contractInfo?.pdfUrl && typeof window !== 'undefined') {
      window.open(item.contractInfo.pdfUrl, '_blank', 'noopener,noreferrer');
    }
  }

  function openMaps(item) {
    if (!item?.locationName || typeof window === 'undefined') return;
    const query = encodeURIComponent(item.locationName);
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${query}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  async function handleOpenScale(item) {
    try {
      setError('');

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

      setScaleModalEvent(item);
      setScaleModalMusicians(musicians);
      setScaleModalOpen(true);
    } catch (e) {
      console.error('Erro ao abrir escala:', e);
      setError(e?.message || 'Não foi possível carregar a escala do evento.');
    }
  }

  function handleOpenRepertoireSummary(item) {
    if (!item) return;
    setRepertorioResumoItem(item);
    setRepertorioResumoOpen(true);
  }

  async function handleMarkDone(item) {
    try {
      setError('');

      const nextDone = !item?.isDone;
      const nextStatus = nextDone ? 'done' : 'confirmed';

      const { error: updateError } = await supabase
        .from('events')
        .update({ status: nextStatus })
        .eq('id', item.eventId);

      if (updateError) throw updateError;

      await loadDashboardData(member);
    } catch (e) {
      console.error('Erro ao marcar evento:', e);
      setError(e?.message || 'Não foi possível atualizar o status do evento.');
    }
  }

  function handlePrevTrack() {
    setPlayerIndex((prev) => {
      if (playerPlaylist.length === 0) return 0;
      return (prev - 1 + playerPlaylist.length) % playerPlaylist.length;
    });
    setIsPlaying(true);
  }

  function handleTogglePlaying() {
    setIsPlaying((prev) => !prev);
  }

  function handleNextTrack() {
    setPlayerIndex((prev) => {
      if (playerPlaylist.length === 0) return 0;
      return (prev + 1) % playerPlaylist.length;
    });
    setIsPlaying(true);
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
                  Painel premium do músico
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
          openRepertoire(item, { autoplay: true });
        }}
        onGoToRepertorios={() => {
          setRepertorioResumoOpen(false);
          setActiveTab('repertorios');
        }}
      />

      <MiniPlayerBar
        expanded={playerExpanded}
        currentTrack={currentTrack}
        eventTitle={playerEventTitle}
        playlist={playerPlaylist}
        currentIndex={playerIndex}
        isPlaying={isPlaying}
        onExpand={() => setPlayerExpanded(true)}
        onCollapse={() => setPlayerExpanded(false)}
        onClose={() => {
          setPlayerExpanded(false);
          setPlayerPlaylist([]);
          setPlayerIndex(0);
          setPlayerEventTitle('');
          setIsPlaying(false);
        }}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        onTogglePlay={handleTogglePlaying}
        onSelectTrack={(index) => {
          setPlayerIndex(index);
          setIsPlaying(true);
        }}
        onPlayerStateChange={(playing) => setIsPlaying(playing)}
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
