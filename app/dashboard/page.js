'use client';

import { useEffect, useState } from 'react';
import AdminShell from '../../components/admin/AdminShell';
import DashboardHero from '../../components/dashboard/DashboardHero';
import DashboardPrimaryKpis from '../../components/dashboard/DashboardPrimaryKpis';
import DashboardSecondaryKpis from '../../components/dashboard/DashboardSecondaryKpis';
import DashboardRevenueChart from '../../components/dashboard/DashboardRevenueChart';
import DashboardFinanceBreakdown from '../../components/dashboard/DashboardFinanceBreakdown';
import DashboardOperationsRadar from '../../components/dashboard/DashboardOperationsRadar';
import DashboardUpcomingEvents from '../../components/dashboard/DashboardUpcomingEvents';
import DashboardQuickActions from '../../components/dashboard/DashboardQuickActions';
import { supabase } from '../../lib/supabase';
import { buildDashboardSummary } from '../../lib/dashboard/dashboard-summary';

function DashboardLoading() {
  return (
    <div className="space-y-5">
      <div className="h-[220px] animate-pulse rounded-[32px] border border-[#dbe3ef] bg-white" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[148px] animate-pulse rounded-[28px] border border-[#dbe3ef] bg-white"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="h-[420px] animate-pulse rounded-[30px] border border-[#dbe3ef] bg-white" />
        <div className="h-[420px] animate-pulse rounded-[30px] border border-[#dbe3ef] bg-white" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.2fr]">
        <div className="h-[360px] animate-pulse rounded-[28px] border border-[#dbe3ef] bg-white" />
        <div className="h-[420px] animate-pulse rounded-[28px] border border-[#dbe3ef] bg-white" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [events, setEvents] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [precontracts, setPrecontracts] = useState([]);
  const [eventMusicians, setEventMusicians] = useState([]);
  const [repertoireConfigs, setRepertoireConfigs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregarDashboard() {
      try {
        setCarregando(true);
        setErro('');

        const [
          eventsRes,
          contractsRes,
          precontractsRes,
          eventMusiciansRes,
          repertoireConfigsRes,
        ] = await Promise.all([
          supabase.from('events').select('*'),
          supabase.from('contracts').select('*'),
          supabase.from('precontracts').select('*'),
          supabase.from('event_musicians').select('*'),
          supabase.from('repertoire_config').select('*'),
        ]);

        if (eventsRes.error) throw eventsRes.error;
        if (contractsRes.error) throw contractsRes.error;
        if (precontractsRes.error) throw precontractsRes.error;
        if (eventMusiciansRes.error) throw eventMusiciansRes.error;
        if (repertoireConfigsRes.error) throw repertoireConfigsRes.error;

        const eventsData = Array.isArray(eventsRes.data) ? eventsRes.data : [];
        const contractsData = Array.isArray(contractsRes.data) ? contractsRes.data : [];
        const precontractsData = Array.isArray(precontractsRes.data) ? precontractsRes.data : [];
        const eventMusiciansData = Array.isArray(eventMusiciansRes.data) ? eventMusiciansRes.data : [];
        const repertoireConfigsData = Array.isArray(repertoireConfigsRes.data) ? repertoireConfigsRes.data : [];

        setEvents(eventsData);
        setContracts(contractsData);
        setPrecontracts(precontractsData);
        setEventMusicians(eventMusiciansData);
        setRepertoireConfigs(repertoireConfigsData);

        setSummary(
          buildDashboardSummary(
            eventsData,
            contractsData,
            precontractsData,
            eventMusiciansData,
            repertoireConfigsData
          )
        );
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        setErro(error?.message || 'Não foi possível carregar o dashboard.');
        setEvents([]);
        setContracts([]);
        setPrecontracts([]);
        setEventMusicians([]);
        setRepertoireConfigs([]);
        setSummary(buildDashboardSummary([], [], [], [], []));
      } finally {
        setCarregando(false);
      }
    }

    carregarDashboard();
  }, []);

  return (
    <AdminShell pageTitle="Dashboard" activeItem="dashboard">
      {carregando ? (
        <DashboardLoading />
      ) : (
        <div className="space-y-5">
          <DashboardHero />

          {erro ? (
            <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700">
              {erro}
            </div>
          ) : null}

          <DashboardPrimaryKpis summary={summary} />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
            <DashboardRevenueChart events={events} />
            <DashboardFinanceBreakdown events={events} summary={summary} />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.2fr]">
            <DashboardOperationsRadar summary={summary} />
            <DashboardUpcomingEvents
              events={events}
              contracts={contracts}
              precontracts={precontracts}
            />
          </div>

          <DashboardSecondaryKpis summary={summary} />

          <DashboardQuickActions />
        </div>
      )}
    </AdminShell>
  );
}
