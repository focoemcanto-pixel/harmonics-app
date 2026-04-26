'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminShell from '@/components/admin/AdminShell';
import AdminSegmentTabs from '@/components/admin/AdminSegmentTabs';
import EventoEscalaTab from '@/components/eventos/EventoEscalaTab';
import { useAppToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

function formatDateBR(value) {
  if (!value) return '-';
  const [y, m, d] = String(value).split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function normalizeAntesalaStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'pending_admin_validation') return 'pending';
  if (value === 'included') return 'approved';
  if (value === 'approved' || value === 'rejected' || value === 'pending') return value;
  return '';
}

function getAntesalaStatusLabel(status) {
  const normalized = normalizeAntesalaStatus(status);
  if (normalized === 'pending') return 'Solicitada • aguardando confirmação';
  if (normalized === 'approved') return 'Aprovada';
  if (normalized === 'rejected') return 'Rejeitada';
  return 'Aguardando validação';
}

function resolvePaymentStatusFromTotals({ agreedAmount, paidAmount }) {
  const agreed = Number(agreedAmount || 0);
  const paid = Number(paidAmount || 0);
  const open = Math.max(0, agreed - paid);

  if (open <= 0) return 'Pago';
  if (paid > 0) return 'Parcial';
  return 'Pendente';
}

