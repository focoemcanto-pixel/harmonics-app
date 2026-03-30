'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdminShell from '../../components/admin/AdminShell';
import AdminPageHero from '../../components/admin/AdminPageHero';
import AdminSegmentTabs from '../../components/admin/AdminSegmentTabs';

function formatDateBR(value) {
  if (!value) return '-';
  const [y, m, d] = String(value).split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : '--:--';
}

function formatDateTimeBR(dateValue, timeValue) {
  return `${formatDateBR(dateValue)} • ${formatTime(timeValue)}`;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function splitCsvLike(value) {
  return String(value || '')
    .split(/[;,/|-]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getContactTagText(contact) {
  const candidates = [
    contact?.tags,
    contact?.tag,
    contact?.role,
    contact?.instrument,
    contact?.instruments,
    contact?.category,
  ];

  const found = candidates.find(Boolean);

  if (Array.isArray(found)) return found.join(', ');
  return String(found || '').trim();
}

function isPastEvent(dateValue) {
  if (!dateValue) return false;
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const eventDate = new Date(`${dateValue}T00:00:00`);
  return eventDate < todayOnly;
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const eventDate = new Date(`${dateValue}T00:00:00`);
  return Math.ceil((eventDate.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24));
}

function isUpcomingWithin(dateValue, days = 15) {
  const diff = daysUntil(dateValue);
  return diff !== null && diff >= 0 && diff <= days;
}

function SummaryCard({ label, value, helper, tone = 'default' }) {
  const tones = {
    default: 'border-[#dbe3ef] bg-white text-[#0f172a]',
    violet: 'border-violet-200 bg-violet-50 text-violet-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
  };

  return (
    <div className={`rounded-[24px] border p-4 ${tones[tone] || tones.default}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.1em] opacity-75">
        {label}
      </div>
      <div className="mt-2 text-[30px] font-black tracking-[-0.04em]">{value}</div>
      {helper ? (
        <div className="mt-1 text-[13px] font-semibold opacity-80">{helper}</div>
      ) : null}
    </div>
  );
}

function SectionCard({ eyebrow, title, subtitle, right, children }) {
  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          {eyebrow ? (
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="mt-1 text-[24px] font-black tracking-[-0.03em] text-[#0f172a] md:text-[28px]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[#64748b]">
              {subtitle}
            </p>
          ) : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function Pill({ children, tone = 'default' }) {
  const tones = {
    default: 'border-[#dbe3ef] bg-[#f8fafc] text-[#475569]',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${tones[tone] || tones.default}`}
    >
      {children}
    </span>
  );
}

function EmptyState({ title, text, actionLabel, actionHref }) {
  return (
    <div className="rounded-[26px] border border-dashed border-[#dbe3ef] bg-[#f8fafc] px-5 py-8 text-center">
      <div className="text-[18px] font-black text-[#0f172a]">{title}</div>
      <p className="mx-auto mt-2 max-w-xl text-[15px] leading-7 text-[#64748b]">
        {text}
      </p>

      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex rounded-[16px] border border-[#dbe3ef] bg-white px-5 py-3 text-[14px] font-black text-[#0f172a] transition hover:bg-[#f8fafc]"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function InviteStatusMeta(status) {
  const value = String(status || 'pending').toLowerCase();

  if (value === 'confirmed') {
    return { label: 'Confirmado', tone: 'emerald' };
  }

  if (value === 'declined') {
    return { label: 'Recusado', tone: 'red' };
  }

  if (value === 'removed') {
    return { label: 'Removido', tone: 'default' };
  }

  if (value === 'sent') {
    return { label: 'Enviado', tone: 'sky' };
  }

  return { label: 'Pendente', tone: 'amber' };
}

function getEventScaleStatus(card) {
  if (card.totalMusicos === 0) {
    return {
      label: 'Sem escala',
      tone: 'default',
      alert: 'Nenhum músico foi escalado ainda.',
    };
  }

  if (card.missingCount > 0) {
    return {
      label: 'Escala incompleta',
      tone: 'red',
      alert:
        card.missingCount === 1
          ? 'Há 1 função sem cobertura.'
          : `Há ${card.missingCount} funções sem cobertura.`,
    };
  }

  if (card.recusados > 0) {
    return {
      label: 'Exige atenção',
      tone: 'red',
      alert:
        card.recusados === 1
          ? 'Houve 1 recusa na equipe.'
          : `Houve ${card.recusados} recusas na equipe.`,
    };
  }

  if (card.pendentes > 0) {
    return {
      label: 'Aguardando confirmações',
      tone: 'amber',
      alert:
        card.pendentes === 1
          ? 'Existe 1 músico pendente.'
          : `Existem ${card.pendentes} músicos pendentes.`,
    };
  }

  return {
    label: 'Escala fechada',
    tone: 'emerald',
    alert: 'Equipe fechada e sem pendências.',
  };
}

function EventScaleCard({ card }) {
  const statusMeta = getEventScaleStatus(card);
  const dangerSoon = card.isUpcomingRisk;
  const progressText =
    card.totalMusicos > 0
      ? `${card.confirmados}/${card.totalMusicos} confirmados`
      : 'Sem equipe montada';

  return (
    <div className="rounded-[26px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] transition hover:shadow-[0_16px_34px_rgba(17,24,39,0.08)] md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={statusMeta.tone}>{statusMeta.label}</Pill>
            {dangerSoon ? <Pill tone="red">Próximo em risco</Pill> : null}
            {card.reservas > 0 ? <Pill tone="sky">{card.reservas} reserva(s)</Pill> : null}
          </div>

          <h3 className="mt-3 text-[22px] font-black tracking-[-0.03em] text-[#0f172a]">
            {card.clientName || 'Evento'}
          </h3>

          <div className="mt-2 text-[15px] font-semibold leading-7 text-[#64748b]">
            {formatDateTimeBR(card.eventDate, card.eventTime)}
            {card.locationName ? ` • ${card.locationName}` : ''}
          </div>

          <div className="mt-2 text-[15px] font-semibold leading-7 text-[#64748b]">
            <span className="font-black text-[#0f172a]">
              {card.formation || 'Sem formação definida'}
            </span>
            {card.instrumentosEsperados.length > 0
              ? ` — ${card.instrumentosEsperados.join(', ')}`
              : ''}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:max-w-[320px] xl:justify-end">
          <Pill>{progressText}</Pill>
          {card.pendentes > 0 ? <Pill tone="amber">{card.pendentes} pendente(s)</Pill> : null}
          {card.recusados > 0 ? <Pill tone="red">{card.recusados} recusa(s)</Pill> : null}
          {card.missingCount > 0 ? <Pill tone="red">{card.missingCount} lacuna(s)</Pill> : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[20px] bg-[#f8fafc] px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Equipe
          </div>
          <div className="mt-2 text-[24px] font-black tracking-[-0.04em] text-[#0f172a]">
            {card.totalMusicos}
          </div>
        </div>

        <div className="rounded-[20px] bg-emerald-50 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-emerald-700">
            Confirmados
          </div>
          <div className="mt-2 text-[24px] font-black tracking-[-0.04em] text-emerald-800">
            {card.confirmados}
          </div>
        </div>

        <div className="rounded-[20px] bg-amber-50 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-amber-700">
            Pendentes
          </div>
          <div className="mt-2 text-[24px] font-black tracking-[-0.04em] text-amber-800">
            {card.pendentes}
          </div>
        </div>

        <div className="rounded-[20px] bg-red-50 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-red-700">
            Cobertura faltando
          </div>
          <div className="mt-2 text-[24px] font-black tracking-[-0.04em] text-red-800">
            {card.missingCount}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[22px] border border-[#e7edf5] bg-[#fafbff] px-4 py-4">
        <div className="text-[12px] font-black uppercase tracking-[0.08em] text-[#64748b]">
          Alerta principal
        </div>
        <div className="mt-2 text-[15px] font-semibold leading-7 text-[#475569]">
          {statusMeta.alert}
          {dangerSoon && card.daysToEvent !== null
            ? ` Faltam ${card.daysToEvent} dia(s) para o evento.`
            : ''}
        </div>

        {card.missing.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {card.missing.map((item) => (
              <Pill key={`${card.eventId}-missing-${item}`} tone="red">
                Falta: {item}
              </Pill>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/eventos/${card.eventId}`}
          className="rounded-[18px] bg-violet-600 px-5 py-3 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
        >
          Abrir evento
        </Link>

        <Link
          href="/eventos"
          className="rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-3 text-[14px] font-black text-[#0f172a]"
        >
          Ir para Eventos
        </Link>
      </div>
    </div>
  );
}

function InviteCard({ invite }) {
  const meta = InviteStatusMeta(invite.status);

  return (
    <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-4 shadow-[0_8px_22px_rgba(17,24,39,0.04)] md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-[18px] font-black text-[#0f172a]">
            {invite.contact?.name || 'Contato'}
          </div>

          <div className="mt-1 text-[14px] font-semibold leading-6 text-[#64748b]">
            {invite.event?.client_name || 'Evento'}
          </div>

          <div className="mt-1 text-[14px] leading-6 text-[#94a3b8]">
            {formatDateTimeBR(invite.event?.event_date, invite.event?.event_time)}
            {invite.event?.location_name ? ` • ${invite.event.location_name}` : ''}
          </div>

          {invite.suggested_role_name ? (
            <div className="mt-3">
              <Pill tone="violet">{invite.suggested_role_name}</Pill>
            </div>
          ) : null}
        </div>

        <Pill tone={meta.tone}>{meta.label}</Pill>
      </div>
    </div>
  );
}

export default function EscalasPage() {
  const [desktopTab, setDesktopTab] = useState('visao');
  const [mobileTab, setMobileTab] = useState('resumo');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [eventos, setEventos] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [invites, setInvites] = useState([]);

  const mobileTabs = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'pendentes', label: 'Pendentes' },
    { key: 'lista', label: 'Lista' },
    { key: 'convites', label: 'Convites' },
  ];

  const desktopTabs = [
    { key: 'visao', label: 'Visão geral' },
    { key: 'pendentes', label: 'Pendentes' },
    { key: 'risco', label: 'Próximas em risco' },
    { key: 'confirmadas', label: 'Confirmadas' },
    { key: 'convites', label: 'Convites' },
  ];

  async function carregarTudo() {
    try {
      setCarregando(true);
      setErro('');

      const [eventosResp, escalasResp, invitesResp] = await Promise.all([
        supabase
          .from('events')
          .select('id, client_name, event_date, event_time, location_name, formation, instruments, status, created_at')
          .order('event_date', { ascending: true }),
        supabase
          .from('event_musicians')
          .select(`
            id,
            event_id,
            musician_id,
            role,
            status,
            notes,
            confirmed_at,
            created_at,
            musician:contacts(id, name, phone, email, tags, tag, role, instrument, instruments, category)
          `)
          .order('created_at', { ascending: true }),
        supabase
          .from('invites')
          .select(`
            id,
            event_id,
            contact_id,
            suggested_role_name,
            status,
            event:events(id, client_name, event_date, event_time, location_name),
            contact:contacts(id, name, phone, email)
          `)
          .order('id', { ascending: false }),
      ]);

      if (eventosResp.error) throw eventosResp.error;
      if (escalasResp.error) throw escalasResp.error;

      if (invitesResp.error) {
        console.warn('Não foi possível carregar invites:', invitesResp.error);
      }

      setEventos(eventosResp.data || []);
      setEscalas(escalasResp.data || []);
      setInvites(invitesResp.data || []);
    } catch (e) {
      console.error('Erro ao carregar painel de escalas:', e);
      setErro(
        e?.message
          ? `Não foi possível carregar o painel de escalas. ${e.message}`
          : 'Não foi possível carregar o painel de escalas.'
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  const eventCards = useMemo(() => {
    const escalasByEventId = new Map();

    escalas.forEach((item) => {
      const key = String(item.event_id);
      if (!escalasByEventId.has(key)) {
        escalasByEventId.set(key, []);
      }
      escalasByEventId.get(key).push(item);
    });

    const cards = eventos
      .filter((event) => !isPastEvent(event.event_date))
      .map((event) => {
        const items = escalasByEventId.get(String(event.id)) || [];
        const instrumentosEsperados = splitCsvLike(event.instruments || event.formation);

        const confirmados = items.filter((item) => item.status === 'confirmed').length;
        const pendentes = items.filter((item) => item.status === 'pending').length;
        const recusados = items.filter((item) => item.status === 'declined').length;
        const reservas = items.filter((item) => item.status === 'backup').length;

        const covered = [];
        const fragile = [];
        const missing = [];

        instrumentosEsperados.forEach((expectedItem) => {
          const normalizedExpected = normalizeText(expectedItem);

          const matches = items.filter((item) => {
            const roleText = normalizeText(item.role);
            const contactTag = normalizeText(getContactTagText(item.musician));
            return (
              (roleText && roleText.includes(normalizedExpected)) ||
              (contactTag && contactTag.includes(normalizedExpected))
            );
          });

          if (matches.some((item) => item.status === 'confirmed')) {
            covered.push(expectedItem);
          } else if (matches.some((item) => item.status === 'pending' || item.status === 'backup')) {
            fragile.push(expectedItem);
          } else {
            missing.push(expectedItem);
          }
        });

        const daysToEvent = daysUntil(event.event_date);
        const isUpcomingRisk =
          isUpcomingWithin(event.event_date, 15) &&
          (pendentes > 0 || recusados > 0 || missing.length > 0 || items.length === 0);

        return {
          eventId: event.id,
          clientName: event.client_name,
          eventDate: event.event_date,
          eventTime: event.event_time,
          locationName: event.location_name,
          formation: event.formation,
          instruments: event.instruments,
          instrumentosEsperados,
          totalMusicos: items.length,
          confirmados,
          pendentes,
          recusados,
          reservas,
          covered,
          fragile,
          missing,
          missingCount: missing.length,
          daysToEvent,
          isUpcomingRisk,
          items,
        };
      });

    return cards.sort((a, b) => {
      const aDate = a.eventDate ? new Date(`${a.eventDate}T${a.eventTime || '00:00:00'}`).getTime() : 0;
      const bDate = b.eventDate ? new Date(`${b.eventDate}T${b.eventTime || '00:00:00'}`).getTime() : 0;
      return aDate - bDate;
    });
  }, [eventos, escalas]);

  const filteredCards = useMemo(() => {
    const termo = normalizeText(busca);

    if (!termo) return eventCards;

    return eventCards.filter((card) => {
      return [
        card.clientName,
        card.locationName,
        card.formation,
        card.instruments,
        ...card.instrumentosEsperados,
      ]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(termo));
    });
  }, [eventCards, busca]);

  const pendentesCards = useMemo(() => {
    return filteredCards.filter(
      (card) =>
        card.totalMusicos === 0 ||
        card.pendentes > 0 ||
        card.recusados > 0 ||
        card.missingCount > 0
    );
  }, [filteredCards]);

  const riscoCards = useMemo(() => {
    return filteredCards.filter((card) => card.isUpcomingRisk);
  }, [filteredCards]);

  const confirmadasCards = useMemo(() => {
    return filteredCards.filter(
      (card) =>
        card.totalMusicos > 0 &&
        card.pendentes === 0 &&
        card.recusados === 0 &&
        card.missingCount === 0
    );
  }, [filteredCards]);

  const invitesFiltrados = useMemo(() => {
    const termo = normalizeText(busca);
    if (!termo) return invites;

    return invites.filter((invite) => {
      return [
        invite.contact?.name,
        invite.contact?.phone,
        invite.contact?.email,
        invite.event?.client_name,
        invite.suggested_role_name,
      ]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(termo));
    });
  }, [invites, busca]);

  const resumo = useMemo(() => {
    const eventosComEscala = eventCards.filter((card) => card.totalMusicos > 0).length;
    const escalasFechadas = eventCards.filter(
      (card) =>
        card.totalMusicos > 0 &&
        card.pendentes === 0 &&
        card.recusados === 0 &&
        card.missingCount === 0
    ).length;
    const eventosPendentes = eventCards.filter(
      (card) =>
        card.totalMusicos === 0 ||
        card.pendentes > 0 ||
        card.recusados > 0 ||
        card.missingCount > 0
    ).length;
    const musicosPendentes = eventCards.reduce((acc, card) => acc + card.pendentes, 0);
    const recusas = eventCards.reduce((acc, card) => acc + card.recusados, 0);
    const proximosEmRisco = eventCards.filter((card) => card.isUpcomingRisk).length;

    return {
      eventosComEscala,
      escalasFechadas,
      eventosPendentes,
      musicosPendentes,
      recusas,
      proximosEmRisco,
    };
  }, [eventCards]);

  function renderCards(cards, emptyTitle, emptyText) {
    if (cards.length === 0) {
      return (
        <EmptyState
          title={emptyTitle}
          text={emptyText}
          actionLabel="Ir para Eventos"
          actionHref="/eventos"
        />
      );
    }

    return (
      <div className="space-y-4">
        {cards.map((card) => (
          <EventScaleCard key={card.eventId} card={card} />
        ))}
      </div>
    );
  }

  function renderConvites() {
    return (
      <SectionCard
        eyebrow="Convites"
        title="Monitor de convites"
        subtitle="Acompanhe a base oficial de convites gerada a partir das escalas do evento."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Convites"
            value={invites.length}
            helper="registros totais"
            tone="default"
          />
          <SummaryCard
            label="Pendentes"
            value={invites.filter((invite) => String(invite.status || 'pending') === 'pending').length}
            helper="aguardando resposta"
            tone="amber"
          />
          <SummaryCard
            label="Confirmados"
            value={invites.filter((invite) => String(invite.status || '') === 'confirmed').length}
            helper="já aceitaram"
            tone="emerald"
          />
          <SummaryCard
            label="Recusados"
            value={invites.filter((invite) => String(invite.status || '') === 'declined').length}
            helper="responderam negativamente"
            tone="red"
          />
        </div>

        <div className="mt-5 space-y-4">
          {invitesFiltrados.length === 0 ? (
            <EmptyState
              title="Sem convites encontrados"
              text="À medida que você salvar escalas nos eventos, os convites sincronizados aparecerão aqui."
              actionLabel="Ir para Eventos"
              actionHref="/eventos"
            />
          ) : (
            invitesFiltrados.map((invite) => (
              <InviteCard key={invite.id} invite={invite} />
            ))
          )}
        </div>
      </SectionCard>
    );
  }

  if (carregando) {
    return (
      <AdminShell pageTitle="Escalas" activeItem="escalas">
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <p className="text-center text-[#64748b]">Carregando painel de escalas...</p>
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
          subtitle="Acompanhe a saúde das equipes, identifique pendências e aja rápido nos eventos que precisam de atenção."
          actions={
            <div className="flex flex-wrap gap-3">
              <Link
                href="/eventos"
                className="rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-4 text-[14px] font-black text-[#0f172a]"
              >
                Ir para Eventos
              </Link>

              <button
                type="button"
                onClick={() => {
                  setDesktopTab('pendentes');
                  setMobileTab('pendentes');
                }}
                className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
              >
                Ver pendências
              </button>
            </div>
          }
        />

        <SectionCard
          eyebrow="Saúde da operação"
          title="Resumo das escalas"
          subtitle="Use este painel para entender rapidamente onde a operação está sólida e onde você precisa agir antes do evento."
          right={
            <div className="w-full md:w-[320px]">
              <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                Buscar evento
              </label>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Cliente, local, formação..."
                className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />
            </div>
          }
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SummaryCard
              label="Eventos com escala"
              value={resumo.eventosComEscala}
              helper="já possuem equipe montada"
              tone="default"
            />
            <SummaryCard
              label="Escalas fechadas"
              value={resumo.escalasFechadas}
              helper="sem pendências ou lacunas"
              tone="emerald"
            />
            <SummaryCard
              label="Eventos pendentes"
              value={resumo.eventosPendentes}
              helper="exigem ação operacional"
              tone="amber"
            />
            <SummaryCard
              label="Músicos pendentes"
              value={resumo.musicosPendentes}
              helper="ainda sem confirmação"
              tone="amber"
            />
            <SummaryCard
              label="Recusas"
              value={resumo.recusas}
              helper="pedem revisão da equipe"
              tone="red"
            />
            <SummaryCard
              label="Próximos em risco"
              value={resumo.proximosEmRisco}
              helper="eventos até 15 dias com problema"
              tone="red"
            />
          </div>
        </SectionCard>

        {erro ? (
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-5 text-[15px] font-bold text-red-700">
            {erro}
          </div>
        ) : null}

        <div className="hidden md:block">
          <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-2 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
            <div className="flex flex-wrap gap-2">
              {desktopTabs.map((tab) => {
                const active = desktopTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setDesktopTab(tab.key)}
                    className={`rounded-[18px] px-4 py-3 text-[14px] font-black transition ${
                      active
                        ? 'bg-violet-600 text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]'
                        : 'bg-[#f8fafc] text-[#475569] hover:bg-[#eef2ff]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="hidden md:block space-y-5">
          {desktopTab === 'visao' && (
            <>
              <SectionCard
                eyebrow="Atenção agora"
                title="Eventos que pedem ação imediata"
                subtitle="Estes são os eventos com pendência, recusa, lacuna ou risco próximo."
              >
                {renderCards(
                  pendentesCards.slice(0, 6),
                  'Tudo sob controle',
                  'Nenhum evento exige ação imediata neste momento.'
                )}
              </SectionCard>

              <SectionCard
                eyebrow="Operação estável"
                title="Escalas fechadas"
                subtitle="Eventos com equipe pronta e sem pendências."
              >
                {renderCards(
                  confirmadasCards.slice(0, 4),
                  'Nenhuma escala fechada ainda',
                  'Quando suas equipes estiverem 100% confirmadas, elas aparecerão aqui.'
                )}
              </SectionCard>
            </>
          )}

          {desktopTab === 'pendentes' && (
            <SectionCard
              eyebrow="Pendências"
              title="Eventos com escala incompleta"
              subtitle="Aqui ficam os eventos que ainda precisam de confirmação, substituição ou cobertura."
            >
              {renderCards(
                pendentesCards,
                'Nenhuma pendência encontrada',
                'No momento, não há eventos com equipe incompleta ou pendências operacionais.'
              )}
            </SectionCard>
          )}

          {desktopTab === 'risco' && (
            <SectionCard
              eyebrow="Próximas em risco"
              title="Eventos até 15 dias com problema"
              subtitle="Priorize estes eventos para não chegar perto da data com equipe indefinida."
            >
              {renderCards(
                riscoCards,
                'Sem risco crítico',
                'Nenhum evento próximo apresenta risco operacional no momento.'
              )}
            </SectionCard>
          )}

          {desktopTab === 'confirmadas' && (
            <SectionCard
              eyebrow="Confirmadas"
              title="Escalas fechadas"
              subtitle="Revise rapidamente os eventos cuja equipe já está pronta."
            >
              {renderCards(
                confirmadasCards,
                'Nenhuma escala fechada',
                'As escalas totalmente resolvidas aparecerão aqui.'
              )}
            </SectionCard>
          )}

          {desktopTab === 'convites' && renderConvites()}
        </div>

        <div className="md:hidden">
          <AdminSegmentTabs
            items={mobileTabs}
            active={mobileTab}
            onChange={setMobileTab}
          />
        </div>

        <div className="space-y-5 md:hidden">
          {mobileTab === 'resumo' && (
            <>
              <SectionCard
                eyebrow="Atenção agora"
                title="Eventos com pendência"
                subtitle="Veja rapidamente onde a operação precisa de intervenção."
              >
                {renderCards(
                  pendentesCards.slice(0, 5),
                  'Tudo sob controle',
                  'Nenhum evento exige ação imediata agora.'
                )}
              </SectionCard>
            </>
          )}

          {mobileTab === 'pendentes' && (
            <SectionCard
              eyebrow="Pendências"
              title="Escalas incompletas"
              subtitle="Eventos que ainda precisam de ação."
            >
              {renderCards(
                pendentesCards,
                'Nenhuma pendência encontrada',
                'No momento, não há eventos com problemas operacionais de escala.'
              )}
            </SectionCard>
          )}

          {mobileTab === 'lista' && (
            <SectionCard
              eyebrow="Lista geral"
              title="Todas as escalas monitoradas"
              subtitle="Acompanhe todos os eventos futuros e a saúde de suas equipes."
            >
              {renderCards(
                filteredCards,
                'Nenhum evento encontrado',
                'Ajuste a busca ou avance em Eventos para começar a montar equipes.'
              )}
            </SectionCard>
          )}

          {mobileTab === 'convites' && renderConvites()}
        </div>
      </div>
    </AdminShell>
  );
}
