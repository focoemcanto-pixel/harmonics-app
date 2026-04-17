'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import AdminShell from '@/components/admin/AdminShell';
import AdminPageHero from '@/components/admin/AdminPageHero';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';
import AdminSegmentTabs from '@/components/admin/AdminSegmentTabs';

import { cleanPhone } from '@/lib/contatos/contatos-format';
import {
  filterBySearchTerm,
  filterByActive,
  sortContatos,
  getUniqueTags,
} from '@/lib/contatos/contatos-filters';
import { resolveContactType, isClientType, isMemberType } from '@/lib/contatos/contact-type';

import ContatosFormularioTab from '@/components/contatos/ContatosFormularioTab';
import ContatosListaTab from '@/components/contatos/ContatosListaTab';

function getInitialForm() {
  return {
    name: '',
    email: '',
    phone: '',
    tag: '',
    notes: '',
    contact_type: 'musician',
    is_active: true,
  };
}

const DESKTOP_TABS = [
  { key: 'lista', label: 'Lista' },
  { key: 'novo', label: 'Novo / Editar' },
];
const CONTACTS_SELECT_FIELDS =
  'id, created_at, name, email, phone, tag, notes, contact_type, is_active';
let contatosCache = [];

export default function ContatosPage() {
  const [contatos, setContatos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [form, setForm] = useState(getInitialForm());

  const [busca, setBusca] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortMode, setSortMode] = useState('name_asc');
  const [segment, setSegment] = useState('members');

  const [desktopTab, setDesktopTab] = useState('lista');
  const [mobileTab, setMobileTab] = useState('lista');
  const [selectedClientIds, setSelectedClientIds] = useState(new Set());

  const desktopFormRef = useRef(null);
  const mobileFormRef = useRef(null);
  const desktopFirstInputRef = useRef(null);
  const mobileFirstInputRef = useRef(null);

  const loadingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  const carregarContatos = useCallback(async ({ background = false } = {}) => {
    if (loadingRef.current) return;

    try {
      loadingRef.current = true;
      if (isMountedRef.current) {
        if (!background || contatosCache.length === 0) {
          setCarregando(true);
        }
        setErrorMessage('');
      }

      const { data, error } = await supabase
        .from('contacts')
        .select(CONTACTS_SELECT_FIELDS)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (isMountedRef.current) {
        setContatos(data || []);
        contatosCache = data || [];
      }
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);

      if (isMountedRef.current) {
        setErrorMessage(error?.message || 'Erro ao carregar contatos');
      }
    } finally {
      if (isMountedRef.current) {
        setCarregando(false);
      }
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (contatosCache.length > 0) {
      setContatos(contatosCache);
      setCarregando(false);
      carregarContatos({ background: true });
      return;
    }

    carregarContatos();
  }, [carregarContatos]);

  useEffect(() => {
    contatosCache = contatos;
  }, [contatos]);

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function iniciarEdicao(contato) {
    setErrorMessage('');
    setEditandoId(contato.id);

    setForm({
      name: contato.name || '',
      email: contato.email || '',
      phone: contato.phone || '',
      tag: contato.tag || '',
      notes: contato.notes || '',
      contact_type: resolveContactType(contato),
      is_active: contato.is_active !== false,
    });

    setDesktopTab('novo');
    setMobileTab('novo');
  }

  function cancelarEdicao() {
    setErrorMessage('');
    setEditandoId(null);
    setForm(getInitialForm());
  }

  async function salvarContato() {
    if (salvando) return;

    if (!form.name.trim()) {
      setErrorMessage('Informe o nome do contato.');
      return;
    }

    try {
      setSalvando(true);
      setErrorMessage('');

      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: cleanPhone(form.phone),
        tag: form.tag.trim() || null,
        notes: form.notes.trim() || null,
        contact_type: form.contact_type,
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
      await carregarContatos({ background: true });
      setDesktopTab('lista');
      setMobileTab('lista');
    } catch (error) {
      console.error('Erro ao salvar contato:', error);
      setErrorMessage(error?.message || 'Erro ao salvar contato');
    } finally {
      setSalvando(false);
    }
  }

  async function excluirContato(id) {
    if (salvando) return;
    if (!confirm('Tem certeza que deseja excluir este contato?')) return;

    try {
      setSalvando(true);
      setErrorMessage('');

      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (editandoId === id) cancelarEdicao();

      await carregarContatos({ background: true });
    } catch (error) {
      console.error('Erro ao excluir contato:', error);
      setErrorMessage(error?.message || 'Erro ao excluir contato');
    } finally {
      setSalvando(false);
    }
  }

  const uniqueTags = useMemo(() => getUniqueTags(contatos), [contatos]);

  const contatosFiltrados = useMemo(() => {
    let lista = [...contatos];

    if (segment === 'members') {
      lista = lista.filter((item) => isMemberType(item));
    } else if (segment === 'clients') {
      lista = lista.filter((item) => isClientType(item));
    }

    if (typeFilter !== 'all') {
      lista = lista.filter((item) => resolveContactType(item) === typeFilter);
    }

    lista = filterBySearchTerm(lista, busca);
    lista = filterByActive(lista, activeFilter);
    lista = sortContatos(lista, sortMode);

    return lista;
  }, [contatos, busca, activeFilter, sortMode, typeFilter, segment]);

  const resumo = useMemo(() => {
    const total = contatos.length;
    const membrosAtivos = contatos.filter((c) => isMemberType(c) && c.is_active !== false).length;
    const clientes = contatos.filter((c) => isClientType(c)).length;
    const novosContatos = contatos.filter((c) => {
      if (!c.created_at) return false;
      const createdAt = new Date(c.created_at).getTime();
      const now = Date.now();
      const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;
      return now - createdAt <= THIRTY_DAYS;
    }).length;

    return { total, membrosAtivos, clientes, novosContatos };
  }, [contatos]);

  const contatosClientesFiltrados = useMemo(
    () => contatosFiltrados.filter((item) => isClientType(item)),
    [contatosFiltrados]
  );

  const handleToggleSelectClient = useCallback((id) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleSelectAllFilteredClients = useCallback(() => {
    setSelectedClientIds(new Set(contatosClientesFiltrados.map((item) => String(item.id))));
  }, [contatosClientesFiltrados]);

  const handleClearSelection = useCallback(() => {
    setSelectedClientIds(new Set());
  }, []);

  async function excluirClientesSelecionados() {
    if (salvando || segment !== 'clients') return;
    const ids = Array.from(selectedClientIds);
    if (!ids.length) return;

    const confirmed = confirm(
      `Você está prestes a excluir ${ids.length} cliente(s). Essa ação não poderá ser desfeita. Deseja continuar?`
    );

    if (!confirmed) return;

    try {
      setSalvando(true);
      setErrorMessage('');

      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', ids);

      if (error) throw error;

      setSelectedClientIds(new Set());
      await carregarContatos({ background: true });
    } catch (error) {
      console.error('Erro ao excluir clientes em massa:', error);
      setErrorMessage(error?.message || 'Erro ao excluir clientes selecionados');
    } finally {
      setSalvando(false);
    }
  }

  const mobileTabs = [
    { key: 'lista', label: 'Lista' },
    { key: 'novo', label: editandoId ? 'Editar' : 'Novo' },
  ];

  useEffect(() => {
    setSelectedClientIds(new Set());
  }, [segment, busca, activeFilter, sortMode, typeFilter]);

  const mobileActions = (
    <button
      type="button"
      onClick={() => {
        setErrorMessage('');
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
      <AdminShell pageTitle="Contatos" activeItem="contatos" mobileActions={mobileActions}>
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <p className="text-center text-[#64748b]">Carregando contatos...</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell pageTitle="Contatos" activeItem="contatos" mobileActions={mobileActions}>
      <div className="space-y-5">
        {errorMessage && (
          <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        <AdminPageHero
          badge="Harmonics Admin"
          title="Contatos"
          subtitle="Separe claramente equipe operacional e clientes comerciais em uma única visão premium."
          actions={
            <button
              type="button"
              onClick={() => {
                setErrorMessage('');
                setEditandoId(null);
                setForm(getInitialForm());
                setDesktopTab('novo');
                setMobileTab('novo');
              }}
              className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
            >
              Novo contato
            </button>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminSummaryCard label="Total de contatos" value={resumo.total} helper="Base geral" />
          <AdminSummaryCard label="Membros ativos" value={resumo.membrosAtivos} helper="Escalas e convites" tone="success" />
          <AdminSummaryCard label="Clientes" value={resumo.clientes} helper="Eventos e contratos" tone="warning" />
          <AdminSummaryCard label="Novos contatos" value={resumo.novosContatos} helper="Últimos 30 dias" tone="accent" />
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
              segment={segment}
              setSegment={setSegment}
              busca={busca}
              setBusca={setBusca}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              sortMode={sortMode}
              setSortMode={setSortMode}
              iniciarEdicao={iniciarEdicao}
              excluirContato={excluirContato}
              selectedIds={selectedClientIds}
              onToggleSelect={handleToggleSelectClient}
              onSelectAllFiltered={handleSelectAllFilteredClients}
              onClearSelection={handleClearSelection}
              onBulkDeleteClients={excluirClientesSelecionados}
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
              segment={segment}
              setSegment={setSegment}
              busca={busca}
              setBusca={setBusca}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              sortMode={sortMode}
              setSortMode={setSortMode}
              iniciarEdicao={iniciarEdicao}
              excluirContato={excluirContato}
              selectedIds={selectedClientIds}
              onToggleSelect={handleToggleSelectClient}
              onSelectAllFiltered={handleSelectAllFilteredClients}
              onClearSelection={handleClearSelection}
              onBulkDeleteClients={excluirClientesSelecionados}
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
