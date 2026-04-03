'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AdminShell from '@/components/admin/AdminShell';
import AdminPageHero from '@/components/admin/AdminPageHero';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';
import AdminSegmentTabs from '@/components/admin/AdminSegmentTabs';

import { cleanPhone } from '@/lib/contatos/contatos-format';
import {
  filterBySearchTerm,
  filterByTag,
  filterByActive,
  sortContatos,
  getUniqueTags,
} from '@/lib/contatos/contatos-filters';

import ContatosFormularioTab from '@/components/contatos/ContatosFormularioTab';
import ContatosListaTab from '@/components/contatos/ContatosListaTab';

function getInitialForm() {
  return {
    name: '',
    email: '',
    phone: '',
    tag: '',
    notes: '',
    is_active: true,
  };
}

const DESKTOP_TABS = [
  { key: 'lista', label: 'Lista' },
  { key: 'novo', label: 'Novo / Editar' },
];

export default function ContatosPage() {
  const [contatos, setContatos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const [form, setForm] = useState(getInitialForm());

  const [busca, setBusca] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortMode, setSortMode] = useState('name_asc');

  const [desktopTab, setDesktopTab] = useState('lista');
  const [mobileTab, setMobileTab] = useState('lista');

  const desktopFormRef = useRef(null);
  const mobileFormRef = useRef(null);
  const desktopFirstInputRef = useRef(null);
  const mobileFirstInputRef = useRef(null);

  useEffect(() => {
    if (desktopTab === 'novo' && desktopFormRef.current) {
      desktopFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      requestAnimationFrame(() => {
        desktopFirstInputRef.current?.focus();
      });
    }
  }, [desktopTab]);

  useEffect(() => {
    if (mobileTab === 'novo' && mobileFormRef.current) {
      mobileFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      requestAnimationFrame(() => {
        mobileFirstInputRef.current?.focus();
      });
    }
  }, [mobileTab]);

  async function carregarContatos() {
    try {
      setCarregando(true);

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setContatos(data || []);
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
      alert(`Erro ao carregar membros: ${error?.message}`);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarContatos();
  }, []);

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function iniciarEdicao(contato) {
    setEditandoId(contato.id);

    setForm({
      name: contato.name || '',
      email: contato.email || '',
      phone: contato.phone || '',
      tag: contato.tag || '',
      notes: contato.notes || '',
      is_active: contato.is_active !== false,
    });

    setDesktopTab('novo');
    setMobileTab('novo');
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(getInitialForm());
  }

  async function salvarContato() {
    if (!form.name.trim()) {
      alert('Informe o nome do membro.');
      return;
    }

    try {
      setSalvando(true);

      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: cleanPhone(form.phone),
        tag: form.tag.trim() || null,
        notes: form.notes.trim() || null,
        is_active: !!form.is_active,
      };

      if (editandoId) {
        const { error } = await supabase
          .from('contacts')
          .update(payload)
          .eq('id', editandoId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contacts')
          .insert([payload]);

        if (error) throw error;
      }

      cancelarEdicao();
      await carregarContatos();
      setDesktopTab('lista');
      setMobileTab('lista');
    } catch (error) {
      console.error('Erro ao salvar membro:', error);
      alert(`Erro ao salvar membro: ${error?.message}`);
    } finally {
      setSalvando(false);
    }
  }

  async function excluirContato(id) {
    if (!confirm('Tem certeza que deseja excluir este membro?')) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (editandoId === id) cancelarEdicao();

      await carregarContatos();
    } catch (error) {
      console.error('Erro ao excluir membro:', error);
      alert(`Erro ao excluir membro: ${error?.message}`);
    }
  }

  const uniqueTags = useMemo(() => getUniqueTags(contatos), [contatos]);

  const contatosFiltrados = useMemo(() => {
    let lista = [...contatos];

    lista = filterBySearchTerm(lista, busca);
    lista = filterByTag(lista, tagFilter);
    lista = filterByActive(lista, activeFilter);
    lista = sortContatos(lista, sortMode);

    return lista;
  }, [contatos, busca, tagFilter, activeFilter, sortMode]);

  const resumo = useMemo(() => {
    const total = contatos.length;
    const ativos = contatos.filter((c) => c.is_active !== false).length;
    const inativos = total - ativos;
    const comEmail = contatos.filter((c) => c.email).length;

    return { total, ativos, inativos, comEmail };
  }, [contatos]);

  const mobileTabs = [
    { key: 'lista', label: 'Lista' },
    { key: 'novo', label: editandoId ? 'Editar' : 'Novo' },
  ];

  const mobileActions = (
    <button
      type="button"
      onClick={() => {
        setEditandoId(null);
        setForm(getInitialForm());
        setMobileTab('novo');
      }}
      className="rounded-[16px] bg-[#0f172a] px-4 py-3 text-[13px] font-black text-white"
    >
      Novo
    </button>
  );

  if (carregando) {
    return (
      <AdminShell pageTitle="Membros" activeItem="contatos" mobileActions={mobileActions}>
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <p className="text-center text-[#64748b]">Carregando membros...</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell pageTitle="Membros" activeItem="contatos" mobileActions={mobileActions}>
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Membros da equipe"
          subtitle="Cadastre e gerencie os músicos e prestadores que participam das suas escalas."
          actions={
            <button
              type="button"
              onClick={() => {
                setEditandoId(null);
                setForm(getInitialForm());
                setDesktopTab('novo');
                setMobileTab('novo');
              }}
              className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
            >
              Novo membro
            </button>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminSummaryCard
            label="Total de membros"
            value={resumo.total}
            helper="Base operacional da equipe"
          />
          <AdminSummaryCard
            label="Ativos"
            value={resumo.ativos}
            helper="Disponíveis para escala"
            tone="success"
          />
          <AdminSummaryCard
            label="Inativos"
            value={resumo.inativos}
            helper="Ocultos da operação"
            tone="warning"
          />
          <AdminSummaryCard
            label="Com email"
            value={resumo.comEmail}
            helper="Prontos para acesso"
            tone="accent"
          />
        </div>

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
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="hidden md:block space-y-5">
          {desktopTab === 'lista' && (
            <ContatosListaTab
              contatosFiltrados={contatosFiltrados}
              busca={busca}
              setBusca={setBusca}
              tagFilter={tagFilter}
              setTagFilter={setTagFilter}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              sortMode={sortMode}
              setSortMode={setSortMode}
              uniqueTags={uniqueTags}
              iniciarEdicao={iniciarEdicao}
              excluirContato={excluirContato}
            />
          )}

          {desktopTab === 'novo' && (
            <div ref={desktopFormRef}>
              <ContatosFormularioTab
                editandoId={editandoId}
                form={form}
                handleFormChange={handleFormChange}
                salvarContato={salvarContato}
                cancelarEdicao={cancelarEdicao}
                salvando={salvando}
                uniqueTags={uniqueTags}
                firstInputRef={desktopFirstInputRef}
              />
            </div>
          )}
        </div>

        <div className="md:hidden">
          <AdminSegmentTabs items={mobileTabs} active={mobileTab} onChange={setMobileTab} />
        </div>

        <div className="space-y-5 md:hidden">
          {mobileTab === 'lista' && (
            <ContatosListaTab
              contatosFiltrados={contatosFiltrados}
              busca={busca}
              setBusca={setBusca}
              tagFilter={tagFilter}
              setTagFilter={setTagFilter}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              sortMode={sortMode}
              setSortMode={setSortMode}
              uniqueTags={uniqueTags}
              iniciarEdicao={iniciarEdicao}
              excluirContato={excluirContato}
            />
          )}

          {mobileTab === 'novo' && (
            <div ref={mobileFormRef}>
              <ContatosFormularioTab
                editandoId={editandoId}
                form={form}
                handleFormChange={handleFormChange}
                salvarContato={salvarContato}
                cancelarEdicao={cancelarEdicao}
                salvando={salvando}
                uniqueTags={uniqueTags}
                firstInputRef={mobileFirstInputRef}
              />
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
