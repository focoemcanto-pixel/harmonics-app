'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminShell from '@/components/admin/AdminShell';
import AdminPageHero from '@/components/admin/AdminPageHero';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';
import AdminSegmentTabs from '@/components/admin/AdminSegmentTabs';
import TemplatesEscalaListaTab from '@/components/templates-escala/TemplatesEscalaListaTab';
import TemplatesEscalaFormularioTab from '@/components/templates-escala/TemplatesEscalaFormularioTab';
import { filterOperationalTeamContacts } from '@/lib/escalas/team-contacts';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import { useAppToast } from '@/components/ui/ToastProvider';
import useCurrentWorkspace from '@/hooks/useCurrentWorkspace';

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

const FORMATION_DEMO_DEFAULT = {
  name: 'Formação Demo Premium',
  formation: 'Trio',
  instruments: 'Voz, Piano, Violino',
  compatible_tags: 'Voz, Piano, Violino',
  suggestion_priority: 1,
  notes: 'Formação reutilizável demo para sugerir automaticamente membros compatíveis com cada função.',
  is_active: true,
};

const DESKTOP_TABS = [
  { key: 'lista', label: 'Lista' },
  { key: 'novo', label: 'Novo / Editar' },
];

export default function TemplatesEscalaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const guide = searchParams?.get('guide') || '';
  const demoEventId = searchParams?.get('eventId') || '';
  const isFormationGuide = guide === 'formation-template';
  const redirectedAfterFormationRef = useRef(false);
  const { workspace, loading: workspaceLoading } = useCurrentWorkspace();
  const workspaceId = workspace?.workspaceId || null;
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
  const [formationGuideLoading, setFormationGuideLoading] = useState(false);
  const [formationGuideSaving, setFormationGuideSaving] = useState(false);
  const [formationGuideError, setFormationGuideError] = useState('');
  const [formationGuideStatus, setFormationGuideStatus] = useState({
    hasFormationTemplate: false,
    formationTemplateCount: 0,
    templates: [],
    members: [],
    demoTemplate: FORMATION_DEMO_DEFAULT,
    requiredRoles: ['Voz', 'Piano', 'Violino'],
  });
  const { confirm } = useConfirm() || {};
  const toast = useAppToast();

  const scaleWithFormationHref = useMemo(() => {
    const params = new URLSearchParams({ tab: 'escala', guide: 'scale-with-formation' });
    return demoEventId ? `/eventos/${demoEventId}?${params.toString()}` : `/eventos?${params.toString()}`;
  }, [demoEventId]);

  const carregarFormationGuide = useCallback(async () => {
    if (!isFormationGuide) return;

    setFormationGuideLoading(true);
    setFormationGuideError('');

    try {
      const response = await fetch('/api/onboarding/formation-template', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Erro ao carregar formação demo.');
      }

      setFormationGuideStatus({
        hasFormationTemplate: Boolean(payload.hasFormationTemplate),
        formationTemplateCount: Number(payload.formationTemplateCount || 0),
        templates: payload.templates || [],
        members: payload.members || [],
        demoTemplate: payload.demoTemplate || FORMATION_DEMO_DEFAULT,
        requiredRoles: payload.requiredRoles || ['Voz', 'Piano', 'Violino'],
      });
    } catch (error) {
      setFormationGuideError(error?.message || 'Erro ao carregar formação demo.');
    } finally {
      setFormationGuideLoading(false);
    }
  }, [isFormationGuide]);

  async function carregarTudo() {
    try {
      setCarregando(true);

      let templatesQuery = supabase
        .from('scale_templates')
        .select('*')
        .order('created_at', { ascending: false });
      let contatosQuery = supabase
        .from('contacts')
        .select('*')
        .order('name', { ascending: true });

      if (workspaceId) {
        templatesQuery = templatesQuery.eq('workspace_id', workspaceId);
        contatosQuery = contatosQuery.eq('workspace_id', workspaceId);
      }

      const [templatesResp, itemsResp, contatosResp] = await Promise.all([
        templatesQuery,
        supabase
          .from('scale_template_items')
          .select('*')
          .order('sort_order', { ascending: true }),
        contatosQuery,
      ]);

      if (templatesResp.error) throw templatesResp.error;
      if (itemsResp.error) throw itemsResp.error;
      if (contatosResp.error) throw contatosResp.error;

      setTemplates(templatesResp.data || []);
      setTemplateItems(itemsResp.data || []);
      setContatos(filterOperationalTeamContacts(contatosResp.data || []));
    } catch (error) {
      console.error('Erro ao carregar templates de escala:', error);
      toast.error(`Erro ao carregar templates: ${error?.message || 'erro desconhecido'}`);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (workspaceLoading) return;
    carregarTudo();
    // carregarTudo é uma rotina de carregamento local; as dependências reais são workspaceLoading/workspaceId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceLoading, workspaceId]);

  useEffect(() => {
    carregarFormationGuide();
  }, [carregarFormationGuide]);

  useEffect(() => {
    if (!isFormationGuide || !formationGuideStatus.hasFormationTemplate || redirectedAfterFormationRef.current) return undefined;

    redirectedAfterFormationRef.current = true;
    const timer = window.setTimeout(() => {
      router.push(scaleWithFormationHref);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [formationGuideStatus.hasFormationTemplate, isFormationGuide, router, scaleWithFormationHref]);

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

  function preencherFormacaoDemo() {
    cancelarEdicao();
    const demo = formationGuideStatus.demoTemplate || FORMATION_DEMO_DEFAULT;
    setForm({
      name: demo.name || FORMATION_DEMO_DEFAULT.name,
      formation: demo.formation || FORMATION_DEMO_DEFAULT.formation,
      instruments: demo.instruments || FORMATION_DEMO_DEFAULT.instruments,
      compatible_tags: demo.compatible_tags || FORMATION_DEMO_DEFAULT.compatible_tags,
      suggestion_priority: Number(demo.suggestion_priority || 1),
      notes: demo.notes || FORMATION_DEMO_DEFAULT.notes,
      is_active: demo.is_active !== false,
    });
    setItens([]);
    setDesktopTab('novo');
    setMobileTab('novo');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function criarFormacaoDemoSugerida() {
    setFormationGuideSaving(true);
    setFormationGuideError('');

    try {
      const response = await fetch('/api/onboarding/formation-template', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'seed' }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Erro ao criar formação demo.');
      }

      setFormationGuideStatus((prev) => ({
        ...prev,
        hasFormationTemplate: Boolean(payload.hasFormationTemplate),
        formationTemplateCount: Number(payload.formationTemplateCount || 1),
        templates: payload.template ? [payload.template] : prev.templates,
        members: payload.members || prev.members,
      }));
      await carregarTudo();
      toast.success(payload.alreadyExisted ? 'Formação demo já existia. Avançando.' : 'Formação demo criada com sucesso.');
    } catch (error) {
      setFormationGuideError(error?.message || 'Erro ao criar formação demo.');
    } finally {
      setFormationGuideSaving(false);
    }
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
      toast.warning('Informe o nome do template.');
      return;
    }

    if (!form.formation.trim()) {
      toast.warning('Informe a formação.');
      return;
    }

    if (itens.length === 0) {
      toast.warning('Adicione pelo menos um membro ao template.');
      return;
    }

    const itensSemFuncao = itens.filter(
      (item) => !String(item.role || item.tag || '').trim()
    );
    if (itensSemFuncao.length > 0) {
      toast.warning('Todos os membros base precisam ter função/instrumento definido.');
      return;
    }

    try {
      setSalvando(true);

      const payload = {
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
        name: form.name.trim(),
        formation: form.formation.trim(),
        instruments: form.instruments.trim() || null,
        compatible_tags: form.compatible_tags.trim() || null,
        suggestion_priority: Number(form.suggestion_priority || 100),
        notes: form.notes.trim() || null,
        is_active: !!form.is_active,
        ...(isFormationGuide
          ? {
              source: 'onboarding_demo',
              metadata: {
                is_onboarding_demo: true,
                source: 'onboarding_demo',
                guide: 'formation-template',
              },
            }
          : {}),
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
      if (isFormationGuide) await carregarFormationGuide();
      toast.success(editandoId ? 'Template atualizado com sucesso.' : 'Template criado com sucesso.');
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error(`Erro ao salvar template: ${error?.message || 'erro desconhecido'}`);
    } finally {
      setSalvando(false);
    }
  }

  async function excluirTemplate(id) {
    const confirmed = await confirm?.({
      title: 'Excluir template?',
      description: 'Esta ação removerá o template e não poderá ser desfeita.',
      confirmText: 'Excluir template',
      cancelText: 'Cancelar',
      tone: 'destructive',
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('scale_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (editandoId === id) cancelarEdicao();

      await carregarTudo();
      toast.success('Template excluído com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      toast.error(`Erro ao excluir template: ${error?.message || 'erro desconhecido'}`);
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
      toast.success('Status do template atualizado.');
    } catch (error) {
      console.error('Erro ao atualizar status do template:', error);
      toast.error(`Erro ao atualizar status: ${error?.message || 'erro desconhecido'}`);
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

  if (carregando || workspaceLoading) {
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
        {isFormationGuide ? (
          <section className="overflow-hidden rounded-[32px] border border-violet-200 bg-white shadow-[0_18px_54px_rgba(124,58,237,0.12)]" data-onboarding-tour="formation-template-guide">
            <div className="bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-600 px-5 py-5 text-white md:px-7">
              <div className="text-[12px] font-black uppercase tracking-[0.16em] text-violet-100">Etapa operacional</div>
              <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] md:text-[34px]">Crie uma formação inteligente reutilizável</h2>
              <p className="mt-3 max-w-4xl text-sm font-semibold leading-7 text-violet-50 md:text-base">
                Em vez de montar cada escala do zero, você pode criar formações reutilizáveis. O Harmonics usará essas formações para sugerir automaticamente membros compatíveis com cada função.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-[1.4fr_0.9fr] md:p-7">
              <div className="space-y-4">
                <div className="rounded-[24px] border border-violet-100 bg-violet-50 p-4">
                  <div className="text-sm font-black uppercase tracking-[0.12em] text-violet-700">Modelo sugerido</div>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">Formação Demo Premium</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(formationGuideStatus.requiredRoles || ['Voz', 'Piano', 'Violino']).map((role) => (
                      <span key={role} className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-black text-violet-700">{role}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                    Use as funções compatíveis com os membros fake cadastrados: Voz, Piano e Violino. A formação fica salva no workspace atual e marcada como demo/onboarding.
                  </p>
                </div>

                {formationGuideError ? (
                  <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{formationGuideError}</div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={criarFormacaoDemoSugerida}
                    disabled={formationGuideSaving || formationGuideLoading || formationGuideStatus.hasFormationTemplate}
                    className="rounded-[18px] bg-violet-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {formationGuideSaving ? 'Criando formação...' : formationGuideStatus.hasFormationTemplate ? 'Formação demo concluída' : 'Criar formação demo sugerida'}
                  </button>
                  <button
                    type="button"
                    onClick={preencherFormacaoDemo}
                    disabled={formationGuideStatus.hasFormationTemplate}
                    className="rounded-[18px] border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Preencher manualmente
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(scaleWithFormationHref)}
                    disabled={!formationGuideStatus.hasFormationTemplate}
                    className="rounded-[18px] border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Avançar para escala
                  </button>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                <h3 className="text-base font-black text-slate-900">Checklist do guia</h3>
                <div className="mt-4 space-y-3">
                  {[
                    { label: 'Explicar formação inteligente', done: true },
                    { label: 'Criar Formação Demo Premium', done: formationGuideStatus.hasFormationTemplate },
                    { label: 'Adicionar Voz, Piano e Violino', done: formationGuideStatus.hasFormationTemplate },
                    { label: 'Salvar com workspace atual e marca demo', done: formationGuideStatus.hasFormationTemplate },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${item.done ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
                        {item.done ? '✓' : '•'}
                      </span>
                      <span className="text-sm font-bold leading-6 text-slate-700">{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-[20px] border border-violet-100 bg-violet-50 px-4 py-3 text-xs font-bold leading-5 text-violet-800">
                  {formationGuideStatus.hasFormationTemplate
                    ? 'Etapa concluída. Vamos abrir a escala do evento demo com sugestões da formação em instantes.'
                    : 'Crie pelo menos uma formação demo para liberar a etapa de escala com formação.'}
                </div>
              </div>
            </div>
          </section>
        ) : null}

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
