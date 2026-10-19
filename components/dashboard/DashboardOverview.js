'use client';

import Link from 'next/link';
import { ArrowUpRight, CalendarCheck2, FileClock, Music2, Plus, Users, Wallet } from 'lucide-react';

const UNAVAILABLE = '—';

function formatCount(value) {
  return Number.isFinite(value) ? String(value) : UNAVAILABLE;
}

function formatMoneyCompact(value) {
  if (!Number.isFinite(value)) return UNAVAILABLE;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function todayLabel() {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function DashboardHeader({ firstName }) {
  return (
    <div className="flex flex-col gap-4 pt-1 md:flex-row md:items-end md:justify-between md:pt-2">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-[var(--hx-text)] md:text-[34px]">
          {firstName ? `Olá, ${firstName}` : 'Bem-vindo de volta'}
        </h1>
        <p className="mt-1 text-[14px] text-[var(--hx-text-2)] first-letter:uppercase md:text-[15px]">
          Resumo do mês atual · {todayLabel()}
        </p>
      </div>
      <Link
        href="/pre-contratos"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--hx-ink)] px-5 text-[14px] font-semibold text-white transition hover:bg-black md:w-auto"
      >
        <Plus size={17} aria-hidden="true" />
        Novo pré-contrato
      </Link>
    </div>
  );
}

function StatTile({ href, icon: Icon, label, value, helper, attention = false }) {
  return (
    <Link
      href={href}
      className="hx-lift group flex min-w-0 flex-col rounded-[20px] border border-[var(--hx-border)] bg-white p-4 shadow-[var(--hx-shadow-sm)] md:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hx-surface-2)] text-[var(--hx-text-2)]">
          <Icon size={17} aria-hidden="true" />
        </span>
        <ArrowUpRight size={16} className="text-[var(--hx-text-3)] opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
      </div>
      <div className="mt-4 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--hx-text)] md:text-[30px]">{value}</div>
      <div className="mt-2 truncate text-[13px] text-[var(--hx-text-2)]">{label}</div>
      {helper ? (
        <div className={`mt-1 truncate text-[12px] ${attention ? 'font-medium text-amber-700' : 'text-[var(--hx-text-3)]'}`}>{helper}</div>
      ) : null}
    </Link>
  );
}

/**
 * Primeira dobra do dashboard: só números reais do workspace. Quando um dado não está
 * disponível (sem eventos no mês, bloco que não carregou), mostra "—" em vez de inventar.
 */
export function DashboardOverview({ summary, healthScore, completionRate, eventosHoje, repertoireCount }) {
  const eventosMes = summary ? summary.eventosMes ?? 0 : null;
  const contratosPendentes = summary ? summary.contratosPendentes ?? 0 : null;
  const escalasPendentes = summary ? summary.escalasPendentes ?? 0 : null;
  const repertoriosAguardando = summary ? summary.repertoriosAguardandoAcao ?? 0 : null;
  const receitaMes = summary ? Number(summary.bruto || 0) : null;

  return (
    <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-12">
      <section className="relative flex flex-col overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#6d28d9_0%,#7c3aed_48%,#a855f7_100%)] p-5 text-white shadow-[0_18px_40px_rgba(109,40,217,0.22)] md:p-7 lg:col-span-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-white/70">Saúde da operação</p>
            <div className="mt-2 text-[48px] font-semibold leading-none tracking-[-0.04em] tabular-nums md:text-[60px]">
              {healthScore === null || healthScore === undefined ? UNAVAILABLE : `${healthScore}%`}
            </div>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-medium backdrop-blur">Mês atual</span>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-white/15 pt-5 lg:mt-auto">
          {[
            ['Eventos no mês', eventosMes],
            ['Contratos pendentes', contratosPendentes],
            ['Escalas abertas', escalasPendentes],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <div className="text-[24px] font-semibold leading-none tabular-nums md:text-[28px]">{formatCount(value)}</div>
              <div className="mt-1.5 text-[12px] leading-4 text-white/70">{label}</div>
            </div>
          ))}
        </div>

        <div className="relative mt-5">
          <div className="mb-2 flex items-center justify-between text-[12px] text-white/75">
            <span>Eventos concluídos no mês</span>
            <span className="font-semibold text-white">{completionRate === null || completionRate === undefined ? 'Sem eventos no mês' : `${completionRate}%`}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${completionRate || 0}%` }} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:col-span-5">
        <StatTile href="/eventos" icon={CalendarCheck2} label="Eventos hoje" value={formatCount(summary ? eventosHoje : null)} helper={eventosHoje > 0 ? 'Na agenda de hoje' : 'Nenhum hoje'} />
        <StatTile href="/contratos" icon={FileClock} label="Contratos pendentes" value={formatCount(contratosPendentes)} helper={contratosPendentes > 0 ? 'Resolver antes dos eventos' : 'Em dia'} attention={contratosPendentes > 0} />
        <StatTile href="/escalas" icon={Users} label="Escalas abertas" value={formatCount(escalasPendentes)} helper={escalasPendentes > 0 ? 'Requer atenção' : 'Equipes completas'} attention={escalasPendentes > 0} />
        <StatTile href="/repertorios" icon={Music2} label="Repertórios aguardando" value={formatCount(repertoriosAguardando)} helper={Number.isFinite(repertoireCount) ? `${repertoireCount} repertório(s) no total` : 'Total indisponível'} />
        <div className="col-span-2">
          <StatTile href="/pagamentos" icon={Wallet} label="Receita contratada do mês" value={formatMoneyCompact(receitaMes)} helper="Eventos com data neste mês" />
        </div>
      </div>
    </div>
  );
}

export function DashboardQuickActions({ actions = [] }) {
  return (
    <section>
      <h2 className="mb-3 text-[17px] font-semibold tracking-[-0.02em] text-[var(--hx-text)]">Ações rápidas</h2>
      <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-4 xl:grid-cols-7 [&::-webkit-scrollbar]:hidden">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            aria-label={action.label}
            className="hx-lift flex min-h-[60px] w-[168px] shrink-0 snap-start items-center gap-3 rounded-[16px] border border-[var(--hx-border)] bg-white px-4 py-3 text-[13px] font-medium text-[var(--hx-text)] shadow-[var(--hx-shadow-sm)] md:w-auto [&_svg]:h-5 [&_svg]:w-5 [&_svg]:text-[var(--hx-text-2)]"
          >
            <span className="shrink-0">{action.icon}</span>
            <span className="min-w-0 leading-tight">{action.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
