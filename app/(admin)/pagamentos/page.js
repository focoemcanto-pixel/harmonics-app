'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminPageHero from '@/components/admin/AdminPageHero';
import AdminSectionTitle from '@/components/admin/AdminSectionTitle';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';
import BulkActionBar from '@/components/ui/BulkActionBar';
import { useAppToast } from '@/components/ui/ToastProvider';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { supabase } from '@/lib/supabase';
import {
  toNumber,
  formatMoney,
  formatDateBR,
} from '@/lib/eventos/eventos-format';
import { resolveProofPreviewFromStoredUrl } from '@/lib/payments/payment-proof-storage';

function normalizePaymentStatus(status, paidAmount, openAmount, agreedAmount) {
  const raw = String(status || '').trim().toLowerCase();

  if (raw === 'paid' || raw === 'pago') return 'Pago';
  if (raw === 'partial' || raw === 'parcial') return 'Parcial';
  if (raw === 'pending' || raw === 'pendente') return 'Pendente';

  const paid = toNumber(paidAmount);
  const open = toNumber(openAmount);
  const agreed = toNumber(agreedAmount);

  if (agreed > 0 && open <= 0) return 'Pago';
  if (paid > 0 && open > 0) return 'Parcial';
  return 'Pendente';
}

function normalizeEntryStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  if (raw === 'confirmed' || raw === 'confirmado') return 'Confirmado';
  if (raw === 'cancelled' || raw === 'cancelado') return 'Cancelado';
  if (raw === 'em_analise' || raw === 'analysis' || raw === 'analyzing') return 'Em análise';
  if (raw === 'pending' || raw === 'pendente') return 'Pendente';
  return status || 'Pendente';
}

function getPaymentTone(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'pago') return 'emerald';
  if (s === 'parcial') return 'amber';
  if (s === 'pendente') return 'red';
  return 'slate';
}

function getEntryTone(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'confirmado') return 'emerald';
  if (s === 'cancelado') return 'red';
  if (s === 'em análise') return 'blue';
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

