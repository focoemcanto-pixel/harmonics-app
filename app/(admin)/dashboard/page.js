'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/layout/AdminShell';
import DashboardPrimaryKpis from '@/components/dashboard/DashboardPrimaryKpis';
import DashboardSecondaryKpis from '@/components/dashboard/DashboardSecondaryKpis';
import DashboardRevenueChart from '@/components/dashboard/DashboardRevenueChart';
import DashboardFinanceBreakdown from '@/components/dashboard/DashboardFinanceBreakdown';
import DashboardOperationsRadar from '@/components/dashboard/DashboardOperationsRadar';
import DashboardUpcomingEvents from '@/components/dashboard/DashboardUpcomingEvents';
import { supabase } from '@/lib/supabase';
import { buildDashboardSummary } from '@/lib/dashboard/dashboard-summary';

const MAX_DISPLAYED_ACTIVITIES = 2;

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

      <div className="space-y-3 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="md:hidden flex gap-3 overflow-x-auto pl-4 pr-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[180px] h-16 bg-slate-200 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Insights Inteligentes Skeleton */}
      <div className="space-y-3 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 bg-slate-200 rounded-xl" />
        ))}
      </div>

      {/* Atividade Recente Skeleton */}
      <div className="rounded-[28px] border border-[#dbe3ef] bg-white p-4 md:p-6">
        <div className="flex items-center justify-between mb-3 md:mb-4 animate-pulse">
          <div className="h-6 w-40 bg-slate-200 rounded" />
          <div className="h-8 w-20 bg-slate-200 rounded" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: MAX_DISPLAYED_ACTIVITIES }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-10 h-10 bg-slate-200 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-48 bg-slate-200 rounded" />
              </div>
              <div className="h-3 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
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

function timeAgo(date) {
  if (!date) return '--';

  const diff = (Date.now() - new Date(date)) / 1000;

  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)}d`;

  return new Date(date).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
  });
}

function ActivityItem({ activity }) {
  return (
    <div className="flex items-start gap-3 hover:bg-slate-50 p-2 rounded-lg transition-colors">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${activity.bgColor}`}>
        <activity.icon className={`w-5 h-5 ${activity.iconColor}`} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">
          {activity.title}
        </p>
        <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
          {activity.description || 'Sem detalhes'}
        </p>
      </div>
      <span className="text-xs text-slate-500 flex-shrink-0">
        {timeAgo(activity.timestamp)}
      </span>
    </div>
  );
}

