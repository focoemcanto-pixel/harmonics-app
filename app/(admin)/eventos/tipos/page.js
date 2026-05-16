'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import AdminPageHero from '@/components/admin/AdminPageHero';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';
import SmartEmptyState from '@/components/onboarding/SmartEmptyState';
import { Field, Input, Select, Textarea, Checkbox } from '@/components/admin/AdminFormPrimitives';
import { useAppToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/hooks/useConfirm';

function getInitialForm() {
  return {
    name: '',
    slug: '',
    description: '',
    is_active: true,
    sort_order: '0',
    color: '',
    icon: '',
    default_contract_template_id: '',
  };
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

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function dedupeById(items) {
  const map = new Map();
  (items || []).forEach((item) => {
    if (!item?.id) return;
    map.set(String(item.id), item);
  });
  return Array.from(map.values());
}

export default function EventTypesPage() {
  const toast = useAppToast();
  const [eventTypes, setEventTypes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templatesMigrationWarning, setTemplatesMigrationWarning] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(getInitialForm());
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const { confirm } = useConfirm() || {};

  function devLog(label, data) {
    if (process.env.NODE_ENV !== 'development') return;
    console.log(label, data);
  }

  async function loadData(showLoading = true) {
    try {
      if (showLoading) setLoading(true);

      const [eventTypesResp, templatesResp] = await Promise.all([
        fetch('/api/admin/event-types', { cache: 'no-store' }),
        fetch('/api/admin/contract-templates', { cache: 'no-store' }),
      ]);

      const [eventTypesJson, templatesJson] = await Promise.all([
        eventTypesResp.json(),
        templatesResp.json(),
      ]);

      if (!eventTypesResp.ok || eventTypesJson?.ok === false) {
        throw new Error(eventTypesJson?.error || 'Falha ao carregar tipos de evento');
      }
      if (!templatesResp.ok || templatesJson?.ok === false) {
        throw new Error(templatesJson?.error || 'Falha ao carregar templates de contrato');
      }

      if (templatesJson?.migrationRequired) {
        setTemplatesMigrationWarning(templatesJson?.warning || 'A estrutura de templates por workspace ainda precisa ser atualizada. Aplique a migration antes de vincular templates.');
      } else {
        setTemplatesMigrationWarning('');
      }

      const rawEventTypes = eventTypesJson?.eventTypes || [];
      const uniqueEventTypes = dedupeById(rawEventTypes);
      if (rawEventTypes.length !== uniqueEventTypes.length) {
        console.warn('[EVENT_TYPES] Registros duplicados detectados na consulta. Mantendo apenas 1 por id.');
      }

      const apiTemplates = templatesJson?.migrationRequired ? [] : (templatesJson?.templates || []);
      const normalizedTemplates = apiTemplates.map((template) => ({
        id: template.id,
        name: template.name,
        is_active: template.is_active,
        is_default: template.is_default,
      }));

      setEventTypes(uniqueEventTypes);
      setTemplates(dedupeById(normalizedTemplates));
    } catch (error) {
      console.error('Erro ao carregar tipos de evento:', error);
      toast.error(`Não foi possível carregar dados: ${error?.message || 'erro desconhecido'}`);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const templateMap = useMemo(() => {
    const map = new Map();
    templates.forEach((template) => map.set(String(template.id), template.name));
    return map;
  }, [templates]);

  const activeTemplates = useMemo(
    () => templates.filter((template) => template.is_active !== false),
    [templates],
  );

  useEffect(() => {
    if (editingId || activeTemplates.length !== 1) return;
    setForm((prev) => {
      if (prev.default_contract_template_id) return prev;
      return { ...prev, default_contract_template_id: String(activeTemplates[0].id) };
    });
  }, [activeTemplates, editingId]);

  const templateOptions = useMemo(() => {
    const selectedId = String(form.default_contract_template_id || '');
    if (!selectedId) return activeTemplates;

    const selectedTemplate = templates.find((template) => String(template.id) === selectedId);
    if (!selectedTemplate) return activeTemplates;

    const alreadyIncluded = activeTemplates.some((template) => String(template.id) === selectedId);
    if (alreadyIncluded) return activeTemplates;

    return [selectedTemplate, ...activeTemplates];
  }, [activeTemplates, form.default_contract_template_id, templates]);

  const filteredTypes = useMemo(() => {
    const term = String(search || '').trim().toLowerCase();
    if (!term) return eventTypes;

    return eventTypes.filter((item) => {
      const templateName = templateMap.get(String(item.default_contract_template_id || '')) || '';
      return [item.name, item.slug, item.description, templateName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [eventTypes, search, templateMap]);

  const summary = useMemo(() => {
    const total = eventTypes.length;
    const active = eventTypes.filter((item) => item.is_active !== false).length;
    const withTemplate = eventTypes.filter((item) => item.default_contract_template_id).length;
    return { total, active, withoutTemplate: total - withTemplate };
  }, [eventTypes]);

  function getNewFormDefaults() {
    const initialForm = getInitialForm();
    if (activeTemplates.length === 1) {
      initialForm.default_contract_template_id = String(activeTemplates[0].id);
    }
    return initialForm;
  }

  function resetForm() {
    setEditingId(null);
    setForm(getNewFormDefaults());
  }

  function startCreate() {
    resetForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      slug: item.slug || '',
      description: item.description || '',
      is_active: item.is_active !== false,
      sort_order: String(item.sort_order ?? 0),
      color: item.color || '',
      icon: item.icon || '',
      default_contract_template_id: item.default_contract_template_id ? String(item.default_contract_template_id) : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveEventType() {
    if (saving) return;

    const name = String(form.name || '').trim();
    const slug = normalizeSlug(form.slug || form.name);
    if (!name) {
      toast.warning('Informe o nome do tipo de evento.');
      return;
    }
    if (!slug) {
      toast.warning('Informe um slug válido.');
      return;
    }

    const payload = {
      name,
      slug,
      description: String(form.description || '').trim(),
      is_active: form.is_active !== false,
      sort_order: Number.parseInt(String(form.sort_order || '0'), 10) || 0,
      color: String(form.color || '').trim() || null,
      icon: String(form.icon || '').trim() || null,
      default_contract_template_id: String(form.default_contract_template_id || '').trim() || null,
    };

    try {
      setSaving(true);
      if (editingId) {
        const tipoSelecionado = eventTypes.find((item) => String(item.id) === String(editingId));
        const id = tipoSelecionado?.id;
        if (!id) {
          throw new Error('ID inválido para atualização do tipo de evento');
        }

        console.log('Atualizando tipo:', tipoSelecionado.id);

        devLog('[EVENT_TYPES][SAVE_PAYLOAD]', {
          editingId: String(tipoSelecionado.id),
          default_contract_template_id: payload.default_contract_template_id,
        });

        const response = await fetch(`/api/admin/event-types/${tipoSelecionado.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const dataJson = await response.json();
        const data = dataJson?.eventType;
        const error = !response.ok || dataJson?.ok === false
          ? { message: dataJson?.error || 'Falha ao atualizar tipo de evento' }
          : null;

        devLog('[EVENT_TYPES][UPDATE_RESULT]', {
          editingId: String(tipoSelecionado.id),
          payload_default_contract_template_id: payload.default_contract_template_id,
          data_default_contract_template_id: data?.default_contract_template_id ?? null,
          hasError: Boolean(error),
        });

        if (error) {
          const message = String(error?.message || '').toLowerCase();
          if (message.includes('rls') || message.includes('permission denied') || message.includes('policy')) {
            throw new Error('Não foi possível salvar. A tabela event_types pode estar bloqueada por RLS.');
          }
          throw error;
        }

        if (!data) {
          throw new Error('Tipo de evento não foi atualizado. Verifique permissões/RLS.');
        }

        setEventTypes((prev) => prev.map((item) => (String(item.id) === String(data.id)
          ? { ...item, ...payload, ...data }
          : item)));
        toast.success('Tipo de evento atualizado com sucesso.');
        await loadData(false);
        resetForm();
      } else {
        const response = await fetch('/api/admin/event-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const dataJson = await response.json();
        if (!response.ok || dataJson?.ok === false) {
          throw new Error(dataJson?.error || 'Falha ao criar tipo de evento');
        }
        toast.success('Tipo de evento criado com sucesso. Próximo passo: associe um template ou gere um pré-contrato.');
        await loadData(false);
        resetForm();
      }
    } catch (error) {
      console.error('Erro ao salvar tipo de evento:', error);
      const msg = String(error?.message || '');
      if (msg.toLowerCase().includes('rls') || msg.toLowerCase().includes('permission denied') || msg.toLowerCase().includes('policy')) {
        toast.error('Não foi possível salvar. A tabela event_types pode estar bloqueada por RLS.');
      } else {
        toast.error(`Não foi possível salvar: ${msg || 'erro desconhecido'}`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item) {
    try {
      const next = item.is_active === false;
      const response = await fetch(`/api/admin/event-types/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      });
      const dataJson = await response.json();
      if (!response.ok || dataJson?.ok === false) {
        throw new Error(dataJson?.error || 'Falha ao alterar status');
      }

      toast.success(next ? 'Tipo ativado.' : 'Tipo inativado.');
      await loadData(false);
    } catch (error) {
      console.error('Erro ao alterar status do tipo:', error);
      toast.error(`Não foi possível alterar o status: ${error?.message || 'erro desconhecido'}`);
    }
  }

  async function deleteEventType(item) {
    const confirmed = await confirm({
      title: 'Excluir tipo de evento?',
      description: `Excluir o tipo "${item?.name || 'sem nome'}"? Essa ação só será permitida se não houver vínculo com eventos e pré-contratos.`,
      confirmText: 'Excluir tipo',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      setDeletingId(item.id);

      const response = await fetch(`/api/admin/event-types/${item.id}`, {
        method: 'DELETE',
      });
      const dataJson = await response.json();
      if (response.status === 409) {
        toast.warning('Este tipo já está em uso. Inative para não aparecer em novos pré-contratos.');
        return;
      }
      if (!response.ok || dataJson?.ok === false) {
        throw new Error(dataJson?.error || 'Falha ao excluir tipo de evento');
      }

      if (editingId && String(editingId) === String(item.id)) {
        resetForm();
      }

      await loadData(false);
      toast.success('Tipo de evento excluído com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir tipo de evento:', error);
      toast.error(`Não foi possível excluir: ${error?.message || 'erro desconhecido'}`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminShell pageTitle="Tipos de evento" activeItem="eventos">
      <div className="space-y-6">
        <AdminPageHero
          badge="Configuração"
          title="Tipos de evento"
          subtitle="Configure os tipos que aparecem no pré-contrato e o template padrão usado em cada um."
          actions={(
            <button
              type="button"
              onClick={startCreate}
              data-tour="event-type-new-button"
              className="rounded-[16px] bg-violet-600 px-5 py-3 text-[13px] font-black text-white shadow-[0_10px_20px_rgba(109,40,217,0.25)]"
            >
              Novo tipo
            </button>
          )}
        />

        <section className="grid gap-4 md:grid-cols-3">
          <AdminSummaryCard label="Tipos cadastrados" value={summary.total} helper="Total no catálogo" />
          <AdminSummaryCard label="Ativos" value={summary.active} helper="Disponíveis para novos pré-contratos" tone="success" />
          <AdminSummaryCard label="Sem template" value={summary.withoutTemplate} helper="Defina padrão para agilizar contratos" tone="warning" />
        </section>

        {templatesMigrationWarning ? (
          <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold leading-6 text-amber-800">
            Não foi possível listar templates deste workspace porque a estrutura de templates por workspace ainda precisa ser atualizada.
            {' '}Aplique a migration indicada pela API antes de vincular templates aos tipos de evento.
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <div className="rounded-[26px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_28px_rgba(17,24,39,0.05)] md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-[20px] font-black tracking-[-0.02em] text-[#0f172a]">Lista de tipos (configuração)</h2>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, slug ou template"
                className="w-full rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#0f172a] outline-none focus:border-violet-400 md:max-w-[300px]"
              />
            </div>

            <div className="mt-4 space-y-3">
              {loading && <div className="rounded-[16px] border border-dashed border-[#dbe3ef] p-4 text-sm text-slate-500">Carregando tipos de evento...</div>}

              {!loading && filteredTypes.length === 0 && eventTypes.length === 0 && (
                <SmartEmptyState
                  eyebrow="Configuração essencial"
                  title="Você ainda não cadastrou tipos de evento."
                  description="Os tipos organizam o fluxo comercial e definem qual modelo de contrato será usado em cada situação, como casamento, aniversário, culto ou evento corporativo."
                  bullets={['Organiza o pré-contrato', 'Vincula o template padrão', 'Facilita novos contratos', 'Evita configuração manual']}
                  primaryHref="/eventos/tipos"
                  primaryLabel="Criar primeiro tipo"
                  icon="🏷️"
                />
              )}

              {!loading && filteredTypes.length === 0 && eventTypes.length > 0 && (
                <div className="rounded-[16px] border border-dashed border-[#dbe3ef] p-4 text-sm text-slate-500">Nenhum tipo encontrado para esta busca.</div>
              )}

              {!loading && filteredTypes.map((item) => {
                const templateName = templateMap.get(String(item.default_contract_template_id || ''));
                return (
                  <article key={item.id} className="rounded-[20px] border border-[#e2e8f0] bg-[#fcfdff] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[17px] font-black text-[#0f172a]">{item.name}</h3>
                        <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.08em] text-[#64748b]">/{item.slug}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-black ${item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                          {item.is_active !== false ? 'Ativo' : 'Inativo'}
                        </span>
                        <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700">
                          Ordem {item.sort_order ?? 0}
                        </span>
                      </div>
                    </div>

                    <p className="mt-3 text-[14px] text-[#475569]">{item.description || 'Sem descrição.'}</p>

                    <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-semibold">
                      <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-[#3730a3]">
                        Template: {templateName || 'Sem template padrão'}
                      </span>
                      {item.color ? <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[#334155]">Cor: {item.color}</span> : null}
                      {item.icon ? <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[#334155]">Ícone: {item.icon}</span> : null}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e8f0] pt-3">
                      <p className="text-[12px] font-semibold text-[#64748b]">Atualizado em {formatDateTime(item.updated_at)}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded-[12px] border border-[#dbe3ef] bg-white px-3 py-2 text-[12px] font-black text-[#0f172a]"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(item)}
                          className="rounded-[12px] border border-[#dbe3ef] bg-white px-3 py-2 text-[12px] font-black text-[#0f172a]"
                        >
                          {item.is_active !== false ? 'Inativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEventType(item)}
                          disabled={deletingId === item.id}
                          className="rounded-[12px] border border-rose-200 bg-white px-3 py-2 text-[12px] font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingId === item.id ? 'Excluindo...' : 'Excluir'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-[26px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_28px_rgba(17,24,39,0.05)] md:p-6">
            <h2 className="text-[20px] font-black tracking-[-0.02em] text-[#0f172a]">
              {editingId ? 'Editar tipo' : 'Novo tipo'}
            </h2>

            <div className="mt-4 space-y-4">
              <Field label="Nome">
                <Input data-tour="event-type-name-input" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Ex.: Casamento" />
              </Field>

              <Field label="Slug" helper="Se vazio, será gerado com base no nome.">
                <Input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} placeholder="casamento" />
              </Field>

              <Field label="Descrição">
                <Textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} placeholder="Resumo interno do tipo de evento" />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Ordem">
                  <Input type="number" value={form.sort_order} onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))} />
                </Field>

                <Field label="Template padrão">
                  <Select
                    data-tour="event-type-template-select"
                    value={form.default_contract_template_id || ''}
                    onChange={(event) => setForm((prev) => ({ ...prev, default_contract_template_id: event.target.value }))}
                  >
                    <option value="">Sem template padrão</option>
                    {templateOptions.map((template) => (
                      <option key={template.id} value={String(template.id)}>
                        {template.name}
                        {template.is_active === false ? ' (inativo)' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Cor">
                  <Input value={form.color} onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))} placeholder="#7c3aed" />
                </Field>

                <Field label="Ícone">
                  <Input value={form.icon} onChange={(event) => setForm((prev) => ({ ...prev, icon: event.target.value }))} placeholder="sparkles" />
                </Field>
              </div>

              <Checkbox
                checked={form.is_active}
                onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                label="Tipo ativo"
              />

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={saveEventType}
                  data-tour="event-type-save-button"
                  disabled={saving}
                  className="rounded-[14px] bg-violet-600 px-4 py-2.5 text-[13px] font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar tipo'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-2.5 text-[13px] font-black text-[#0f172a]"
                >
                  Limpar
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
