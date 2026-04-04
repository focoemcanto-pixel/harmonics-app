'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function MembroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentMember, setCurrentMember] = useState(null);
  const [invites, setInvites] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [repertorios, setRepertorios] = useState([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('convites');

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    try {
      setLoading(true);
      setError('');

      // 1. Verificar sessão
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        // Sem sessão → redireciona para login do membro
        router.replace('/membro/login');
        return;
      }

      // 2. Verificar se é admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, id')
        .eq('id', session.user.id)
        .single();

      // Se encontrou profile e é admin
      if (!profileError && profile?.role === 'admin') {
        setCurrentMember({
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Admin',
          isAdmin: true,
          id: profile.id,
        });

        // Carregar visão administrativa (TODOS os dados)
        await loadAdminData();
        return;
      }

      // 3. Se não é admin, validar como membro normal
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('email', session.user.email)
        .single();

      if (contactError || !contact) {
        setError('Acesso negado. Você não está cadastrado como membro ativo.');
        setLoading(false);
        return;
      }

      if (contact.is_active === false) {
        setError('Sua conta está inativa. Entre em contato com o administrador.');
        setLoading(false);
        return;
      }

      setCurrentMember({
        email: contact.email,
        name: contact.name || contact.email,
        isAdmin: false,
        contact_id: contact.id,
      });

      // Carregar visão do membro (apenas seus dados)
      await loadMemberData(contact.id);

    } catch (error) {
      console.error('Erro ao verificar acesso:', error);
      setError('Erro ao verificar acesso. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // Carregar dados do ADMIN (TODOS os dados)
  async function loadAdminData() {
    try {
      // Buscar TODOS os convites
      const { data: invitesData, error: invitesError } = await supabase
        .from('invites')
        .select(`
          *,
          contacts (
            id,
            name,
            email
          ),
          events (
            id,
            client_name,
            event_date,
            event_time
          )
        `)
        .order('created_at', { ascending: false });

      if (invitesError) throw invitesError;

      // Buscar TODAS as escalas
      const { data: escalasData, error: escalasError } = await supabase
        .from('event_musicians')
        .select(`
          *,
          events (
            id,
            client_name,
            event_date,
            event_time,
            location_name,
            formation
          ),
          contacts (
            id,
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (escalasError) throw escalasError;

      // Buscar TODOS os repertórios
      const { data: repertoriosData, error: repertoriosError } = await supabase
        .from('repertoire_config')
        .select('*')
        .order('created_at', { ascending: false });

      if (repertoriosError) throw repertoriosError;

      setInvites(invitesData || []);
      setEscalas(escalasData || []);
      setRepertorios(repertoriosData || []);

    } catch (error) {
      console.error('Erro ao carregar dados admin:', error);
      setError('Erro ao carregar dados administrativos.');
    }
  }

  // Carregar dados do MEMBRO (apenas seus dados)
  async function loadMemberData(contactId) {
    try {
      // Buscar convites do membro
      const { data: invitesData, error: invitesError } = await supabase
        .from('invites')
        .select(`
          *,
          events (
            id,
            client_name,
            event_date,
            event_time
          )
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (invitesError) throw invitesError;

      // Buscar escalas do membro
      const { data: escalasData, error: escalasError } = await supabase
        .from('event_musicians')
        .select(`
          *,
          events (
            id,
            client_name,
            event_date,
            event_time,
            location_name,
            formation
          )
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (escalasError) throw escalasError;

      setInvites(invitesData || []);
      setEscalas(escalasData || []);
      setRepertorios([]); // Members do not have access to repertoires

    } catch (error) {
      console.error('Erro ao carregar dados do membro:', error);
      setError('Erro ao carregar seus dados.');
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/membro/login');
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4" />
          <p className="text-slate-600 font-semibold">Carregando painel...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-purple-50 p-4">
        <div className="max-w-md w-full">
          <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="text-[20px] font-black text-red-900 mb-2">
              Acesso Negado
            </h2>
            <p className="text-[14px] text-red-700 mb-4">
              {error}
            </p>
            <button
              onClick={() => router.push('/membro/login')}
              className="rounded-[16px] bg-red-600 px-4 py-3 text-[14px] font-black text-white hover:bg-red-700 transition"
            >
              Voltar para Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Sem currentMember
  if (!currentMember) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header com Badge Admin (se aplicável) */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              {currentMember.isAdmin && (
                <div className="inline-flex rounded-full border border-violet-300 bg-violet-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-violet-700 mb-3">
                  Visão Administrativa
                </div>
              )}
              <h1 className="text-[28px] md:text-[32px] font-black tracking-[-0.04em] text-slate-900">
                {currentMember.isAdmin ? 'Painel de Membros' : 'Meu Painel'}
              </h1>
              <p className="mt-2 text-[14px] md:text-[15px] text-slate-600">
                Bem-vindo, <span className="font-semibold">{currentMember.name}</span>
              </p>
            </div>

            <button
              onClick={handleSignOut}
              className="rounded-[16px] border border-slate-200 px-4 py-3 text-[13px] font-black text-slate-900 hover:bg-slate-50 transition"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('convites')}
              className={`flex-1 min-w-[120px] rounded-[18px] px-4 py-3 text-[13px] md:text-[14px] font-black transition ${
                activeTab === 'convites'
                  ? 'bg-violet-600 text-white shadow-lg'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Convites ({invites.length})
            </button>
            <button
              onClick={() => setActiveTab('escalas')}
              className={`flex-1 min-w-[120px] rounded-[18px] px-4 py-3 text-[13px] md:text-[14px] font-black transition ${
                activeTab === 'escalas'
                  ? 'bg-violet-600 text-white shadow-lg'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Escalas ({escalas.length})
            </button>
            {currentMember.isAdmin && (
              <button
                onClick={() => setActiveTab('repertorios')}
                className={`flex-1 min-w-[120px] rounded-[18px] px-4 py-3 text-[13px] md:text-[14px] font-black transition ${
                  activeTab === 'repertorios'
                    ? 'bg-violet-600 text-white shadow-lg'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Repertórios ({repertorios.length})
              </button>
            )}
          </div>
        </div>

        {/* Conteúdo das Tabs */}
        {activeTab === 'convites' && (
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-[18px] md:text-[20px] font-black text-slate-900 mb-4">
              {currentMember.isAdmin ? 'Todos os Convites' : 'Meus Convites'}
            </h2>

            {invites.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-[14px]">
                Nenhum convite encontrado.
              </div>
            ) : (
              <div className="space-y-3">
                {invites.map((invite) => {
                  const contactName = currentMember.isAdmin
                    ? invite.contacts?.name || 'Nome não informado'
                    : currentMember.name;
                  const eventName = invite.events?.client_name || 'Evento não identificado';
                  const eventDate = invite.events?.event_date
                    ? new Date(invite.events.event_date).toLocaleDateString('pt-BR')
                    : '-';

                  return (
                    <div
                      key={invite.id}
                      className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 hover:bg-white hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-[15px] md:text-[16px] font-black text-slate-900">
                              {currentMember.isAdmin && `${contactName} - `}{eventName}
                            </h3>
                            <span
                              className={`rounded-full px-3 py-1 text-[10px] md:text-[11px] font-black uppercase tracking-[0.08em] ${
                                invite.status === 'accepted'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : invite.status === 'pending'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {invite.status === 'accepted'
                                ? 'Aceito'
                                : invite.status === 'pending'
                                ? 'Pendente'
                                : invite.status || 'Desconhecido'}
                            </span>
                          </div>

                          <p className="mt-2 text-[12px] md:text-[13px] text-slate-500">
                            Data do evento: {eventDate}
                          </p>

                          {invite.created_at && (
                            <p className="mt-1 text-[11px] md:text-[12px] text-slate-400">
                              Criado em: {new Date(invite.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'escalas' && (
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-[18px] md:text-[20px] font-black text-slate-900 mb-4">
              {currentMember.isAdmin ? 'Todas as Escalas' : 'Minhas Escalas'}
            </h2>

            {escalas.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-[14px]">
                Nenhuma escala encontrada.
              </div>
            ) : (
              <div className="space-y-3">
                {escalas.map((escala) => {
                  const contactName = currentMember.isAdmin
                    ? escala.contacts?.name || 'Músico não identificado'
                    : currentMember.name;
                  const eventName = escala.events?.client_name || 'Evento não identificado';
                  const eventDate = escala.events?.event_date
                    ? new Date(escala.events.event_date).toLocaleDateString('pt-BR')
                    : '-';
                  const eventTime = escala.events?.event_time?.slice(0, 5) || '-';

                  return (
                    <div
                      key={escala.id}
                      className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 hover:bg-white hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[15px] md:text-[16px] font-black text-slate-900">
                            {currentMember.isAdmin && `${contactName} - `}{eventName}
                          </h3>

                          <p className="mt-2 text-[13px] md:text-[14px] text-slate-600">
                            Instrumento: {escala.instrument || '-'}
                          </p>

                          <p className="mt-1 text-[12px] md:text-[13px] text-slate-500">
                            Data: {eventDate} às {eventTime}
                          </p>

                          {escala.events?.location_name && (
                            <p className="mt-1 text-[12px] md:text-[13px] text-slate-500">
                              Local: {escala.events.location_name}
                            </p>
                          )}
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-[10px] md:text-[11px] font-black uppercase tracking-[0.08em] flex-shrink-0 ${
                            escala.status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : escala.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {escala.status === 'confirmed'
                            ? 'Confirmada'
                            : escala.status === 'pending'
                            ? 'Pendente'
                            : escala.status || 'Indefinido'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'repertorios' && currentMember.isAdmin && (
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-[18px] md:text-[20px] font-black text-slate-900 mb-4">
              Todos os Repertórios
            </h2>

            {repertorios.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-[14px]">
                Nenhum repertório encontrado.
              </div>
            ) : (
              <div className="space-y-3">
                {repertorios.map((repertorio) => (
                  <div
                    key={repertorio.id}
                    className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 hover:bg-white hover:shadow-md transition"
                  >
                    <h3 className="text-[15px] md:text-[16px] font-black text-slate-900">
                      {repertorio.name || 'Repertório sem nome'}
                    </h3>

                    {repertorio.description && (
                      <p className="mt-2 text-[13px] md:text-[14px] text-slate-600">
                        {repertorio.description}
                      </p>
                    )}

                    <p className="mt-2 text-[11px] md:text-[12px] text-slate-400">
                      Criado em: {new Date(repertorio.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
