'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import MembroHomeTab from '../../components/membro/MembroHomeTab';
import MembroSolicitacoesTab from '../../components/membro/MembroSolicitacoesTab';
import MembroEscalasTab from '../../components/membro/MembroEscalasTab';
import MembroRepertoriosTab from '../../components/membro/MembroRepertoriosTab';
import MembroPerfilTab from '../../components/membro/MembroPerfilTab';
import MembroBottomNav from '../../components/membro/MembroBottomNav';
import MembroPlayerModal from '../../components/membro/MembroPlayerModal';
import MiniPlayerBar from '../../components/membro/MiniPlayerBar';
import MembroEscalaModal from '../../components/membro/MembroEscalaModal';
import MembroRepertorioResumoModal from '../../components/membro/MembroRepertorioResumoModal';
import { buildMemberDashboardData } from '../../lib/membro/membro-invites';

function LoginScreen({ onGoogleLogin, loggingIn, error }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050814] px-5 py-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.35),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.14),_transparent_30%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,11,24,0.15)_0%,rgba(5,8,20,0.92)_65%)]" />

      <div className="relative z-10 w-full max-w-md rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(29,20,58,0.96),rgba(10,14,30,0.98))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)] md:p-7">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-violet-300/15 bg-black text-center shadow-[0_0_50px_rgba(139,92,246,0.25)]">
          <span className="font-serif text-[28px] italic tracking-[-0.02em] text-white">
            H
          </span>
        </div>

        <div className="mt-6 text-center">
          <div className="inline-flex rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-violet-200">
            Harmonics Member
          </div>

          <h1 className="mt-4 text-[34px] font-black tracking-[-0.05em]">
            Harmonics
          </h1>

          <p className="mt-2 text-[15px] leading-7 text-white/65">
            Entre com Google para acessar suas solicitações, sua agenda e seus repertórios.
          </p>
        </div>

        <button
          type="button"
          onClick={onGoogleLogin}
          disabled={loggingIn}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-[20px] bg-white px-5 py-4 text-[16px] font-black text-[#111827] shadow-[0_18px_35px_rgba(255,255,255,0.14)] disabled:opacity-60"
        >
          <span className="text-[20px]">G</span>
          {loggingIn ? 'Entrando...' : 'Continuar com Google'}
        </button>

        {error ? (
          <div className="mt-4 rounded-[18px] border border-red-300/15 bg-red-400/10 px-4 py-3 text-[14px] font-semibold text-red-100">
            {error}
          </div>
        ) : null}
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

  const [invites, setInvites] = useState([]);
  const [precontracts, setPrecontracts] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [activeTab, setActiveTab] = useState('home');
  const [loadingKey, setLoadingKey] = useState('');

  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerPlaylist, setPlayerPlaylist] = useState([]);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [playerEventTitle, setPlayerEventTitle] = useState('');
  const [currentTrack, setCurrentTrack] = useState(null);
const [playlist, setPlaylist] = useState([]);
const [isPlaying, setIsPlaying] = useState(false);

  const [scaleModalOpen, setScaleModalOpen] = useState(false);
  const [scaleModalEvent, setScaleModalEvent] = useState(null);
  const [scaleModalMusicians, setScaleModalMusicians] = useState([]);

  const [repertorioResumoOpen, setRepertorioResumoOpen] = useState(false);
  const [repertorioResumoItem, setRepertorioResumoItem] = useState(null);
  const [repertoireConfigs, setRepertoireConfigs] = useState([]);
