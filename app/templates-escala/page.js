'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdminShell from '../../components/admin/AdminShell';
import AdminPageHero from '../../components/admin/AdminPageHero';
import AdminSummaryCard from '../../components/admin/AdminSummaryCard';
import AdminSegmentTabs from '../../components/admin/AdminSegmentTabs';
import TemplatesEscalaListaTab from '../../components/templates-escala/TemplatesEscalaListaTab';
import TemplatesEscalaFormularioTab from '../../components/templates-escala/TemplatesEscalaFormularioTab';
import { filterOperationalTeamContacts } from '../../lib/escalas/team-contacts';

function getInitialForm() {
  return {
    name: '',
    formation: '',
    instruments: '',
    compatible_tags: '',
    suggestion_priority: 100,
    notes: '',
    is_active: true,
  };
}

const FORMATIONS = [
  'Solo',
  'Duo',
  'Trio',
  'Quarteto',
  'Quinteto',
  'Sexteto',
  'Septeto',
];

const DESKTOP_TABS = [
  { key: 'lista', label: 'Lista' },
  { key: 'novo', label: 'Novo / Editar' },
];

export default function TemplatesEscalaPage() {
  const [templates, setTemplates] = useState([]);
  const [templateItems, setTemplateItems] = useState([]);
  const [contatos, setContatos] = useState([]);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const [form, setForm] = useState(getInitialForm());
  const [itens, setItens] = useState([]);

  const [busca, setBusca] = useState('');
  const [formationFilter, setFormationFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');

  const [desktopTab, setDesktopTab] = useState('lista');
  const [mobileTab, setMobileTab] = useState('lista');

  async function carregarTudo() {
    try {
      setCarregando(true);

      const [templatesResp, itemsResp, contatosResp] = await Promise.all([
        supabase
          .from('scale_templates')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('scale_template_items')
          .select('*')
          .order('sort_order', { ascending: true }),
        supabase
          .from('contacts')
          .select('*')
          .order('name', { ascending: true }),
      ]);

      if (templatesResp.error) throw templatesResp.error;
      if (itemsResp.error) throw itemsResp.error;
      if (contatosResp.error) throw contatosResp.error;

      setTemplates(templatesResp.data || []);
      setTemplateItems(itemsResp.data || []);
      setContatos(filterOperationalTeamContacts(contatosResp.data || []));
    } catch (error) {
      console.error('Erro ao carregar templates de escala:', error);
      alert(`Erro ao carregar templates: ${error?.message}`);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(getInitialForm());
    setItens([]);
  }

  function iniciarNovo() {
    cancelarEdicao();
    setDesktopTab('novo');
    setMobileTab('novo');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function iniciarEdicao(template) {
    const contatosMap = new Map(contatos.map((c) => [String(c.id), c]));

    const itensDoTemplate = templateItems
      .filter((item) => String(item.template_id) === String(template.id))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((item) => {
        const contato = contatosMap.get(String(item.contact_id)) || null;
        if (!contato) return null;

        return {
          id: item.id,
          contact_id: item.contact_id,
          role: item.role || '',
          sort_order: item.sort_order || 0,
          name: contato?.name || '',
          email: contato?.email || '',
          phone: contato?.phone || '',
          tag: contato?.tag || '',
        };
      })
      .filter(Boolean);

    setEditandoId(template.id);
    setForm({
      name: template.name || '',
      formation: template.formation || '',
      instruments: template.instruments || '',
      compatible_tags: template.compatible_tags || '',
      suggestion_priority: Number(template.suggestion_priority ?? 100),
      notes: template.notes || '',
      is_active: template.is_active !== false,
    });
    setItens(itensDoTemplate);
    setDesktopTab('novo');
    setMobileTab('novo');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function adicionarContatoAoTemplate(contato) {
    setItens((prev) => {
      const exists = prev.some((item) => String(item.contact_id) === String(contato.id));
      if (exists) return prev;

      return [
        ...prev,
        {
          id: undefined,
          contact_id: contato.id,
          role: contato.tag || '',
          sort_order: prev.length,
          name: contato.name || '',
          email: contato.email || '',
          phone: contato.phone || '',
          tag: contato.tag || '',
        },
      ];
    });
  }

  function removerItem(index) {
    setItens((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((item, idx) => ({ ...item, sort_order: idx }))
    );
  }

  function atualizarItem(index, field, value) {
    setItens((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  async function salvarTemplate() {
    if (!form.name.trim()) {
      alert('Informe o nome do template.');
      return;
    }

    if (!form.formation.trim()) {
      alert('Informe a formação.');
      return;
    }

    if (itens.length === 0) {
      alert('Adicione pelo menos um membro ao template.');
      return;
    }

    const itensSemFuncao = itens.filter(
      (item) => !String(item.role || item.tag || '').trim()
    );
    if (itensSemFuncao.length > 0) {
      alert('Todos os membros base precisam ter função/instrumento definido.');
      return;
    }

    try {
      setSalvando(true);

      const payload = {
        name: form.name.trim(),
        formation: form.formation.trim(),
        instruments: form.instruments.trim() || null,
        compatible_tags: form.compatible_tags.trim() || null,
        suggestion_priority: Number(form.suggestion_priority || 100),
        notes: form.notes.trim() || null,
        is_active: !!form.is_active,
      };

      let templateId = editandoId;

      if (editandoId) {
        const { error } = await supabase
          .from('scale_templates')
          .update(payload)
          .eq('id', editandoId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('scale_templates')
          .insert([payload])
          .select('id')
          .single();

        if (error) throw error;
        templateId = data.id;
      }

      const { error: deleteItemsError } = await supabase
        .from('scale_template_items')
        .delete()
        .eq('template_id', templateId);

      if (deleteItemsError) throw deleteItemsError;

      const itemsPayload = itens.map((item, index) => ({
        template_id: templateId,
        contact_id: item.contact_id,
        role: item.role || item.tag || null,
        sort_order: index,
      }));

      const { error: insertItemsError } = await supabase
        .from('scale_template_items')
        .insert(itemsPayload);

      if (insertItemsError) throw insertItemsError;

      cancelarEdicao();
      await carregarTudo();
      setDesktopTab('lista');
      setMobileTab('lista');
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      alert(`Erro ao salvar template: ${error?.message}`);
    } finally {
      setSalvando(false);
    }
  }

  async function excluirTemplate(id) {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;

    try {
      const { error } = await supabase
        .from('scale_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (editandoId === id) cancelarEdicao();

      await carregarTudo();
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      alert(`Erro ao excluir template: ${error?.message}`);
    }
  }

  async function alternarStatus(template) {
    try {
      const { error } = await supabase
        .from('scale_templates')
        .update({ is_active: template.is_active === false })
        .eq('id', template.id);
      if (error) throw error;
      await carregarTudo();
    } catch (error) {
      console.error('Erro ao atualizar status do template:', error);
      alert(`Erro ao atualizar status: ${error?.message}`);
    }
  }

  const contatosDisponiveis = useMemo(() => {
    const usados = new Set(itens.map((item) => String(item.contact_id)));
    return contatos.filter((contato) => !usados.has(String(contato.id)));
  }, [contatos, itens]);

  const templatesComResumo = useMemo(() => {
    const contatosIds = new Set(contatos.map((c) => String(c.id)));
    const itemsByTemplateId = new Map();

    for (const item of templateItems) {
      if (!contatosIds.has(String(item.contact_id))) continue;
      const key = String(item.template_id);
      if (!itemsByTemplateId.has(key)) itemsByTemplateId.set(key, []);
      itemsByTemplateId.get(key).push(item);
    }

    return templates.map((template) => ({
      ...template,
      items_count: itemsByTemplateId.get(String(template.id))?.length || 0,
    }));
  }, [templates, templateItems, contatos]);

  const templatesFiltrados = useMemo(() => {
    const termo = String(busca || '').toLowerCase().trim();

    let lista = [...templatesComResumo];

    if (formationFilter !== 'all') {
      lista = lista.filter(
        (template) => String(template.formation || '') === formationFilter
      );
    }

    if (activeFilter === 'active') {
      lista = lista.filter((template) => template.is_active !== false);
    }

    if (activeFilter === 'inactive') {
      lista = lista.filter((template) => template.is_active === false);
    }

    if (termo) {
      lista = lista.filter((template) =>
        [template.name, template.formation, template.instruments, template.notes]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(termo))
      );
    }

    return lista;
  }, [templatesComResumo, busca, formationFilter, activeFilter]);

  const resumo = useMemo(() => {
    const total = templates.length;
    const ativos = templates.filter((t) => t.is_active !== false).length;
    const inativos = total - ativos;
    const totalItens = templateItems.length;

    return { total, ativos, inativos, totalItens };
  }, [templates, templateItems]);

  const mobileTabs = [
    { key: 'lista', label: 'Lista' },
    { key: 'novo', label: editandoId ? 'Editar' : 'Novo' },
  ];

  const mobileActions = (
    <button
      type="button"
      onClick={iniciarNovo}
      className="rounded-[16px] bg-[#0f172a] px-4 py-3 text-[13px] font-black text-white"
    >
      Novo
    </button>
  );

  if (carregando) {
    return (
      <AdminShell pageTitle="Templates de escala" activeItem="escalas" mobileActions={mobileActions}>
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <p className="text-center text-[#64748b]">Carregando templates...</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell pageTitle="Templates de escala" activeItem="escalas" mobileActions={mobileActions}>
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Templates de escala"
          subtitle="Cadastre formações padrão para sugerir automaticamente a equipe base de cada evento."
          actions={
            <button
              type="button"
              onClick={iniciarNovo}
              className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
            >
              Novo template
            </button>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminSummaryCard label="Templates" value={resumo.total} helper="Formações cadastradas" />
          <AdminSummaryCard label="Ativos" value={resumo.ativos} helper="Disponíveis para sugestão" tone="success" />
          <AdminSummaryCard label="Inativos" value={resumo.inativos} helper="Ocultos da automação" tone="warning" />
          <AdminSummaryCard label="Membros base" value={resumo.totalItens} helper="Itens nos templates" tone="accent" />
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
            <TemplatesEscalaListaTab
              templates={templatesFiltrados}
              busca={busca}
              setBusca={setBusca}
              formationFilter={formationFilter}
              setFormationFilter={setFormationFilter}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              formations={FORMATIONS}
              iniciarEdicao={iniciarEdicao}
              excluirTemplate={excluirTemplate}
              alternarStatus={alternarStatus}
            />
          )}

          {desktopTab === 'novo' && (
            <TemplatesEscalaFormularioTab
              editandoId={editandoId}
              form={form}
              handleFormChange={handleFormChange}
              salvarTemplate={salvarTemplate}
              cancelarEdicao={cancelarEdicao}
              salvando={salvando}
              formations={FORMATIONS}
              contatosDisponiveis={contatosDisponiveis}
              itens={itens}
              adicionarContatoAoTemplate={adicionarContatoAoTemplate}
              removerItem={removerItem}
              atualizarItem={atualizarItem}
            />
          )}
        </div>

        <div className="md:hidden">
          <AdminSegmentTabs items={mobileTabs} active={mobileTab} onChange={setMobileTab} />
        </div>

        <div className="space-y-5 md:hidden">
          {mobileTab === 'lista' && (
            <TemplatesEscalaListaTab
              templates={templatesFiltrados}
              busca={busca}
              setBusca={setBusca}
              formationFilter={formationFilter}
              setFormationFilter={setFormationFilter}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              formations={FORMATIONS}
              iniciarEdicao={iniciarEdicao}
              excluirTemplate={excluirTemplate}
              alternarStatus={alternarStatus}
            />
          )}

          {mobileTab === 'novo' && (
            <TemplatesEscalaFormularioTab
              editandoId={editandoId}
              form={form}
              handleFormChange={handleFormChange}
              salvarTemplate={salvarTemplate}
              cancelarEdicao={cancelarEdicao}
              salvando={salvando}
              formations={FORMATIONS}
              contatosDisponiveis={contatosDisponiveis}
              itens={itens}
              adicionarContatoAoTemplate={adicionarContatoAoTemplate}
              removerItem={removerItem}
              atualizarItem={atualizarItem}
            />
          )}
        </div>
      </div>
    </AdminShell>
  );
}
