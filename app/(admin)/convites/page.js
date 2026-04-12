'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import AdminPageHero from '@/components/admin/AdminPageHero';
import AdminSectionTitle from '@/components/admin/AdminSectionTitle';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';
import { supabase } from '@/lib/supabase';
import { formatDateBR, formatPhoneDisplay } from '@/lib/eventos/eventos-format';

function normalizeInviteStatus(status) {
  const s = String(status || '').trim().toLowerCase();

  if (s === 'confirmed' || s === 'confirmado') return 'Confirmado';
  if (s === 'declined' || s === 'recusado') return 'Recusado';
  if (s === 'pending' || s === 'pendente') return 'Pendente';

  return status || 'Pendente';
}

function getInviteTone(status) {
  const s = String(status || '').trim().toLowerCase();

  if (s === 'confirmado') return 'emerald';
  if (s === 'recusado') return 'red';
  if (s === 'pendente') return 'amber';

  return 'slate';
}

function getToneClasses(tone) {
  switch (tone) {
    case 'emerald':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'amber':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'red':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'violet':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'blue':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function InvitePill({ tone = 'slate', children }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${getToneClasses(
        tone
      )}`}
    >
      {children}
    </span>
  );
}

function FeedbackBanner({ feedback, onClose }) {
  if (!feedback) return null;

  const tones = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
  };

  return (
    <div
      className={`rounded-[22px] border px-4 py-4 shadow-[0_8px_20px_rgba(17,24,39,0.04)] ${tones[feedback.type] || tones.info}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[12px] font-black uppercase tracking-[0.08em] opacity-80">
            {feedback.title || 'Atualização'}
          </div>
          <div className="mt-2 text-[14px] font-semibold leading-6">
            {feedback.message}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-[14px] bg-white/80 px-3 py-2 text-[12px] font-black text-[#0f172a]"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

export default function ConvitesPage() {
  const [convites, setConvites] = useState([]);
  const [events, setEvents] = useState([]);
  const [contacts, setContacts] = useState([]);

  const [carregando, setCarregando] = useState(true);
  const [feedback, setFeedback] = useState(null);

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [somenteProximos, setSomenteProximos] = useState(false);

  async function carregarTudo() {
    const [convitesRes, eventsRes, contactsRes] = await Promise.all([
      supabase
        .from('event_musicians')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true }),
      supabase
        .from('contacts')
        .select('id, name, email, phone'),
    ]);

    if (convitesRes.error) throw convitesRes.error;
    if (eventsRes.error) throw eventsRes.error;
    if (contactsRes.error) throw contactsRes.error;

    setConvites(convitesRes.data || []);
    setEvents(eventsRes.data || []);
    setContacts(contactsRes.data || []);
  }

  useEffect(() => {
    async function init() {
      try {
        setCarregando(true);
        await carregarTudo();
      } catch (error) {
        console.error('Erro ao carregar convites:', error);
        setFeedback({
          type: 'error',
          title: 'Erro ao carregar módulo',
          message: 'Não foi possível carregar os convites agora.',
        });
      } finally {
        setCarregando(false);
      }
    }

    init();
  }, []);

  function isUpcomingEvent(dateStr, days = 15) {
    if (!dateStr) return false;

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const target = new Date(`${dateStr}T00:00:00`);
    const diff = (target - start) / (1000 * 60 * 60 * 24);

    return diff >= 0 && diff <= days;
  }

  const convitesEnriquecidos = useMemo(() => {
    return convites
      .map((invite) => {
        const event = events.find((ev) => String(ev.id) === String(invite.event_id));
        const contact = contacts.find((ct) => String(ct.id) === String(invite.musician_id));

        if (!event) return null;

        const statusLabel = normalizeInviteStatus(invite.status);

        return {
          ...invite,
          event,
          contact,
          statusLabel,
        };
      })
      .filter(Boolean);
  }, [convites, events, contacts]);

  const convitesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return convitesEnriquecidos.filter((item) => {
      const matchBusca =
        !termo ||
        [
          item.event.client_name,
          item.event.location_name,
          item.event.event_type,
          item.role,
          item.contact?.name,
          item.contact?.email,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(termo));

      const matchStatus =
        statusFiltro === 'todos' ||
        String(item.statusLabel).toLowerCase() === statusFiltro;

      const matchProximos =
        !somenteProximos || isUpcomingEvent(item.event.event_date, 15);

      return matchBusca && matchStatus && matchProximos;
    });
  }, [convitesEnriquecidos, busca, statusFiltro, somenteProximos]);

  const resumo = useMemo(() => {
    const total = convitesEnriquecidos.length;
    const pendentes = convitesEnriquecidos.filter(
      (item) => item.statusLabel === 'Pendente'
    ).length;
    const confirmados = convitesEnriquecidos.filter(
      (item) => item.statusLabel === 'Confirmado'
    ).length;
    const recusados = convitesEnriquecidos.filter(
      (item) => item.statusLabel === 'Recusado'
    ).length;

    return { total, pendentes, confirmados, recusados };
  }, [convitesEnriquecidos]);

  if (carregando) {
    return (
      <AdminShell pageTitle="Convites" activeItem="convites">
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <p className="text-center text-[#64748b]">Carregando convites...</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell pageTitle="Convites" activeItem="convites">
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Convites"
          subtitle="Gerencie convites enviados para músicos, acompanhe confirmações, recusas e o status operacional por evento."
        />

        {feedback ? (
          <FeedbackBanner
            feedback={feedback}
            onClose={() => setFeedback(null)}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminSummaryCard
            label="Convites"
            value={String(resumo.total)}
            helper="Total de vínculos de convite"
            size="highlight"
          />
          <AdminSummaryCard
            label="Pendentes"
            value={String(resumo.pendentes)}
            helper="Aguardando resposta"
            tone="warning"
            size="highlight"
          />
          <AdminSummaryCard
            label="Confirmados"
            value={String(resumo.confirmados)}
            helper="Músicos já confirmados"
            tone="success"
            size="highlight"
          />
          <AdminSummaryCard
            label="Recusados"
            value={String(resumo.recusados)}
            helper="Convites recusados"
            tone="default"
            size="highlight"
          />
        </div>

        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <AdminSectionTitle
            title="Convites operacionais"
            subtitle="Filtre por status, acompanhe a resposta dos músicos e identifique rapidamente onde a escala ainda não fechou."
          />

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por evento, músico, local, função..."
              className="rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-semibold text-[#0f172a] outline-none"
            />

            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-semibold text-[#0f172a] outline-none"
            >
              <option value="todos">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="confirmado">Confirmado</option>
              <option value="recusado">Recusado</option>
            </select>

            <button
              type="button"
              onClick={() => setSomenteProximos((prev) => !prev)}
              className={`rounded-[18px] px-4 py-3 text-[14px] font-black transition ${
                somenteProximos
                  ? 'bg-violet-600 text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]'
                  : 'border border-[#dbe3ef] bg-white text-[#0f172a]'
              }`}
            >
              {somenteProximos ? 'Mostrando próximos 15 dias' : 'Filtrar próximos 15 dias'}
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {convitesFiltrados.length === 0 ? (
              <div className="rounded-[20px] bg-[#f8fafc] px-5 py-5 text-[14px] font-semibold text-[#64748b]">
                Nenhum convite encontrado com esse filtro.
              </div>
            ) : (
              convitesFiltrados.map((item) => {
                const tone = getInviteTone(item.statusLabel);

                return (
                  <div
                    key={item.id}
                    className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.04)]"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="text-[20px] font-black tracking-[-0.03em] text-[#0f172a]">
                          {item.event.client_name || 'Evento sem cliente'}
                        </div>

                        <div className="mt-1 text-[14px] font-semibold text-[#64748b]">
                          {item.event.event_type || 'Evento'} • {formatDateBR(item.event.event_date)} • {item.event.location_name || 'Local não informado'}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <InvitePill tone={tone}>
                            {item.statusLabel}
                          </InvitePill>

                          <InvitePill tone="slate">
                            {item.role || 'Função não informada'}
                          </InvitePill>

                          <InvitePill tone={isUpcomingEvent(item.event.event_date, 15) ? 'blue' : 'slate'}>
                            {isUpcomingEvent(item.event.event_date, 15)
                              ? 'Próximo evento'
                              : 'Fora da janela imediata'}
                          </InvitePill>
                        </div>

                        <div className="mt-4 text-[13px] font-semibold leading-6 text-[#64748b]">
                          <div>
                            <strong>Músico:</strong> {item.contact?.name || 'Não encontrado'}
                          </div>
                          <div>
                            <strong>Email:</strong> {item.contact?.email || '-'}
                          </div>
                          <div>
                            <strong>Telefone:</strong> {formatPhoneDisplay(item.contact?.phone || '') || '-'}
                          </div>
                          <div>
                            <strong>Confirmado em:</strong>{' '}
                            {item.confirmed_at
                              ? new Date(item.confirmed_at).toLocaleDateString('pt-BR')
                              : '-'}
                          </div>
                        </div>

                        {item.notes ? (
                          <div className="mt-3 text-[14px] text-[#475569]">
                            {item.notes}
                          </div>
                        ) : null}
                      </div>

                      <div className="w-full rounded-[18px] border border-[#e8edf5] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#475569] xl:w-[260px]">
                        <div>
                          <strong>Evento:</strong> {item.event.formation || 'Sem formação'}
                        </div>
                        <div className="mt-1">
                          <strong>Hora:</strong> {item.event.event_time || '-'}
                        </div>
                        <div className="mt-1">
                          <strong>Status do evento:</strong> {item.event.status || 'Rascunho'}
                        </div>
                        <div className="mt-1">
                          <strong>Atualizado em:</strong>{' '}
                          {item.updated_at
                            ? new Date(item.updated_at).toLocaleDateString('pt-BR')
                            : '-'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href="/escalas"
                        className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
                      >
                        Ir para escalas
                      </Link>

                      <Link
                        href="/eventos"
                        className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
                      >
                        Ir para eventos
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
