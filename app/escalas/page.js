'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdminShell from '../../components/admin/AdminShell';
import AdminPageHero from '../../components/admin/AdminPageHero';
import AdminSegmentTabs from '../../components/admin/AdminSegmentTabs';

// Helpers
import { filterBySearch, filterByStatus } from '../../lib/escalas/escalas-filters';
import { getEscalasSummary } from '../../lib/escalas/escalas-summary';

// Components
import EscalasResumoTab from '../../components/escalas/EscalasResumoTab';
import EscalasListaTab from '../../components/escalas/EscalasListaTab';

export default function EscalasPage() {
  const [mobileTab, setMobileTab] = useState('resumo');
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [escalas, setEscalas] = useState([]);

  const mobileTabs = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'lista', label: 'Lista' },
  ];

  useEffect(() => {
    async function carregar() {
      try {
        setCarregando(true);
        setErro('');

        const { data, error } = await supabase
          .from('escalas')
          .select(`
            *,
            events (id, client_name, event_date),
            contacts (id, name, phone)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setEscalas(data || []);
      } catch (e) {
        console.error('Erro ao carregar escalas:', e);
        setErro('Não foi possível carregar as escalas.');
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, []);

  const escalasFiltradas = useMemo(() => {
    let resultado = escalas;
    resultado = filterBySearch(resultado, busca);
    resultado = filterByStatus(resultado, statusFiltro);
    return resultado;
  }, [escalas, busca, statusFiltro]);

  const resumo = useMemo(() => getEscalasSummary(escalas), [escalas]);

  if (carregando) {
    return (
      <AdminShell pageTitle="Escalas" activeItem="escalas">
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <p className="text-center text-[#64748b]">Carregando escalas...</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell pageTitle="Escalas" activeItem="escalas">
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Escalas"
          subtitle="Monte equipes, acompanhe confirmações e organize a operação musical."
        />

        {/* Desktop - always shows all sections */}
        <div className="hidden space-y-5 md:block">
          <EscalasResumoTab resumo={resumo} setMobileTab={setMobileTab} />
          <EscalasListaTab
            escalas={escalasFiltradas}
            busca={busca}
            setBusca={setBusca}
            statusFiltro={statusFiltro}
            setStatusFiltro={setStatusFiltro}
          />
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden">
          <AdminSegmentTabs
            items={mobileTabs}
            active={mobileTab}
            onChange={setMobileTab}
          />
        </div>

        <div className="space-y-5 md:hidden">
          {mobileTab === 'resumo' && (
            <EscalasResumoTab resumo={resumo} setMobileTab={setMobileTab} />
          )}
          {mobileTab === 'lista' && (
            <EscalasListaTab
              escalas={escalasFiltradas}
              busca={busca}
              setBusca={setBusca}
              statusFiltro={statusFiltro}
              setStatusFiltro={setStatusFiltro}
            />
          )}
        </div>
      </div>
    </AdminShell>
  );
}