const [repertoireItems, setRepertoireItems] = useState([]);
  

  const [debugAuth, setDebugAuth] = useState({
    sessionEmail: '',
    contactFound: false,
    contactActive: null,
    contactName: '',
    step: 'idle',
    rawError: '',
  });

  async function resolveMemberFromSession() {
    try {
      setError('');
      setDebugAuth({
        sessionEmail: '',
        contactFound: false,
        contactActive: null,
        contactName: '',
        step: 'getting-session',
        rawError: '',
      });

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
        setDebugAuth({
          sessionEmail: '',
          contactFound: false,
          contactActive: null,
          contactName: '',
          step: 'no-session-email',
          rawError: '',
        });
        return;
      }

      setDebugAuth((prev) => ({
        ...prev,
        sessionEmail,
        step: 'querying-contact',
      }));

      console.log('EMAIL GOOGLE:', sessionEmail);

      const { data, error: memberError } = await supabase
        .from('contacts')
        .select('id, name, email, phone, tag, is_active')
        .eq('email', sessionEmail)
        .maybeSingle();

      if (memberError) {
        setMember(null);
        setDebugAuth({
          sessionEmail,
          contactFound: false,
          contactActive: null,
          contactName: '',
          step: 'contact-query-error',
          rawError: memberError.message || 'Erro na consulta',
        });
        setError('Não foi possível validar seu acesso.');
        return;
      }

      if (!data) {
        setMember(null);
        setDebugAuth({
          sessionEmail,
          contactFound: false,
          contactActive: null,
          contactName: '',
          step: 'contact-not-found',
          rawError: '',
        });
        setError('Este e-mail não está autorizado no painel do membro.');
        return;
      }

      if (data.is_active === false) {
        setMember(null);
        setDebugAuth({
          sessionEmail,
          contactFound: true,
          contactActive: false,
          contactName: data.name || '',
          step: 'contact-inactive',
          rawError: '',
        });
        setError('Seu acesso está inativo no momento.');
        return;
      }

      setMember(data);
      setDebugAuth({
        sessionEmail,
        contactFound: true,
        contactActive: true,
        contactName: data.name || '',
        step: 'success',
        rawError: '',
      });
    } catch (e) {
      console.error('Erro ao resolver membro:', e);
      setMember(null);
      setError('Não foi possível validar seu acesso.');
      setDebugAuth((prev) => ({
        ...prev,
        step: 'unexpected-error',
        rawError: e?.message || 'Erro inesperado',
      }));
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
      setPlayerOpen(false);
      setScaleModalOpen(false);
      setScaleModalEvent(null);
      setScaleModalMusicians([]);
      setRepertorioResumoOpen(false);
      setRepertorioResumoItem(null);
      setActiveTab('home');
      setRepertoireConfigs([]);
setRepertoireItems([]);
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
    .filter((row) => !!row?.referencia)
    .sort((a, b) => Number(a?.ordem || 0) - Number(b?.ordem || 0))
    .map((row, index) => ({
      title: row?.musica || `Faixa ${index + 1}`,
      subtitle:
        row?.quemEntra ||
        row?.momento ||
        row?.label ||
        row?.section ||
        '',
      notes: row?.observacao || '',
      url: row?.referencia,
      order: row?.ordem || index + 1,
    }));
}

  function openRepertoire(item, options = {}) {
    if (!item) return;

    const playlist = buildPlaylistFromRow(item);

    setPlayerPlaylist(playlist);
    setPlayerIndex(0);
    setPlayerEventTitle(item?.clientName || 'Repertório');

    if (playlist.length > 0 || options.autoplay) {
      setPlayerOpen(true);
      return;
    }

    if (item?.contractInfo?.publicToken && typeof window !== 'undefined') {
      window.open(`/cliente/${item.contractInfo.publicToken}`, '_blank', 'noopener,noreferrer');
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

  function handleNextTrack() {
    setPlayerIndex((prev) => {
      if (playerPlaylist.length === 0) return 0;
      return (prev + 1) % playerPlaylist.length;
    });
  }

  function handlePrevTrack() {
    setPlayerIndex((prev) => {
      if (playerPlaylist.length === 0) return 0;
      return (prev - 1 + playerPlaylist.length) % playerPlaylist.length;
    });
  }
  const currentTrack = playerPlaylist[playerIndex] || null;

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

        <div className="fixed bottom-4 left-4 right-4 z-[200] mx-auto max-w-2xl rounded-[18px] border border-yellow-300/20 bg-black/80 p-4 text-[12px] text-yellow-100 backdrop-blur">
          <div><strong>step:</strong> {debugAuth.step}</div>
          <div><strong>sessionEmail:</strong> {debugAuth.sessionEmail || '-'}</div>
          <div><strong>contactFound:</strong> {String(debugAuth.contactFound)}</div>
          <div><strong>contactActive:</strong> {String(debugAuth.contactActive)}</div>
          <div><strong>contactName:</strong> {debugAuth.contactName || '-'}</div>
          <div><strong>rawError:</strong> {debugAuth.rawError || '-'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050814] text-white">
     <div className="mx-auto max-w-6xl px-4 pt-4 pb-[220px] md:px-6 md:pt-6 md:pb-36">
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
    onMarkDone={handleMarkDone}
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

      <MembroBottomNav
        active={activeTab}
        onChange={setActiveTab}
        pendingCount={resumo?.pendentes || 0}
      />

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

      <MembroPlayerModal
        open={playerOpen}
        eventTitle={playerEventTitle}
        playlist={playerPlaylist}
        currentIndex={playerIndex}
        onClose={() => setPlayerOpen(false)}
        onSelectTrack={setPlayerIndex}
        onPrev={handlePrevTrack}
        onNext={handleNextTrack}
      />

      <MiniPlayerBar
        currentTrack={currentTrack}
        eventTitle={playerEventTitle}
        onOpen={() => setPlayerOpen(true)}
        onClose={() => {
          setPlayerOpen(false);
          setPlayerPlaylist([]);
          setPlayerIndex(0);
          setPlayerEventTitle('');
        }}
        onNext={handleNextTrack}
      />
    </div>
  );
}