function InfoItem({ label, value, full = false }) {
  return (
    <div className={full ? 'md:col-span-2 min-w-0' : 'min-w-0'}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 break-words">
        {value || '-'}
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone = 'default' }) {
  const toneClasses = {
    default: 'border-slate-200 bg-white text-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return (
    <div className={`rounded-3xl border p-4 md:p-5 ${toneClasses[tone] || toneClasses.default}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold break-words">{value}</p>
    </div>
  );
}

function formatTeamSummary(team) {
  const total = Number(team?.total || 0);
  const confirmed = Number(team?.confirmed || 0);
  const pending = Math.max(0, total - confirmed);
  return {
    total,
    confirmed,
    pending,
  };
}

function getRepertoireStatusLabel(status) {
  const value = String(status || '').trim().toLowerCase();
  if (!value || value === 'pending') return 'Aguardando envio';
  if (value === 'in_review') return 'Em revisão';
  if (value === 'approved') return 'Aprovado';
  if (value === 'rejected') return 'Precisa de ajustes';
  return 'Aguardando envio';
}

export default function EventoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id;

  const [evento, setEvento] = useState(null);
  const [repertoireStatus, setRepertoireStatus] = useState('');
  const [teamMetrics, setTeamMetrics] = useState({ total: 0, confirmed: 0 });
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState(false);
  const [processandoAntesala, setProcessandoAntesala] = useState('');
  const [activeTab, setActiveTab] = useState('resumo');
  const toast = useAppToast();
  const confirm = useConfirm();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'escala') {
      setActiveTab('escala');
      return;
    }
    if (tab === 'financeiro') {
      setActiveTab('financeiro');
      return;
    }
    setActiveTab('resumo');
  }, [searchParams]);

  const backHref = useMemo(() => {
    const params = new URLSearchParams();
    const status = searchParams.get('status');
    const data = searchParams.get('data');
    const busca = searchParams.get('busca');
    const ordem = searchParams.get('ordem');

    if (status) params.set('status', status);
    if (data) params.set('data', data);
    if (busca) params.set('busca', busca);
    if (ordem) params.set('ordem', ordem);

    const query = params.toString();
    return query ? `/eventos?${query}` : '/eventos';
  }, [searchParams]);

  const nextEventHref = useMemo(() => {
    if (!id) return '';

    const listRaw = searchParams.get('lista') || '';
    const ids = listRaw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const currentIndex = ids.findIndex((item) => String(item) === String(id));
    if (currentIndex < 0 || currentIndex >= ids.length - 1) return '';

    const nextId = ids[currentIndex + 1];
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'escala');
    params.set('retorno', 'operacao');

    return `/eventos/${nextId}?${params.toString()}`;
  }, [id, searchParams]);

  useEffect(() => {
    async function carregarEvento() {
      if (!id) return;

      try {
        setCarregando(true);
        const [eventResp, teamResp, repertoireResp] = await Promise.all([
          supabase.from('events').select('*').eq('id', id).single(),
          supabase.from('event_musicians').select('id, status').eq('event_id', id),
          supabase
            .from('repertoire_config')
            .select('status')
            .eq('event_id', id)
            .maybeSingle(),
        ]);

        if (eventResp.error) throw eventResp.error;
        if (teamResp.error) throw teamResp.error;
        if (repertoireResp.error) throw repertoireResp.error;

        setEvento(eventResp.data || null);
        setRepertoireStatus(String(repertoireResp?.data?.status || ''));
        const musicians = teamResp.data || [];
        setTeamMetrics({
          total: musicians.length,
          confirmed: musicians.filter((item) => String(item?.status || '').toLowerCase() === 'confirmed').length,
        });
      } catch (error) {
        console.error('Erro ao carregar detalhe do evento:', error);
      } finally {
        setCarregando(false);
      }
    }

    carregarEvento();
  }, [id]);

  async function excluirEvento() {
    if (!evento?.id) return;
    console.info('[UI][NATIVE_CONFIRM_FOUND]', {
      context: 'admin-evento-detalhe.excluirEvento',
      message: 'Tem certeza que deseja excluir este evento?',
    });
    const confirmed = await confirm?.({
      title: 'Excluir evento',
      description: 'Essa ação remove o evento permanentemente.',
      confirmText: 'Excluir evento',
      cancelText: 'Cancelar',
      tone: 'destructive',
    });
    if (!confirmed) return;

    try {
      setExcluindo(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const response = await fetch(`/api/events/${evento.id}`, {
        method: 'DELETE',
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Erro ao excluir evento.');
      }
      toast.success('Evento excluído com sucesso.');
      router.push('/eventos');
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      toast.error('Erro ao excluir evento.');
    } finally {
      setExcluindo(false);
    }
  }

  async function responderSolicitacaoAntesala(nextStatus) {
    if (!evento?.id || (nextStatus !== 'approved' && nextStatus !== 'rejected')) return;

    try {
      setProcessandoAntesala(nextStatus);

      const payload =
        nextStatus === 'approved'
          ? (() => {
              const currentAgreedAmount = Number(evento?.agreed_amount || 0);
              const currentPaidAmount = Number(evento?.paid_amount || 0);
              const increment = Number(evento?.antesala_price_increment || 0) || 0;
              const shouldApplyIncrement = !Boolean(evento?.has_antesala) && increment > 0;
              const nextAgreedAmount = shouldApplyIncrement
                ? currentAgreedAmount + increment
                : currentAgreedAmount;
              const nextOpenAmount = Math.max(0, nextAgreedAmount - currentPaidAmount);

              return {
                antesala_request_status: 'approved',
                antesala_requested_by_client: false,
                has_antesala: true,
                antesala_enabled: true,
                antesala_duration_minutes: Number(evento?.antesala_duration_minutes || 0) || null,
                antesala_price_increment: increment,
                agreed_amount: nextAgreedAmount,
                open_amount: nextOpenAmount,
                payment_status: resolvePaymentStatusFromTotals({
                  agreedAmount: nextAgreedAmount,
                  paidAmount: currentPaidAmount,
                }),
              };
            })()
          : {
              antesala_request_status: 'rejected',
              antesala_requested_by_client: false,
              has_antesala: false,
              antesala_enabled: false,
            };

      const { data, error } = await supabase
        .from('events')
        .update(payload)
        .eq('id', evento.id)
        .select('*')
        .single();

      if (error) throw error;
      setEvento(data || null);
    } catch (error) {
      console.error('Erro ao responder solicitação de antesala:', error);
      toast.error('Não foi possível atualizar a solicitação de antesala.');
    } finally {
      setProcessandoAntesala('');
    }
  }

  const resumoFinanceiro = useMemo(() => {
    if (!evento) return null;
    return {
      agreed: Number(evento.agreed_amount || 0),
      paid: Number(evento.paid_amount || 0),
      open: Number(evento.open_amount || 0),
      profit: Number(evento.profit_amount || 0),
    };
  }, [evento]);

  const teamSummary = useMemo(() => formatTeamSummary(teamMetrics), [teamMetrics]);

  const attentionItems = useMemo(() => {
    if (!evento) return [];
    const items = [];

    if (teamSummary.total === 0) items.push('Definir escala');
    if (String(repertoireStatus || '').toLowerCase() !== 'approved') {
      items.push('Cliente ainda não enviou repertório');
    }
    if (Number(evento?.open_amount || 0) > 0) items.push('Pagamento pendente');

    return items;
  }, [evento, repertoireStatus, teamSummary.total]);

  const suggestionTitle = useMemo(() => {
    if (!evento) return '-';
    const formation = String(evento.formation || '').trim();
    const instruments = String(evento.instruments || '').trim();
    if (formation && instruments) return `${formation} — ${instruments}`;
    if (formation) return formation;
    if (instruments) return instruments;
    return 'Defina a formação ideal';
  }, [evento]);

  const otherOptions = useMemo(() => {
    const formation = String(evento?.formation || '').trim().toLowerCase();
    if (formation.includes('duo')) {
      return ['Trio — formação mais completa', 'Quarteto — experiência mais rica'];
    }
    if (formation.includes('trio')) {
      return ['Duo — opção mais enxuta', 'Quarteto — experiência mais rica'];
    }
    if (formation.includes('quarteto')) {
      return ['Trio — formação mais objetiva', 'Duo — opção mais enxuta'];
    }
    return ['Trio — formação mais completa', 'Quarteto — experiência mais rica'];
  }, [evento?.formation]);

  const tabs = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'detalhes', label: 'Detalhes' },
    { key: 'financeiro', label: 'Financeiro' },
    { key: 'escala', label: 'Escala' },
  ];

  return (
    <AdminShell pageTitle="Detalhe do evento" activeItem="eventos">
      <div className="space-y-5">
        <header className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Link href={backHref} className="rounded-xl border border-[#dbe3ef] bg-white px-3 py-2 text-xs font-bold text-[#0f172a]">Voltar</Link>
            {evento?.id ? (
              <Link href={`/eventos?edit=${evento.id}`} className="rounded-xl border border-[#dbe3ef] bg-white px-3 py-2 text-xs font-bold text-[#0f172a]">Editar</Link>
            ) : null}
            {evento?.id ? (
              <button type="button" onClick={excluirEvento} disabled={excluindo} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                {excluindo ? 'Excluindo...' : 'Excluir'}
              </button>
            ) : null}
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-black text-slate-900">
              {evento?.client_name || (carregando ? 'Carregando...' : 'Evento não encontrado')}
            </h1>
            <p className="text-sm text-slate-600">
              {evento
                ? `${formatDateBR(evento.event_date)} • ${String(evento.event_time || '--:--').slice(0, 5)}`
                : '-'}
            </p>
            <p className="text-sm text-slate-600">{evento?.location_name || '-'}</p>
          </div>
        </header>

        <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-2 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <AdminSegmentTabs items={tabs} active={activeTab} onChange={setActiveTab} />
        </div>

        {carregando ? (
          <section className="rounded-[24px] border border-[#dbe3ef] bg-white p-6 text-center text-[#64748b]">Carregando evento...</section>
        ) : !evento ? (
          <section className="rounded-[24px] border border-[#dbe3ef] bg-white p-6 text-center text-[#64748b]">Evento não encontrado.</section>
        ) : (
          <>
            {activeTab === 'resumo' && (
              <section className="space-y-4">
                <section className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-4">
                  <h3 className="text-sm font-black text-slate-900">Atenção necessária</h3>
                  {attentionItems.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {attentionItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-emerald-700">Tudo certo para este evento.</p>
                  )}
                </section>

                <section className="rounded-2xl border border-[#dbeafe] bg-[#f8fbff] px-4 py-4">
                  <h3 className="text-base font-black text-slate-900">Sugestão de formação</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{suggestionTitle}</p>
                  <p className="mt-1 text-xs text-slate-500">Recomendado para este evento</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('escala')}
                    className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
                  >
                    Ajustar escala
                  </button>
                </section>

                <section className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-4">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-black text-slate-900">Equipe</p>
                    <p className="text-slate-700">{teamSummary.total} músicos</p>
                  </div>
                  <p className="text-sm text-slate-600">
                    {teamSummary.confirmed} confirmados / {teamSummary.pending} pendentes
                  </p>
                </section>

                <section className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-4">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-black text-slate-900">Financeiro</p>
                    <p className="font-semibold text-amber-700">{formatMoney(evento?.open_amount || 0)} pendente</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('financeiro')}
                    className="rounded-xl border border-[#dbe3ef] bg-white px-3 py-2 text-sm font-bold text-slate-900"
                  >
                    Ver pagamentos
                  </button>
                </section>

                <section className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-4">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-black text-slate-900">Repertório</p>
                    <p className="text-slate-700">{getRepertoireStatusLabel(repertoireStatus)}</p>
                  </div>
                  <Link
                    href="/repertorios"
                    className="inline-flex rounded-xl border border-[#dbe3ef] bg-white px-3 py-2 text-sm font-bold text-slate-900"
                  >
                    Ver repertório
                  </Link>
                </section>

                <section className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-4">
                  <h3 className="text-sm font-black text-slate-900">Outras opções</h3>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {otherOptions.map((option) => (
                      <li key={option}>• {option}</li>
                    ))}
                  </ul>
                </section>

                {evento?.antesala_requested_by_client ? (
                  <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                    <p className="text-sm font-semibold text-amber-700">
                      Solicitação do cliente: {getAntesalaStatusLabel(evento?.antesala_request_status)}
                    </p>
                    {normalizeAntesalaStatus(evento?.antesala_request_status) === 'pending' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => responderSolicitacaoAntesala('approved')}
                          disabled={processandoAntesala !== ''}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                        >
                          {processandoAntesala === 'approved' ? 'Aprovando...' : 'Aprovar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => responderSolicitacaoAntesala('rejected')}
                          disabled={processandoAntesala !== ''}
                          className="rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-black text-red-700 disabled:opacity-60"
                        >
                          {processandoAntesala === 'rejected' ? 'Rejeitando...' : 'Rejeitar'}
                        </button>
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </section>
            )}

            {activeTab === 'detalhes' && (
              <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <InfoItem label="Contratante / Cliente" value={evento.client_name} />
                  <InfoItem label="Tipo do evento" value={evento.event_type} />
                  <InfoItem label="Data" value={formatDateBR(evento.event_date)} />
                  <InfoItem label="Hora" value={String(evento.event_time || '').slice(0, 5)} />
                  <InfoItem label="Local" value={evento.location_name} />
                  <InfoItem label="Formação" value={evento.formation} />
                  <InfoItem label="Instrumentos" value={evento.instruments} />
                  <InfoItem label="WhatsApp" value={evento.whatsapp_phone} />
                  <InfoItem label="Observações" value={evento.observations} full />
                </div>
              </section>
            )}

            {activeTab === 'financeiro' && (
              <section className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Valor acertado" value={formatMoney(resumoFinanceiro?.agreed)} tone="blue" />
                  <MetricCard label="Valor quitado" value={formatMoney(resumoFinanceiro?.paid)} tone="emerald" />
                  <MetricCard label="Saldo em aberto" value={formatMoney(resumoFinanceiro?.open)} tone={resumoFinanceiro?.open > 0 ? 'amber' : 'default'} />
                  <MetricCard label="Lucro estimado" value={formatMoney(resumoFinanceiro?.profit)} tone={resumoFinanceiro?.profit > 0 ? 'default' : 'red'} />
                </div>
              </section>
            )}

            {activeTab === 'escala' && (
              <section id="escala-section" className="rounded-[24px] border border-[#dbe3ef] bg-white p-4 md:p-5">
                <EventoEscalaTab eventId={evento.id} nextEventHref={nextEventHref} />
              </section>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
