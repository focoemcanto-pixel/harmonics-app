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

function getInitialForm() {
  return {
    event_id: '',
    musician_id: '',
    role: '',
    status: 'pending',
    notes: '',
  };
}

const DESKTOP_TABS = [
  { key: 'lista', label: 'Lista' },
  { key: 'nova', label: 'Nova / Editar' },
];

export default function EscalasPage() {
  const [mobileTab, setMobileTab] = useState('resumo');
  const [desktopTab, setDesktopTab] = useState('lista');
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [escalas, setEscalas] = useState([]);
  const [contatos, setContatos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [escalaSelecionada, setEscalaSelecionada] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(getInitialForm());

  const mobileTabs = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'lista', label: 'Lista' },
    { key: 'nova', label: escalaSelecionada ? 'Editar' : 'Nova' },
  ];

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function carregar() {
    try {
      setCarregando(true);
      setErro('');

      const { data, error } = await supabase
        .from('escalas')
        .select(`
          *,
          events (id, client_name, event_date),
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

  async function carregarContatos() {
    const { data } = await supabase
      .from('contacts')
      .select('id, name, email, phone, contact_type')
      .eq('is_active', true)
      .in('contact_type', ['musician', 'staff'])
      .order('name', { ascending: true });

    setContatos(data || []);
  }

  async function carregarEventos() {
    const { data } = await supabase
      .from('events')
      .select('id, client_name, event_date')
      .order('event_date', { ascending: false });

    setEventos(data || []);
  }

  useEffect(() => {
    carregar();
    carregarContatos();
    carregarEventos();
  }, []);

  function iniciarEdicao(escala) {
    setEscalaSelecionada(escala);
    setForm({
      event_id: escala.event_id || '',
      musician_id: escala.musician_id || '',
      role: escala.role || '',
      status: escala.status || 'pending',
      notes: escala.notes || '',
    });
    setDesktopTab('nova');
    setMobileTab('nova');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelarEdicao() {
    setEscalaSelecionada(null);
    setForm(getInitialForm());
  }

  async function handleSave() {
    if (!form.event_id) {
      alert('Selecione um evento.');
      return;
    }
    if (!form.musician_id) {
      alert('Selecione um músico.');
      return;
    }
    if (!form.role) {
      alert('Informe a função/instrumento.');
      return;
    }

    try {
      setSalvando(true);

      // Buscar dados atuais do contato para snapshot
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('name, email, phone')
        .eq('id', form.musician_id)
        .single();

      if (contactError) {
        console.error('Erro ao buscar contato:', contactError);
        alert('Erro ao buscar dados do músico');
        return;
      }

      // Preparar payload com snapshots
      const payload = {
        event_id: form.event_id,
        musician_id: form.musician_id,
        role: form.role,
        status: form.status,
        notes: form.notes.trim() || null,
        // Snapshots (copiados de contacts)
        musician_name: contactData?.name || null,
        musician_email: contactData?.email || null,
        musician_phone: contactData?.phone || null,
      };

      // Gerenciar confirmed_at
      if (form.status === 'confirmed' && (!escalaSelecionada || escalaSelecionada.status !== 'confirmed')) {
        payload.confirmed_at = new Date().toISOString();
      }
      if (form.status !== 'confirmed' && escalaSelecionada?.status === 'confirmed') {
        payload.confirmed_at = null;
      }

      if (escalaSelecionada?.id) {
        const { error } = await supabase
          .from('escalas')
          .update(payload)
          .eq('id', escalaSelecionada.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('escalas')
          .insert([payload]);

        if (error) throw error;
      }

      await carregar();
      cancelarEdicao();
      setDesktopTab('lista');
      setMobileTab('lista');
    } catch (error) {
      console.error('Erro ao salvar escala:', error);
      alert('Erro ao salvar escala: ' + (error?.message || 'erro desconhecido'));
    } finally {
      setSalvando(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Tem certeza que deseja excluir esta escala?')) return;

    try {
      const { error } = await supabase
        .from('escalas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (escalaSelecionada?.id === id) cancelarEdicao();
      await carregar();
    } catch (error) {
      console.error('Erro ao excluir escala:', error);
      alert('Erro ao excluir escala: ' + (error?.message || 'erro desconhecido'));
    }
  }

  async function handleChangeStatus(id, newStatus) {
    try {
      const payload = { status: newStatus };
      if (newStatus === 'confirmed') {
        payload.confirmed_at = new Date().toISOString();
      } else {
        payload.confirmed_at = null;
      }

      const { error } = await supabase
        .from('escalas')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
      await carregar();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status: ' + (error?.message || 'erro desconhecido'));
    }
  }

  const escalasFiltradas = useMemo(() => {
    let resultado = escalas;
    resultado = filterBySearch(resultado, busca);
    resultado = filterByStatus(resultado, statusFiltro);
    return resultado;
  }, [escalas, busca, statusFiltro]);

  const resumo = useMemo(() => getEscalasSummary(escalas), [escalas]);

  const mobileActions = (
    <button
      type="button"
      onClick={() => {
        setEscalaSelecionada(null);
        setForm(getInitialForm());
        setMobileTab('nova');
      }}
      className="rounded-[16px] bg-[#0f172a] px-4 py-3 text-[13px] font-black text-white"
    >
      Nova
    </button>
  );

  if (carregando) {
    return (
      <AdminShell pageTitle="Escalas" activeItem="escalas" mobileActions={mobileActions}>
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <p className="text-center text-[#64748b]">Carregando escalas...</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell pageTitle="Escalas" activeItem="escalas" mobileActions={mobileActions}>
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Escalas"
          subtitle="Monte equipes, acompanhe confirmações e organize a operação musical."
          actions={
            <button
              type="button"
              onClick={() => {
                setEscalaSelecionada(null);
                setForm(getInitialForm());
                setDesktopTab('nova');
                setMobileTab('nova');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
            >
              Nova escala
            </button>
          }
        />

        {/* Desktop - tabs */}
        <div className="hidden md:block">
          <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-2 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
            <div className="flex flex-wrap gap-2">
              {DESKTOP_TABS.map((tab) => {
                const active = desktopTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setDesktopTab(tab.key)}
                    className={`rounded-[18px] px-4 py-3 text-[14px] font-black transition ${
                      active
                        ? 'bg-violet-600 text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]'
                        : 'bg-[#f8fafc] text-[#475569] hover:bg-[#eef2ff]'
                    }`}
                  >
                    {tab.key === 'nova' && escalaSelecionada ? 'Editar' : tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="hidden space-y-5 md:block">
          {desktopTab === 'lista' && (
            <>
              <EscalasResumoTab resumo={resumo} setMobileTab={setDesktopTab} />
              <EscalasListaTab
                escalas={escalasFiltradas}
                busca={busca}
                setBusca={setBusca}
                statusFiltro={statusFiltro}
                setStatusFiltro={setStatusFiltro}
                onEdit={iniciarEdicao}
                onDelete={handleDelete}
                onChangeStatus={handleChangeStatus}
              />
            </>
          )}

          {desktopTab === 'nova' && (
            <EscalasFormularioTab
              editandoId={escalaSelecionada?.id}
              form={form}
              handleFormChange={handleFormChange}
              onSave={handleSave}
              onCancel={cancelarEdicao}
              salvando={salvando}
              eventos={eventos}
              contatos={contatos}
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
              onEdit={iniciarEdicao}
              onDelete={handleDelete}
              onChangeStatus={handleChangeStatus}
            />
          )}
          {mobileTab === 'nova' && (
            <EscalasFormularioTab
              editandoId={escalaSelecionada?.id}
              form={form}
              handleFormChange={handleFormChange}
              onSave={handleSave}
              onCancel={cancelarEdicao}
              salvando={salvando}
              eventos={eventos}
              contatos={contatos}
            />
          )}
        </div>
      </div>
    </AdminShell>
  );
}
