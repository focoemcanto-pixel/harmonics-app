'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function Home() {
  const [eventos, setEventos] = useState<any[]>([]);

  async function carregarEventos() {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar eventos:', error);
      return;
    }

    setEventos(data || []);
  }

  useEffect(() => {
    carregarEventos();
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <Header title="Dashboard" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-slate-500 text-sm">Total de eventos</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">
              {eventos.length}
            </h3>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-slate-500 text-sm">Concluídos</p>
            <h3 className="text-3xl font-bold text-emerald-600 mt-2">
              {eventos.filter((e) => e.status === 'done').length}
            </h3>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-slate-500 text-sm">Em rascunho</p>
            <h3 className="text-3xl font-bold text-amber-500 mt-2">
              {eventos.filter((e) => e.status === 'draft').length}
            </h3>
          </div>
        </div>

        <section className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-xl font-semibold text-slate-900 mb-4">
            Eventos recentes
          </h3>

          <div className="space-y-4">
            {eventos.length === 0 && (
              <p className="text-slate-500">Nenhum evento encontrado.</p>
            )}

            {eventos.map((ev) => (
              <div
                key={ev.id}
                className="border border-slate-200 rounded-xl p-4"
              >
                <h4 className="text-lg font-bold text-slate-900">
                  {ev.client_name}
                </h4>

                <p className="text-slate-600 mt-1">
                  {ev.event_date || '-'} • {ev.event_time || '-'}
                </p>

                <p className="text-slate-500 mt-1">
                  Local: {ev.location_name || '-'}
                </p>

                <div className="mt-3">
                  <span className="inline-block rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-sm">
                    Status: {ev.status || '-'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
