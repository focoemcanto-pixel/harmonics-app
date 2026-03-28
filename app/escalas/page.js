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
import EscalasListaTab from '../../components/escalas/EscalasListaTab';
import EscalasFormularioTab from '../../components/escalas/EscalasFormularioTab';

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
        .from('escalas')
        .select(`
          *,
          events (id, client_name, event_date, event_time, location),
          contacts (id, name, phone, email)
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
    const { data } = await supabase
      .from('events')
      .select('id, client_name, event_date')
      .order('event_date', { ascending: false });

    setEventos(data || []);
  }

  async function carregarContatos() {
    const { data } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true });

    setContatos(data || []);
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
          .from('escalas')
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
          .from('escalas')
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
    try {
      const { error } = await supabase
        .from('escalas')
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
        .from('escalas')
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
    const escala = escalas.find((e) => e.id === escalaId);
    const isResend = escala?.invite_sent_at != null;
    const confirmMessage = isResend
      ? 'Reenviar convite para este músico?'
      : 'Enviar convite por email para este músico?';

    if (!confirm(confirmMessage)) return;

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

        {/* Mobile: botão nova escala */}
        <div className="md:hidden">
          <button
            type="button"
            onClick={handleNovo}
            className="w-full rounded-[18px] bg-violet-600 px-6 py-3 text-[14px] font-black text-white transition hover:bg-violet-700"
          >
            Nova escala
          </button>
        </div>

        {/* Desktop - always shows all sections */}
        <div className="hidden space-y-5 md:block">
          <EscalasResumoTab resumo={resumo} setMobileTab={setMobileTab} />
          <EscalasListaTab
            escalas={escalasFiltradas}
            busca={busca}
            setBusca={setBusca}
            statusFiltro={statusFiltro}
            setStatusFiltro={setStatusFiltro}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onChangeStatus={handleChangeStatus}
            onEnviarConvite={handleEnviarConvite}
          />
          {mostrarFormulario && (
            <EscalasFormularioTab
              escalaSelecionada={escalaSelecionada}
              eventos={eventos}
              contatos={contatos}
              onSave={handleSave}
              onCancel={() => {
                setEscalaSelecionada(null);
                setMostrarFormulario(false);
              }}
              salvando={salvando}
            />
          )}
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden">
          <AdminSegmentTabs
            items={mobileTabs}
            active={mobileTab}
            onChange={setMobileTab}
          />
        </div>

        <div className="space-y-5 md:hidden">
          {mobileTab === 'resumo' && (
            <EscalasResumoTab resumo={resumo} setMobileTab={setMobileTab} />
          )}
          {mobileTab === 'lista' && (
            <EscalasListaTab
              escalas={escalasFiltradas}
              busca={busca}
              setBusca={setBusca}
              statusFiltro={statusFiltro}
              setStatusFiltro={setStatusFiltro}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onChangeStatus={handleChangeStatus}
              onEnviarConvite={handleEnviarConvite}
            />
          )}
          {mobileTab === 'formulario' && (
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
          )}
        </div>
      </div>
    </AdminShell>
  );
}

