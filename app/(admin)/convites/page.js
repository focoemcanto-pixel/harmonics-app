'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import AdminPageHero from '@/components/admin/AdminPageHero';
import AdminSectionTitle from '@/components/admin/AdminSectionTitle';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';
import { supabase } from '@/lib/supabase';
import { formatDateBR, formatPhoneDisplay } from '@/lib/eventos/eventos-format';
import { EVENT_FILTERS, buildEventInviteGroups, isWithinDays } from '@/lib/invites/event-invite-summary';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';
import BulkActionBar from '@/components/ui/BulkActionBar';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useBulkDelete } from '@/hooks/useBulkDelete';


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
    <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${getToneClasses(tone)}`}>
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
    <div className={`rounded-[22px] border px-4 py-4 shadow-[0_8px_20px_rgba(17,24,39,0.04)] ${tones[feedback.type] || tones.info}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[12px] font-black uppercase tracking-[0.08em] opacity-80">{feedback.title || 'Atualização'}</div>
          <div className="mt-2 text-[14px] font-semibold leading-6">{feedback.message}</div>
        </div>

        <button type="button" onClick={onClose} className="rounded-[14px] bg-white/80 px-3 py-2 text-[12px] font-black text-[#0f172a]">
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
  const [filtroEvento, setFiltroEvento] = useState('todos');
  const [expandedEvents, setExpandedEvents] = useState({});
  const [deleteDialog, setDeleteDialog] = useState({ open: false, inviteId: null });
  const [sendingInviteIds, setSendingInviteIds] = useState([]);
  const [sendingEventIds, setSendingEventIds] = useState([]);

  const { selectedIds, selectedSet, clear, toggle, toggleAll } = useMultiSelect();
  const { loading: deleting, run: runBulkDelete } = useBulkDelete();

  async function carregarTudo() {
  const [convitesRes, eventsRes, contactsRes] = await Promise.all([
    fetch('/api/event-musicians'),
    fetch('/api/events?scope=events'),
    fetch('/api/contacts'),
  ]);

  const convitesJson = await convitesRes.json();
  const eventsJson = await eventsRes.json();
  const contactsJson = await contactsRes.json();

  if (!convitesJson?.ok) throw new Error(convitesJson?.message);
  if (!eventsJson?.ok) throw new Error(eventsJson?.message);
  if (!contactsJson?.ok) throw new Error(contactsJson?.message);

  setConvites(convitesJson.data || []);
  setEvents(eventsJson.events || []);
  setContacts(contactsJson.data || []);
}

  useEffect(() => {
    async function init() {
      try {
        setCarregando(true);
        await carregarTudo();
      } catch (error) {
        console.error('Erro ao carregar convites:', error);
        setFeedback({ type: 'error', title: 'Erro ao carregar módulo', message: 'Não foi possível carregar os convites agora.' });
      } finally {
        setCarregando(false);
      }
    }

    init();
  }, []);

  const { enrichedInvites: convitesEnriquecidos, groupedEvents: eventosAgrupados } = useMemo(
    () => buildEventInviteGroups({ invites: convites, events, contacts }),
    [convites, events, contacts]
  );

  const eventosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return eventosAgrupados.filter((item) => {
      const matchBusca =
        !termo ||
        [item.event.client_name, item.event.location_name, item.event.event_type, item.event.formation, ...item.invites.map((invite) => invite.contact?.name), ...item.invites.map((invite) => invite.role)]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(termo));

      const matchFiltro =
        filtroEvento === 'todos' ||
        (filtroEvento === 'acao' && item.statusGeral.label !== 'Escala fechada') ||
        (filtroEvento === 'proximos7' && isWithinDays(item.event?.event_date, 7)) ||
        (filtroEvento === 'pendentes' && item.pendentes > 0) ||
        (filtroEvento === 'recusas' && item.recusados > 0) ||
        (filtroEvento === 'fechados' && item.statusGeral.label === 'Escala fechada');

      return matchBusca && matchFiltro;
    });
  }, [eventosAgrupados, busca, filtroEvento]);

  const resumo = useMemo(() => {
    const eventosAtivos = eventosAgrupados.length;
    const eventosPendencia = eventosAgrupados.filter((item) => item.statusGeral.label !== 'Escala fechada').length;
    const convitesPendentes = eventosAgrupados.reduce((acc, item) => acc + item.pendentes, 0);
    const convitesRecusados = eventosAgrupados.reduce((acc, item) => acc + item.recusados, 0);
    const eventosRisco = eventosAgrupados.filter((item) => item.emRisco).length;

    return {
      eventosAtivos,
      eventosPendencia,
      convitesPendentes,
      convitesRecusados,
      eventosRisco,
    };
  }, [eventosAgrupados]);

  async function reenviarConvite(inviteId) {
    try {
      if (!inviteId) {
        throw new Error('Convite ainda não sincronizado para envio.');
      }

      setSendingInviteIds((prev) => [...prev, String(inviteId)]);
      const response = await fetch('/api/whatsapp/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      });

      if (!response.ok) throw new Error('Falha no reenvio do convite');

      setFeedback({ type: 'success', title: 'Convite reenviado', message: 'Convite reenviado com sucesso para o músico.' });
    } catch (error) {
      setFeedback({ type: 'error', title: 'Falha no reenvio', message: error?.message || 'Não foi possível reenviar o convite.' });
    } finally {
      setSendingInviteIds((prev) => prev.filter((item) => item !== String(inviteId)));
    }
  }

  async function reenviarPendentesDoEvento(group) {
    try {
      setSendingEventIds((prev) => [...prev, String(group.eventId)]);
      const pendentes = group.invites.filter((invite) => invite.statusKey === 'pendente' && invite.invite_id);

      if (pendentes.length === 0) {
        throw new Error('Nenhum convite pendente sincronizado para reenvio.');
      }

      await Promise.all(
        pendentes.map((invite) =>
          fetch('/api/whatsapp/send-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inviteId: invite.invite_id }),
          })
        )
      );

      setFeedback({
        type: 'success',
        title: 'Pendentes reenviados',
        message: `${pendentes.length} convite(s) pendente(s) reenviado(s) para o evento.`,
      });
    } catch (error) {
      setFeedback({ type: 'error', title: 'Falha no reenvio em lote', message: error?.message || 'Não foi possível reenviar os pendentes.' });
    } finally {
      setSendingEventIds((prev) => prev.filter((item) => item !== String(group.eventId)));
    }
  }

  async function deleteSelectedInvites(ids) {
    const res = await runBulkDelete({ endpoint: '/api/invites/delete-many', idsKey: 'inviteIds', ids });

    if (!res?.success) {
      setFeedback({ type: 'error', title: 'Erro ao excluir convites', message: res?.message || 'Erro na operação' });
      return;
    }

    const deletedIds = (res.ids || []).map((id) => String(id));
    setConvites((prev) => prev.filter((item) => !deletedIds.includes(String(item.id))));
    clear();
    setFeedback({ type: 'success', title: 'Convites excluídos', message: res.message || `${res.affected || 0} itens processados` });
  }

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
          subtitle="Visão operacional por evento para acompanhar cobertura, respostas e risco de escala com leitura rápida."
        />

        {feedback ? <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} /> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <AdminSummaryCard label="Eventos com convites ativos" value={String(resumo.eventosAtivos)} helper="Eventos agrupados na operação" size="highlight" />
          <AdminSummaryCard label="Eventos com pendência" value={String(resumo.eventosPendencia)} helper="Precisam de ação" tone="warning" size="highlight" />
          <AdminSummaryCard label="Convites pendentes" value={String(resumo.convitesPendentes)} helper="Ainda sem resposta" tone="warning" size="highlight" />
          <AdminSummaryCard label="Convites recusados" value={String(resumo.convitesRecusados)} helper="Demandam substituição" tone="default" size="highlight" />
          <AdminSummaryCard label="Eventos em risco" value={String(resumo.eventosRisco)} helper="Data próxima + cobertura incompleta" tone="danger" size="highlight" />
        </div>

        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <AdminSectionTitle
            title="Convites por evento"
            subtitle="Cada card representa um evento. Expanda para acessar os convites individuais e executar ações rápidas."
          />

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_2fr]">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por evento, local, músico ou função..."
              className="rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-semibold text-[#0f172a] outline-none"
            />

            <div className="flex flex-wrap gap-2">
              {EVENT_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setFiltroEvento(filter.key)}
                  className={`rounded-full px-4 py-2 text-[12px] font-black uppercase tracking-[0.06em] transition ${
                    filtroEvento === filter.key
                      ? 'bg-violet-600 text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]'
                      : 'border border-[#dbe3ef] bg-white text-[#334155]'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {eventosFiltrados.length === 0 ? (
              <div className="rounded-[20px] bg-[#f8fafc] px-5 py-5 text-[14px] font-semibold text-[#64748b]">Nenhum evento encontrado com esse filtro.</div>
            ) : (
              eventosFiltrados.map((group) => {
                const isExpanded = Boolean(expandedEvents[group.eventId]);
                const sendingEvent = sendingEventIds.includes(String(group.eventId));

                return (
                  <div key={group.eventId} className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.04)]">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="text-[20px] font-black tracking-[-0.03em] text-[#0f172a]">{group.event.client_name || 'Evento sem cliente'}</div>
                        <div className="mt-1 text-[14px] font-semibold text-[#64748b]">
                          {group.event.event_type || 'Evento'} • {formatDateBR(group.event.event_date)} {group.event.event_time ? `• ${group.event.event_time}` : ''} • {group.event.location_name || 'Local não informado'}
                        </div>
                        <div className="mt-1 text-[13px] font-semibold text-[#475569]">Formação: {group.event.formation || 'Não informada'}</div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <InvitePill tone={group.statusGeral.tone}>{group.statusGeral.label}</InvitePill>
                          {isWithinDays(group.event?.event_date, 7) ? <InvitePill tone="blue">Próximos 7 dias</InvitePill> : null}
                          {group.coberturaFaltando ? <InvitePill tone="violet">Cobertura faltando</InvitePill> : <InvitePill tone="emerald">Cobertura completa</InvitePill>}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 text-[12px] font-black uppercase tracking-[0.06em] text-[#334155]">
                          <InvitePill tone="slate">Enviados: {group.total}</InvitePill>
                          <InvitePill tone="emerald">Confirmados: {group.confirmados}</InvitePill>
                          <InvitePill tone="amber">Pendentes: {group.pendentes}</InvitePill>
                          <InvitePill tone="red">Recusados: {group.recusados}</InvitePill>
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 xl:w-[280px]">
                        <Link href={`/escalas?event=${group.eventId}`} className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-center text-[14px] font-black text-[#0f172a]">
                          Ir para Escala
                        </Link>
                        <Link href={`/eventos?event=${group.eventId}`} className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-center text-[14px] font-black text-[#0f172a]">
                          Abrir Evento
                        </Link>
                        <button
                          type="button"
                          disabled={group.pendentes === 0 || sendingEvent}
                          onClick={() => reenviarPendentesDoEvento(group)}
                          className="rounded-[16px] border border-sky-200 bg-sky-50 px-4 py-3 text-[14px] font-black text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {sendingEvent ? 'Reenviando pendentes...' : `Reenviar pendentes (${group.pendentes})`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedEvents((prev) => ({ ...prev, [group.eventId]: !isExpanded }))}
                          className="rounded-[16px] border border-[#dbe3ef] bg-[#f8fafc] px-4 py-3 text-[14px] font-black text-[#0f172a]"
                        >
                          {isExpanded ? 'Ocultar convites' : `Ver todos os convites (${group.total})`}
                        </button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="mt-5 space-y-3 border-t border-[#e2e8f0] pt-4">
                        {group.invites.map((invite) => {
                          const sendingInvite = sendingInviteIds.includes(String(invite.invite_id || invite.id));

                          return (
                            <div key={invite.id} className="rounded-[18px] border border-[#e2e8f0] bg-[#f8fafc] px-4 py-4">
                              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0">
                                  <label className="inline-flex items-center gap-2 text-[12px] font-black text-[#0f172a]">
                                    <input type="checkbox" checked={selectedSet.has(String(invite.id))} onChange={() => toggle(invite.id)} />
                                    Selecionar
                                  </label>
                                  <div className="mt-1 text-[16px] font-black text-[#0f172a]">{invite.contact?.name || 'Músico não identificado'}</div>
                                  <div className="mt-1 text-[13px] font-semibold text-[#64748b]">{invite.role || 'Função não informada'} • {invite.statusLabel}</div>
                                  <div className="mt-2 text-[13px] font-semibold leading-6 text-[#64748b]">
                                    <div><strong>Email:</strong> {invite.contact?.email || '-'}</div>
                                    <div><strong>Telefone:</strong> {formatPhoneDisplay(invite.contact?.phone || '') || '-'}</div>
                                    <div><strong>Enviado em:</strong> {invite.invite_whatsapp_sent_at ? new Date(invite.invite_whatsapp_sent_at).toLocaleDateString('pt-BR') : invite.created_at ? new Date(invite.created_at).toLocaleDateString('pt-BR') : '-'}</div>
                                    <div><strong>Confirmado em:</strong> {invite.confirmed_at ? new Date(invite.confirmed_at).toLocaleDateString('pt-BR') : '-'}</div>
                                  </div>
                                </div>

                                <div className="flex w-full flex-wrap gap-2 xl:w-[360px] xl:justify-end">
                                  <button
                                    type="button"
                                    disabled={sendingInvite || !invite.invite_id}
                                    onClick={() => reenviarConvite(invite.invite_id)}
                                    className="rounded-[14px] border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] font-black text-sky-700 disabled:opacity-70"
                                  >
                                    {sendingInvite ? 'Reenviando...' : invite.invite_id ? 'Reenviar' : 'Não sincronizado'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteDialog({ open: true, inviteId: invite.id })}
                                    className="rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-black text-red-700"
                                  >
                                    Remover
                                  </button>
                                  <a
                                    href={invite.contact?.phone ? `tel:${invite.contact.phone}` : '#'}
                                    className="rounded-[14px] border border-[#dbe3ef] bg-white px-3 py-2 text-[12px] font-black text-[#0f172a]"
                                  >
                                    Abrir contato
                                  </a>
                                  <Link
                                    href={`/escalas?event=${group.eventId}`}
                                    className="rounded-[14px] border border-[#dbe3ef] bg-white px-3 py-2 text-[12px] font-black text-[#0f172a]"
                                  >
                                    Trocar músico
                                  </Link>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {convitesEnriquecidos.length > 0 ? (
          <label className="inline-flex items-center gap-2 text-[12px] font-black text-[#0f172a]">
            <input type="checkbox" onChange={() => toggleAll(convitesEnriquecidos.map((item) => item.id))} />
            Selecionar todos os convites carregados
          </label>
        ) : null}
      </div>

      <BulkActionBar
        selectedCount={selectedIds.length}
        label="convites"
        deleting={deleting}
        onClear={clear}
        onDelete={() => setDeleteDialog({ open: true, inviteId: null })}
      />

      <DeleteConfirmModal
        open={deleteDialog.open}
        loading={deleting}
        title={deleteDialog.inviteId ? 'Excluir este convite selecionado?' : `Excluir ${selectedIds.length} convites selecionados?`}
        description="Somente os convites escolhidos serão removidos."
        onCancel={() => setDeleteDialog({ open: false, inviteId: null })}
        onConfirm={() =>
          deleteSelectedInvites(deleteDialog.inviteId ? [deleteDialog.inviteId] : selectedIds).finally(() =>
            setDeleteDialog({ open: false, inviteId: null })
          )
        }
      />
    </AdminShell>
  );
}
