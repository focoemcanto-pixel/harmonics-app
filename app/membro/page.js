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

  const [scaleModalOpen, setScaleModalOpen] = useState(false);
  const [scaleModalEvent, setScaleModalEvent] = useState(null);
  const [scaleModalMusicians, setScaleModalMusicians] = useState([]);

  const [repertorioResumoOpen, setRepertorioResumoOpen] = useState(false);
  const [repertorioResumoItem, setRepertorioResumoItem] = useState(null);
    const authBootstrappedRef = useRef(false);

  async function resolveMemberFromSession() {
    try {
      setError('');

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.email) {
        setMember(null);
        return;
      }

      const email = String(session.user.email).trim().toLowerCase();

      const { data, error: memberError } = await supabase
        .from('contacts')
        .select('id, name, email, phone, tag, is_active')
        .eq('email', email)
        .single();

      if (memberError || !data) {
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

      const [invitesResp, precontractsResp, contractsResp] = await Promise.all([
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
      ]);

      if (invitesResp.error) throw invitesResp.error;
      if (precontractsResp.error) throw precontractsResp.error;
      if (contractsResp.error) throw contractsResp.error;

      setInvites(invitesResp.data || []);
      setPrecontracts(precontractsResp.data || []);
      setContracts(contractsResp.data || []);
    } catch (e) {
      console.error('Erro ao carregar painel do membro:', e);
      setError(e?.message || 'Não foi possível carregar seu painel.');
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
        } = await supabase.auth.getSession();

        if (mounted && session?.user?.email) {
          await resolveMemberFromSession();
        } else if (mounted) {
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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!authBootstrappedRef.current) return;

      if (session?.user?.email) {
        await resolveMemberFromSession();
        return;
      }

      if (!session) {
        if (mounted) {
          setMember(null);
          setSessionChecked(true);
          setLoggingIn(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
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
    });
  }, [invites, contracts, precontracts]);

  const confirmados = Array.isArray(dashboard?.confirmados) ? dashboard.confirmados : [];
  const pendentes = Array.isArray(dashboard?.pendentes) ? dashboard.pendentes : [];
  const resumo = dashboard?.resumo || { pendentes: 0, confirmados: 0, repertorios: 0 };

  const repertorios = useMemo(() => {
    return confirmados.filter(
      (row) => row?.contractInfo?.pdfUrl || (Array.isArray(row?.youtubeUrls) && row.youtubeUrls.length > 0)
    );
  }, [confirmados]);

  const proximasEscalas = useMemo(() => {
    return [...confirmados]
      .sort((a, b) => {
        const aDate = new Date(`${a?.eventDate || ''}T${a?.eventTime || '00:00:00'}`).getTime();
        const bDate = new Date(`${b?.eventDate || ''}T${b?.eventTime || '00:00:00'}`).getTime();
        return aDate - bDate;
      })
      .slice(0, 2);
  }, [confirmados]);

  async function handleGoogleLogin() {
    try {
      setLoggingIn(true);
      setError('');

      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/membro`
          : undefined;

            const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;
    } catch (e) {
      console.error('Erro no login Google:', e);
      setError(e?.message || 'Falha ao entrar com Google.');
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      setMember(null);
      setInvites([]);
      setPrecontracts([]);
      setContracts([]);
      setPlayerPlaylist([]);
      setPlayerIndex(0);
      setPlayerEventTitle('');
      setPlayerOpen(false);
      setActiveTab('home');
    } catch (e) {
      console.error('Erro ao sair:', e);
    }
  }

  async function updateInviteStatus(item, nextStatus) {
    const key = `${item.id}:${nextStatus === 'confirmed' ? 'accept' : 'decline'}`;

    try {
      setLoadingKey(key);

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
        .eq('musician_id', member.id);

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
    return (item?.youtubeUrls || []).map((url, index) => ({
      title: `${item.clientName} • Faixa ${index + 1}`,
      url,
    }));
  }

  function openRepertoire(item, options = {}) {
    const playlist = buildPlaylistFromRow(item);

    setPlayerPlaylist(playlist);
    setPlayerIndex(0);
    setPlayerEventTitle(item?.clientName || 'Repertório');

    if (playlist.length > 0 || options.autoplay) {
      setPlayerOpen(true);
    }

    if (playlist.length === 0 && item?.contractInfo?.publicToken) {
      window.open(`/cliente/${item.contractInfo.publicToken}`, '_blank', 'noopener,noreferrer');
    }
  }

  function openPdf(item) {
    if (item?.contractInfo?.pdfUrl) {
      window.open(item.contractInfo.pdfUrl, '_blank', 'noopener,noreferrer');
    }
  }

  function openMaps(item) {
    if (!item?.locationName) return;
    const query = encodeURIComponent(item.locationName);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
  }

  async function handleOpenScale(item) {
    try {
      const { data, error } = await supabase
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

      if (error) throw error;

      const musicians = (data || []).map((row) => {
        const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;

        return {
          id: row.id,
          musician_id: row.musician_id,
          role: row.role || contact?.tag || '',
          status: row.status || 'pending',
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
    setRepertorioResumoItem(item);
    setRepertorioResumoOpen(true);
  }

  async function handleMarkDone(item) {
    try {
      const nextDone = !item?.isDone;
      const nextStatus = nextDone ? 'done' : 'confirmed';

      const { error } = await supabase
        .from('events')
        .update({ status: nextStatus })
        .eq('id', item.eventId);

      if (error) throw error;

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
      <LoginScreen
        onGoogleLogin={handleGoogleLogin}
        loggingIn={loggingIn}
        error={error}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <div className="mx-auto max-w-6xl px-4 py-4 pb-28 md:px-6 md:py-6 md:pb-32">
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
              member={member}
              resumo={resumo}
              nextPending={pendentes[0] || null}
              nextConfirmed={proximasEscalas[0] || null}
              onGoToPendentes={() => setActiveTab('pendentes')}
              onGoToEscalas={() => setActiveTab('escalas')}
              onGoToRepertorios={() => setActiveTab('repertorios')}
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
              confirmados={confirmados}
              onOpenRepertoire={handleOpenRepertoireSummary}
              onOpenPdf={openPdf}
              onOpenMaps={openMaps}
              onOpenScale={handleOpenScale}
              onMarkDone={handleMarkDone}
            />
          ) : null}

          {!loadingData && activeTab === 'repertorios' ? (
            <MembroRepertoriosTab
              repertorios={repertorios}
              onOpenRepertoire={openRepertoire}
              onOpenPdf={openPdf}
            />
          ) : null}

          {!loadingData && activeTab === 'perfil' ? (
            <MembroPerfilTab member={member} onLogout={handleLogout} />
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
