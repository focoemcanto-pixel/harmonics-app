'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import AdminPageHero from '@/components/admin/AdminPageHero';
import AdminSegmentTabs from '@/components/admin/AdminSegmentTabs';
import { useAppToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/hooks/useConfirm';
import PrepareDynamicFieldsModal from '@/components/contratos/PrepareDynamicFieldsModal';
import RichContractEditor from '@/components/contracts/RichContractEditor';
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
    source_rich_html: '',
    is_active: true,
    is_default: false,
  };
}

function htmlToReadableText(value) {
  const raw = String(value || '');
  if (!raw) return '';

  if (typeof window !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, 'text/html');
    const blockTags = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'TR']);
    let output = '';

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        output += node.textContent || '';
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.nodeName;
      if (tag === 'BR') {
        output += '\n';
        return;
      }

      const shouldBreakBefore = blockTags.has(tag) && output && !output.endsWith('\n');
      if (shouldBreakBefore) output += '\n';
      node.childNodes.forEach(walk);
      const shouldBreakAfter = blockTags.has(tag) && !output.endsWith('\n');
      if (shouldBreakAfter) output += '\n';
    }

    doc.body?.childNodes.forEach(walk);
    return output
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return raw
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ');
}

function textToEditorHtml(value) {
  const text = String(value || '').replace(/\r\n/g, '\n');
  if (!text) return '';
  if (looksLikeHtml(text)) return text;

  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function hasVisibleText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length > 0;
}

