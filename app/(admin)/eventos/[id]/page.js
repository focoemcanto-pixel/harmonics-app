'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminShell from '@/components/admin/AdminShell';
import AdminSegmentTabs from '@/components/admin/AdminSegmentTabs';
import ContractSignedPdfButton from '@/components/contracts/ContractSignedPdfButton';
import { useAppToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

function EscalaTabSkeleton() {
  return (
    <section className="space-y-4 rounded-[24px] border border-[#dbe3ef] bg-white p-4 text-[#64748b] md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-2 h-5 w-44 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded-xl bg-slate-100" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <p className="text-center text-sm font-semibold">Carregando escala...</p>
    </section>
  );
}

const EventoEscalaTab = dynamic(() => import('@/components/eventos/EventoEscalaTab'), {
  ssr: false,
  loading: () => <EscalaTabSkeleton />,
});

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

function normalizeTabParam(tab) {
  const value = String(tab || '').trim().toLowerCase();
  if (value === 'detalhes' || value === 'financeiro' || value === 'escala') return value;
  return 'resumo';
}

function resolvePaymentStatusFromTotals({ agreedAmount, paidAmount }) {
  const agreed = Number(agreedAmount || 0);
  const paid = Number(paidAmount || 0);
  const open = Math.max(0, agreed - paid);

  if (open <= 0) return 'Pago';
  if (paid > 0) return 'Parcial';
  return 'Pendente';
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

function getRepertoireStatusLabel(status) {
  const value = String(status || '').trim().toLowerCase();
  if (!value || value === 'pending') return 'Aguardando envio';
  if (value === 'in_review') return 'Em revisão';
  if (value === 'approved') return 'Aprovado';
  if (value === 'rejected') return 'Precisa de ajustes';
  return 'Aguardando envio';
}

function formatTeamSummary(team) {
  const total = Number(team?.total || 0);
  const confirmed = Number(team?.confirmed || 0);
  const pending = Math.max(0, total - confirmed);
  return { total, confirmed, pending };
}

function InfoItem({ label, value, full = false }) {
  return (
    <div className={full ? 'min-w-0 md:col-span-2' : 'min-w-0'}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="break-words rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
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
      <p className="mt-2 break-words text-2xl font-bold">{value}</p>
    </div>
  );
}

function EventoDetalheSkeleton({ message = 'Carregando evento...' }) {
  return (
    <section className="space-y-4 rounded-[24px] border border-[#dbe3ef] bg-white p-5 text-[#64748b]">
      <div className="h-4 w-44 animate-pulse rounded-full bg-slate-200" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <p className="text-center text-sm font-semibold">{message}</p>
    </section>
  );
}

function TabPanel({ active, children, className = '' }) {
  return (
    <section aria-hidden={!active} className={`${active ? 'block animate-[fadeIn_160ms_ease-out]' : 'hidden'} ${className}`}>
      {children}
    </section>
  );
}

export default function EventoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = typeof params?.id === 'string' ? params.id : '';

  const [evento, setEvento] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState(false);
  const [processandoAntesala, setProcessandoAntesala] = useState('');
  const [repertoireStatus, setRepertoireStatus] = useState('');
  const [teamMetrics, setTeamMetrics] = useState({ total: 0, confirmed: 0 });
  const [externalContract, setExternalContract] = useState(null);
  const [uploadingExternalContract, setUploadingExternalContract] = useState(false);
  const [activeTab, setActiveTab] = useState(() => normalizeTabParam(searchParams?.get('tab')));
  const [isPendingTab, startTabTransition] = useTransition();

  const toast = useAppToast();
  const confirm = useConfirm();

  const tabParam = searchParams?.get('tab') || '';

  useEffect(() => {
    const nextTab = normalizeTabParam(tabParam);
    setActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [tabParam]);

  useEffect(() => {
    if (!eventId) {
      setEvento(null);
      setErro('Evento inválido.');
      setCarregando(false);
      return;
    }

    let cancelled = false;

    async function carregarEvento() {
      setCarregando(true);
      setErro('');

      try {
        const [eventResp, teamResp, contractResp, repertoireResp] = await Promise.all([
          supabase.from('events').select('*').eq('id', eventId).single(),
          supabase.from('event_musicians').select('id, status').eq('event_id', eventId),
          supabase
            .from('contracts')
            .select('id, status, signed_at, pdf_url, public_token, raw_payload')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('repertoire_config').select('status').eq('event_id', eventId).maybeSingle(),
        ]);

        if (cancelled) return;
        if (eventResp.error) throw eventResp.error;
        if (teamResp.error) throw teamResp.error;
        if (contractResp.error) throw contractResp.error;
        if (repertoireResp.error) throw repertoireResp.error;

        const musicians = Array.isArray(teamResp.data) ? teamResp.data : [];
        setEvento(eventResp.data || null);
        setExternalContract(contractResp.data || null);
        setRepertoireStatus(String(repertoireResp?.data?.status || ''));
        setTeamMetrics({
          total: musicians.length,
          confirmed: musicians.filter((item) => String(item?.status || '').toLowerCase() === 'confirmed').length,
        });
      } catch (error) {
        console.error('Erro ao carregar detalhe do evento:', error);
        if (!cancelled) {
          setEvento(null);
          setErro(error?.message || 'Não foi possível carregar o evento.');
          toast.error('Não foi possível carregar o evento. Tente novamente.');
        }
      } finally {
        if (!cancelled) setCarregando(false);
      }
    }

    carregarEvento();

    return () => {
      cancelled = true;
    };
  }, [eventId, toast]);

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

  const teamSummary = useMemo(() => formatTeamSummary(teamMetrics), [teamMetrics]);

  const resumoFinanceiro = useMemo(() => {
    if (!evento) return null;
    return {
      agreed: Number(evento.agreed_amount || 0),
      paid: Number(evento.paid_amount || 0),
      open: Number(evento.open_amount || 0),
      profit: Number(evento.profit_amount || 0),
    };
  }, [evento]);

  const attentionItems = useMemo(() => {
    if (!evento) return [];
    const items = [];
    if (teamSummary.total === 0) items.push('Definir escala');
    if (String(repertoireStatus || '').toLowerCase() !== 'approved') items.push('Cliente ainda não enviou repertório');
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
    if (formation.includes('duo')) return ['Trio — formação mais completa', 'Quarteto — experiência mais rica'];
    if (formation.includes('trio')) return ['Duo — opção mais enxuta', 'Quarteto — experiência mais rica'];
    if (formation.includes('quarteto')) return ['Trio — formação mais objetiva', 'Duo — opção mais enxuta'];
    return ['Trio — formação mais completa', 'Quarteto — experiência mais rica'];
  }, [evento?.formation]);

  function handleTabChange(nextTab) {
    startTabTransition(() => setActiveTab(nextTab));
  }

  async function excluirEvento() {
    if (!evento?.id) return;

    const confirmedByDialog = await confirm?.({
      title: 'Excluir evento',
      description: 'Essa ação remove o evento permanentemente.',
      confirmText: 'Excluir evento',
      cancelText: 'Cancelar',
      tone: 'destructive',
    });
    const confirmed = typeof confirmedByDialog === 'boolean'
      ? confirmedByDialog
      : window.confirm('Tem certeza que deseja excluir este evento? Essa ação é definitiva.');
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
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Erro ao excluir evento.');
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
      const payload = nextStatus === 'approved'
        ? (() => {
            const currentAgreedAmount = Number(evento?.agreed_amount || 0);
            const currentPaidAmount = Number(evento?.paid_amount || 0);
            const increment = Number(evento?.antesala_price_increment || 0) || 0;
            const shouldApplyIncrement = !Boolean(evento?.has_antesala) && increment > 0;
            const nextAgreedAmount = shouldApplyIncrement ? currentAgreedAmount + increment : currentAgreedAmount;
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

  async function handleUploadExternalContract(file, shouldReplace = false) {
    if (!evento?.id || !file) return;
    try {
      setUploadingExternalContract(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const form = new FormData();
      form.append('file', file);
      if (shouldReplace) form.append('replace', 'true');

      const response = await fetch(`/api/events/${evento.id}/external-contract`, {
        method: 'POST',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: form,
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Falha ao anexar contrato externo.');
      setExternalContract(payload.contract || null);
      toast.success('Contrato externo anexado com sucesso.');
    } catch (error) {
      toast.error(error?.message || 'Não foi possível anexar o contrato externo.');
    } finally {
      setUploadingExternalContract(false);
    }
  }

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
            <Link href={backHref} className="rounded-xl border border-[#dbe3ef] bg-white px-3 py-2 text-xs font-bold text-[#0f172a] active:scale-[0.98]">Voltar</Link>
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
              {evento ? `${formatDateBR(evento.event_date)} • ${String(evento.event_time || '--:--').slice(0, 5)}` : '-'}
            </p>
            <p className="text-sm text-slate-600">{evento?.location_name || '-'}</p>
          </div>
        </header>

        <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-2 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <AdminSegmentTabs items={tabs} active={activeTab} onChange={handleTabChange} />
        </div>

        {isPendingTab ? <p className="-mt-2 text-xs font-bold text-violet-600">Abrindo aba...</p> : null}

        {carregando ? (
          <EventoDetalheSkeleton />
        ) : erro ? (
          <section className="rounded-[24px] border border-red-200 bg-red-50 p-6 text-center text-red-700">
            <p className="font-bold">Não foi possível carregar o evento.</p>
            <p className="mt-2 text-sm">{erro}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">
              Tentar novamente
            </button>
          </section>
        ) : !evento ? (
          <section className="rounded-[24px] border border-[#dbe3ef] bg-white p-6 text-center text-[#64748b]">Evento não encontrado.</section>
        ) : (
          <>
            <TabPanel active={activeTab === 'resumo'} className="space-y-4">
              <section className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-4">
                <h3 className="text-sm font-black text-slate-900">Atenção necessária</h3>
                {attentionItems.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {attentionItems.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-emerald-700">Tudo certo para este evento.</p>
                )}
              </section>

              <section className="rounded-2xl border border-[#dbeafe] bg-[#f8fbff] px-4 py-4">
                <h3 className="text-base font-black text-slate-900">Sugestão de formação</h3>
                <p className="mt-1 text-sm font-semibold text-slate-800">{suggestionTitle}</p>
                <p className="mt-1 text-xs text-slate-500">Recomendado para este evento</p>
                <button type="button" onClick={() => handleTabChange('escala')} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
                  Ajustar escala
                </button>
              </section>

              <section className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-4">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-black text-slate-900">Equipe</p>
                  <p className="text-slate-700">{teamSummary.total} músicos</p>
                </div>
                <p className="text-sm text-slate-600">{teamSummary.confirmed} confirmados / {teamSummary.pending} pendentes</p>
              </section>

              <section className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-4">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-black text-slate-900">Financeiro</p>
                  <p className="font-semibold text-amber-700">{formatMoney(evento?.open_amount || 0)} pendente</p>
                </div>
                <button type="button" onClick={() => handleTabChange('financeiro')} className="rounded-xl border border-[#dbe3ef] bg-white px-3 py-2 text-sm font-bold text-slate-900">
                  Ver pagamentos
                </button>
              </section>

              <section className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-4">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-black text-slate-900">Contrato externo/manual</p>
                  <p className="text-slate-700">{externalContract?.id ? 'Contrato externo anexado' : 'Não anexado'}</p>
                </div>
                {externalContract?.pdf_url ? (
                  <ContractSignedPdfButton
                    contractId={externalContract.id}
                    hasPdf={!!externalContract.pdf_url}
                    className="text-xs font-semibold text-blue-700 underline"
                    onError={(error) => toast.error(error?.message || 'Não foi possível abrir o PDF anexado.')}
                  >
                    Abrir PDF anexado
                  </ContractSignedPdfButton>
                ) : null}
                {externalContract?.public_token ? (
                  <div className="flex flex-wrap gap-2">
                    <a href={`/cliente/${externalContract.public_token}`} target="_blank" rel="noreferrer" className="rounded-xl border border-[#dbe3ef] bg-white px-3 py-2 text-xs font-bold text-slate-900">Abrir painel do cliente</a>
                    <button type="button" className="rounded-xl border border-[#dbe3ef] bg-white px-3 py-2 text-xs font-bold text-slate-900" onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}/cliente/${externalContract.public_token}`); toast.success('Link do painel copiado.'); }}>
                      Copiar link do painel do cliente
                    </button>
                  </div>
                ) : null}
                <label className="inline-flex cursor-pointer rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                  {uploadingExternalContract ? 'Enviando...' : externalContract?.id ? 'Substituir PDF externo' : 'Anexar contrato externo'}
                  <input type="file" accept="application/pdf" className="hidden" disabled={uploadingExternalContract} onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const shouldReplace = !!externalContract?.id;
                    if (shouldReplace && !window.confirm('Já existe contrato assinado. Confirmar substituição do PDF?')) return;
                    await handleUploadExternalContract(file, shouldReplace);
                    e.target.value = '';
                  }} />
                </label>
              </section>

              <section className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-4">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-black text-slate-900">Repertório</p>
                  <p className="text-slate-700">{getRepertoireStatusLabel(repertoireStatus)}</p>
                </div>
                <Link href="/repertorios" className="inline-flex rounded-xl border border-[#dbe3ef] bg-white px-3 py-2 text-sm font-bold text-slate-900">
                  Ver repertório
                </Link>
              </section>

              <section className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-4">
                <h3 className="text-sm font-black text-slate-900">Outras opções</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {otherOptions.map((option) => <li key={option}>• {option}</li>)}
                </ul>
              </section>

              {evento?.antesala_requested_by_client ? (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="text-sm font-semibold text-amber-700">
                    Solicitação do cliente: {getAntesalaStatusLabel(evento?.antesala_request_status)}
                  </p>
                  {normalizeAntesalaStatus(evento?.antesala_request_status) === 'pending' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => responderSolicitacaoAntesala('approved')} disabled={processandoAntesala !== ''} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-60">
                        {processandoAntesala === 'approved' ? 'Aprovando...' : 'Aprovar'}
                      </button>
                      <button type="button" onClick={() => responderSolicitacaoAntesala('rejected')} disabled={processandoAntesala !== ''} className="rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-black text-red-700 disabled:opacity-60">
                        {processandoAntesala === 'rejected' ? 'Rejeitando...' : 'Rejeitar'}
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </TabPanel>

            <TabPanel active={activeTab === 'detalhes'} className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
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
            </TabPanel>

            <TabPanel active={activeTab === 'financeiro'} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Valor acertado" value={formatMoney(resumoFinanceiro?.agreed)} tone="blue" />
                <MetricCard label="Valor quitado" value={formatMoney(resumoFinanceiro?.paid)} tone="emerald" />
                <MetricCard label="Saldo em aberto" value={formatMoney(resumoFinanceiro?.open)} tone={resumoFinanceiro?.open > 0 ? 'amber' : 'default'} />
                <MetricCard label="Lucro estimado" value={formatMoney(resumoFinanceiro?.profit)} tone={resumoFinanceiro?.profit > 0 ? 'default' : 'red'} />
              </div>
            </TabPanel>

            <TabPanel active={activeTab === 'escala'} className="space-y-4 rounded-[24px] border border-[#dbe3ef] bg-white p-4 md:p-5">
              <div id="escala-section" />
              <EventoEscalaTab eventId={evento.id} />
            </TabPanel>
          </>
        )}
      </div>
    </AdminShell>
  );
}
