'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import MembroHeader from '../../components/membro/MembroHeader';
import MembroResumoCards from '../../components/membro/MembroResumoCards';
import MembroSolicitacoesTab from '../../components/membro/MembroSolicitacoesTab';
import MembroEscalasTab from '../../components/membro/MembroEscalasTab';
import MembroRepertoriosTab from '../../components/membro/MembroRepertoriosTab';
import MembroPlayerModal from '../../components/membro/MembroPlayerModal';
import MiniPlayerBar from '../../components/membro/MiniPlayerBar';
import { buildMemberDashboardData } from '../../lib/membro/membro-invites';

function LoginScreen({ onGoogleLogin, loggingIn, error }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#060914] px-5 py-8">
      <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.22),_rgba(15,23,42,0.96)_55%)] p-6 text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-violet-200">
          Harmonics Member
        </div>

        <h1 className="mt-4 text-[34px] font-black tracking-[-0.05em]">
          Seu painel de ensaio
        </h1>

        <p className="mt-3 text-[15px] leading-7 text-white/70">
          Entre com Google para acessar suas solicitações, suas escalas e seus repertórios.
        </p>

        <button
          type="button"
          onClick={onGoogleLogin}
          disabled={loggingIn}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-[20px] bg-white px-5 py-4 text-[15px] font-black text-[#111827] shadow-[0_14px_30px_rgba(255,255,255,0.14)] disabled:opacity-60"
        >
          {loggingIn ? 'Entrando...' : 'Entrar com Google'}
        </button>

        {error ? (
          <div className="mt-4 rounded-[18px] border border-red-300/20 bg-red-400/10 px-4 py-3 text-[14px] font-semibold text-red-100">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionTabs({ active, onChange }) {
  const items = [
    { key: 'pendentes', label: 'Pendentes' },
    { key: 'escalas', label: 'Minhas escalas' },
    { key: 'repertorios', label: 'Repertórios' },
  ];

  return (
    <>
      <div className="hidden md:block">
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-2 shadow-[0_10px_26px_rgba(17,24,39,0.12)]">
          <div className="flex flex-wrap gap-2">
            {items.map((item) => {
              const isActive = active === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onChange(item.key)}
                  className={`rounded-[18px] px-4 py-3 text-[14px] font-black transition ${
                    isActive
                      ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-[0_12px_28px_rgba(124,58,237,0.22)]'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-white/10 bg-white/5 p-2 shadow-[0_10px_26px_rgba(17,24,39,0.12)]">
          {items.map((item) => {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onChange(item.key)}
                className={`rounded-[16px] px-3 py-3 text-[12px] font-black transition ${
                  isActive
                    ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white'
                    : 'bg-transparent text-white/70'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
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

  const [activeTab, setActiveTab] = useState('pendentes');
  const [loadingKey, setLoadingKey] = useState('');

  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerPlaylist, setPlayerPlaylist] = useState([]);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [playerEventTitle, setPlayerEventTitle] = useState('');

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
            events (
              id,
              client_name,
              event_date,
              event_time,
              location_name,
              formation,
              instruments,
              observations
            )
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
    resolveMemberFromSession();
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

  const repertorios = useMemo(() => {
    return dashboard.confirmados.filter(
      (row) => row.contractInfo?.pdfUrl || row.youtubeUrls.length > 0
    );
  }, [dashboard.confirmados]);

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
    const tracks = (item.youtubeUrls || []).map((url, index) => ({
      title: `${item.clientName} • Faixa ${index + 1}`,
      url,
    }));

    return tracks;
  }

  function openRepertoire(item, options = {}) {
    const playlist = buildPlaylistFromRow(item);

    setPlayerPlaylist(playlist);
    setPlayerIndex(0);
    setPlayerEventTitle(item.clientName || 'Repertório');

    if (playlist.length > 0 || options.autoplay) {
      setPlayerOpen(true);
    }

    if (playlist.length === 0 && item.contractInfo?.publicToken) {
      window.open(`/cliente/${item.contractInfo.publicToken}`, '_blank', 'noopener,noreferrer');
    }
  }

  function openPdf(item) {
    if (item.contractInfo?.pdfUrl) {
      window.open(item.contractInfo.pdfUrl, '_blank', 'noopener,noreferrer');
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
      <div className="flex min-h-screen items-center justify-center bg-[#060914] text-white">
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
    <div className="min-h-screen bg-[#060914] px-4 py-5 text-white md:px-6 md:py-6">
      <div className="mx-auto max-w-6xl space-y-5 md:space-y-6">
        <MembroHeader member={member} onLogout={handleLogout} />

        <MembroResumoCards resumo={dashboard.resumo} />

        <SectionTabs active={activeTab} onChange={setActiveTab} />

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

        {!loadingData && activeTab === 'pendentes' ? (
          <MembroSolicitacoesTab
            pendentes={dashboard.pendentes}
            onAccept={(item) => updateInviteStatus(item, 'confirmed')}
            onDecline={(item) => updateInviteStatus(item, 'declined')}
            loadingKey={loadingKey}
          />
        ) : null}

        {!loadingData && activeTab === 'escalas' ? (
          <MembroEscalasTab
            confirmados={dashboard.confirmados}
            onOpenRepertoire={openRepertoire}
            onOpenPdf={openPdf}
          />
        ) : null}

        {!loadingData && activeTab === 'repertorios' ? (
          <MembroRepertoriosTab
            repertorios={repertorios}
            onOpenRepertoire={openRepertoire}
            onOpenPdf={openPdf}
          />
        ) : null}
      </div>

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
