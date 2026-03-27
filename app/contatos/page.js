'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

// Layout premium
import AdminShell from '../../components/admin/AdminShell';
import AdminPageHero from '../../components/admin/AdminPageHero';
import AdminSegmentTabs from '../../components/admin/AdminSegmentTabs';
import AdminSectionTitle from '../../components/admin/AdminSectionTitle';

// Componentes de contatos
import ContatoCard from '../../components/contatos/ContatoCard';
import ContatosResumoTab from '../../components/contatos/ContatosResumoTab';
import ContatosFormularioTab from '../../components/contatos/ContatosFormularioTab';
import { Input, Select } from '../../components/eventos/EventFormPrimitives';

// Lógica modular
import { applyFilters, getTagsList } from '../../lib/contatos/contatos-filters';
import { cleanPhone, getInitials } from '../../lib/contatos/contatos-format';
import { getHealthStatus } from '../../lib/contatos/contatos-ui';

export default function ContatosPage() {
  const [contatos, setContatos] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [busca, setBusca] = useState('');
  const [tagFiltro, setTagFiltro] = useState('todas');
  const [statusFiltro, setStatusFiltro] = useState('todos');

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    tag: '',
    notes: '',
    is_active: true,
  });

  const [mobileTab, setMobileTab] = useState('resumo');
  const [desktopTab, setDesktopTab] = useState('visao');

  // ─── Backend ────────────────────────────────────────────────────────────────

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
      console.error('Erro ao carregar contatos:', error);
      alert(`Erro ao carregar contatos: ${error?.message}`);
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
      is_active: contato.is_active ?? true,
    });
    setDesktopTab('formulario');
    setMobileTab('formulario');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm({
      name: '',
      email: '',
      phone: '',
      tag: '',
      notes: '',
      is_active: true,
    });
  }

  async function salvarContato() {
    if (!form.name.trim()) {
      alert('Informe o nome');
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
        is_active: form.is_active,
      };

      let result;
      if (editandoId) {
        result = await supabase.from('contacts').update(payload).eq('id', editandoId);
      } else {
        result = await supabase.from('contacts').insert([payload]);
      }

      if (result.error) throw result.error;

      cancelarEdicao();
      await carregarContatos();
      setMobileTab('lista');
    } catch (error) {
      console.error('Erro ao salvar contato:', error);
      alert(`Erro ao salvar contato: ${error?.message}`);
    } finally {
      setSalvando(false);
    }
  }

  async function excluirContato(id) {
    if (!confirm('Excluir contato?')) return;

    try {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;

      if (editandoId === id) cancelarEdicao();
      await carregarContatos();
    } catch (error) {
      console.error('Erro ao excluir contato:', error);
      alert(`Erro ao excluir contato: ${error?.message}`);
    }
  }

  async function toggleStatus(id, currentStatus) {
    const { error } = await supabase
      .from('contacts')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      alert('Erro ao atualizar status');
      return;
    }

    setContatos((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, is_active: !currentStatus } : c
      )
    );
  }

  // ─── Computed ───────────────────────────────────────────────────────────────

  const contatosFiltrados = useMemo(() => {
    return applyFilters(contatos, { busca, tagFiltro, statusFiltro });
  }, [contatos, busca, tagFiltro, statusFiltro]);

  const tags = useMemo(() => getTagsList(contatos), [contatos]);

  const resumo = useMemo(() => {
    const total = contatosFiltrados.length;
    const ativos = contatosFiltrados.filter((c) => c.is_active).length;
    const completos = contatosFiltrados.filter(
      (c) => c.name && c.email && c.phone
    ).length;

    return { total, ativos, completos };
  }, [contatosFiltrados]);

  const healthStatus = useMemo(() => {
    return getHealthStatus(resumo);
  }, [resumo]);

  // ─── Tabs ───────────────────────────────────────────────────────────────────

  const DESKTOP_TABS = [
    { key: 'visao', label: 'Visão geral' },
    { key: 'formulario', label: editandoId ? 'Editar' : 'Novo' },
  ];

  const mobileTabs = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'formulario', label: editandoId ? 'Editar' : 'Novo contato' },
    { key: 'lista', label: 'Lista' },
  ];

  // ─── Mobile action ──────────────────────────────────────────────────────────

  const mobileActions = (
    <button
      type="button"
      onClick={() => {
        setEditandoId(null);
        cancelarEdicao();
        setMobileTab('formulario');
      }}
      className="rounded-[16px] bg-[#0f172a] px-4 py-3 text-[13px] font-black text-white"
    >
      Novo
    </button>
  );

  // ─── Lista ──────────────────────────────────────────────────────────────────

  function renderLista() {
    return (
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <AdminSectionTitle
          title="Contatos"
          subtitle="Pesquise, filtre e gerencie seus contatos."
        />

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, email, telefone..."
          />

          <Select value={tagFiltro} onChange={(e) => setTagFiltro(e.target.value)}>
            <option value="todas">Todas as tags</option>
            {tags.map((tag) => (
              <option key={tag.tag} value={tag.tag}>
                {tag.tag} ({tag.count})
              </option>
            ))}
          </Select>

          <Select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
          </Select>
        </div>

        <div className="space-y-4">
          {carregando ? (
            <div className="rounded-[20px] bg-[#f8fafc] px-4 py-5 text-[14px] font-semibold text-[#64748b]">
              Carregando contatos...
            </div>
          ) : contatosFiltrados.length === 0 ? (
            <div className="rounded-[20px] bg-[#f8fafc] px-4 py-5 text-[14px] font-semibold text-[#64748b]">
              Nenhum contato encontrado.
            </div>
          ) : (
            contatosFiltrados.map((c) => (
              <ContatoCard
                key={c.id}
                id={c.id}
                name={c.name}
                email={c.email}
                phone={c.phone}
                tag={c.tag}
                notes={c.notes}
                isActive={c.is_active}
                initials={getInitials(c.name)}
                onEdit={() => iniciarEdicao(c)}
                onDelete={() => excluirContato(c.id)}
                onToggleStatus={() => toggleStatus(c.id, c.is_active)}
              />
            ))
          )}
        </div>
      </section>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <AdminShell pageTitle="Contatos" activeItem="contatos" mobileActions={mobileActions}>
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Contatos"
          subtitle="Gerencie clientes, músicos e convidados com visão centralizada."
          actions={
            <button
              type="button"
              onClick={() => {
                setEditandoId(null);
                cancelarEdicao();
                setDesktopTab('formulario');
                setMobileTab('formulario');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
            >
              Novo contato
            </button>
          }
        />

        {/* Desktop tabs */}
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

        {/* Desktop content */}
        <div className="hidden md:block space-y-5">
          {desktopTab === 'visao' && (
            <>
              <ContatosResumoTab
                resumo={resumo}
                healthStatus={healthStatus}
                tags={tags}
                setTagFiltro={setTagFiltro}
                setDesktopTab={setDesktopTab}
                setMobileTab={setMobileTab}
              />
              {renderLista()}
            </>
          )}

          {desktopTab === 'formulario' && (
            <ContatosFormularioTab
              editandoId={editandoId}
              form={form}
              handleFormChange={handleFormChange}
              salvarContato={salvarContato}
              cancelarEdicao={cancelarEdicao}
              salvando={salvando}
            />
          )}
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden">
          <AdminSegmentTabs items={mobileTabs} active={mobileTab} onChange={setMobileTab} />
        </div>

        {/* Mobile content */}
        <div className="space-y-5 md:hidden">
          {mobileTab === 'resumo' && (
            <ContatosResumoTab
              resumo={resumo}
              healthStatus={healthStatus}
              tags={tags}
              setTagFiltro={setTagFiltro}
              setDesktopTab={setDesktopTab}
              setMobileTab={setMobileTab}
            />
          )}

          {mobileTab === 'formulario' && (
            <ContatosFormularioTab
              editandoId={editandoId}
              form={form}
              handleFormChange={handleFormChange}
              salvarContato={salvarContato}
              cancelarEdicao={cancelarEdicao}
              salvando={salvando}
            />
          )}

          {mobileTab === 'lista' && renderLista()}
        </div>
      </div>
    </AdminShell>
  );
}
