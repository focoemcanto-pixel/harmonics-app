'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import AdminShell from '@/components/layout/AdminShell';
import DashboardPrimaryKpis from '@/components/dashboard/DashboardPrimaryKpis';
import DashboardSecondaryKpis from '@/components/dashboard/DashboardSecondaryKpis';
import { supabase } from '@/lib/supabase';
import { buildDashboardSummary } from '@/lib/dashboard/dashboard-summary';
import { calculateFinancialSummary } from '@/lib/finance/calculateFinancialSummary';
import { logWarn, reportError } from '@/lib/observability/client-log';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardHeader, DashboardOverview, DashboardQuickActions } from '@/components/dashboard/DashboardOverview';

const DashboardRevenueChart = dynamic(() => import('@/components/dashboard/DashboardRevenueChart'));
const DashboardFinanceBreakdown = dynamic(() => import('@/components/dashboard/DashboardFinanceBreakdown'));
const DashboardOperationsRadar = dynamic(() => import('@/components/dashboard/DashboardOperationsRadar'));
const DashboardUpcomingEvents = dynamic(() => import('@/components/dashboard/DashboardUpcomingEvents'));

const DASHBOARD_EVENTS_SELECT =
  'id, created_at, event_date, status, client_name, agreed_amount, paid_amount, open_amount, profit_amount, antesala_requested_by_client, antesala_request_status';
const DASHBOARD_PRECONTRACTS_SELECT =
  'id, created_at, event_id, event_date, status, client_name, notes, public_token';
const DASHBOARD_CONTRACTS_SELECT =
  'id, created_at, event_id, precontract_id, event_date, status, client_name, public_token, raw_payload';
const DASHBOARD_EVENT_MUSICIANS_SELECT = 'id, created_at, status';
const DASHBOARD_REPERTOIRE_CONFIG_SELECT = 'id, created_at, event_id, status, is_locked, submitted_at';
const DASHBOARD_ADJUSTMENT_REQUESTS_SELECT = 'id, created_at, precontract_id, status';
const DASHBOARD_PAYMENTS_SELECT = 'id, event_id, status, payment_date, created_at, amount';
const DASHBOARD_FETCH_LIMIT = 50;
const DASHBOARD_HEAVY_FETCH_LIMIT = 30;

const MAX_DISPLAYED_ACTIVITIES = 2;
const DASHBOARD_CACHE_TTL_MS = 60 * 1000;
let dashboardMemoryCache = null;

function filterRowsByMonth(rows = [], dateField, referenceDate = new Date()) {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();

  return rows.filter((row) => {
    const value = row?.[dateField];
    if (!value) return false;

    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return false;

    return parsed.getMonth() === month && parsed.getFullYear() === year;
  });
}

