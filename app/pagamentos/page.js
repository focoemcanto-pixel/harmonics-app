'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminShell from '../../components/admin/AdminShell';
import AdminPageHero from '../../components/admin/AdminPageHero';
import AdminSectionTitle from '../../components/admin/AdminSectionTitle';
import AdminSummaryCard from '../../components/admin/AdminSummaryCard';
import { supabase } from '../../lib/supabase';
import {
  toNumber,
  formatMoney,
  formatDateBR,
} from '../../lib/eventos/eventos-format';

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

function getPaymentTone(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'pago') return 'emerald';
  if (s === 'parcial') return 'amber';
  if (s === 'pendente') return 'red';
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

export default function PagamentosPage() {
  const [events, setEvents] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [feedback, setFeedback] = useState(null);

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [somentePendentes, setSomentePendentes] = useState(false);

  async function carregarEventos() {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true });

    if (error) throw error;
    setEvents(data || []);
  }

  useEffect(() => {
    async function init() {
      try {
        setCarregando(true);
        await carregarEventos();
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

  const pagamentos = useMemo(() => {
    return events.map((ev) => {
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

      return {
        ...ev,
        bruto,
        quitado,
        aberto,
        custos,
        liquido,
        paymentStatus,
      };
    });
  }, [events]);

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

      return matchBusca && matchStatus && matchPendentes;
    });
  }, [pagamentos, busca, statusFiltro, somentePendentes]);

  const resumo = useMemo(() => {
    const totalBruto = pagamentos.reduce((acc, item) => acc + item.bruto, 0);
    const totalQuitado = pagamentos.reduce((acc, item) => acc + item.quitado, 0);
    const totalAberto = pagamentos.reduce((acc, item) => acc + item.aberto, 0);
    const totalLiquido = pagamentos.reduce((acc, item) => acc + item.liquido, 0);

    const pagos = pagamentos.filter((item) => item.paymentStatus === 'Pago').length;
    const parciais = pagamentos.filter((item) => item.paymentStatus === 'Parcial').length;
    const pendentes = pagamentos.filter((item) => item.paymentStatus === 'Pendente').length;

    return {
      totalBruto,
      totalQuitado,
      totalAberto,
      totalLiquido,
      pagos,
      parciais,
      pendentes,
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
          subtitle="Acompanhe recebimentos, pendências, bruto, custos e líquido por evento."
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
            helper="Valores já recebidos"
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            tone="default"
          />
        </div>

        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <AdminSectionTitle
            title="Controle financeiro"
            subtitle="Filtre os eventos e acompanhe a fotografia financeira completa de cada operação."
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
          </div>

          <div className="mt-6 space-y-4">
            {pagamentosFiltrados.length === 0 ? (
              <div className="rounded-[20px] bg-[#f8fafc] px-5 py-5 text-[14px] font-semibold text-[#64748b]">
                Nenhum pagamento encontrado com esse filtro.
              </div>
            ) : (
              pagamentosFiltrados.map((item) => {
                const tone = getPaymentTone(item.paymentStatus);

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
                        </div>

                        <div className="mt-4 text-[13px] font-semibold leading-6 text-[#64748b]">
                          <div>
                            <strong>Atualizado em:</strong>{' '}
                            {item.updated_at
                              ? new Date(item.updated_at).toLocaleDateString('pt-BR')
                              : '-'}
                          </div>
                          <div>
                            <strong>Observação:</strong>{' '}
                            Histórico detalhado de datas/comprovantes depende da integração com a tabela de pagamentos.
                          </div>
                        </div>
                      </div>

                      <div className="grid w-full gap-3 md:grid-cols-2 xl:w-[420px]">
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
                          <div className="mt-1 font-semibold text-amber-700">
                            Em aberto: {formatMoney(item.aberto)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href="/eventos"
                        className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
                      >
                        Ir para eventos
                      </Link>

                      <Link
                        href={`/eventos/${item.id}`}
                        className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
                      >
                        Ver detalhe
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
