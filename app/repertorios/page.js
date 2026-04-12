'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminShell from '../../components/admin/AdminShell';
import AdminPageHero from '../../components/admin/AdminPageHero';
import AdminSectionTitle from '../../components/admin/AdminSectionTitle';
import AdminSummaryCard from '../../components/admin/AdminSummaryCard';
import { supabase } from '../../lib/supabase';
import { formatDateBR } from '../../lib/eventos/eventos-format';

function normalizeStatus(value) {
  return String(value || '').trim().toUpperCase();
}

function formatRepertoireStatus(status, isLocked) {
  const s = normalizeStatus(status);

  if (s === 'NAO_INICIADO') return 'Não iniciado';
  if (s === 'REABERTO') return 'Reaberto';
  if (s === 'AGUARDANDO_REVISAO') return 'Aguardando revisão';
  if (s === 'REVISAO_SOLICITADA' || s === 'REVIEW_REQUESTED') return 'Revisão solicitada';
  if (s === 'EM_EDICAO') return 'Em edição';
  if (s === 'FINALIZADO') return 'Finalizado';
  if (isLocked) return 'Travado';

  return status || 'Em edição';
}

function isReviewRequestedStatus(status) {
  const s = normalizeStatus(status);
  return s === 'AGUARDANDO_REVISAO' || s === 'REVISAO_SOLICITADA' || s === 'REVIEW_REQUESTED';
}

function getRepertoireTone(status, isLocked) {
  const s = normalizeStatus(status);

  if (isReviewRequestedStatus(s)) return 'amber';
  if (s === 'FINALIZADO' || isLocked) return 'emerald';
  if (s === 'REABERTO') return 'violet';
  if (s === 'NAO_INICIADO') return 'slate';

  return 'blue';
}

