'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PlusIcon,
  ActivityIcon,
  CalendarIcon,
  FileTextIcon,
  ZapIcon,
  UsersIcon,
  MusicIcon,
  DollarSignIcon,
  TrendingUpIcon,
} from 'lucide-react';
import AdminShell from '../../components/layout/AdminShell';
import { supabase } from '../../lib/supabase';
import { buildDashboardSummary } from '../../lib/dashboard/dashboard-summary';

function isSameDay(dateStr, refDate = new Date()) {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T00:00:00`);
  return (
    d.getDate() === refDate.getDate() &&
    d.getMonth() === refDate.getMonth() &&
    d.getFullYear() === refDate.getFullYear()
  );
}

function computeHealthScore(summary) {
  if (!summary) return null;
  let score = 100;
  if (summary.escalasIncompletas > 0) score -= Math.min(summary.escalasIncompletas * 5, 20);
  if (summary.contratosPendentes > 0) score -= Math.min(summary.contratosPendentes * 5, 20);
  if (summary.pagamentosPendentes > 0) score -= Math.min(summary.pagamentosPendentes * 5, 20);
  if (summary.repertoriosAguardandoAcao > 0) score -= Math.min(summary.repertoriosAguardandoAcao * 5, 20);
  return Math.max(score, 0);
}

function computeCompletionRate(summary) {
  if (!summary) return null;
  const bruto = summary.bruto;
  const recebido = summary.recebido;
  if (!bruto || bruto === 0) return null;
  return Math.round((recebido / bruto) * 100);
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-pulse">
        <div className="space-y-2">
          <div className="h-9 w-64 rounded bg-slate-200" />
          <div className="h-5 w-48 rounded bg-slate-200" />
        </div>
        <div className="h-11 w-40 rounded-lg bg-slate-200" />
      </div>

      {/* Primeira Dobra Skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 animate-pulse">
        <div className="h-64 rounded-xl bg-slate-200 lg:col-span-2" />
        <div className="space-y-4">
          <div className="h-[78px] rounded-xl bg-slate-200" />
          <div className="h-[78px] rounded-xl bg-slate-200" />
          <div className="h-[78px] rounded-xl bg-slate-200" />
        </div>
      </div>

      {/* Métricas Skeleton */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-slate-200" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [events, setEvents] = useState([]);
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
        setSummary(null);
      } finally {
        setCarregando(false);
      }
    }

    carregarDashboard();
  }, []);

  if (carregando) {
    return (
      <AdminShell pageTitle="Dashboard" activeItem="dashboard">
        <DashboardSkeleton />
      </AdminShell>
    );
  }

  const healthScore = computeHealthScore(summary);
  const completionRate = computeCompletionRate(summary);
  // eventosMes = events of the current month, shown as "Eventos ativos" in the UI
  const eventosAtivos = summary?.eventosMes ?? null;
  const contratosPendentes = summary?.contratosPendentes ?? null;
  const escalasAbertas = summary?.escalasPendentes ?? null;
  const eventosHoje = events.filter((ev) => isSameDay(ev.event_date)).length;
  const receitaMes = summary?.bruto ?? null;
  // TODO: fetch from musicians/repertoire tables when available
  const totalMusicos = null;
  const totalRepertorios = null;

  const dateLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <AdminShell
      pageTitle="Dashboard"
      activeItem="dashboard"
      mobileSubtitle="Visão executiva compacta"
    >
      <div className="space-y-6">
        {erro ? (
          <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700">
            {erro}
          </div>
        ) : null}

        {/* Hero Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">
              Bem-vindo de volta, Admin
            </h1>
            <p className="mt-1 text-sm capitalize text-slate-600">{dateLabel}</p>
          </div>

          <Link
            href="/eventos/novo"
            className="inline-flex w-full items-center justify-center rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-violet-700 sm:w-auto"
          >
            <PlusIcon className="mr-2 h-5 w-5" />
            Novo Evento
          </Link>
        </div>

        {/* Primeira Dobra */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Card Principal: Saúde da Operação */}
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-violet-800 p-6 text-white lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-200">
                  Saúde da Operação
                </p>
                <div className="text-5xl font-black">
                  {healthScore != null ? `${healthScore}%` : '--'}
                </div>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <ActivityIcon className="h-9 w-9" />
              </div>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-4">
              <div>
                <div className="text-3xl font-bold">
                  {eventosAtivos ?? '--'}
                </div>
                <div className="mt-1 text-xs text-violet-200">Eventos ativos</div>
              </div>
              <div>
                <div className="text-3xl font-bold">
                  {contratosPendentes ?? '--'}
                </div>
                <div className="mt-1 text-xs text-violet-200">Contratos pendentes</div>
              </div>
              <div>
                <div className="text-3xl font-bold">
                  {escalasAbertas ?? '--'}
                </div>
                <div className="mt-1 text-xs text-violet-200">Escalas abertas</div>
              </div>
            </div>

            <div className="border-t border-white/20 pt-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-violet-200">Taxa de conclusão mensal</span>
                <span className="font-semibold">
                  {completionRate != null ? `${completionRate}%` : '--'}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{ width: completionRate != null ? `${completionRate}%` : '0%' }}
                />
              </div>
            </div>
          </div>

          {/* Stack Lateral: 3 cards menores */}
          <div className="flex flex-col gap-3">
            {/* Card: Eventos Hoje */}
            <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition hover:shadow-md">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                <CalendarIcon className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-2xl font-black text-emerald-900">
                  {eventosHoje ?? '--'}
                </div>
                <div className="text-xs font-medium text-emerald-700">
                  Eventos hoje
                </div>
              </div>
            </div>

            {/* Card: Contratos Pendentes */}
            <div className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:shadow-md">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <FileTextIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-2xl font-black text-amber-900">
                  {contratosPendentes ?? '--'}
                </div>
                <div className="text-xs font-medium text-amber-700">
                  Contratos pendentes
                </div>
              </div>
              {contratosPendentes != null && contratosPendentes > 0 && (
                <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  atenção
                </span>
              )}
            </div>

            {/* Card: Automação */}
            <div className="flex items-center gap-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 transition hover:shadow-md">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                <ZapIcon className="h-5 w-5 text-violet-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-2xl font-black text-violet-900">
                  {completionRate != null ? `${completionRate}%` : '--'}
                </div>
                <div className="text-xs font-medium text-violet-700">
                  Taxa de realização
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {/* Músicos */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
              <UsersIcon className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {totalMusicos ?? '--'}
            </div>
            <div className="mt-1 text-xs text-slate-500">Total de músicos</div>
          </div>

          {/* Repertórios */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
              <MusicIcon className="h-4 w-4 text-violet-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {totalRepertorios ?? '--'}
            </div>
            <div className="mt-1 text-xs text-slate-500">Repertórios ativos</div>
          </div>

          {/* Receita do Mês */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
              <DollarSignIcon className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {receitaMes != null
                ? receitaMes.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    maximumFractionDigits: 0,
                  })
                : '--'}
            </div>
            <div className="mt-1 text-xs text-slate-500">Receita do mês</div>
          </div>

          {/* Escalas Abertas */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
              <TrendingUpIcon className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {escalasAbertas ?? '--'}
            </div>
            <div className="mt-1 text-xs text-slate-500">Escalas abertas</div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
