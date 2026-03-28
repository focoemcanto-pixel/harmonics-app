'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdminShell from '../../components/admin/AdminShell';
import AdminPageHero from '../../components/admin/AdminPageHero';
import AdminSegmentTabs from '../../components/admin/AdminSegmentTabs';

// Helpers
import { filterBySearch, filterByStatus } from '../../lib/escalas/escalas-filters';
import { getEscalasSummary } from '../../lib/escalas/escalas-summary';

// Components
import EscalasResumoTab from '../../components/escalas/EscalasResumoTab';
import EscalasFormularioTab from '../../components/escalas/EscalasFormularioTab';
import EscalaCard from '../../components/escalas/EscalaCard';

export default function EscalasPage() {
  const [mobileTab, setMobileTab] = useState('resumo');
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [escalas, setEscalas] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [contatos, setContatos] = useState([]);
  const [escalaSelecionada, setEscalaSelecionada] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const mobileTabs = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'lista', label: 'Lista' },
    { key: 'formulario', label: 'Formulário' },
  ];

  async function carregar() {
    try {
      setCarregando(true);
      setErro('');

      const { data, error } = await supabase
        .from('event_musicians')
        .select(`
          *,
          event:events(id, client_name, event_date, event_time, location),
          musician:contacts(id, name, phone, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEscalas(data || []);
    } catch (e) {
      console.error('Erro ao carregar escalas:', e);
      setErro('Não foi possível carregar as escalas.');
    } finally {
      setCarregando(false);
    }
  }

  async function carregarEventos() {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, client_name')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEventos(data || []);
    } catch (e) {
      console.error('Erro ao carregar eventos:', e);
    }
  }

  async function carregarContatos() {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone')
        .order('name', { ascending: true });

      if (error) throw error;
      setContatos(data || []);
    } catch (e) {
      console.error('Erro ao carregar contatos:', e);
    }
  }

  useEffect(() => {
    carregar();
    carregarEventos();
    carregarContatos();
  }, []);

  const escalasFiltradas = useMemo(() => {
    let resultado = escalas;
    resultado = filterBySearch(resultado, busca);
    resultado = filterByStatus(resultado, statusFiltro);
    return resultado;
  }, [escalas, busca, statusFiltro]);

  const resumo = useMemo(() => getEscalasSummary(escalas), [escalas]);

  async function handleSave(form) {
    try {
      setSalvando(true);

      if (escalaSelecionada?.id) {
        const payload = {
          event_id: form.event_id,
          musician_id: form.musician_id,
          role: form.role,
          status: form.status,
          notes: form.notes,
        };

        if (form.status === 'confirmed' && escalaSelecionada.status !== 'confirmed') {
          payload.confirmed_at = new Date().toISOString();
        }

        if (form.status !== 'confirmed' && escalaSelecionada.status === 'confirmed') {
          payload.confirmed_at = null;
        }

        const { error } = await supabase
          .from('event_musicians')
          .update(payload)
          .eq('id', escalaSelecionada.id);

        if (error) throw error;
      } else {
        const payload = {
          event_id: form.event_id,
          musician_id: form.musician_id,
          role: form.role,
          status: form.status,
          notes: form.notes,
        };

        if (form.status === 'confirmed') {
          payload.confirmed_at = new Date().toISOString();
        }

        const { error } = await supabase
          .from('event_musicians')
          .insert([payload]);

        if (error) throw error;
      }

      await carregar();
      setEscalaSelecionada(null);
      setMostrarFormulario(false);
      setMobileTab('lista');
    } catch (error) {
      console.error('Erro ao salvar escala:', error);
      alert('Erro ao salvar escala: ' + (error?.message || 'erro desconhecido'));
    } finally {
      setSalvando(false);
    }
  }

  async function handleDelete(escalaId) {
    const ok = confirm('Deseja realmente excluir esta escala?');
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('event_musicians')
        .delete()
        .eq('id', escalaId);

      if (error) throw error;
      await carregar();
    } catch (error) {
      console.error('Erro ao deletar escala:', error);
      alert('Erro ao deletar escala: ' + (error?.message || 'erro desconhecido'));
    }
  }

  async function handleChangeStatus(escalaId, novoStatus) {
    try {
      const payload = {
        status: novoStatus,
        confirmed_at: novoStatus === 'confirmed' ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from('event_musicians')
        .update(payload)
        .eq('id', escalaId);

      if (error) throw error;
      await carregar();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      alert('Erro ao alterar status: ' + (error?.message || 'erro desconhecido'));
    }
  }

  function handleEdit(escala) {
    setEscalaSelecionada(escala);
    setMostrarFormulario(true);
    setMobileTab('formulario');
  }

  async function handleEnviarConvite(escalaId) {
    const escala = escalas.find((item) => item.id === escalaId);
    const isResend = escala?.invite_sent_at != null;
    const message = isResend
      ? 'Reenviar convite para este músico?'
      : 'Enviar convite por email para este músico?';

    if (!confirm(message)) return;

    try {
      setEnviando(true);

      const response = await fetch('/api/escalas/enviar-convite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalaId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar convite');
      }

      await carregar();
      alert('✅ Convite enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar convite:', error);
      alert('❌ Erro: ' + error.message);
    } finally {
      setEnviando(false);
    }
  }

  function handleNovo() {
    setEscalaSelecionada(null);
    setMostrarFormulario(true);
    setMobileTab('formulario');
  }

  function renderLista() {
    return (
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-[#7c3aed]">
              Escalas cadastradas
            </div>
            <h2 className="mt-1 text-[26px] font-black tracking-[-0.03em] text-[#0f172a]">
              Lista operacional
            </h2>
            <p className="mt-1 text-[14px] leading-6 text-[#64748b]">
              Acompanhe o elenco escalado, edite funções e controle confirmações.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1.3fr_220px]">
          <div>
            <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Buscar
            </label>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por músico, evento ou função..."
              className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Status
            </label>
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
            >
              <option value="todos">Todos</option>
              <option value="pending">Pendentes</option>
              <option value="confirmed">Confirmados</option>
              <option value="declined">Recusados</option>
              <option value="backup">Reserva</option>
            </select>
          </div>
        </div>

        {erro ? (
          <div className="mt-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-bold text-red-700">
            {erro}
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          {escalasFiltradas.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#dbe3ef] bg-[#f8fafc] px-5 py-8 text-center">
              <div className="text-[14px] font-black uppercase tracking-[0.12em] text-[#94a3b8]">
                Nenhuma escala encontrada
              </div>
              <p className="mt-2 text-[14px] leading-6 text-[#64748b]">
                Ajuste os filtros ou cadastre uma nova escala para começar.
              </p>
            </div>
          ) : (
            escalasFiltradas.map((escala) => (
              <EscalaCard
                key={escala.id}
                escala={{ ...escala, status: escala.status || 'pending' }}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onChangeStatus={handleChangeStatus}
                onEnviarConvite={handleEnviarConvite}
                enviando={enviando}
              />
            ))
          )}
        </div>
      </section>
    );
  }

  if (carregando) {
    return (
      <AdminShell pageTitle="Escalas" activeItem="escalas">
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <p className="text-center text-[#64748b]">Carregando escalas...</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell pageTitle="Escalas" activeItem="escalas">
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Escalas"
          subtitle="Monte equipes, acompanhe confirmações e organize a operação musical."
          actions={
            <button
              type="button"
              onClick={handleNovo}
              className="hidden md:inline-flex rounded-[18px] bg-violet-600 px-6 py-3 text-[14px] font-black text-white transition hover:bg-violet-700"
            >
              Nova escala
            </button>
          }
        />

        <div className="md:hidden">
          <button
            type="button"
            onClick={handleNovo}
            className="w-full rounded-[18px] bg-violet-600 px-6 py-3 text-[14px] font-black text-white transition hover:bg-violet-700"
          >
            Nova escala
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-5">
            <EscalasResumoTab
              resumo={resumo}
              onVerTodas={() => {
                setBusca('');
                setStatusFiltro('todos');
                setMobileTab('lista');
              }}
              onVerPendentes={() => {
                setStatusFiltro('pending');
                setMobileTab('lista');
              }}
            />

            <div className="hidden xl:block">{renderLista()}</div>
          </div>

          <div className="space-y-5">
            {mostrarFormulario ? (
              <EscalasFormularioTab
                escalaSelecionada={escalaSelecionada}
                eventos={eventos}
                contatos={contatos}
                onSave={handleSave}
                onCancel={() => {
                  setEscalaSelecionada(null);
                  setMostrarFormulario(false);
                  setMobileTab('lista');
                }}
                salvando={salvando}
              />
            ) : (
              <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
                <div className="text-[12px] font-black uppercase tracking-[0.14em] text-[#7c3aed]">
                  Ações rápidas
                </div>
                <h3 className="mt-2 text-[28px] font-black tracking-[-0.03em] text-[#0f172a]">
                  Comece uma nova escala
                </h3>
                <p className="mt-2 text-[15px] leading-7 text-[#64748b]">
                  Selecione um evento e atribua músicos ou prestadores para organizar sua operação.
                </p>

                <div className="mt-6 rounded-[22px] border border-dashed border-[#dbe3ef] bg-[#f8fafc] p-5">
                  <p className="text-[14px] leading-6 text-[#64748b]">
                    Clique no botão <span className="font-black text-[#0f172a]">Nova escala</span> para abrir o formulário.
                  </p>
                </div>
              </section>
            )}
          </div>
        </div>

        <div className="xl:hidden">
          <AdminSegmentTabs
            items={mobileTabs}
            active={mobileTab}
            onChange={setMobileTab}
          />

          <div className="mt-4">
            {mobileTab === 'resumo' && (
              <EscalasResumoTab
                resumo={resumo}
                onVerTodas={() => {
                  setBusca('');
                  setStatusFiltro('todos');
                  setMobileTab('lista');
                }}
                onVerPendentes={() => {
                  setStatusFiltro('pending');
                  setMobileTab('lista');
                }}
              />
            )}

            {mobileTab === 'lista' && renderLista()}

            {mobileTab === 'formulario' &&
              (mostrarFormulario ? (
                <EscalasFormularioTab
                  escalaSelecionada={escalaSelecionada}
                  eventos={eventos}
                  contatos={contatos}
                  onSave={handleSave}
                  onCancel={() => {
                    setEscalaSelecionada(null);
                    setMostrarFormulario(false);
                    setMobileTab('lista');
                  }}
                  salvando={salvando}
                />
              ) : (
                <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
                  <div className="text-[12px] font-black uppercase tracking-[0.14em] text-[#7c3aed]">
                    Formulário
                  </div>
                  <h3 className="mt-2 text-[26px] font-black tracking-[-0.03em] text-[#0f172a]">
                    Nenhuma escala em edição
                  </h3>
                  <p className="mt-2 text-[15px] leading-7 text-[#64748b]">
                    Toque em <span className="font-black text-[#0f172a]">Nova escala</span> para cadastrar uma nova escala.
                  </p>
                </section>
              ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
