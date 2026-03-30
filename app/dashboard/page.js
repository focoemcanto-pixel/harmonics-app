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

export default function DashboardPage() {
  const [events, setEvents] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [precontracts, setPrecontracts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregarDashboard() {
      try {
        setCarregando(true);
        setErro('');

        const [eventsRes, contractsRes, precontractsRes] = await Promise.all([
          supabase.from('events').select('*'),
          supabase.from('contracts').select('*'),
          supabase.from('precontracts').select('*'),
        ]);

        if (eventsRes.error) throw eventsRes.error;
        if (contractsRes.error) throw contractsRes.error;
        if (precontractsRes.error) throw precontractsRes.error;

        const eventsData = Array.isArray(eventsRes.data) ? eventsRes.data : [];
        const contractsData = Array.isArray(contractsRes.data) ? contractsRes.data : [];
        const precontractsData = Array.isArray(precontractsRes.data)
          ? precontractsRes.data
          : [];

        setEvents(eventsData);
        setContracts(contractsData);
        setPrecontracts(precontractsData);

        const summaryData = buildDashboardSummary(
          eventsData,
          contractsData,
          precontractsData
        );

        setSummary(summaryData);
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        setErro(error?.message || 'Não foi possível carregar o dashboard.');
        setEvents([]);
        setContracts([]);
        setPrecontracts([]);
        setSummary(
          buildDashboardSummary([], [], [])
        );
      } finally {
        setCarregando(false);
      }
    }

    carregarDashboard();
  }, []);

  return (
    <AdminShell pageTitle="Dashboard" activeItem="dashboard">
      <div className="space-y-5">
        <DashboardHero />

        {erro ? (
          <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700">
            {erro}
          </div>
        ) : null}

        {carregando || !summary ? (
          <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
            <p className="text-[14px] font-semibold text-[#64748b]">
              Carregando indicadores do dashboard...
            </p>
          </section>
        ) : (
          <>
            <DashboardPrimaryKpis summary={summary} />

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
              <DashboardRevenueChart
                events={events}
                contracts={contracts}
                precontracts={precontracts}
                summary={summary}
              />
              <DashboardFinanceBreakdown
                events={events}
                contracts={contracts}
                precontracts={precontracts}
                summary={summary}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.2fr]">
              <DashboardOperationsRadar
                events={events}
                contracts={contracts}
                precontracts={precontracts}
                summary={summary}
              />
              <DashboardUpcomingEvents
                events={events}
                contracts={contracts}
                precontracts={precontracts}
                summary={summary}
              />
            </div>

            <DashboardSecondaryKpis summary={summary} />

            <DashboardQuickActions />
          </>
        )}
      </div>
    </AdminShell>
  );
}
