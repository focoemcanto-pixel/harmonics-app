'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import AdminShell from '../components/admin/AdminShell';
import AdminPageHero from '../components/admin/AdminPageHero';
import AdminSummaryCard from '../components/admin/AdminSummaryCard';

const MAX_RECENT_EVENTS = 10;

export default function Home() {
  const [eventos, setEventos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const mobileActions: any[] = [];

  async function carregarEventos() {
    try {
      setCarregando(true);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEventos(data || []);
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarEventos();
  }, []);

  const totalEventos = eventos.length;
  const concluidos = eventos.filter(
    (e) => e.status === 'done' || e.status === 'Pago'
  ).length;
  const rascunhos = eventos.filter(
    (e) => e.status === 'draft' || e.status === 'Rascunho'
  ).length;
  const confirmados = eventos.filter((e) => e.status === 'Confirmado').length;

  if (carregando) {
    return (
      <AdminShell
        pageTitle="Dashboard"
        activeItem="dashboard"
        mobileActions={mobileActions}
      >
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <p className="text-center text-[#64748b]">Carregando dashboard...</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      pageTitle="Dashboard"
      activeItem="dashboard"
      mobileActions={mobileActions}
    >
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Dashboard"
          subtitle="Visão geral do sistema de gestão de eventos musicais."
          actions={null}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminSummaryCard
            label="Total de eventos"
            value={totalEventos}
            helper="Cadastrados no sistema"
          />
          <AdminSummaryCard
            label="Concluídos"
            value={concluidos}
            helper="Eventos finalizados"
            tone="success"
          />
          <AdminSummaryCard
            label="Confirmados"
            value={confirmados}
            helper="Aguardando realização"
            tone="accent"
          />
          <AdminSummaryCard
            label="Em rascunho"
            value={rascunhos}
            helper="Aguardando conclusão"
            tone="warning"
          />
        </div>

        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
          <h3 className="mb-4 text-[18px] font-black text-[#0f172a]">
            Eventos recentes
          </h3>

          {eventos.length === 0 ? (
            <div className="rounded-[20px] bg-[#f8fafc] px-4 py-5 text-[14px] font-semibold text-[#64748b]">
              Nenhum evento encontrado.
            </div>
          ) : (
            <div className="space-y-3">
              {eventos.slice(0, MAX_RECENT_EVENTS).map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-[20px] border border-[#dbe3ef] bg-[#fafbfc] p-4 transition hover:bg-white hover:shadow-[0_4px_12px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[16px] font-black text-[#0f172a]">
                        {ev.client_name || 'Sem nome'}
                      </h4>
                      <p className="mt-1 text-[14px] text-[#64748b]">
                        {ev.event_date || '-'} • {ev.event_time || '-'}
                      </p>
                      <p className="mt-1 text-[13px] text-[#94a3b8]">
                        Local: {ev.location_name || '-'}
                      </p>
                    </div>

                    <div>
                      <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-slate-700">
                        {ev.status || 'Rascunho'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