function pickTemplateEditorHtml(template) {
  const rich = String(template?.source_rich_html || '');
  const content = String(template?.content || '');
  const text = String(template?.source_text || '');
  if (hasVisibleText(rich)) return rich;
  if (hasVisibleText(content)) return content;
  return textToEditorHtml(text);
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


function getTemplateEditSessionId(template) {
  if (!template?.id) return 0;
  const updatedAt = String(template.updated_at || template.created_at || '').trim();
  return updatedAt ? `${template.id}:${updatedAt}` : String(template.id);
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
  const [richContentHtml, setRichContentHtml] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [editorTab, setEditorTab] = useState('texto');
  const [editSessionId, setEditSessionId] = useState(0);
  const [busca, setBusca] = useState('');
  const [mobileTab, setMobileTab] = useState('lista');
  const [preparingDynamicFields, setPreparingDynamicFields] = useState(false);
  const [prepareSnapshotHtml, setPrepareSnapshotHtml] = useState('');
  const [prepareInitialText, setPrepareInitialText] = useState('');
  const [excluindoId, setExcluindoId] = useState(null);
  const richEditorRef = useRef(null);

  function devLog(label, data) {
    if (process.env.NODE_ENV !== 'development') return;
    console.log(label, data);
  }

  const parsedTemplate = useMemo(() => parseContractTemplateInput(richContentHtml), [richContentHtml]);
  const hasRichEditorText = richContentHtml.length > 0;
  const processedContentForDisplay = hasRichEditorText
    ? parsedTemplate.normalizedContent
    : String(form.content || '');
  const isHtmlAdvancedOnly = useMemo(
    () => richContentHtml.length === 0 && looksLikeHtml(form.content),
    [form.content, richContentHtml],
  );

  async function carregarTemplates(showLoading = true) {
    try {
      if (showLoading) setCarregando(true);
      setErro('');

      const response = await fetch('/api/admin/contract-templates', { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error || 'Falha ao carregar templates.');
      }
      setTemplates(result.templates || []);
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

  function getCurrentEditorHtml() {
    if (richEditorRef.current?.getHtml) return String(richEditorRef.current.getHtml() || '');
    if (richContentHtml) return String(richContentHtml);
    return '';
  }

  function limparFormulario() {
    setEditandoId(null);
    setForm(getInitialForm());
    setRichContentHtml('');
    setIsDirty(false);
    richEditorRef.current?.setHtml?.('');
    setEditorTab('texto');
    setEditSessionId(0);
  }

  function iniciarNovo() {
    limparFormulario();
    setMobileTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function abrirPreparadorCampos() {
    const editorHtml = getCurrentEditorHtml();
    const readableFromEditor = htmlToReadableText(editorHtml);
    const readableFromRichState = htmlToReadableText(richContentHtml);
    const readableFromContent = htmlToReadableText(form.content);
    const source = String(
      readableFromEditor ||
      readableFromRichState ||
      form.source_text ||
      readableFromContent ||
      ''
    ).trim();
    if (!source) {
      toast.warning('Informe um texto de contrato antes de preparar campos dinâmicos.');
      return;
    }
    setPrepareSnapshotHtml(editorHtml || richContentHtml);
    setPrepareInitialText(source);
    setPreparingDynamicFields(true);
  }

  function iniciarEdicao(template) {
    const existingContent = template.content || '';
    const existingSourceText = template.source_text || '';
    const existingSourceRichHtml = template.source_rich_html || '';
    setEditandoId(template.id);
    setForm({
      name: template.name || '',
      slug: template.slug || '',
      description: template.description || '',
      content: existingContent,
      source_text: existingSourceText,
      source_rich_html: existingSourceRichHtml,
      is_active: template.is_active !== false,
      is_default: template.is_default === true,
    });
    const nextEditorHtml = String(pickTemplateEditorHtml(template) || '');

    setRichContentHtml(nextEditorHtml);
    setIsDirty(false);
    devLog('[TEMPLATE_EDITOR][LOAD_FOR_EDIT]', {
      id: template.id,
      sourceRichHtmlLength: existingSourceRichHtml.length,
      sourceTextLength: existingSourceText.length,
      contentLength: existingContent.length,
      loadedRichLength: nextEditorHtml.length,
    });
    setEditorTab('texto');
    setEditSessionId(getTemplateEditSessionId(template));
    setMobileTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function salvarTemplate() {
    const isEditing = !!editandoId;
    const endpoint = isEditing
      ? `/api/admin/contract-templates/${editandoId}`
      : '/api/admin/contract-templates';
    const method = isEditing ? 'PATCH' : 'POST';

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

    let currentRichHtml = '';
    if (editorTab === 'avancado') {
      currentRichHtml = textToEditorHtml(form.content || form.source_text || '');
    } else {
      currentRichHtml = String(getCurrentEditorHtml() || richContentHtml || '');
    }
    const currentText = htmlToReadableText(currentRichHtml);
    const parsed = parseContractTemplateInput(currentRichHtml || currentText);

    if (!hasVisibleText(currentRichHtml)) {
      toast.error('Erro: conteúdo do contrato vazio');
      return;
    }

    const visualHasText = hasVisibleText(currentRichHtml);

    if (visualHasText && !hasVisibleText(parsed.normalizedContent)) {
      toast.error('O conteúdo processado não pode ficar vazio quando o editor contém texto.');
      return;
    }

    const payload = {
      name,
      slug,
      description: String(form.description || '').trim(),
      source_rich_html: currentRichHtml,
      source_text: currentText,
      content: parsed.normalizedContent,
      is_active: form.is_active !== false,
      is_default: form.is_default === true,
    };

    console.log('[TEMPLATE_SAVE_PAYLOAD]', {
      id: editandoId || null,
      source_rich_html_len: currentRichHtml?.length || 0,
      source_text_len: currentText?.length || 0,
      content_len: payload.content?.length || 0,
      is_active: payload.is_active,
      is_default: payload.is_default,
    });

    devLog('[TEMPLATE_EDITOR][BEFORE_SAVE_PAYLOAD]', {
      editandoId,
      richContentLength: richContentHtml.length,
      currentEditorHtmlLength: currentRichHtml.length,
      sourceTextLength: currentText.length,
      contentLength: payload.content.length,
    });
    console.log('[SAVE TEMPLATE]', {
      editandoId,
      hasId: !!editandoId,
      contentLen: payload.content.length,
    });

    try {
      setSalvando(true);

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error || `Falha ao ${isEditing ? 'atualizar' : 'criar'} template.`);
      }
      const savedTemplate = result.template;
      if (!savedTemplate?.id) {
        throw new Error('API não retornou o template salvo.');
      }
      if (isEditing) {
        setTemplates((prev) =>
          prev.map((item) =>
            String(item.id) === String(savedTemplate.id) ? savedTemplate : item
          )
        );
      } else {
        setTemplates((prev) => [savedTemplate, ...prev]);
      }
      setEditandoId(savedTemplate.id);
      setForm({
        name: savedTemplate.name || '',
        slug: savedTemplate.slug || '',
        description: savedTemplate.description || '',
        content: savedTemplate.content || '',
        source_text: savedTemplate.source_text || '',
        source_rich_html: savedTemplate.source_rich_html || '',
        is_active: savedTemplate.is_active !== false,
        is_default: savedTemplate.is_default === true,
      });
      const nextEditorHtml = String(pickTemplateEditorHtml(savedTemplate) || '');
      setRichContentHtml(nextEditorHtml);
      richEditorRef.current?.setHtml?.(nextEditorHtml);
      setEditSessionId(getTemplateEditSessionId(savedTemplate));
      console.info('[TEMPLATE_AFTER_SAVE]', {
        id: savedTemplate.id,
        sourceRichIncludesAssinatura: savedTemplate.source_rich_html?.includes('ASSINATURA'),
        contentIncludesAssinatura: savedTemplate.content?.includes('ASSINATURA'),
        sourceRichLen: savedTemplate.source_rich_html?.length || 0,
        contentLen: savedTemplate.content?.length || 0,
      });
      setIsDirty(false);
      devLog('[TEMPLATE_EDITOR][SAVE_RESULT]', { mode: isEditing ? 'update' : 'create', id: savedTemplate.id, ok: true });
      toast.success(isEditing ? 'Template atualizado com sucesso.' : 'Template criado com sucesso.');
      await carregarTemplates(false);
      console.log('[TEMPLATE SAVED]', {
        rich_len: currentRichHtml.length,
        text_len: payload.source_text.length,
        content_len: payload.content.length,
      });

    } catch (saveError) {
      if (String(saveError?.message || '').toLowerCase().includes('source_rich_html')) {
        toast.error('Coluna source_rich_html não existe. Rode a migration.');
        return;
      }
      devLog('[TEMPLATE_EDITOR][SAVE_RESULT]', { ok: false, message: saveError?.message });
      console.error('Erro ao salvar template de contrato:', saveError);
      toast.error(`Não foi possível salvar: ${saveError?.message || 'erro desconhecido'}`);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarStatus(template) {
    try {
      const nextActive = template.is_active === false;
      const response = await fetch(`/api/admin/contract-templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error || 'Falha ao alterar status.');
      }
      const updatedTemplate = result.template;
      setTemplates((prev) => prev.map((item) => (String(item.id) === String(updatedTemplate.id) ? updatedTemplate : item)));

      toast.success(nextActive ? 'Template ativado.' : 'Template inativado.');
      await carregarTemplates(false);
    } catch (statusError) {
      console.error('Erro ao alterar status do template:', statusError);
      toast.error(`Não foi possível alterar o status: ${statusError?.message || 'erro desconhecido'}`);
    }
  }

  async function excluirTemplate(template) {
    const confirmou = await confirm({
        title: 'Excluir template?',
        description:
          'Essa ação removerá este template. Se ele estiver vinculado a tipos de evento ou pré-contratos, o sistema deve impedir exclusão física ou avisar corretamente.',
        confirmText: 'Excluir template',
        cancelText: 'Cancelar',
        variant: 'danger',
      });
    if (!confirmou) return;

    try {
      setExcluindoId(template.id);
      devLog('[TEMPLATE_EDITOR][DELETE_REQUEST]', { id: template.id, name: template.name });

      const response = await fetch(`/api/admin/contract-templates/${template.id}`, {
        method: 'DELETE',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error || 'Falha ao excluir template.');
      }
      devLog('[TEMPLATE_EDITOR][DELETE_RESULT]', { id: template.id, ok: true });

      if (String(editandoId || '') === String(template.id)) {
        limparFormulario();
      }
      setTemplates((prev) => prev.filter((item) => String(item.id) !== String(template.id)));
      await carregarTemplates(false);
      toast.success('Template excluído com sucesso.');
    } catch (deleteError) {
      devLog('[TEMPLATE_EDITOR][DELETE_RESULT]', { id: template.id, ok: false, message: deleteError?.message });
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
                    <RichContractEditor
                      ref={richEditorRef}
                      editSessionId={editSessionId}
                      initialHtml={richContentHtml}
                      canHydrate={!isDirty}
                      onChangeHtml={(nextHtml) => {
                        setRichContentHtml(nextHtml);
                        setIsDirty(true);
                        devLog('[TEMPLATE_EDITOR][RICH_CONTENT_LENGTH]', {
                          source: 'editor_change',
                          richContentLength: String(nextHtml || '').length,
                        });
                      }}
                    />
                    {!!String(richContentHtml || form.source_text || '').trim() && (
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

          </section>
        </div>
      </div>
      {preparingDynamicFields && (
        <PrepareDynamicFieldsModal
          initialText={prepareInitialText}
          onLiveChange={(nextText) => {
            const updatedHtml = textToEditorHtml(nextText);
            setRichContentHtml(updatedHtml);
            setIsDirty(true);
            richEditorRef.current?.setHtml?.(updatedHtml);
            setForm((prev) => ({
              ...prev,
              source_text: String(nextText || ''),
              source_rich_html: updatedHtml,
            }));
          }}
          onCancel={() => {
            setRichContentHtml(prepareSnapshotHtml);
            richEditorRef.current?.setHtml?.(prepareSnapshotHtml);
            setPreparingDynamicFields(false);
          }}
          onConclude={(updatedText) => {
            const updatedHtml = textToEditorHtml(updatedText);
            setRichContentHtml(updatedHtml);
            setIsDirty(true);
            richEditorRef.current?.setHtml?.(updatedHtml);
            setForm((prev) => ({
              ...prev,
              source_text: String(updatedText || ''),
              source_rich_html: updatedHtml,
            }));
            setPreparingDynamicFields(false);
            toast.success('Campos dinâmicos preparados no texto.');
          }}
        />
      )}
    </AdminShell>
  );
}
