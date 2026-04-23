'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AdminShell from '@/components/admin/AdminShell';
import AdminPageHero from '@/components/admin/AdminPageHero';
import AdminSegmentTabs from '@/components/admin/AdminSegmentTabs';
import { useAppToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import PrepareDynamicFieldsModal from '@/components/contratos/PrepareDynamicFieldsModal';
import { looksLikeHtml, parseContractTemplateInput } from '@/lib/contracts/templateImport';

const MOBILE_TABS = [
  { key: 'lista', label: 'Lista' },
  { key: 'form', label: 'Novo / Editar' },
];

function getInitialForm() {
  return {
    name: '',
    slug: '',
    description: '',
    content: '',
    source_text: '',
    is_active: true,
    is_default: false,
  };
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function normalizeSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function ContractTemplatesPage() {
  const toast = useAppToast();
  const { confirm } = useConfirm() || {};
  const [templates, setTemplates] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(getInitialForm());
  const [rawContractText, setRawContractText] = useState('');
  const [editorTab, setEditorTab] = useState('texto');
  const [busca, setBusca] = useState('');
  const [mobileTab, setMobileTab] = useState('lista');
  const [preparingDynamicFields, setPreparingDynamicFields] = useState(false);
  const [prepareSnapshotText, setPrepareSnapshotText] = useState('');
  const [excluindoId, setExcluindoId] = useState(null);

  const parsedTemplate = useMemo(() => parseContractTemplateInput(rawContractText), [rawContractText]);
  const processedContentForDisplay = rawContractText.trim()
    ? parsedTemplate.normalizedContent
    : String(form.content || '');
  const previewContent = editorTab === 'texto' && rawContractText.trim()
    ? parsedTemplate.normalizedContent
    : String(form.content || '');
  const isHtmlAdvancedOnly = useMemo(
    () => !rawContractText.trim() && looksLikeHtml(form.content),
    [form.content, rawContractText],
  );

  async function carregarTemplates(showLoading = true) {
    try {
      if (showLoading) setCarregando(true);
      setErro('');

      const { data, error } = await supabase
        .from('contract_templates')
        .select('id, name, slug, description, content, source_text, is_active, is_default, created_at, updated_at')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTemplates(data || []);
    } catch (loadError) {
      console.error('Erro ao carregar templates de contrato:', loadError);
      setErro('Não foi possível carregar os templates de contrato.');
      toast.error(`Erro ao carregar templates: ${loadError?.message || 'erro desconhecido'}`);
    } finally {
      if (showLoading) setCarregando(false);
    }
  }

  useEffect(() => {
    carregarTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function limparFormulario() {
    setEditandoId(null);
    setForm(getInitialForm());
    setRawContractText('');
    setEditorTab('texto');
  }

  function iniciarNovo() {
    limparFormulario();
    setMobileTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function abrirPreparadorCampos() {
    const source = String(rawContractText || form.source_text || '').trim();
    if (!source) {
      toast.warning('Informe um texto de contrato antes de preparar campos dinâmicos.');
      return;
    }
    setPrepareSnapshotText(rawContractText);
    setPreparingDynamicFields(true);
  }

  function iniciarEdicao(template) {
    const existingContent = template.content || '';
    const existingSourceText = template.source_text || '';
    setEditandoId(template.id);
    setForm({
      name: template.name || '',
      slug: template.slug || '',
      description: template.description || '',
      content: existingContent,
      source_text: existingSourceText,
      is_active: template.is_active !== false,
      is_default: template.is_default === true,
    });
    if (existingSourceText.trim()) {
      setRawContractText(existingSourceText);
      setEditorTab('texto');
    } else if (looksLikeHtml(existingContent)) {
      setRawContractText('');
      setEditorTab('avancado');
    } else {
      setRawContractText(existingContent);
      setEditorTab('texto');
    }
    setMobileTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function salvarTemplate() {
    const name = String(form.name || '').trim();
    const slug = normalizeSlug(form.slug || form.name);

    if (!name) {
      toast.warning('Informe o nome do template.');
      return;
    }

    if (!slug) {
      toast.warning('Informe um slug válido.');
      return;
    }

    const shouldPersistSourceText = editorTab === 'texto' || rawContractText.trim();
    const processedContent = rawContractText.trim()
      ? parsedTemplate.normalizedContent
      : String(form.content || '');
    const sourceTextToPersist = shouldPersistSourceText
      ? rawContractText
      : String(form.source_text || '');

    const payload = {
      name,
      slug,
      description: String(form.description || '').trim(),
      content: processedContent,
      source_text: sourceTextToPersist,
      is_active: form.is_active !== false,
      is_default: form.is_default === true,
    };

    try {
      setSalvando(true);

      if (editandoId) {
        const { error } = await supabase
          .from('contract_templates')
          .update(payload)
          .eq('id', editandoId);

        if (error) throw error;
        toast.success('Template atualizado com sucesso.');
      } else {
        const { error } = await supabase
          .from('contract_templates')
          .insert([payload]);

        if (error) throw error;
        toast.success('Template criado com sucesso.');
      }

      limparFormulario();
      setMobileTab('lista');
      await carregarTemplates(false);
    } catch (saveError) {
      console.error('Erro ao salvar template de contrato:', saveError);
      toast.error(`Não foi possível salvar: ${saveError?.message || 'erro desconhecido'}`);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarStatus(template) {
    try {
      const nextActive = template.is_active === false;
      const { error } = await supabase
        .from('contract_templates')
        .update({ is_active: nextActive })
        .eq('id', template.id);

      if (error) throw error;

      toast.success(nextActive ? 'Template ativado.' : 'Template inativado.');
      await carregarTemplates(false);
    } catch (statusError) {
      console.error('Erro ao alterar status do template:', statusError);
      toast.error(`Não foi possível alterar o status: ${statusError?.message || 'erro desconhecido'}`);
    }
  }

  async function excluirTemplate(template) {
    const confirmou = confirm
      ? await confirm({
        title: 'Excluir template?',
        description:
          'Essa ação removerá este template. Se ele estiver vinculado a tipos de evento ou pré-contratos, o sistema deve impedir exclusão física ou avisar corretamente.',
        confirmText: 'Excluir template',
        cancelText: 'Cancelar',
        tone: 'destructive',
      })
      : window.confirm('Excluir template? Esta ação não pode ser desfeita.');
    if (!confirmou) return;

    try {
      setExcluindoId(template.id);

      const [eventTypesUsage, precontractsUsage] = await Promise.all([
        supabase
          .from('event_types')
          .select('id', { count: 'exact', head: true })
          .eq('default_contract_template_id', template.id),
        supabase
          .from('precontracts')
          .select('id', { count: 'exact', head: true })
          .eq('contract_template_id', template.id),
      ]);

      if (eventTypesUsage.error) throw eventTypesUsage.error;
      if (precontractsUsage.error) throw precontractsUsage.error;

      const eventTypesCount = Number(eventTypesUsage.count || 0);
      const precontractsCount = Number(precontractsUsage.count || 0);
      const totalUsages = eventTypesCount + precontractsCount;

      if (totalUsages > 0) {
        toast.warning(
          `Este template está vinculado (${eventTypesCount} tipo(s) de evento e ${precontractsCount} pré-contrato(s)). Desvincule antes de excluir.`
        );
        return;
      }

      const { error } = await supabase
        .from('contract_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      if (String(editandoId || '') === String(template.id)) {
        limparFormulario();
      }
      await carregarTemplates(false);
      toast.success('Template excluído com sucesso.');
    } catch (deleteError) {
      console.error('Erro ao excluir template:', deleteError);
      toast.error(`Não foi possível excluir: ${deleteError?.message || 'erro desconhecido'}`);
    } finally {
      setExcluindoId(null);
    }
  }

  const templatesFiltrados = useMemo(() => {
    const term = String(busca || '').trim().toLowerCase();
    if (!term) return templates;

    return templates.filter((item) => {
      const composed = `${item.name || ''} ${item.slug || ''} ${item.description || ''}`.toLowerCase();
      return composed.includes(term);
    });
  }, [templates, busca]);

  const totais = useMemo(() => {
    const total = templates.length;
    const ativos = templates.filter((item) => item.is_active !== false).length;
    const defaults = templates.filter((item) => item.is_default === true).length;
    return { total, ativos, defaults };
  }, [templates]);

  return (
    <AdminShell pageTitle="Templates de contrato" activeItem="contratos">
      <div className="space-y-5 md:space-y-6">
        <AdminPageHero
          badge="Contratos"
          title="Templates de contrato"
          subtitle="Gerencie os modelos-base usados nos pré-contratos."
          actions={(
            <button
              type="button"
              onClick={iniciarNovo}
              className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-[0_14px_28px_rgba(124,58,237,0.35)] transition hover:bg-violet-700"
            >
              Novo template
            </button>
          )}
        />

        <section className="grid gap-3 md:grid-cols-3">
          <article className="rounded-[24px] border border-[#dbe3ef] bg-white px-5 py-4 shadow-[0_10px_25px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748b]">Total</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#0f172a]">{totais.total}</p>
          </article>
          <article className="rounded-[24px] border border-[#dbe3ef] bg-white px-5 py-4 shadow-[0_10px_25px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748b]">Ativos</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-emerald-600">{totais.ativos}</p>
          </article>
          <article className="rounded-[24px] border border-[#dbe3ef] bg-white px-5 py-4 shadow-[0_10px_25px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748b]">Defaults</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-violet-700">{totais.defaults}</p>
          </article>
        </section>

        <div className="md:hidden">
          <AdminSegmentTabs items={MOBILE_TABS} active={mobileTab} onChange={setMobileTab} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          {(mobileTab === 'lista' || mobileTab === 'form') && (
            <section className={`rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] ${mobileTab !== 'lista' ? 'hidden md:block' : ''}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-[22px] font-black tracking-[-0.03em] text-[#0f172a]">Lista de templates</h2>
                <input
                  type="search"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Buscar por nome, slug ou descrição"
                  className="w-full rounded-2xl border border-[#dbe3ef] bg-[#f8fafc] px-4 py-2.5 text-sm font-medium text-[#0f172a] outline-none transition focus:border-violet-400 md:max-w-[320px]"
                />
              </div>

              {carregando && <p className="mt-5 text-sm font-semibold text-[#64748b]">Carregando templates...</p>}
              {!carregando && erro && <p className="mt-5 text-sm font-semibold text-red-600">{erro}</p>}

              {!carregando && !erro && templatesFiltrados.length === 0 && (
                <p className="mt-5 text-sm font-semibold text-[#64748b]">Nenhum template encontrado.</p>
              )}

              {!carregando && !erro && templatesFiltrados.length > 0 && (
                <div className="mt-5 space-y-3">
                  {templatesFiltrados.map((template) => (
                    <article
                      key={template.id}
                      className="rounded-[22px] border border-[#e2e8f0] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-[17px] font-black text-[#0f172a]">{template.name || 'Sem nome'}</h3>
                          <p className="mt-1 text-xs font-semibold text-[#64748b]">slug: {template.slug || '—'}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-black ${template.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                            {template.is_active !== false ? 'Ativo' : 'Inativo'}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-black ${template.is_default ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                            {template.is_default ? 'Default' : 'Não default'}
                          </span>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm text-[#475569]">{template.description || 'Sem descrição'}</p>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8f0] pt-3">
                        <p className="text-xs font-semibold text-[#64748b]">
                          Atualizado em {formatDateTime(template.updated_at || template.created_at)}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => iniciarEdicao(template)}
                            className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-700 transition hover:bg-violet-100"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => alternarStatus(template)}
                            className="rounded-xl border border-[#dbe3ef] bg-white px-3 py-1.5 text-xs font-black text-[#334155] transition hover:bg-slate-50"
                          >
                            {template.is_active !== false ? 'Inativar' : 'Ativar'}
                          </button>
                          <button
                            type="button"
                            disabled={excluindoId === template.id}
                            onClick={() => excluirTemplate(template)}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {excluindoId === template.id ? 'Excluindo...' : 'Excluir'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className={`rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] ${mobileTab !== 'form' ? 'hidden md:block' : ''}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[22px] font-black tracking-[-0.03em] text-[#0f172a]">
                {editandoId ? 'Editar template' : 'Novo template'}
              </h2>
              {editandoId && (
                <button
                  type="button"
                  onClick={limparFormulario}
                  className="rounded-xl border border-[#dbe3ef] px-3 py-1.5 text-xs font-black text-[#475569]"
                >
                  Cancelar edição
                </button>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-[#64748b]">Nome</span>
                <input
                  value={form.name}
                  onChange={(event) => handleFormChange('name', event.target.value)}
                  className="w-full rounded-2xl border border-[#dbe3ef] bg-[#f8fafc] px-4 py-2.5 text-sm text-[#0f172a] outline-none transition focus:border-violet-400"
                  placeholder="Ex: Contrato padrão casamento"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-[#64748b]">Slug</span>
                <input
                  value={form.slug}
                  onChange={(event) => handleFormChange('slug', normalizeSlug(event.target.value))}
                  className="w-full rounded-2xl border border-[#dbe3ef] bg-[#f8fafc] px-4 py-2.5 text-sm text-[#0f172a] outline-none transition focus:border-violet-400"
                  placeholder="contrato-casamento-padrao"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-[#64748b]">Descrição</span>
                <textarea
                  value={form.description}
                  onChange={(event) => handleFormChange('description', event.target.value)}
                  className="min-h-[80px] w-full rounded-2xl border border-[#dbe3ef] bg-[#f8fafc] px-4 py-3 text-sm text-[#0f172a] outline-none transition focus:border-violet-400"
                  placeholder="Breve descrição de quando usar este template"
                />
              </label>

              <div className="rounded-2xl border border-[#dbe3ef] bg-[#f8fafc] p-3">
                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditorTab('texto')}
                    className={`rounded-xl px-3 py-2 text-xs font-black transition ${editorTab === 'texto' ? 'bg-violet-600 text-white' : 'bg-white text-[#334155] hover:bg-slate-100'}`}
                  >
                    Texto do contrato
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('avancado')}
                    className={`rounded-xl px-3 py-2 text-xs font-black transition ${editorTab === 'avancado' ? 'bg-violet-600 text-white' : 'bg-white text-[#334155] hover:bg-slate-100'}`}
                  >
                    Modo avançado
                  </button>
                </div>

                {editorTab === 'texto' ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-[#64748b]">Texto do contrato</span>
                    <p className="mb-2 text-xs font-medium text-[#64748b]">Cole aqui o contrato base. O sistema vai reconhecer e preparar os campos dinâmicos.</p>
                    <p className="mb-2 text-xs font-medium text-[#64748b]">
                      Texto do contrato = sua versão editável.
                    </p>
                    <textarea
                      value={rawContractText}
                      onChange={(event) => setRawContractText(event.target.value)}
                      className="min-h-[220px] w-full rounded-2xl border border-[#dbe3ef] bg-white px-4 py-3 text-sm text-[#0f172a] outline-none transition focus:border-violet-400"
                      placeholder="Cole aqui o contrato em texto normal, com ou sem placeholders."
                    />
                    {!!String(rawContractText || form.source_text || '').trim() && (
                      <button
                        type="button"
                        onClick={abrirPreparadorCampos}
                        className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-black text-violet-700 transition hover:bg-violet-100"
                      >
                        Preparar campos dinâmicos
                      </button>
                    )}
                  </label>
                ) : (
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-[#64748b]">Template processado</span>
                    <p className="mb-2 text-xs font-medium text-[#64748b]">
                      Modo avançado = versão processada usada pelo sistema.
                    </p>
                    <textarea
                      value={processedContentForDisplay}
                      onChange={(event) => {
                        setRawContractText('');
                        handleFormChange('content', event.target.value);
                      }}
                      className="min-h-[220px] w-full rounded-2xl border border-[#dbe3ef] bg-white px-4 py-3 font-mono text-sm text-[#0f172a] outline-none transition focus:border-violet-400"
                      placeholder="Conteúdo técnico final salvo em content"
                    />
                  </label>
                )}

                {isHtmlAdvancedOnly && editorTab === 'texto' && (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    Este template já está em HTML legado. Use o Modo avançado para editar mantendo compatibilidade.
                  </p>
                )}
              </div>

              {editorTab === 'texto' && (
                <div className="rounded-[22px] border border-[#e2e8f0] bg-white p-4">
                  <h3 className="text-sm font-black text-[#0f172a]">Análise do texto</h3>
                  <div className="mt-3 grid gap-2 text-sm text-[#334155]">
                    <p><span className="font-bold">Placeholders reconhecidos:</span> {parsedTemplate.detectedPlaceholders.length}</p>
                    <p><span className="font-bold">Placeholders não reconhecidos:</span> {parsedTemplate.unknownPlaceholders.length}</p>
                    <p><span className="font-bold">Condicionais:</span> {parsedTemplate.hasConditionals ? parsedTemplate.conditionals.join(', ') : 'Nenhum'}</p>
                  </div>

                  {parsedTemplate.unknownPlaceholders.length > 0 && (
                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                      Encontramos variáveis que ainda não são reconhecidas automaticamente. Você poderá revisá-las depois.
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-2xl border border-[#dbe3ef] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#334155]">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) => handleFormChange('is_active', event.target.checked)}
                  />
                  Template ativo
                </label>
                <label className="flex items-center gap-2 rounded-2xl border border-[#dbe3ef] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#334155]">
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    onChange={(event) => handleFormChange('is_default', event.target.checked)}
                  />
                  Marcar como default
                </label>
              </div>

              <button
                type="button"
                disabled={salvando}
                onClick={salvarTemplate}
                className="w-full rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-[0_14px_28px_rgba(124,58,237,0.35)] transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar template'}
              </button>

              {editandoId && (
                <button
                  type="button"
                  disabled={excluindoId === editandoId}
                  onClick={() => {
                    const templateInMemory = templates.find((item) => String(item.id) === String(editandoId));
                    if (!templateInMemory) return;
                    excluirTemplate(templateInMemory);
                  }}
                  className="w-full rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {excluindoId === editandoId ? 'Excluindo...' : 'Excluir template'}
                </button>
              )}
            </div>

            <div className="mt-6 rounded-[22px] border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <h3 className="text-sm font-black text-[#0f172a]">Preview do contrato</h3>
              <div className="prose prose-sm mt-3 max-w-none rounded-xl border border-[#e2e8f0] bg-white p-4 text-[#1e293b]">
                {String(previewContent || '').trim() ? (
                  <div dangerouslySetInnerHTML={{ __html: previewContent }} />
                ) : (
                  <p className="text-sm font-medium text-[#64748b]">Nenhum conteúdo para pré-visualizar.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
      {preparingDynamicFields && (
        <PrepareDynamicFieldsModal
          initialText={rawContractText}
          onLiveChange={setRawContractText}
          onCancel={() => {
            setRawContractText(prepareSnapshotText);
            setPreparingDynamicFields(false);
          }}
          onConclude={(updatedText) => {
            setRawContractText(updatedText);
            setPreparingDynamicFields(false);
            toast.success('Campos dinâmicos preparados no texto.');
          }}
        />
      )}
    </AdminShell>
  );
}