function getToneClasses(tone) {
  switch (tone) {
    case 'emerald':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'amber':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'violet':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'blue':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function formatContractLabel(rawStatus) {
  const s = String(rawStatus || '').trim().toLowerCase();

  if (!s) return 'Sem contrato';
  if (s === 'signed') return 'Assinado';
  if (s === 'client_filling') return 'Preenchendo';
  if (s === 'link_generated') return 'Link gerado';
  if (s === 'cancelled') return 'Cancelado';

  return 'Pendente';
}

function getContractTone(rawStatus) {
  const s = String(rawStatus || '').trim().toLowerCase();

  if (s === 'signed') return 'emerald';
  if (s === 'client_filling') return 'violet';
  if (s === 'link_generated') return 'blue';
  if (s === 'cancelled') return 'red';

  return 'slate';
}

function isUpcomingEvent(dateStr, days = 15) {
  if (!dateStr) return false;

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${dateStr}T00:00:00`);
  const diff = (target - start) / (1000 * 60 * 60 * 24);

  return diff >= 0 && diff <= days;
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

function RepertoirePill({ tone = 'slate', children }) {
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

export default function RepertoriosPage() {
  const [events, setEvents] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [items, setItems] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [precontracts, setPrecontracts] = useState([]);
  const [contracts, setContracts] = useState([]);

  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [somenteProximos, setSomenteProximos] = useState(false);

  const [feedback, setFeedback] = useState(null);
  const [reabrindoId, setReabrindoId] = useState(null);
  const [resumoAbertoId, setResumoAbertoId] = useState(null);

  async function carregarTudo() {
    const [
      eventsRes,
      configsRes,
      itemsRes,
      tokensRes,
      precontractsRes,
      contractsRes,
    ] = await Promise.all([
      supabase.from('events').select('*'),
      supabase.from('repertoire_config').select('*'),
      supabase.from('repertoire_items').select('*'),
      supabase.from('repertoire_tokens').select('*'),
      supabase.from('precontracts').select('*'),
      supabase.from('contracts').select('*'),
    ]);

    if (eventsRes.error) throw eventsRes.error;
    if (configsRes.error) throw configsRes.error;
    if (itemsRes.error) throw itemsRes.error;
    if (tokensRes.error) throw tokensRes.error;
    if (precontractsRes.error) throw precontractsRes.error;
    if (contractsRes.error) throw contractsRes.error;

    setEvents(eventsRes.data || []);
    setConfigs(configsRes.data || []);
    setItems(itemsRes.data || []);
    setTokens(tokensRes.data || []);
    setPrecontracts(precontractsRes.data || []);
    setContracts(contractsRes.data || []);
  }

  useEffect(() => {
    async function init() {
      try {
        setCarregando(true);
        await carregarTudo();
      } catch (error) {
        console.error('Erro ao carregar repertórios:', error);
        setFeedback({
          type: 'error',
          title: 'Erro ao carregar módulo',
          message: 'Não foi possível carregar os repertórios agora.',
        });
      } finally {
        setCarregando(false);
      }
    }

    init();
  }, []);

  const contractsByEventId = useMemo(() => {
    const map = new Map();

    const contractsByPreId = new Map(
      contracts.map((item) => [String(item.precontract_id), item])
    );

    for (const pre of precontracts) {
      const contract = contractsByPreId.get(String(pre.id));
      const eventId = contract?.event_id || pre?.event_id;
      if (!eventId) continue;

      map.set(String(eventId), {
        status: contract?.status || pre?.status || '',
        link: pre?.public_token ? `/contrato/${pre.public_token}` : '',
      });
    }

    return map;
  }, [precontracts, contracts]);

  const itemsByEventId = useMemo(() => {
    const map = new Map();

    for (const item of items) {
      const key = String(item.event_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }

    for (const [, eventItems] of map) {
      eventItems.sort((a, b) => {
        const sectionA = String(a.section || '');
        const sectionB = String(b.section || '');
        if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);
        return Number(a.item_order || 0) - Number(b.item_order || 0);
      });
    }

    return map;
  }, [items]);

  const repertoireTokenByEventId = useMemo(() => {
    const map = new Map();

    for (const token of tokens) {
      if (!token?.event_id) continue;
      map.set(String(token.event_id), token);
    }

    return map;
  }, [tokens]);

  const repertorios = useMemo(() => {
    const eventsById = new Map(events.map((event) => [String(event.id), event]));

    return configs
      .map((config) => {
        const eventId = String(config.event_id || '').trim();
        if (!eventId) return null;

        const event = eventsById.get(eventId);
        if (!event) return null;

        const repertoireItems = itemsByEventId.get(eventId) || [];
        const fallbackRepertoireToken = repertoireTokenByEventId.get(eventId) || null;
        const contractInfo = contractsByEventId.get(eventId) || null;
        const clientPanelToken = String(config.client_public_token || '').trim();

        return {
          event_id: eventId,
          event,
          config,
          items: repertoireItems,
          client_public_token: clientPanelToken || null,
          fallbackRepertoireToken,
          contractInfo,
        };
      })
      .filter(Boolean);
  }, [configs, events, itemsByEventId, repertoireTokenByEventId, contractsByEventId]);

  const repertoriosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return repertorios.filter((entry) => {
      const statusLabel = formatRepertoireStatus(entry.config.status, entry.config.is_locked);

      const matchBusca =
        !termo ||
        [
          entry.event.client_name,
          entry.event.location_name,
          entry.event.event_type,
          entry.event.formation,
          statusLabel,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(termo));

      const normalizedStatus = normalizeStatus(entry.config.status);

      const matchStatus =
        statusFiltro === 'todos' ||
        (statusFiltro === 'nao_iniciado' && normalizedStatus === 'NAO_INICIADO') ||
        (statusFiltro === 'reaberto' && normalizedStatus === 'REABERTO') ||
        (statusFiltro === 'revisao_solicitada' &&
          isReviewRequestedStatus(normalizedStatus)) ||
        (statusFiltro === 'finalizado' && (normalizedStatus === 'FINALIZADO' || entry.config.is_locked)) ||
        (statusFiltro === 'aberto' && !entry.config.is_locked);

      const matchProximos =
        !somenteProximos || isUpcomingEvent(entry.event.event_date, 15);

      return matchBusca && matchStatus && matchProximos;
    });
  }, [repertorios, busca, statusFiltro, somenteProximos]);

  const resumo = useMemo(() => {
    const total = repertorios.length;
    const aguardando = repertorios.filter((r) => !r.config.is_locked).length;
    const finalizados = repertorios.filter((r) => r.config.is_locked).length;
    const reabertos = repertorios.filter(
      (r) => normalizeStatus(r.config.status) === 'REABERTO'
    ).length;
    const revisoesSolicitadas = repertorios.filter((r) =>
      isReviewRequestedStatus(r.config.status)
    ).length;

    return { total, aguardando, finalizados, reabertos, revisoesSolicitadas };
  }, [repertorios]);

  async function liberarEdicao(entry) {
    try {
      setReabrindoId(entry.config.id);

      const response = await fetch('/api/admin/repertorio/liberar-revisao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: entry.event_id,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Não foi possível liberar revisão.');
      }

      await carregarTudo();

      setFeedback({
        type: 'success',
        title: 'Revisão liberada',
        message: `O repertório de ${entry.event.client_name || 'evento'} foi liberado para edição.`,
      });
    } catch (error) {
      console.error('Erro ao liberar edição:', error);
      setFeedback({
        type: 'error',
        title: 'Erro ao liberar revisão',
        message: 'Não foi possível liberar esta revisão agora.',
      });
    } finally {
      setReabrindoId(null);
    }
  }

  if (carregando) {
    return (
      <AdminShell pageTitle="Repertórios" activeItem="repertorios">
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <p className="text-center text-[#64748b]">Carregando repertórios...</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell pageTitle="Repertórios" activeItem="repertorios">
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Repertórios"
          subtitle="Acompanhe repertórios enviados pelos clientes, organize correções e reabra edições quando necessário."
        />

        {feedback ? (
          <FeedbackBanner
            feedback={feedback}
            onClose={() => setFeedback(null)}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminSummaryCard
            label="Repertórios"
            value={String(resumo.total)}
            helper="Total com configuração criada"
          />
          <AdminSummaryCard
            label="Aguardando ação"
            value={String(resumo.aguardando)}
            helper="Ainda abertos ou reabertos"
            tone="warning"
          />
          <AdminSummaryCard
            label="Finalizados"
            value={String(resumo.finalizados)}
            helper="Travados e concluídos"
            tone="success"
          />
          <AdminSummaryCard
            label="Reabertos"
            value={String(resumo.reabertos)}
            helper="Liberados novamente pelo admin"
            tone="accent"
          />
          <AdminSummaryCard
            label="Revisão solicitada"
            value={String(resumo.revisoesSolicitadas)}
            helper="Clientes aguardando liberação"
            tone="warning"
          />
        </div>

        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <AdminSectionTitle
            title="Fluxo de repertório"
            subtitle="Filtre por status, acompanhe o envio do cliente e aja rapidamente nos repertórios que exigem revisão."
          />

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente, local, tipo..."
              className="rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-semibold text-[#0f172a] outline-none"
            />

            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-semibold text-[#0f172a] outline-none"
            >
              <option value="todos">Todos os status</option>
              <option value="nao_iniciado">Não iniciado</option>
              <option value="aberto">Abertos</option>
              <option value="reaberto">Reabertos</option>
              <option value="revisao_solicitada">Revisão solicitada</option>
              <option value="finalizado">Finalizados</option>
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
            {repertoriosFiltrados.length === 0 ? (
              <div className="rounded-[20px] bg-[#f8fafc] px-5 py-5 text-[14px] font-semibold text-[#64748b]">
                Nenhum repertório encontrado com esse filtro.
              </div>
            ) : (
              repertoriosFiltrados.map((entry) => {
                const statusLabel = formatRepertoireStatus(
                  entry.config.status,
                  entry.config.is_locked
                );
                const statusTone = getRepertoireTone(
                  entry.config.status,
                  entry.config.is_locked
                );
                const contractLabel = formatContractLabel(entry.contractInfo?.status);
                const contractTone = getContractTone(entry.contractInfo?.status);
                const resumoAberto = resumoAbertoId === entry.config.id;
                const hasReviewRequested = isReviewRequestedStatus(entry.config.status);
                const painelToken = entry.client_public_token || '';
                const painelUrl = painelToken
                  ? `/cliente/${painelToken}`
                  : null;

                console.log('[repertorios] card render', {
                  client_name: entry.event.client_name || null,
                  event_id: entry.event_id,
                  client_public_token: entry.client_public_token || null,
                  href: painelUrl,
                });

                return (
                  <div
                    key={`${entry.event_id}-${entry.config.id}`}
                    className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.04)]"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        {hasReviewRequested ? (
                          <div className="mb-3 rounded-[16px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-amber-800">
                            ⚠️ Revisão solicitada • aguardando liberação do admin
                          </div>
                        ) : null}

                        <div className="text-[20px] font-black tracking-[-0.03em] text-[#0f172a]">
                          {entry.event.client_name || 'Evento sem cliente'}
                        </div>

                        <div className="mt-1 text-[14px] font-semibold text-[#64748b]">
                          {entry.event.event_type || 'Evento'} • {formatDateBR(entry.event.event_date)} • {entry.event.location_name || 'Local não informado'}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <RepertoirePill tone={statusTone}>
                            {statusLabel}
                          </RepertoirePill>

                          <RepertoirePill tone={entry.config.is_locked ? 'emerald' : 'amber'}>
                            {entry.config.is_locked ? 'Travado' : 'Editável'}
                          </RepertoirePill>

                          <RepertoirePill tone={contractTone}>
                            {contractLabel}
                          </RepertoirePill>

                          <RepertoirePill tone={painelUrl ? 'blue' : 'slate'}>
                            {painelUrl ? 'Painel ativo' : 'Sem painel'}
                          </RepertoirePill>
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-[#e8edf5] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#475569] xl:min-w-[220px]">
                        <div>
                          <strong>Itens enviados:</strong> {entry.items.length}
                        </div>
                        <div className="mt-1">
                          <strong>Enviado em:</strong>{' '}
                          {entry.config.submitted_at
                            ? new Date(entry.config.submitted_at).toLocaleDateString('pt-BR')
                            : '-'}
                        </div>
                        <div className="mt-1">
                          <strong>Último salvamento:</strong>{' '}
                          {entry.config.last_saved_at
                            ? new Date(entry.config.last_saved_at).toLocaleDateString('pt-BR')
                            : '-'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setResumoAbertoId((prev) =>
                            prev === entry.config.id ? null : entry.config.id
                          )
                        }
                        className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
                      >
                        {resumoAberto ? 'Ocultar resumo' : 'Ver resumo'}
                      </button>

                      {painelUrl ? (
                        <a
                          href={painelUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
                        >
                          Abrir painel do cliente
                        </a>
                      ) : null}

                      {hasReviewRequested ? (
                        <button
                          type="button"
                          onClick={() => liberarEdicao(entry)}
                          disabled={reabrindoId === entry.config.id}
                          className={`rounded-[16px] px-4 py-3 text-[14px] font-black ${
                            reabrindoId === entry.config.id
                              ? 'cursor-not-allowed border border-[#e5e7eb] bg-[#f8fafc] text-[#94a3b8]'
                              : 'bg-violet-600 text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]'
                          }`}
                        >
                          {reabrindoId === entry.config.id ? 'Liberando...' : 'Liberar revisão'}
                        </button>
                      ) : null}
                    </div>

                    {resumoAberto ? (
                      <div className="mt-5 rounded-[20px] border border-[#e8edf5] bg-[#fcfdff] p-4">
                        {entry.items.length === 0 ? (
                          <div className="text-[14px] font-semibold text-[#64748b]">
                            Nenhum item cadastrado neste repertório.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {entry.items.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-[18px] border border-[#eef2f7] bg-white px-4 py-4"
                              >
                                <div className="flex flex-wrap gap-2">
                                  {item.section ? (
                                    <RepertoirePill tone="slate">{item.section}</RepertoirePill>
                                  ) : null}

                                  {item.moment ? (
                                    <RepertoirePill tone="blue">{item.moment}</RepertoirePill>
                                  ) : null}
                                </div>

                                <div className="mt-3 text-[16px] font-black text-[#0f172a]">
                                  {item.song_name || item.label || 'Item sem título'}
                                </div>

                                {item.who_enters ? (
                                  <div className="mt-1 text-[13px] font-semibold text-[#64748b]">
                                    Entrada: {item.who_enters}
                                  </div>
                                ) : null}

                                {item.notes ? (
                                  <div className="mt-2 text-[14px] text-[#475569]">
                                    {item.notes}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
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