function PaymentPill({ tone = 'slate', children }) {
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

function formatPaymentMethod(method) {
  if (!method) return '-';
  return String(method)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function resolvePreviewDetails(proofReference) {
  const preview = resolveProofPreviewFromStoredUrl(proofReference, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  console.log('[ADMIN_PAYMENT_PROOF][PREVIEW_URL]', {
    bucket: preview.bucket,
    path: preview.path,
    url: preview.url,
  });

  return preview.url;
}

function isRejectedStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  return ['rejected', 'rejeitado', 'cancelado', 'cancelled', 'canceled'].includes(raw);
}

function isPendingValidationStatus(status) {
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

function buildFinancialGroupingKey(event) {
  return [
    String(event.client_name || '').trim().toLowerCase(),
    String(event.event_date || '').trim(),
    String(event.location_name || '').trim().toLowerCase(),
    String(event.event_type || '').trim().toLowerCase(),
  ].join('::');
}

export default function PagamentosPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <PagamentosPageContent />
    </ProtectedRoute>
  );
}

function PagamentosPageContent() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [feedback, setFeedback] = useState(null);

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [somentePendentes, setSomentePendentes] = useState(false);
  const [somenteAguardandoValidacao, setSomenteAguardandoValidacao] = useState(false);
  const [historicoAbertoId, setHistoricoAbertoId] = useState(null);
  const [historicoSelecionadoId, setHistoricoSelecionadoId] = useState(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState('');
  const [processingAction, setProcessingAction] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    mode: 'single',
    paymentId: null,
  });
  const [deleting, setDeleting] = useState(false);
  const { selectedIds, selectedSet, setSelectedIds, clear, toggle } = useMultiSelect();
  const toast = useAppToast();

  async function carregarTudo() {
    const [eventsRes, paymentsRes] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true }),
      supabase
        .from('payments')
        .select('*')
        .order('payment_date', { ascending: false }),
    ]);

    if (eventsRes.error) throw eventsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    console.log('[PAYMENTS_PAGE][RAW_ROWS]', {
      events: eventsRes.data || [],
      payments: paymentsRes.data || [],
    });

    setEvents(eventsRes.data || []);
    setPayments(paymentsRes.data || []);
  }

  useEffect(() => {
    async function init() {
      try {
        setCarregando(true);
        await carregarTudo();
      } catch (error) {
        console.error('Erro ao carregar pagamentos:', error);
        setFeedback({
          type: 'error',
          title: 'Erro ao carregar módulo',
          message: 'Não foi possível carregar a central de pagamentos agora.',
        });
      } finally {
        setCarregando(false);
      }
    }

    init();
  }, []);

  useEffect(() => {
    for (const entry of payments) {
      if (entry?.proof_file_url) {
        console.log('[ADMIN_PAYMENTS][PROOF_URL]', {
          paymentId: entry.id,
          eventId: entry.event_id,
          proofFileUrl: entry.proof_file_url,
        });
      }
    }
  }, [payments]);

  const entrySelecionado = useMemo(() => {
    if (!historicoSelecionadoId) return null;
    return payments.find((entry) => String(entry.id) === String(historicoSelecionadoId)) || null;
  }, [historicoSelecionadoId, payments]);
  const entrySelecionadoPreviewUrl = useMemo(() => {
    if (!entrySelecionado?.proof_file_url) return '';
    return resolvePreviewDetails(entrySelecionado.proof_file_url);
  }, [entrySelecionado]);

  async function atualizarResumoEvento(eventId) {
    const eventRef = String(eventId || '');
    if (!eventRef) return;

    const [eventRes, paymentsRes] = await Promise.all([
      supabase.from('events').select('id, agreed_amount').eq('id', eventRef).single(),
      supabase.from('payments').select('amount, status').eq('event_id', eventRef),
    ]);

    if (eventRes.error) throw eventRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const agreedAmount = toNumber(eventRes.data?.agreed_amount);
    const paidAmount = (paymentsRes.data || []).reduce((acc, item) => {
      if (isRejectedStatus(item?.status)) return acc;
      return acc + toNumber(item?.amount);
    }, 0);
    const openAmount = Math.max(agreedAmount - paidAmount, 0);
    const paymentStatus = openAmount <= 0 && agreedAmount > 0 ? 'Pago' : paidAmount > 0 ? 'Parcial' : 'Pendente';

    const { error: updateError } = await supabase
      .from('events')
      .update({
        paid_amount: paidAmount,
        open_amount: openAmount,
        payment_status: paymentStatus,
      })
      .eq('id', eventRef);

    if (updateError) throw updateError;
  }

  async function atualizarStatusComprovante(entry, nextStatus) {
    if (!entry?.id || !nextStatus) return;

    try {
      setProcessingAction(`${entry.id}:${nextStatus}`);
      const { data, error } = await supabase
        .from('payments')
        .update({
          status: nextStatus,
          notes: [entry.notes, `Decisão admin (${new Date().toISOString()}): ${nextStatus}`]
            .filter(Boolean)
            .join(' | '),
        })
        .eq('id', entry.id)
        .select('id, event_id, status')
        .single();

      if (error) throw error;

      await atualizarResumoEvento(entry.event_id);
      await carregarTudo();

      const logPayload = {
        paymentId: entry.id,
        eventId: entry.event_id,
        status: data?.status || nextStatus,
        ok: true,
      };

      if (nextStatus === 'confirmado') {
        console.log('[ADMIN_PAYMENT_PROOF][APPROVE_RESULT]', logPayload);
      } else {
        console.log('[ADMIN_PAYMENT_PROOF][REJECT_RESULT]', logPayload);
      }

      setFeedback({
        type: 'success',
        title: 'Comprovante atualizado',
        message:
          nextStatus === 'confirmado'
            ? 'Comprovante aprovado e financeiro atualizado.'
            : 'Comprovante rejeitado e financeiro atualizado.',
      });
    } catch (error) {
      const logPayload = {
        paymentId: entry?.id || null,
        eventId: entry?.event_id || null,
        status: nextStatus,
        ok: false,
        error: error?.message || String(error),
      };
      if (nextStatus === 'confirmado') {
        console.error('[ADMIN_PAYMENT_PROOF][APPROVE_RESULT]', logPayload);
      } else {
        console.error('[ADMIN_PAYMENT_PROOF][REJECT_RESULT]', logPayload);
      }
      setFeedback({
        type: 'error',
        title: 'Falha ao atualizar comprovante',
        message: 'Não foi possível salvar a decisão no momento.',
      });
    } finally {
      setProcessingAction('');
    }
  }

  function abrirExclusaoIndividual(entry) {
    setDeleteDialog({
      open: true,
      mode: 'single',
      paymentId: String(entry?.id || ''),
    });
  }

  function abrirExclusaoEmMassa() {
    if (selectedIds.length === 0) return;
    setDeleteDialog({
      open: true,
      mode: 'bulk',
      paymentId: null,
    });
  }

  function cancelarExclusao() {
    if (deleting) return;
    setDeleteDialog({
      open: false,
      mode: 'single',
      paymentId: null,
    });
  }

  function aplicarResultadoExclusao(result = {}, fallbackTargetIds = []) {
    const deletedIds = (result?.ids || fallbackTargetIds).map((id) => String(id || '').trim()).filter(Boolean);
    const eventUpdates = Array.isArray(result?.eventUpdates) ? result.eventUpdates : [];

    if (deletedIds.length > 0) {
      setPayments((prev) => prev.filter((item) => !deletedIds.includes(String(item?.id))));
      setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(String(id))));
    }

    if (eventUpdates.length > 0) {
      setEvents((prev) =>
        prev.map((eventItem) => {
          const found = eventUpdates.find((entry) => String(entry?.id) === String(eventItem?.id));
          if (!found) return eventItem;
          return {
            ...eventItem,
            paid_amount: found.paid_amount,
            open_amount: found.open_amount,
            payment_status: found.payment_status,
          };
        })
      );
    }

    if (historicoSelecionadoId && deletedIds.includes(String(historicoSelecionadoId))) {
      setHistoricoSelecionadoId(null);
    }
  }

  async function confirmarExclusao() {
    const isBulk = deleteDialog.mode === 'bulk';
    const targetIds = isBulk
      ? selectedIds
      : deleteDialog.paymentId
        ? [deleteDialog.paymentId]
        : [];

    if (targetIds.length === 0) {
      cancelarExclusao();
      return;
    }

    const payload = isBulk ? { paymentIds: targetIds } : { paymentId: targetIds[0] };
    const endpoint = isBulk
      ? '/api/payments/bulk-delete'
      : `/api/payments/${encodeURIComponent(targetIds[0])}`;

    if (isBulk) {
      console.log('[PAYMENTS_DELETE][BULK_PAYLOAD]', payload);
    } else {
      console.log('[PAYMENTS_DELETE][SINGLE_PAYLOAD]', payload);
    }

    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(endpoint, {
        method: isBulk ? 'POST' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        ...(isBulk ? { body: JSON.stringify(payload) } : {}),
      });

      const result = await response.json().catch(() => ({}));
      if (isBulk) {
        console.log('[PAYMENTS_DELETE][BULK_RESULT]', result);
      } else {
        console.log('[PAYMENTS_DELETE][SINGLE_RESULT]', result);
      }

      if (!response.ok || !result?.success || Number(result?.affected || 0) === 0) {
        toast.error(result?.message || 'Não foi possível excluir pagamento(s).');
        return;
      }

      aplicarResultadoExclusao(result, targetIds);
      clear();
      setDeleteDialog({
        open: false,
        mode: 'single',
        paymentId: null,
      });

      if (isBulk) {
        toast.success(`${result.affected} pagamento(s) excluído(s) com sucesso.`);
      } else {
        toast.success('Pagamento excluído com sucesso.');
      }
    } catch (error) {
      toast.error(error?.message || 'Falha ao excluir pagamento(s).');
    } finally {
      setDeleting(false);
    }
  }

  const paymentsByEventId = useMemo(() => {
    const map = new Map();

    for (const payment of payments) {
      const key = String(payment.event_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(payment);
    }

    for (const [, list] of map) {
      list.sort((a, b) => {
        const aDate = a.payment_date ? new Date(a.payment_date).getTime() : 0;
        const bDate = b.payment_date ? new Date(b.payment_date).getTime() : 0;
        return bDate - aDate;
      });
    }

    return map;
  }, [payments]);

  const pagamentos = useMemo(() => {
    const inputRows = events.map((ev) => {
      const bruto = toNumber(ev.agreed_amount);
      const quitado = toNumber(ev.paid_amount);
      const aberto = toNumber(ev.open_amount);
      const custos =
        toNumber(ev.musician_cost) +
        toNumber(ev.sound_cost) +
        toNumber(ev.extra_transport_cost);
      const liquido = toNumber(ev.profit_amount);

      const paymentStatus = normalizePaymentStatus(
        ev.payment_status,
        ev.paid_amount,
        ev.open_amount,
        ev.agreed_amount
      );

      const paymentEntries = paymentsByEventId.get(String(ev.id)) || [];
      const totalHistorico = paymentEntries.reduce(
        (acc, item) => acc + toNumber(item.amount),
        0
      );
      const ultimoPagamento = paymentEntries[0] || null;

      return {
        ...ev,
        bruto,
        quitado,
        aberto,
        custos,
        liquido,
        paymentStatus,
        paymentEntries,
        totalHistorico,
        ultimoPagamento,
      };
    });
    console.log('[PAYMENTS_PAGE][GROUPING_INPUT]', inputRows);

    const grouped = new Map();

    for (const row of inputRows) {
      const key = buildFinancialGroupingKey(row);
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          id: `group:${key}`,
          groupKey: key,
          sourceEventIds: [row.id],
          primaryEventId: row.id,
          client_name: row.client_name,
          event_date: row.event_date,
          location_name: row.location_name,
          event_type: row.event_type,
          formation: row.formation,
          updated_at: row.updated_at,
          bruto: row.bruto,
          quitadoReferencia: row.quitado,
          abertoReferencia: row.aberto,
          custos: row.custos,
          liquido: row.liquido,
          paymentStatusReferencia: row.paymentStatus,
          paymentEntries: [...row.paymentEntries],
        });
        continue;
      }

      const shouldReplacePrimary =
        new Date(row.updated_at || 0).getTime() > new Date(existing.updated_at || 0).getTime();

      existing.sourceEventIds.push(row.id);
      existing.updated_at = shouldReplacePrimary ? row.updated_at : existing.updated_at;
      existing.primaryEventId = shouldReplacePrimary ? row.id : existing.primaryEventId;
      existing.bruto = Math.max(existing.bruto, row.bruto);
      existing.quitadoReferencia = Math.max(existing.quitadoReferencia, row.quitado);
      existing.abertoReferencia = Math.max(existing.abertoReferencia, row.aberto);
      existing.custos = Math.max(existing.custos, row.custos);
      existing.liquido = Math.max(existing.liquido, row.liquido);
      existing.paymentStatusReferencia =
        existing.paymentStatusReferencia === 'Pendente' || row.paymentStatus === 'Pendente'
          ? 'Pendente'
          : existing.paymentStatusReferencia === 'Parcial' || row.paymentStatus === 'Parcial'
            ? 'Parcial'
            : 'Pago';
      existing.paymentEntries.push(...row.paymentEntries);
    }

    const groupedRows = Array.from(grouped.values()).map((groupRow) => {
      const entriesById = new Map();
      for (const entry of groupRow.paymentEntries) {
        entriesById.set(String(entry.id), entry);
      }
      const paymentEntries = Array.from(entriesById.values()).sort((a, b) => {
        const aDate = a.payment_date ? new Date(a.payment_date).getTime() : 0;
        const bDate = b.payment_date ? new Date(b.payment_date).getTime() : 0;
        return bDate - aDate;
      });

      const totalHistorico = paymentEntries.reduce((acc, item) => acc + toNumber(item.amount), 0);
      const quitadoPorHistorico = paymentEntries.reduce((acc, entry) => {
        if (isRejectedStatus(entry?.status) || isPendingValidationStatus(entry?.status)) return acc;
        return acc + toNumber(entry?.amount);
      }, 0);
      const quitado = Math.max(groupRow.quitadoReferencia, quitadoPorHistorico);
      const bruto = groupRow.bruto;
      const aberto = bruto > 0 ? Math.max(bruto - quitado, 0) : groupRow.abertoReferencia;
      const paymentStatus = normalizePaymentStatus(
        groupRow.paymentStatusReferencia,
        quitado,
        aberto,
        bruto
      );
      const pendenciasValidacao = paymentEntries.filter((entry) =>
        isPendingValidationStatus(entry?.status)
      );
      const ultimoPagamento = paymentEntries[0] || null;

      return {
        ...groupRow,
        paymentEntries,
        quitado,
        aberto,
        totalHistorico,
        paymentStatus,
        pendenciasValidacaoCount: pendenciasValidacao.length,
        pendenciaMaisAntiga: pendenciasValidacao
          .slice()
          .sort((a, b) => new Date(a.created_at || a.payment_date || 0) - new Date(b.created_at || b.payment_date || 0))[0] || null,
        ultimoPagamento,
      };
    });

    groupedRows.sort((a, b) => {
      if (a.pendenciasValidacaoCount !== b.pendenciasValidacaoCount) {
        return b.pendenciasValidacaoCount - a.pendenciasValidacaoCount;
      }
      return new Date(a.event_date || 0) - new Date(b.event_date || 0);
    });

    console.log('[PAYMENTS_PAGE][GROUPING_RESULT]', groupedRows);
    return groupedRows;
  }, [events, paymentsByEventId]);

  useEffect(() => {
    const filtro = searchParams.get('filtro');
    if (filtro === 'validacao') {
      setSomenteAguardandoValidacao(true);
    }

    const eventId = searchParams.get('eventId');
    if (!eventId) return;

    const foundByEvent = pagamentos.find((item) =>
      item.sourceEventIds.some((id) => String(id) === String(eventId))
    );
    if (foundByEvent?.id) {
      setHistoricoAbertoId(String(foundByEvent.id));
    }
  }, [searchParams, pagamentos]);

  useEffect(() => {
    const historico = searchParams.get('historico');
    if (historico) {
      const target = payments.find((entry) => String(entry.id) === String(historico));
      if (target?.event_id) {
        const foundByEvent = pagamentos.find((item) =>
          item.sourceEventIds.some((id) => String(id) === String(target.event_id))
        );
        if (foundByEvent?.id) {
          setHistoricoAbertoId(String(foundByEvent.id));
        }
      }
      setHistoricoSelecionadoId(String(historico));
      if (target?.proof_file_url) {
        setProofPreviewUrl(resolvePreviewDetails(target.proof_file_url));
      }
    }
  }, [pagamentos, payments, searchParams]);

  const pagamentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return pagamentos.filter((item) => {
      const matchBusca =
        !termo ||
        [
          item.client_name,
          item.location_name,
          item.event_type,
          item.formation,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(termo));

      const matchStatus =
        statusFiltro === 'todos' ||
        String(item.paymentStatus).toLowerCase() === statusFiltro;

      const matchPendentes = !somentePendentes || item.aberto > 0;
      const matchValidacao = !somenteAguardandoValidacao || item.pendenciasValidacaoCount > 0;

      return matchBusca && matchStatus && matchPendentes && matchValidacao;
    });
  }, [pagamentos, busca, statusFiltro, somentePendentes, somenteAguardandoValidacao]);

  const resumo = useMemo(() => {
    const totalBruto = pagamentos.reduce((acc, item) => acc + item.bruto, 0);
    const totalQuitado = pagamentos.reduce((acc, item) => acc + item.quitado, 0);
    const totalAberto = pagamentos.reduce((acc, item) => acc + item.aberto, 0);
    const totalLiquido = pagamentos.reduce((acc, item) => acc + item.liquido, 0);
    const totalHistorico = pagamentos.reduce(
      (acc, item) => acc + item.totalHistorico,
      0
    );

    const pagos = pagamentos.filter((item) => item.paymentStatus === 'Pago').length;
    const parciais = pagamentos.filter((item) => item.paymentStatus === 'Parcial').length;
    const pendentes = pagamentos.filter((item) => item.paymentStatus === 'Pendente').length;
    const aguardandoValidacao = pagamentos.reduce(
      (acc, item) => acc + item.pendenciasValidacaoCount,
      0
    );

    return {
      totalBruto,
      totalQuitado,
      totalAberto,
      totalLiquido,
      totalHistorico,
      pagos,
      parciais,
      pendentes,
      aguardandoValidacao,
    };
  }, [pagamentos]);

  if (carregando) {
    return (
      <AdminShell pageTitle="Pagamentos" activeItem="pagamentos">
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <p className="text-center text-[#64748b]">Carregando pagamentos...</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell pageTitle="Pagamentos" activeItem="pagamentos">
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Pagamentos"
          subtitle="Acompanhe recebimentos, histórico de entradas, pendências, bruto, custos e líquido por evento."
        />

        {feedback ? (
          <FeedbackBanner
            feedback={feedback}
            onClose={() => setFeedback(null)}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminSummaryCard
            label="Bruto total"
            value={formatMoney(resumo.totalBruto)}
            helper="Valor total negociado"
            size="highlight"
          />
          <AdminSummaryCard
            label="Quitado"
            value={formatMoney(resumo.totalQuitado)}
            helper="Consolidado em eventos"
            tone="success"
            size="highlight"
          />
          <AdminSummaryCard
            label="Em aberto"
            value={formatMoney(resumo.totalAberto)}
            helper="Saldo ainda pendente"
            tone="warning"
            size="highlight"
          />
          <AdminSummaryCard
            label="Líquido"
            value={formatMoney(resumo.totalLiquido)}
            helper="Margem final da operação"
            tone="accent"
            size="highlight"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <AdminSummaryCard
            label="Histórico em payments"
            value={formatMoney(resumo.totalHistorico)}
            helper="Soma das entradas registradas"
          />
          <AdminSummaryCard
            label="Pagos"
            value={String(resumo.pagos)}
            helper="Eventos quitados"
            tone="success"
          />
          <AdminSummaryCard
            label="Parciais"
            value={String(resumo.parciais)}
            helper="Recebimento parcial"
            tone="warning"
          />
          <AdminSummaryCard
            label="Pendentes"
            value={String(resumo.pendentes)}
            helper="Sem quitação"
          />
          <AdminSummaryCard
            label="Comprovantes em validação"
            value={String(resumo.aguardandoValidacao)}
            helper="Aguardando conferência"
            tone="warning"
          />
        </div>

        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <AdminSectionTitle
            title="Controle financeiro"
            subtitle="Filtre os eventos e acompanhe a fotografia financeira consolidada e o histórico real de entradas."
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
              <option value="pago">Pago</option>
              <option value="parcial">Parcial</option>
              <option value="pendente">Pendente</option>
            </select>

            <button
              type="button"
              onClick={() => setSomentePendentes((prev) => !prev)}
              className={`rounded-[18px] px-4 py-3 text-[14px] font-black transition ${
                somentePendentes
                  ? 'bg-violet-600 text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]'
                  : 'border border-[#dbe3ef] bg-white text-[#0f172a]'
              }`}
            >
              {somentePendentes ? 'Mostrando apenas pendentes' : 'Filtrar apenas pendentes'}
            </button>

            <button
              type="button"
              onClick={() => setSomenteAguardandoValidacao((prev) => !prev)}
              className={`rounded-[18px] px-4 py-3 text-[14px] font-black transition ${
                somenteAguardandoValidacao
                  ? 'bg-amber-500 text-white shadow-[0_12px_28px_rgba(245,158,11,0.18)]'
                  : 'border border-[#dbe3ef] bg-white text-[#0f172a]'
              }`}
            >
              {somenteAguardandoValidacao
                ? 'Somente aguardando validação'
                : 'Pendências de comprovante'}
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {pagamentosFiltrados.length === 0 ? (
              <div className="rounded-[20px] bg-[#f8fafc] px-5 py-5 text-[14px] font-semibold text-[#64748b]">
                Nenhum pagamento encontrado com esse filtro.
              </div>
            ) : (
              pagamentosFiltrados.map((item) => {
                const tone = getPaymentTone(item.paymentStatus);
                const historicoAberto = String(historicoAbertoId) === String(item.id);

                return (
                  <div
                    key={item.id}
                    className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.04)]"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="text-[20px] font-black tracking-[-0.03em] text-[#0f172a]">
                          {item.client_name || 'Evento sem cliente'}
                        </div>

                        <div className="mt-1 text-[14px] font-semibold text-[#64748b]">
                          {item.event_type || 'Evento'} • {formatDateBR(item.event_date)} • {item.location_name || 'Local não informado'}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <PaymentPill tone={tone}>
                            {item.paymentStatus}
                          </PaymentPill>

                          <PaymentPill tone="slate">
                            {item.formation || 'Sem formação'}
                          </PaymentPill>

                          <PaymentPill tone={item.paymentEntries.length > 0 ? 'blue' : 'slate'}>
                            {item.paymentEntries.length > 0
                              ? `${item.paymentEntries.length} lançamento(s)`
                              : 'Sem histórico'}
                          </PaymentPill>

                          {item.pendenciasValidacaoCount > 0 ? (
                            <PaymentPill tone="amber">
                              {item.pendenciasValidacaoCount === 1
                                ? '1 comprovante aguardando validação'
                                : `${item.pendenciasValidacaoCount} lançamentos em análise`}
                            </PaymentPill>
                          ) : null}
                        </div>

                        <div className="mt-4 text-[13px] font-semibold leading-6 text-[#64748b]">
                          <div>
                            <strong>Último pagamento:</strong>{' '}
                            {item.ultimoPagamento?.payment_date
                              ? formatDateBR(item.ultimoPagamento.payment_date)
                              : '-'}
                          </div>
                          <div>
                            <strong>Última forma:</strong>{' '}
                            {formatPaymentMethod(item.ultimoPagamento?.payment_method)}
                          </div>
                          <div>
                            <strong>Atualizado em:</strong>{' '}
                            {item.updated_at
                              ? new Date(item.updated_at).toLocaleDateString('pt-BR')
                              : '-'}
                          </div>
                          {item.pendenciaMaisAntiga?.payment_date ? (
                            <div>
                              <strong>Pendência mais antiga:</strong>{' '}
                              {formatDateBR(item.pendenciaMaisAntiga.payment_date)}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid w-full gap-3 md:grid-cols-2 xl:w-[430px]">
                        <div className="rounded-[18px] border border-[#e8edf5] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#475569]">
                          <div>
                            <strong>Bruto:</strong> {formatMoney(item.bruto)}
                          </div>
                          <div className="mt-1">
                            <strong>Custos:</strong> {formatMoney(item.custos)}
                          </div>
                          <div className="mt-1 font-semibold text-violet-700">
                            Líquido: {formatMoney(item.liquido)}
                          </div>
                        </div>

                        <div className="rounded-[18px] border border-[#e8edf5] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#475569]">
                          <div>
                            <strong>Quitado:</strong> {formatMoney(item.quitado)}
                          </div>
                          <div className="mt-1">
                            <strong>Histórico:</strong> {formatMoney(item.totalHistorico)}
                          </div>
                          <div className="mt-1 font-semibold text-amber-700">
                            Em aberto: {formatMoney(item.aberto)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setHistoricoAbertoId((prev) =>
                            String(prev) === String(item.id) ? null : String(item.id)
                          )
                        }
                        className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
                      >
                        {historicoAberto ? 'Ocultar histórico' : 'Ver histórico'}
                      </button>

                      <Link
                        href="/eventos"
                        className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
                      >
                        Ir para eventos
                      </Link>

                      <Link
                        href={`/eventos/${item.primaryEventId}`}
                        className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
                      >
                        Ver detalhe
                      </Link>

                      {item.pendenciaMaisAntiga ? (
                        <button
                          type="button"
                          onClick={() => {
                            setHistoricoAbertoId(String(item.id));
                            setHistoricoSelecionadoId(String(item.pendenciaMaisAntiga.id));
                          }}
                          className="rounded-[16px] bg-amber-500 px-4 py-3 text-[14px] font-black text-white"
                        >
                          Validar pagamento
                        </button>
                      ) : null}
                    </div>

                    {historicoAberto ? (
                      <div className="mt-5 rounded-[20px] border border-[#e8edf5] bg-[#fcfdff] p-4">
                        {item.paymentEntries.length === 0 ? (
                          <div className="text-[14px] font-semibold text-[#64748b]">
                            Nenhum lançamento encontrado em payments para este evento.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {item.paymentEntries.map((entry) => {
                              const entryStatus = normalizeEntryStatus(entry.status);
                              const entryTone = getEntryTone(entryStatus);
                              const isSelected = selectedSet.has(String(entry.id));

                              return (
                                <div
                                  key={entry.id}
                                  className="rounded-[18px] border border-[#eef2f7] bg-white px-4 py-4"
                                >
                                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                      <div className="text-[16px] font-black text-[#0f172a]">
                                        {formatMoney(entry.amount)}
                                      </div>

                                      <div className="mt-1 text-[13px] font-semibold text-[#64748b]">
                                        {entry.payment_date
                                          ? formatDateBR(entry.payment_date)
                                          : 'Data não informada'}{' '}
                                        • {formatPaymentMethod(entry.payment_method)}
                                      </div>

                                      {entry.notes ? (
                                        <div className="mt-2 text-[14px] text-[#475569]">
                                          {entry.notes}
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      <label className="inline-flex items-center gap-2 rounded-full border border-[#dbe3ef] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#0f172a]">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggle(entry.id)}
                                          disabled={deleting}
                                          className="h-3.5 w-3.5"
                                        />
                                        Selecionar
                                      </label>

                                      <PaymentPill tone={entryTone}>
                                        {entryStatus}
                                      </PaymentPill>

                                      {entry.proof_file_url ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setProofPreviewUrl(resolvePreviewDetails(entry.proof_file_url))
                                          }
                                          className="rounded-full border border-[#dbe3ef] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#0f172a]"
                                        >
                                          Ver comprovante
                                        </button>
                                      ) : null}

                                      <button
                                        type="button"
                                        onClick={() => setHistoricoSelecionadoId(String(entry.id))}
                                        className="rounded-full border border-[#dbe3ef] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#0f172a]"
                                      >
                                        Validar comprovante
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => abrirExclusaoIndividual(entry)}
                                        disabled={deleting}
                                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-red-700 disabled:opacity-60"
                                      >
                                        Excluir
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
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

        <BulkActionBar
          selectedCount={selectedIds.length}
          label="pagamentos"
          deleting={deleting}
          onClear={clear}
          onDelete={abrirExclusaoEmMassa}
        />
      </div>

      {proofPreviewUrl ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-4xl rounded-[20px] bg-white p-3 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-black text-[#0f172a]">Preview do comprovante</div>
              <div className="flex items-center gap-2">
                <a
                  href={proofPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[12px] border border-[#dbe3ef] px-3 py-2 text-xs font-black text-[#0f172a]"
                >
                  Abrir em nova aba
                </a>
                <button
                  type="button"
                  onClick={() => setProofPreviewUrl('')}
                  className="rounded-[12px] border border-[#dbe3ef] px-3 py-2 text-xs font-black text-[#0f172a]"
                >
                  Fechar
                </button>
              </div>
            </div>
            <iframe
              src={proofPreviewUrl}
              title="Preview do comprovante"
              className="h-[70vh] w-full rounded-[14px] border border-[#e2e8f0]"
            />
          </div>
        </div>
      ) : null}

      {entrySelecionado ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-2xl rounded-[20px] bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.08em] text-[#64748b]">
                  Lançamento #{entrySelecionado.id}
                </div>
                <div className="text-lg font-black text-[#0f172a]">Validação de comprovante</div>
              </div>
              <button
                type="button"
                onClick={() => setHistoricoSelecionadoId(null)}
                className="rounded-[12px] border border-[#dbe3ef] px-3 py-2 text-xs font-black text-[#0f172a]"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 text-[14px] text-[#334155] md:grid-cols-2">
              <div><strong>Valor:</strong> {formatMoney(entrySelecionado.amount)}</div>
              <div><strong>Data:</strong> {entrySelecionado.payment_date ? formatDateBR(entrySelecionado.payment_date) : '-'}</div>
              <div><strong>Forma:</strong> {formatPaymentMethod(entrySelecionado.payment_method)}</div>
              <div><strong>Status:</strong> {normalizeEntryStatus(entrySelecionado.status)}</div>
            </div>
            <div className="mt-3 text-[14px] text-[#334155]">
              <strong>Observação:</strong> {entrySelecionado.notes || '-'}
            </div>

            {entrySelecionadoPreviewUrl ? (
              <div className="mt-4">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.08em] text-[#64748b]">
                  Preview do comprovante
                </div>
                <iframe
                  src={entrySelecionadoPreviewUrl}
                  title={`Comprovante ${entrySelecionado.id}`}
                  className="h-[320px] w-full rounded-[14px] border border-[#e2e8f0]"
                />
              </div>
            ) : (
              <div className="mt-4 rounded-[14px] border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm text-[#64748b]">
                Nenhum comprovante anexado.
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => atualizarStatusComprovante(entrySelecionado, 'confirmado')}
                disabled={Boolean(processingAction)}
                className="rounded-[14px] bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {processingAction === `${entrySelecionado.id}:confirmado` ? 'Aprovando...' : 'Aprovar comprovante'}
              </button>
              <button
                type="button"
                onClick={() => atualizarStatusComprovante(entrySelecionado, 'cancelado')}
                disabled={Boolean(processingAction)}
                className="rounded-[14px] bg-red-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {processingAction === `${entrySelecionado.id}:cancelado` ? 'Rejeitando...' : 'Rejeitar comprovante'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DeleteConfirmModal
        open={deleteDialog.open}
        loading={deleting}
        title={
          deleteDialog.mode === 'bulk'
            ? `Excluir ${selectedIds.length} pagamento(s) selecionado(s)?`
            : 'Excluir este lançamento de pagamento?'
        }
        description={
          deleteDialog.mode === 'bulk'
            ? 'Esta ação removerá os registros do histórico financeiro selecionados e atualizará os totais relacionados. Essa ação é definitiva.'
            : 'Esta ação removerá este registro do histórico financeiro e atualizará os totais do evento. Essa ação é definitiva.'
        }
        confirmLabel={deleteDialog.mode === 'bulk' ? 'Excluir selecionados' : 'Excluir'}
        onCancel={cancelarExclusao}
        onConfirm={confirmarExclusao}
      />
    </AdminShell>
  );
}
