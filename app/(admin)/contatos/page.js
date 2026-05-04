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
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';
import { useAppToast } from '@/components/ui/ToastProvider';
import { useBulkDelete } from '@/hooks/useBulkDelete';

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
  const toast = useAppToast();
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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const { loading: deletingMany, run: runBulkDelete } = useBulkDelete();

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    ids: [],
    mode: 'single',
    state: 'idle',
    message: '',
  });

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

    const response = await fetch('/api/contacts');
    const json = await response.json();

    if (!response.ok || !json?.ok) {
      throw new Error(json?.message || 'Erro ao carregar contatos');
    }

    if (isMountedRef.current) {
      setContatos(json.data || []);
      contatosCache = json.data || [];
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

    const response = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editandoId,
        payload,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result?.ok) {
      throw new Error(result?.message || 'Erro ao salvar contato');
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

  const filteredIds = useMemo(
    () => contatosFiltrados.map((item) => String(item.id)),
    [contatosFiltrados]
  );

  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
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

  const handleSelectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filteredIds));
  }, [filteredIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  function abrirDialogoExclusao(ids, mode) {
    const normalizedIds = Array.from(new Set((ids || []).map((id) => String(id)).filter(Boolean)));
    if (!normalizedIds.length) return;
    setDeleteDialog({
      open: true,
      ids: normalizedIds,
      mode,
      state: 'confirming',
      message: '',
    });
  }

  function fecharDialogoExclusao() {
    if (deleteDialog.state === 'deleting' || deletingMany) return;
    setDeleteDialog({ open: false, ids: [], mode: 'single', state: 'idle', message: '' });
  }

  function excluirContato(id) {
    if (salvando) return;
    abrirDialogoExclusao([id], 'single');
  }

  async function excluirContatosSelecionados() {
    if (salvando) return;
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    abrirDialogoExclusao(ids, 'bulk');
  }

  async function confirmarExclusao() {
    const ids = deleteDialog.ids;
    if (!ids.length || salvando || deletingMany) return;

    try {
      setSalvando(true);
      setErrorMessage('');
      setDeleteDialog((prev) => ({ ...prev, state: 'deleting', message: '' }));

      const res = await runBulkDelete({
        endpoint: '/api/contacts/delete-many',
        idsKey: 'contactIds',
        ids,
      });
      console.log('[DELETE_RESULT]', res);

      if (!res?.success) {
        const reason = res?.message || 'Erro na operação';
        setDeleteDialog((prev) => ({ ...prev, state: 'error', message: reason }));
        setErrorMessage(reason);
        toast.error(reason);
        return;
      }

      const deletedIds = (res.ids || []).map((id) => String(id));

      if (editandoId && deletedIds.includes(String(editandoId))) cancelarEdicao();
      setContatos((prev) => prev.filter((item) => !deletedIds.includes(String(item.id))));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deletedIds.forEach((id) => next.delete(String(id)));
        return next;
      });
      setDeleteDialog((prev) => ({ ...prev, state: 'success' }));

      toast.success(res.message || `${res.affected || 0} itens processados`);
      await carregarContatos({ background: true });
      setDeleteDialog({ open: false, ids: [], mode: 'single', state: 'idle', message: '' });
    } catch (error) {
      const reason =
        error?.message ||
        'Não foi possível excluir o contato devido a vínculos operacionais ativos.';
      console.error('Erro ao excluir contato(s):', error);
      setDeleteDialog((prev) => ({ ...prev, state: 'error', message: reason }));
      setErrorMessage(reason);
      toast.error(reason);
    } finally {
      setSalvando(false);
    }
  }

  const mobileTabs = [
    { key: 'lista', label: 'Lista' },
    { key: 'novo', label: editandoId ? 'Editar' : 'Novo' },
  ];

  useEffect(() => {
    setSelectedIds(new Set());
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
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAllFiltered={handleSelectAllFiltered}
              onClearSelection={handleClearSelection}
              onBulkDelete={excluirContatosSelecionados}
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
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAllFiltered={handleSelectAllFiltered}
              onClearSelection={handleClearSelection}
              onBulkDelete={excluirContatosSelecionados}
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
      <DeleteConfirmModal
        open={deleteDialog.open}
        title={
          deleteDialog.mode === 'bulk'
            ? `Excluir ${deleteDialog.ids.length} contatos selecionados?`
            : 'Excluir contato?'
        }
        description={
          deleteDialog.mode === 'bulk'
            ? 'Esta ação removerá os contatos selecionados. A ação é definitiva.'
            : 'Esta ação removerá este contato do sistema. Se houver vínculos operacionais ativos, a exclusão poderá ser bloqueada.'
        }
        loading={deleteDialog.state === 'deleting'}
        onCancel={fecharDialogoExclusao}
        onConfirm={confirmarExclusao}
      />
    </AdminShell>
  );
}