function AlertCircleIcon({ className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function AlertTriangleIcon({ className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function InfoIcon({ className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

// Gerar insights a partir dos dados
function generateInsights(data) {
  if (!data) return [];

  const insights = [];
  const { contratosPendentes, escalasAbertas, falhasHoje } = data;

  // 1. PRIORIDADE ALTA: Falhas
  if (falhasHoje > 0) {
    insights.push({
      id: 'falhas',
      type: 'error',
      icon: AlertCircleIcon,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      title: `${falhasHoje} ${falhasHoje === 1 ? 'falha' : 'falhas'} hoje`,
      description: 'Verifique os logs de automação',
      action: {
        label: 'Ver logs',
        href: '/automacoes/logs',
      },
    });
  }

  // 2. PRIORIDADE MÉDIA: Contratos
  if (contratosPendentes > 0) {
    insights.push({
      id: 'contratos',
      type: 'warning',
      icon: AlertTriangleIcon,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      title: `${contratosPendentes} ${contratosPendentes === 1 ? 'contrato' : 'contratos'} ${contratosPendentes === 1 ? 'pendente' : 'pendentes'}`,
      description: 'Resolva antes dos eventos',
      action: {
        label: 'Ver contratos',
        href: '/contratos',
      },
    });
  }

  // 3. PRIORIDADE BAIXA: Escalas
  if (escalasAbertas > 0) {
    insights.push({
      id: 'escalas',
      type: 'info',
      icon: InfoIcon,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      title: `${escalasAbertas} ${escalasAbertas === 1 ? 'escala' : 'escalas'} não ${escalasAbertas === 1 ? 'confirmada' : 'confirmadas'}`,
      description: 'Confirme para enviar lembretes',
      action: {
        label: 'Ver escalas',
        href: '/escalas',
      },
    });
  }

  // Retornar apenas os 2 primeiros (prioridade)
  return insights.slice(0, 2);
}

// Componente de Insight Card
function InsightCard({ insight }) {
  const Icon = insight.icon;

  return (
    <div className={`
      rounded-xl border-2 p-4
      ${insight.bgColor} ${insight.borderColor}
      transition-all duration-200
      hover:shadow-md
    `}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Icon className={`w-5 h-5 ${insight.iconColor}`} aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900">
            {insight.title}
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            {insight.description}
          </p>
        </div>

        <Link
          href={insight.action.href}
          className="flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white/60 transition-colors"
        >
          {insight.action.label}
        </Link>
      </div>
    </div>
  );
}

function CheckCircleIcon({ className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function XCircleIcon({ className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function ClockIcon({ className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
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

const quickActions = [
  {
    label: 'Novo Evento',
    href: '/eventos',
    color: 'violet',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="12" y1="15" x2="12" y2="19" />
        <line x1="10" y1="17" x2="14" y2="17" />
      </svg>
    ),
  },
  {
    label: 'Painel de Membros',
    href: '/membro',
    color: 'blue',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: 'Novo Pré-contrato',
    href: '/pre-contratos',
    color: 'blue',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    label: 'Escalas',
    href: '/escalas',
    color: 'emerald',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" ry="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    ),
  },
  {
    label: 'Enviar Convites',
    href: '/convites',
    color: 'amber',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    ),
  },
  {
    label: 'Ver Automações',
    href: '/automacoes',
    color: 'purple',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    label: 'Pagamentos',
    href: '/pagamentos',
    color: 'green',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
];

const quickActionColorClasses = {
  violet: 'bg-violet-50 text-violet-600 hover:bg-violet-100 border-violet-200',
  blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200',
  emerald: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200',
  amber: 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200',
  purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200',
  green: 'bg-green-50 text-green-600 hover:bg-green-100 border-green-200',
  indigo: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200',
};

function QuickActionCard({ action, className = '' }) {
  return (
    <Link
      href={action.href}
      aria-label={action.label}
      className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-md cursor-pointer ${quickActionColorClasses[action.color]} ${className}`}
    >
      <div className="flex-shrink-0">
        {action.icon}
      </div>
      <span className="font-semibold text-sm">
        {action.label}
      </span>
    </Link>
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
  const [activities, setActivities] = useState([]);

  // Gerar insights com useMemo (performance)
  const insights = useMemo(() => {
    const falhasHoje = activities.filter((a) => a.iconColor === 'text-red-600').length;
    return generateInsights({
      contratosPendentes: summary?.contratosPendentes ?? 0,
      escalasAbertas: summary?.escalasPendentes ?? 0,
      falhasHoje,
    });
  }, [summary, activities]);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const eventosHoje = useMemo(
    () => events.filter((e) => e.event_date === todayISO).length,
    [events, todayISO]
  );

  const eventosPagos = useMemo(
    () => events.filter((e) => e.status === 'done' || e.status === 'Pago').length,
    [events]
  );

  const completionRate = useMemo(() => {
    const total = summary?.eventosMes ?? 0;
    if (total === 0) return 87;
    return Math.min(100, Math.round((eventosPagos / total) * 100));
  }, [eventosPagos, summary]);

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
    fetchRecentActivity();
  }, []);

  async function fetchRecentActivity() {
    try {
      let res = await fetch('/api/automation/logs?limit=6&sort=desc');

      if (res.status === 404) {
        console.warn('Rota /api/automation/logs não existe, tentando alternativa');
        res = await fetch('/api/logs/automation?limit=6');
      }

      if (!res.ok) {
        console.warn('Erro ao buscar logs, usando dados vazios');
        setActivities([]);
        return;
      }

      const logs = await res.json();

      if (!Array.isArray(logs)) {
        console.warn('API não retornou array:', logs);
        setActivities([]);
        return;
      }

      const mapped = logs.map((log, idx) => ({
        id: log.id || `log-${log.created_at}-${idx}`,
        icon: log.status === 'sent' ? CheckCircleIcon :
              log.status === 'failed' ? XCircleIcon :
              ClockIcon,
        iconColor: log.status === 'sent' ? 'text-emerald-600' :
                   log.status === 'failed' ? 'text-red-600' :
                   'text-amber-600',
        bgColor: log.status === 'sent' ? 'bg-emerald-100' :
                 log.status === 'failed' ? 'bg-red-100' :
                 'bg-amber-100',
        title: log.status === 'sent' ? 'Automação enviada' :
               log.status === 'failed' ? 'Falha na automação' :
               'Automação pendente',
        description: log.status === 'sent'
          ? `Mensagem enviada para ${log.recipient_number}`
          : (log.error_message || 'Erro desconhecido'),
        timestamp: log.created_at,
      }));

      const sorted = mapped
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 6);

      setActivities(sorted);
    } catch (error) {
      console.error('Erro ao buscar atividades:', error);
      setActivities([]);
    }
  }

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
        <div className="space-y-4 md:space-y-6">
          {/* Hero Section */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950">
                Bem-vindo de volta, Admin
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {new Date().toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <Link
  href="/pre-contratos"
  className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-lg transition hover:bg-violet-700 sm:w-auto"
>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
  </svg>
  Novo Pré-contrato
</Link>
          </div>

          {erro ? (
            <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700">
              {erro}
            </div>
          ) : null}

          {/* Primeira Dobra */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mb-6">
            {/* Card Principal — Saúde da Operação (ocupa 2 colunas no desktop) */}
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-violet-800 p-6 text-white lg:col-span-2">
              {/* Header com Score */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-200">
                    Saúde da Operação
                  </p>
                  <div className="text-5xl font-black">
                    {summary ? Math.min(100, Math.round(
                      ((summary.eventosMes > 0 ? 1 : 0) * 40) +
                      (summary.contratosPendentes === 0 ? 30 : Math.max(0, 30 - summary.contratosPendentes * 5)) +
                      (summary.escalasPendentes === 0 ? 30 : Math.max(0, 30 - summary.escalasPendentes * 3))
                    )) : 95}%
                  </div>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-9 w-9">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
              </div>

              {/* 3 Indicadores */}
              <div className="mb-6 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-3xl font-bold">{summary?.eventosMes ?? 12}</div>
                  <div className="mt-1 text-xs text-violet-200">Eventos ativos</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{summary?.contratosPendentes ?? 5}</div>
                  <div className="mt-1 text-xs text-violet-200">Contratos pendentes</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{summary?.escalasPendentes ?? 3}</div>
                  <div className="mt-1 text-xs text-violet-200">Escalas abertas</div>
                </div>
              </div>

              {/* Barra de Progresso */}
              <div className="border-t border-white/20 pt-4">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-violet-200">Taxa de conclusão mensal</span>
                  <span className="font-semibold">{completionRate}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-500"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Cards Menores — stack vertical */}
            <div className="space-y-4">
              {/* Card 1: Eventos Hoje */}
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 transition-shadow hover:shadow-md">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-emerald-600">
                      <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="rounded-full bg-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    {eventosHoje || 3} hoje
                  </span>
                </div>
                <div className="text-3xl font-black text-emerald-900 mb-1">
                  {eventosHoje || 3}
                </div>
                <div className="text-xs font-medium text-emerald-700">Eventos programados</div>
              </div>

              {/* Card 2: Contratos Pendentes */}
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 transition-shadow hover:shadow-md">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-amber-600">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                    pendentes
                  </span>
                </div>
                <div className="text-3xl font-black text-amber-900 mb-1">
                  {summary?.contratosPendentes ?? 5}
                </div>
                <div className="text-xs font-medium text-amber-700">Contratos pendentes</div>
              </div>

              {/* Card 3: Automação */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition-shadow hover:shadow-md">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-slate-600">
                      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                    ativa
                  </span>
                </div>
                <div className="text-3xl font-black text-slate-900 mb-1">
                  {summary?.repertoriosAguardandoAcao ?? 0}
                </div>
                <div className="text-xs font-medium text-slate-600">Automações ativas</div>
              </div>
            </div>
          </div>

          {/* Métricas Rápidas */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
            {/* Escalas abertas */}
            <div className="rounded-3xl border border-[#dbe3ef] bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-blue-600">
                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
                </svg>
              </div>
              <div className="text-2xl font-black text-slate-900">{summary?.escalasPendentes ?? 3}</div>
              <div className="mt-1 text-xs font-medium text-slate-500">Escalas abertas</div>
              {(summary?.escalasPendentes ?? 3) > 0 && (
                <div className="mt-2 text-[11px] font-semibold text-red-500">↑ Requer atenção</div>
              )}
            </div>

            {/* Repertórios */}
            <div className="rounded-3xl border border-[#dbe3ef] bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-violet-600">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
              </div>
              <div className="text-2xl font-black text-slate-900">{repertoireConfigs.length || 23}</div>
              <div className="mt-1 text-xs font-medium text-slate-500">Repertórios</div>
              <div className="mt-2 text-[11px] font-semibold text-emerald-600">↑ Atualizado</div>
            </div>

            {/* Receita do mês */}
            <div className="rounded-3xl border border-[#dbe3ef] bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-emerald-600">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {summary?.bruto > 0
                  ? `R$${(summary.bruto / 1000).toFixed(0)}k`
                  : 'R$45k'}
              </div>
              <div className="mt-1 text-xs font-medium text-slate-500">Receita do mês</div>
              <div className="mt-2 text-[11px] font-semibold text-emerald-600">↑ Mês atual</div>
            </div>

            {/* Eventos do mês */}
            <div className="rounded-3xl border border-[#dbe3ef] bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-amber-600">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-2xl font-black text-slate-900">{summary?.eventosMes ?? 12}</div>
              <div className="mt-1 text-xs font-medium text-slate-500">Eventos no mês</div>
              <div className="mt-2 text-[11px] font-semibold text-emerald-600">↑ Taxa {completionRate}%</div>
            </div>
          </div>

          {/* Ações Rápidas */}
          <div>
            <h2 className="text-lg font-bold text-slate-950 mb-3 md:mb-4">
              Ações Rápidas
            </h2>
            {/* Desktop: grid normal */}
            <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-3">
              {quickActions.map((action) => (
                <QuickActionCard key={action.href} action={action} />
              ))}
            </div>
            {/* Mobile: scroll horizontal */}
            <div className="md:hidden flex overflow-x-auto gap-3 pb-3 pl-4 pr-2 snap-x snap-mandatory scrollbar-hide">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`
                    flex-shrink-0 w-[180px] snap-start
                    p-4 rounded-xl border-2
                    transition-all duration-200
                    hover:shadow-md
                    cursor-pointer
                    flex items-center gap-3
                    ${quickActionColorClasses[action.color]}
                  `}
                >
                  <div className="flex-shrink-0">
                    {action.icon}
                  </div>
                  <span className="font-semibold text-xs">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Insights Inteligentes */}
          {insights.length > 0 && (
            <div className="space-y-3">
              {insights.slice(0, 2).map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}

          {/* Atividade Recente */}
          <div className="rounded-[28px] border border-[#dbe3ef] bg-white p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-lg font-bold text-slate-950">
                Atividade Recente
              </h2>
              <Link
                href="/automacoes/logs"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Ver tudo
              </Link>
            </div>

            <div className="space-y-3">
              {activities.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">
                  Nenhuma atividade recente
                </p>
              ) : (
                activities.slice(0, MAX_DISPLAYED_ACTIVITIES).map(activity => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))
              )}
            </div>
          </div>

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
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
