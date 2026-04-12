'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminShell from '@/components/admin/AdminShell';
import AdminPageHero from '@/components/admin/AdminPageHero';
import AdminSegmentTabs from '@/components/admin/AdminSegmentTabs';
import EventoEscalaTab from '@/components/eventos/EventoEscalaTab';

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

export default function EventoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id;

  const [evento, setEvento] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState(false);
  const [activeTab, setActiveTab] = useState('resumo');

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

  useEffect(() => {
    async function carregarEvento() {
      if (!id) return;

      try {
        setCarregando(true);
        const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
        if (error) throw error;
        setEvento(data || null);
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
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;

    try {
      setExcluindo(true);
      const { error } = await supabase.from('events').delete().eq('id', evento.id);
      if (error) throw error;
      router.push('/eventos');
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      alert('Erro ao excluir evento.');
    } finally {
      setExcluindo(false);
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

  const tabs = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'detalhes', label: 'Detalhes' },
    { key: 'financeiro', label: 'Financeiro' },
    { key: 'escala', label: 'Escala' },
  ];

  return (
    <AdminShell pageTitle="Detalhe do evento" activeItem="eventos">
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title={evento?.client_name || (carregando ? 'Carregando...' : 'Evento não encontrado')}
          subtitle={evento ? `${formatDateBR(evento.event_date)} • ${String(evento.event_time || '--:--').slice(0, 5)}${evento.location_name ? ` • ${evento.location_name}` : ''}` : 'Hub oficial do evento, incluindo escala premium e financeiro.'}
          actions={
            <div className="flex flex-wrap gap-3">
              <Link href="/eventos" className="rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-4 text-[14px] font-black text-[#0f172a]">Voltar</Link>
              {evento?.id ? (
                <Link href={`/eventos?edit=${evento.id}`} className="rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-4 text-[14px] font-black text-[#0f172a]">Editar</Link>
              ) : null}
              {evento?.id ? (
                <button type="button" onClick={excluirEvento} disabled={excluindo} className="rounded-[18px] bg-red-600 px-5 py-4 text-[14px] font-black text-white disabled:opacity-60">
                  {excluindo ? 'Excluindo...' : 'Excluir'}
                </button>
              ) : null}
            </div>
          }
        />

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
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Formação" value={evento.formation || '-'} tone="blue" />
                <MetricCard label="Instrumentos" value={evento.instruments || '-'} tone="default" />
                <MetricCard label="Status" value={evento.status || 'Rascunho'} tone="amber" />
                <MetricCard label="Pagamento" value={evento.payment_status || 'Pendente'} tone="emerald" />
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
                <EventoEscalaTab eventId={evento.id} />
              </section>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
