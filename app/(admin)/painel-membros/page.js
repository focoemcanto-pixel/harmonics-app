'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminShell from '@/components/layout/AdminShell';
import MemberAdminView from '@/components/membro/MemberAdminView';

export default function PainelMembrosPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [repertorios, setRepertorios] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Verificar se é admin (SEM AuthContext)
  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      // Buscar profile do usuário
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (error || profile?.role !== 'admin') {
        router.replace('/login');
        return;
      }

      setIsAdmin(true);
      loadAllData();
    } catch (error) {
      console.error('Erro ao verificar admin:', error);
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  // Buscar TODOS os dados (visão admin)
  async function loadAllData() {
    try {
      setLoadingData(true);

      // Buscar TODOS os convites com JOIN
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

      // Buscar TODAS as escalas com JOIN
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
      console.error('Erro ao carregar dados administrativos:', error);
      alert('Erro ao carregar dados. Verifique o console para detalhes.');
    } finally {
      setLoadingData(false);
    }
  }

  // Feedback visual durante verificação de permissões
  if (loading) {
    return (
      <AdminShell pageTitle="Painel de Membros" activeItem="painel-membros">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4" />
            <p className="text-slate-600 font-semibold">Verificando permissões...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  // Se não for admin, mostra feedback durante redirect
  if (!isAdmin) {
    return (
      <AdminShell pageTitle="Painel de Membros" activeItem="painel-membros">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-slate-600">Redirecionando...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  // Loading dos dados
  if (loadingData) {
    return (
      <AdminShell pageTitle="Painel de Membros" activeItem="painel-membros">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4" />
            <p className="text-slate-600 font-semibold">Carregando visão administrativa...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell pageTitle="Painel de Membros" activeItem="painel-membros">
      <MemberAdminView
        invites={invites}
        escalas={escalas}
        repertorios={repertorios}
        onRefresh={loadAllData}
      />
    </AdminShell>
  );
}
