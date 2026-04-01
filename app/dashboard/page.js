'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminShell from '../../components/layout/AdminShell';
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

function MobileSectionTabs({ active, onChange }) {
  const items = [
    { key: 'overview', label: 'Visão geral' },
    { key: 'finance', label: 'Financeiro' },
    { key: 'ops', label: 'Operação' },
    { key: 'agenda', label: 'Agenda' },
  ];

  return (
    <div className="overflow-x-auto pb-1 xl:hidden">
      <div className="flex min-w-max gap-2 rounded-[20px] border border-[#e5e7eb] bg-white p-1 shadow-[0_8px_24px_rgba(17,24,39,0.04)]">
        {items.map((item) => {
          const isActive = active === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`whitespace-nowrap rounded-[16px] px-4 py-3 text-[13px] font-black transition ${
                isActive
                  ? 'bg-violet-600 text-white shadow-[0_10px_24px_rgba(124,58,237,0.18)]'
                  : 'text-[#475569]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileCarousel({ children }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 xl:hidden">
      <div className="flex snap-x snap-mandatory gap-4 pb-2">
        {children}
      </div>
    </div>
  );
}

function MobileSlide({ children, wide = false }) {
  return (
    <div
      className={`snap-start shrink-0 ${
        wide ? 'w-[92%]' : 'w-[88%]'
      }`}
    >
      {children}
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
  const [mobileSection, setMobileSection] = useState('overview');

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

  const mobileOverview = useMemo(() => {
    return (
      <div className="space-y-4 xl:hidden">
        <MobileCarousel>
          <MobileSlide wide>
            <DashboardPrimaryKpis summary={summary} />
          </MobileSlide>
          <MobileSlide wide>
            <DashboardSecondaryKpis summary={summary} />
          </MobileSlide>
        </MobileCarousel>

        <MobileCarousel>
          <MobileSlide wide>
            <DashboardUpcomingEvents
              events={events}
              contracts={contracts}
              precontracts={precontracts}
            />
          </MobileSlide>
        </MobileCarousel>
      </div>
    );
  }, [summary, events, contracts, precontracts]);

  const mobileFinance = useMemo(() => {
    return (
      <div className="space-y-4 xl:hidden">
        <MobileCarousel>
          <MobileSlide wide>
            <DashboardRevenueChart events={events} />
          </MobileSlide>
          <MobileSlide wide>
            <DashboardFinanceBreakdown events={events} summary={summary} />
          </MobileSlide>
        </MobileCarousel>
      </div>
    );
  }, [events, summary]);

  const mobileOps = useMemo(() => {
    return (
      <div className="space-y-4 xl:hidden">
        <MobileCarousel>
          <MobileSlide wide>
            <DashboardOperationsRadar summary={summary} />
          </MobileSlide>
          <MobileSlide wide>
            <DashboardQuickActions />
          </MobileSlide>
        </MobileCarousel>
      </div>
    );
  }, [summary]);

  const mobileAgenda = useMemo(() => {
    return (
      <div className="space-y-4 xl:hidden">
        <MobileCarousel>
          <MobileSlide wide>
            <DashboardUpcomingEvents
              events={events}
              contracts={contracts}
              precontracts={precontracts}
            />
          </MobileSlide>
          <MobileSlide wide>
            <DashboardSecondaryKpis summary={summary} />
          </MobileSlide>
        </MobileCarousel>
      </div>
    );
  }, [events, contracts, precontracts, summary]);

  return (
    <AdminShell
      pageTitle="Dashboard"
      activeItem="dashboard"
      mobileSubtitle="Visão executiva compacta"
    >
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

          <MobileSectionTabs
            active={mobileSection}
            onChange={setMobileSection}
          />

          {mobileSection === 'overview' ? mobileOverview : null}
          {mobileSection === 'finance' ? mobileFinance : null}
          {mobileSection === 'ops' ? mobileOps : null}
          {mobileSection === 'agenda' ? mobileAgenda : null}

          <div className="hidden xl:block">
            <div className="space-y-5">
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
          </div>
        </div>
      )}
    </AdminShell>
  );
}