function DashboardLoading() {
  return (
    <div className="space-y-5">
      <div className="h-[220px] hx-skeleton rounded-[24px]" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[148px] hx-skeleton rounded-[24px]"
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
      <div className="rounded-[24px] border border-[#e4e7ec] bg-white p-4 md:p-6">
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
        <div className="h-[420px] hx-skeleton rounded-[24px]" />
        <div className="h-[420px] hx-skeleton rounded-[24px]" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.2fr]">
        <div className="h-[360px] hx-skeleton rounded-[24px]" />
        <div className="h-[420px] hx-skeleton rounded-[24px]" />
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

function formatEventDate(value) {
  if (!value) return '--';

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '--';

  return parsed.toLocaleDateString('pt-BR');
}

function isPendingPaymentValidationStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  return [
    'em_analise',
    'em análise',
    'analysis',
    'analyzing',
    'pending_admin_validation',
    'admin_review',
    'pending_confirmation',
    'aguardando_validacao',
    'aguardando validação',
    'pendente_validacao',
  ].includes(raw);
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
      rounded-[16px] border p-4
      ${insight.bgColor} ${insight.borderColor}
      transition-colors duration-200
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

function ReviewRequestsAlertCard({ total, urgentClientName, urgentEventDate }) {
  const linkHref = '/repertorios?status=AGUARDANDO_REVISAO';
  const title = total === 1 ? '1 revisão solicitada' : `${total} revisões solicitadas`;
  const urgentClientLabel = urgentClientName || 'Cliente não identificado';
  const urgentEventLabel = formatEventDate(urgentEventDate);

  return (
    <Link
      href={linkHref}
      className="group block rounded-[20px] border border-[#e4e7ec] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#d0d5dd] hover:shadow-[0_8px_24px_rgba(16,24,40,0.06)] md:p-5"
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          <AlertTriangleIcon className="h-6 w-6" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">
            Atenção imediata
          </p>
          <h2 className="mt-1 text-[16px] font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-[13px] text-slate-600">
            Mais urgente: {urgentClientLabel}
          </p>
          <p className="mt-0.5 text-[13px] text-slate-600">
            Evento: {urgentEventLabel}
          </p>
        </div>

        <div className="hidden shrink-0 rounded-full border border-[#e4e7ec] px-3 py-1.5 text-[12px] font-semibold text-slate-800 transition-colors group-hover:bg-[#f6f7f9] sm:block">
          Liberar revisão
        </div>
      </div>
    </Link>
  );
}

function ContractAdjustmentAlertCard({
  total,
  urgentClientName,
  urgentEventDate,
  urgentPrecontractId,
}) {
  const linkHref = urgentPrecontractId
    ? `/pre-contratos?edit=${urgentPrecontractId}&highlightAdjustment=1`
    : '/pre-contratos';
  const title = total === 1 ? '1 ajuste solicitado' : `${total} ajustes solicitados`;
  const urgentClientLabel = urgentClientName || 'Cliente não identificado';
  const urgentEventLabel = formatEventDate(urgentEventDate);

  return (
    <Link
      href={linkHref}
      className="group block rounded-[20px] border border-[#e4e7ec] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#d0d5dd] hover:shadow-[0_8px_24px_rgba(16,24,40,0.06)] md:p-5"
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-700">
          <AlertCircleIcon className="h-6 w-6" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-orange-700">
            Operação pendente
          </p>
          <h2 className="mt-1 text-[16px] font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-[13px] text-slate-600">
            Mais urgente: {urgentClientLabel}
          </p>
          <p className="mt-0.5 text-[13px] text-slate-600">
            Evento: {urgentEventLabel}
          </p>
        </div>

        <div className="hidden shrink-0 rounded-full border border-[#e4e7ec] px-3 py-1.5 text-[12px] font-semibold text-slate-800 transition-colors group-hover:bg-[#f6f7f9] sm:block">
          Abrir pré-contrato
        </div>
      </div>
    </Link>
  );
}

function PendingPaymentValidationAlertCard({
  total,
  urgentClientName,
  urgentEventDate,
  urgentEventId,
}) {
  const linkHref = urgentEventId
    ? `/pagamentos?filtro=validacao&eventId=${encodeURIComponent(urgentEventId)}`
    : '/pagamentos?filtro=validacao';
  const title =
    total === 1 ? '1 pagamento aguardando validação' : `${total} pagamentos aguardando validação`;
  const urgentClientLabel = urgentClientName || 'Cliente não identificado';
  const urgentEventLabel = formatEventDate(urgentEventDate);

  return (
    <Link
      href={linkHref}
      className="group block rounded-[20px] border border-[#e4e7ec] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#d0d5dd] hover:shadow-[0_8px_24px_rgba(16,24,40,0.06)] md:p-5"
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700">
          <AlertCircleIcon className="h-6 w-6" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-violet-700">
            Pagamentos aguardando validação
          </p>
          <h2 className="mt-1 text-[16px] font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-[13px] text-slate-600">
            Mais urgente: {urgentClientLabel}
          </p>
          <p className="mt-0.5 text-[13px] text-slate-600">
            Evento: {urgentEventLabel}
          </p>
        </div>

        <div className="hidden shrink-0 rounded-full border border-[#e4e7ec] px-3 py-1.5 text-[12px] font-semibold text-slate-800 transition-colors group-hover:bg-[#f6f7f9] sm:block">
          Validar agora
        </div>
      </div>
    </Link>
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
      <div className="flex min-w-max gap-1 rounded-full border border-[#e4e7ec] bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {items.map((item) => {
          const isActive = active === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`min-h-10 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-medium transition ${
                isActive
                  ? 'bg-[#0c0d12] text-white'
                  : 'text-[#586174]'
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

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const firstName = String(profile?.name || user?.user_metadata?.name || '').trim().split(/\s+/)[0] || '';
  const [events, setEvents] = useState([]);
  const [antesalaRequests, setAntesalaRequests] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [precontracts, setPrecontracts] = useState([]);
  const [repertoireConfigs, setRepertoireConfigs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pendingPaymentValidation, setPendingPaymentValidation] = useState({
    total: 0,
    urgentClientName: '',
    urgentEventDate: '',
    urgentEventId: '',
  });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mobileSection, setMobileSection] = useState('overview');
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [partialDataWarning, setPartialDataWarning] = useState('');
  const [secondaryReady, setSecondaryReady] = useState(false);
  const [heavyReady, setHeavyReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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

  const healthScore = useMemo(() => {
    if (!summary) return null;
    return Math.min(100, Math.round(
      ((summary.eventosMes > 0 ? 1 : 0) * 40) +
      (summary.contratosPendentes === 0 ? 30 : Math.max(0, 30 - summary.contratosPendentes * 5)) +
      (summary.escalasPendentes === 0 ? 30 : Math.max(0, 30 - summary.escalasPendentes * 3))
    ));
  }, [summary]);

  const eventosPagos = useMemo(
    () => events.filter((e) => e.status === 'done' || e.status === 'Pago').length,
    [events]
  );

  const completionRate = useMemo(() => {
    const total = summary?.eventosMes ?? 0;
    if (total === 0) return null;
    return Math.min(100, Math.round((eventosPagos / total) * 100));
  }, [eventosPagos, summary]);

 useEffect(() => {
  async function carregarDashboard() {
    try {
      setCarregando(true);
      setErro('');
      setPartialDataWarning('');
      setSecondaryReady(false);
      setHeavyReady(false);

      // Cache curto para navegação interna, válido só para a mesma sessão/usuário
      // (logout + login de outra conta na mesma aba não reaproveita dados).
      const { data: cacheSession } = await supabase.auth.getSession();
      const cacheOwnerId = cacheSession?.session?.user?.id || null;
      if (
        dashboardMemoryCache &&
        cacheOwnerId &&
        dashboardMemoryCache.ownerId === cacheOwnerId &&
        Date.now() - dashboardMemoryCache.updatedAt < DASHBOARD_CACHE_TTL_MS
      ) {
        setEvents(dashboardMemoryCache.events);
        setContracts(dashboardMemoryCache.contracts);
        setPrecontracts(dashboardMemoryCache.precontracts);
        setRepertoireConfigs(dashboardMemoryCache.repertoireConfigs);
        setSummary(dashboardMemoryCache.summary);
        if (dashboardMemoryCache.antesalaRequests) setAntesalaRequests(dashboardMemoryCache.antesalaRequests);
        if (dashboardMemoryCache.pendingPaymentValidation) setPendingPaymentValidation(dashboardMemoryCache.pendingPaymentValidation);
        setSecondaryReady(true);
        setHeavyReady(true);
        setCarregando(false);
      }

      // Consultas independentes começam juntas; o processamento continua em etapas para
      // priorizar o conteúdo principal (antes eram 3 ondas sequenciais de rede).
      const antesalaRequestsPromise = supabase.from('events')
        .select('id, client_name, event_date')
        .eq('antesala_request_status', 'pending').eq('antesala_requested_by_client', true)
        .order('event_date', { ascending: true });
      const heavyResultsPromise = Promise.allSettled([
        supabase
          .from('event_musicians')
          .select(DASHBOARD_EVENT_MUSICIANS_SELECT)
          .order('created_at', { ascending: false })
          .limit(DASHBOARD_HEAVY_FETCH_LIMIT),
        supabase
          .from('repertoire_config')
          .select(DASHBOARD_REPERTOIRE_CONFIG_SELECT)
          .order('created_at', { ascending: false })
          .limit(DASHBOARD_HEAVY_FETCH_LIMIT),
        supabase
          .from('contract_adjustment_requests')
          .select(DASHBOARD_ADJUSTMENT_REQUESTS_SELECT)
          .order('created_at', { ascending: false })
          .limit(DASHBOARD_HEAVY_FETCH_LIMIT),
      ]);

      const primaryResults = await Promise.allSettled([
        supabase
          .from('events')
          .select(DASHBOARD_EVENTS_SELECT)
          .order('created_at', { ascending: false })
          .limit(DASHBOARD_FETCH_LIMIT),
        supabase
          .from('contracts')
          .select(DASHBOARD_CONTRACTS_SELECT)
          .order('created_at', { ascending: false })
          .limit(DASHBOARD_FETCH_LIMIT),
        supabase
          .from('precontracts')
          .select(DASHBOARD_PRECONTRACTS_SELECT)
          .order('created_at', { ascending: false })
          .limit(DASHBOARD_FETCH_LIMIT),
        supabase
          .from('payments')
          .select(DASHBOARD_PAYMENTS_SELECT)
          .order('created_at', { ascending: false })
          .limit(DASHBOARD_FETCH_LIMIT * 2),
      ]);

      const eventsRes =
        primaryResults[0].status === 'fulfilled' ? primaryResults[0].value : { data: [], error: null };
      const contractsRes =
        primaryResults[1].status === 'fulfilled' ? primaryResults[1].value : { data: [], error: null };
      const precontractsRes =
        primaryResults[2].status === 'fulfilled' ? primaryResults[2].value : { data: [], error: null };
      const paymentsRes =
        primaryResults[3].status === 'fulfilled' ? primaryResults[3].value : { data: [], error: null };

      const failedPrimaryBlocks = [];
      if (eventsRes.error) {
        failedPrimaryBlocks.push('eventos');
        logWarn('dashboard', 'events falhou', eventsRes.error);
      }
      if (contractsRes.error) {
        failedPrimaryBlocks.push('contratos');
        logWarn('dashboard', 'contracts falhou', contractsRes.error);
      }
      if (precontractsRes.error) {
        failedPrimaryBlocks.push('pré-contratos');
        logWarn('dashboard', 'precontracts falhou', precontractsRes.error);
      }
      if (paymentsRes.error) {
        failedPrimaryBlocks.push('pagamentos');
        logWarn('dashboard', 'payments falhou', paymentsRes.error);
      }

      const eventsData = Array.isArray(eventsRes.data) ? eventsRes.data : [];
      const contractsData = Array.isArray(contractsRes.data) ? contractsRes.data : [];
      const precontractsData = Array.isArray(precontractsRes.data) ? precontractsRes.data : [];
      const paymentsData = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];

      setEvents(eventsData);
      const antesalaRequestsResult = await antesalaRequestsPromise;
      const antesalaRequestsData = antesalaRequestsResult.error ? null : antesalaRequestsResult.data || [];
      if (antesalaRequestsData) setAntesalaRequests(antesalaRequestsData);
      else logWarn('dashboard', 'Solicitações de antessala indisponíveis', antesalaRequestsResult.error);

      setContracts(contractsData);
      setPrecontracts(precontractsData);
      setSecondaryReady(true);

      const eventsById = new Map(eventsData.map((eventItem) => [String(eventItem.id), eventItem]));
      const pendingValidationRows = paymentsData.filter((entry) =>
        isPendingPaymentValidationStatus(entry?.status)
      );
      const urgentPending = pendingValidationRows
        .slice()
        .sort(
          (a, b) =>
            new Date(a.created_at || a.payment_date || 0).getTime() -
            new Date(b.created_at || b.payment_date || 0).getTime()
        )[0];
      const urgentEvent = urgentPending ? eventsById.get(String(urgentPending.event_id)) : null;

      const nextPendingPaymentValidation = {
        total: pendingValidationRows.length,
        urgentClientName: urgentEvent?.client_name || '',
        urgentEventDate: urgentEvent?.event_date || '',
        urgentEventId: urgentEvent?.id || '',
      };
      setPendingPaymentValidation(nextPendingPaymentValidation);

      const heavyResults = await heavyResultsPromise;
      const eventMusiciansRes =
        heavyResults[0].status === 'fulfilled' ? heavyResults[0].value : { data: [], error: null };
      const repertoireConfigsRes =
        heavyResults[1].status === 'fulfilled' ? heavyResults[1].value : { data: [], error: null };
      const adjustmentRequestsRes =
        heavyResults[2].status === 'fulfilled' ? heavyResults[2].value : { data: [], error: null };

      const failedHeavyBlocks = [];
      if (eventMusiciansRes.error) {
        failedHeavyBlocks.push('escalas');
        logWarn('dashboard', 'event_musicians falhou', eventMusiciansRes.error);
      }
      if (repertoireConfigsRes.error) {
        failedHeavyBlocks.push('repertórios');
        logWarn('dashboard', 'repertoire_config falhou', repertoireConfigsRes.error);
      }
      if (adjustmentRequestsRes.error) {
        failedHeavyBlocks.push('ajustes');
        logWarn('dashboard', 'contract_adjustment_requests falhou', adjustmentRequestsRes.error);
      }
      if (failedPrimaryBlocks.length > 0 || failedHeavyBlocks.length > 0) {
        setPartialDataWarning(
          `Alguns blocos foram carregados parcialmente (${[...failedPrimaryBlocks, ...failedHeavyBlocks].join(', ')}).`
        );
      }

      const eventMusiciansData = Array.isArray(eventMusiciansRes.data) ? eventMusiciansRes.data : [];
      const repertoireConfigsData = Array.isArray(repertoireConfigsRes.data) ? repertoireConfigsRes.data : [];
      const adjustmentRequestsData = Array.isArray(adjustmentRequestsRes.data)
        ? adjustmentRequestsRes.data
        : [];

      setRepertoireConfigs(repertoireConfigsData);
      setHeavyReady(true);

      const monthStart = new Date();
      const monthlyFinanceEvents = filterRowsByMonth(eventsData, 'event_date', monthStart);
      const monthlyFinancePayments = filterRowsByMonth(paymentsData, 'payment_date', monthStart);
      const monthlyFinancialSummary = calculateFinancialSummary(
        monthlyFinanceEvents,
        monthlyFinancePayments,
        {
          onError: (message, data) => console.error(message, data),
        }
      );

      const nextSummary = buildDashboardSummary(
        eventsData,
        contractsData,
        precontractsData,
        eventMusiciansData,
        repertoireConfigsData,
        adjustmentRequestsData,
        {
          monthlyFinanceEvents,
          monthlyFinancialSummary,
        }
      );
      setSummary(nextSummary);
      dashboardMemoryCache = {
        ownerId: cacheOwnerId,
        updatedAt: Date.now(),
        events: eventsData,
        contracts: contractsData,
        precontracts: precontractsData,
        eventMusicians: eventMusiciansData,
        repertoireConfigs: repertoireConfigsData,
        summary: nextSummary,
        antesalaRequests: antesalaRequestsData,
        pendingPaymentValidation: nextPendingPaymentValidation,
      };
    } catch (error) {
      reportError('dashboard.load', error);
      setErro(error?.message || 'Não foi possível carregar o dashboard.');
      setEvents([]);
      setContracts([]);
      setPrecontracts([]);
      setRepertoireConfigs([]);
      setSummary(buildDashboardSummary([], [], [], [], [], []));
      setPendingPaymentValidation({
        total: 0,
        urgentClientName: '',
        urgentEventDate: '',
        urgentEventId: '',
      });
    } finally {
      setCarregando(false);
    }
  }

  carregarDashboard();
  fetchRecentActivity();
}, [reloadKey]);
  async function fetchRecentActivity() {
  try {
    setActivitiesLoading(true);
    let res = await fetch('/api/automation/logs?limit=6&sort=desc');

    if (res.status === 404) {
      res = await fetch('/api/logs/automation?limit=6');
    }

    if (!res.ok) {
      logWarn('dashboard', 'Não foi possível carregar logs agora, exibindo vazio');
      setActivities([]);
      return;
    }

    const payload = await res.json();

    const logs = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.logs)
      ? payload.logs
      : [];

    if (logs.length === 0) {
      setActivities([]);
      return;
    }

    const mapped = logs.map((log, idx) => ({
      id: log.id || `log-${log.created_at || idx}-${idx}`,
      icon:
        log.status === 'sent'
          ? CheckCircleIcon
          : log.status === 'failed'
          ? XCircleIcon
          : ClockIcon,
      iconColor:
        log.status === 'sent'
          ? 'text-emerald-600'
          : log.status === 'failed'
          ? 'text-red-600'
          : 'text-amber-600',
      bgColor:
        log.status === 'sent'
          ? 'bg-emerald-100'
          : log.status === 'failed'
          ? 'bg-red-100'
          : 'bg-amber-100',
      title:
        log.status === 'sent'
          ? 'Automação enviada'
          : log.status === 'failed'
          ? 'Falha na automação'
          : 'Automação pendente',
      description:
        log.status === 'sent'
          ? `Mensagem enviada para ${log.recipient_number || 'destinatário'}`
          : log.error_message || 'Erro desconhecido',
      timestamp: log.created_at,
    }));

    const sorted = mapped
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, 6);

    setActivities(sorted);
  } catch (error) {
    reportError('dashboard.activities', error);
    setActivities([]);
  } finally {
    setActivitiesLoading(false);
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
            {secondaryReady ? (
              <DashboardSecondaryKpis summary={summary} />
            ) : (
              <div className="h-[148px] hx-skeleton rounded-[24px]" />
            )}
          </MobileSlide>
        </MobileCarousel>

        <MobileCarousel>
          <MobileSlide wide>
            {heavyReady ? (
              <DashboardUpcomingEvents
                events={events}
                contracts={contracts}
                precontracts={precontracts}
              />
            ) : (
              <div className="h-[360px] hx-skeleton rounded-[24px]" />
            )}
          </MobileSlide>
        </MobileCarousel>
      </div>
    );
  }, [summary, events, contracts, precontracts, secondaryReady, heavyReady]);

  const mobileFinance = useMemo(() => {
    return (
      <div className="space-y-4 xl:hidden">
        <MobileCarousel>
          <MobileSlide wide>
            {heavyReady ? (
              <DashboardRevenueChart events={events} />
            ) : (
              <div className="h-[420px] hx-skeleton rounded-[24px]" />
            )}
          </MobileSlide>
          <MobileSlide wide>
            {heavyReady ? (
              <DashboardFinanceBreakdown summary={summary} />
            ) : (
              <div className="h-[420px] hx-skeleton rounded-[24px]" />
            )}
          </MobileSlide>
        </MobileCarousel>
      </div>
    );
  }, [events, summary, heavyReady]);

  const mobileOps = useMemo(() => {
    return (
      <div className="space-y-4 xl:hidden">
        <MobileCarousel>
          <MobileSlide wide>
            {heavyReady ? (
              <DashboardOperationsRadar summary={summary} />
            ) : (
              <div className="h-[360px] hx-skeleton rounded-[24px]" />
            )}
          </MobileSlide>
        </MobileCarousel>
      </div>
    );
  }, [summary, heavyReady]);

  const mobileAgenda = useMemo(() => {
    return (
      <div className="space-y-4 xl:hidden">
        <MobileCarousel>
          <MobileSlide wide>
            {heavyReady ? (
              <DashboardUpcomingEvents
                events={events}
                contracts={contracts}
                precontracts={precontracts}
              />
            ) : (
              <div className="h-[360px] hx-skeleton rounded-[24px]" />
            )}
          </MobileSlide>
          <MobileSlide wide>
            {secondaryReady ? (
              <DashboardSecondaryKpis summary={summary} />
            ) : (
              <div className="h-[148px] hx-skeleton rounded-[24px]" />
            )}
          </MobileSlide>
        </MobileCarousel>
      </div>
    );
  }, [events, contracts, precontracts, summary, heavyReady, secondaryReady]);

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
          <DashboardHeader firstName={firstName} />

          {erro ? (
            <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <span>{erro}</span>
                <button
                  type="button"
                  onClick={() => setReloadKey((current) => current + 1)}
                  className="rounded-xl border border-red-300 bg-white px-3 py-1.5 text-[12px] font-black text-red-700 hover:bg-red-50"
                >
                  Recarregar dashboard
                </button>
              </div>
            </div>
          ) : null}
          {partialDataWarning ? (
            <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
              {partialDataWarning}
            </div>
          ) : null}

          <DashboardOverview
            summary={summary}
            healthScore={healthScore}
            completionRate={completionRate}
            eventosHoje={eventosHoje}
            repertoireCount={heavyReady && !partialDataWarning.includes('repertórios') ? repertoireConfigs.length : null}
          />

          <div className="space-y-3">
            {antesalaRequests.map((event) => (
              <Link key={`antesala-${event.id}`} href={`/eventos/${event.id}`} className="block rounded-[20px] border border-amber-200 bg-amber-50/60 p-4">
                <div className="text-sm font-black text-amber-900">Liberar antessala</div>
                <div className="mt-1 text-sm text-amber-800">{event.client_name} • {formatEventDate(event.event_date)}</div>
                <div className="mt-2 text-xs font-bold text-amber-900">Revisar solicitação e liberar ou recusar</div>
              </Link>
            ))}
            {summary?.revisoesSolicitadas > 0 ? (
              <ReviewRequestsAlertCard
                total={summary.revisoesSolicitadas}
                urgentClientName={summary?.revisaoSolicitadaMaisUrgente?.clientName}
                urgentEventDate={summary?.revisaoSolicitadaMaisUrgente?.eventDate}
              />
            ) : null}

            {summary?.ajustesSolicitadosPendentes > 0 ? (
              <ContractAdjustmentAlertCard
                total={summary.ajustesSolicitadosPendentes}
                urgentClientName={summary?.ajusteSolicitadoMaisUrgente?.clientName}
                urgentEventDate={summary?.ajusteSolicitadoMaisUrgente?.eventDate}
                urgentPrecontractId={summary?.ajusteSolicitadoMaisUrgente?.precontractId}
              />
            ) : null}

            {pendingPaymentValidation.total > 0 ? (
              <PendingPaymentValidationAlertCard
                total={pendingPaymentValidation.total}
                urgentClientName={pendingPaymentValidation.urgentClientName}
                urgentEventDate={pendingPaymentValidation.urgentEventDate}
                urgentEventId={pendingPaymentValidation.urgentEventId}
              />
            ) : null}
          </div>

          <DashboardQuickActions actions={quickActions} />

          {/* Insights Inteligentes */}
          {insights.length > 0 && (
            <div className="space-y-3">
              {insights.slice(0, 2).map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}

          {/* Atividade Recente */}
          <div className="rounded-[24px] border border-[#e4e7ec] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-slate-950">
                Atividade recente
              </h2>
              <Link
                href="/automacoes/logs"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Ver tudo
              </Link>
            </div>

            <div className="space-y-3">
              {activitiesLoading ? (
                Array.from({ length: MAX_DISPLAYED_ACTIVITIES }).map((_, index) => (
                  <div key={`activity-loading-${index}`} className="flex items-start gap-3 animate-pulse">
                    <div className="h-10 w-10 rounded-lg bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 rounded bg-slate-200" />
                      <div className="h-3 w-full max-w-[260px] rounded bg-slate-100" />
                    </div>
                  </div>
                ))
              ) : activities.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">
                  Sem atividade recente no momento. Novos envios e alertas aparecerão aqui.
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
                {heavyReady ? (
                  <>
                    <DashboardRevenueChart events={events} />
                    <DashboardFinanceBreakdown summary={summary} />
                  </>
                ) : (
                  <>
                    <div className="h-[420px] hx-skeleton rounded-[24px]" />
                    <div className="h-[420px] hx-skeleton rounded-[24px]" />
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.2fr]">
                {heavyReady ? (
                  <>
                    <DashboardOperationsRadar summary={summary} />
                    <DashboardUpcomingEvents
                      events={events}
                      contracts={contracts}
                      precontracts={precontracts}
                    />
                  </>
                ) : (
                  <>
                    <div className="h-[360px] hx-skeleton rounded-[24px]" />
                    <div className="h-[420px] hx-skeleton rounded-[24px]" />
                  </>
                )}
              </div>

              {secondaryReady ? (
                <DashboardSecondaryKpis summary={summary} />
              ) : (
                <div className="h-[148px] hx-skeleton rounded-[24px]" />
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
