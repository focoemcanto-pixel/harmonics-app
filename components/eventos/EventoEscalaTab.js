'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  pickBestScaleTemplate,
  splitCsvLike,
  normalizeText,
} from '../../lib/templates-escala/templates-escala-match';

function formatDateBR(value) {
  if (!value) return '-';
  const [y, m, d] = String(value).split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function formatDateTimeBR(dateValue, timeValue) {
  const date = formatDateBR(dateValue);
  const time = timeValue ? String(timeValue).slice(0, 5) : '--:--';
  return `${date} • ${time}`;
}

function getContactTagText(contact) {
  const candidates = [
    contact?.tags,
    contact?.tag,
    contact?.role,
    contact?.instrument,
    contact?.instruments,
    contact?.category,
  ];

  const found = candidates.find(Boolean);

  if (Array.isArray(found)) return found.join(', ');
  return String(found || '').trim();
}

function getContactSearchText(contact) {
  return normalizeText(
    [
      contact?.name,
      contact?.phone,
      contact?.email,
      getContactTagText(contact),
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function getStatusMeta(status) {
  const value = String(status || 'pending').toLowerCase();

  if (value === 'confirmed') {
    return {
      label: 'Confirmado',
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      dot: 'bg-emerald-500',
    };
  }

  if (value === 'declined') {
    return {
      label: 'Recusado',
      badge: 'border-red-200 bg-red-50 text-red-700',
      dot: 'bg-red-500',
    };
  }

  if (value === 'backup') {
    return {
      label: 'Reserva',
      badge: 'border-sky-200 bg-sky-50 text-sky-700',
      dot: 'bg-sky-500',
    };
  }

  return {
    label: 'Pendente',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  };
}

function SummaryChip({ children, tone = 'default' }) {
  const classes = {
    default: 'border-[#dbe3ef] bg-white text-[#0f172a]',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    slate: 'border-[#dbe3ef] bg-[#f8fafc] text-[#475569]',
  };

  return (
    <div
      className={`inline-flex rounded-full border px-4 py-2 text-[13px] font-black ${classes[tone] || classes.default}`}
    >
      {children}
    </div>
  );
}

function EmptyState({ title, text, actionLabel, onAction }) {
  return (
    <div className="rounded-[26px] border border-dashed border-[#dbe3ef] bg-[#f8fafc] px-5 py-7 text-center">
      <div className="text-[18px] font-black text-[#0f172a]">{title}</div>
      <p className="mx-auto mt-2 max-w-xl text-[15px] leading-7 text-[#64748b]">
        {text}
      </p>

      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-[16px] border border-[#dbe3ef] bg-white px-5 py-3 text-[14px] font-black text-[#0f172a] transition hover:bg-[#f8fafc]"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function PreviewScaleCard({ item }) {
  const statusMeta = getStatusMeta(item.status);

  return (
    <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-4 shadow-[0_8px_22px_rgba(17,24,39,0.04)] transition hover:shadow-[0_14px_30px_rgba(17,24,39,0.06)] md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dot}`} />
            <div className="text-[19px] font-black text-[#0f172a]">
              {item.musician_name || 'Músico sem nome'}
            </div>
          </div>

          <div className="mt-2 text-[15px] font-semibold text-[#475569]">
            {item.role || item.contact_tag_text || 'Função não definida'}
          </div>

          <div className="mt-1 text-[14px] text-[#94a3b8]">
            {item.musician_phone || 'Sem telefone'}
            {item.musician_email ? ` • ${item.musician_email}` : ''}
          </div>

          {item.contact_tag_text ? (
            <div className="mt-3">
              <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-violet-700">
                {item.contact_tag_text}
              </span>
            </div>
          ) : null}
        </div>

        <div
          className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${statusMeta.badge}`}
        >
          {statusMeta.label}
        </div>
      </div>

      {item.notes ? (
        <div className="mt-4 rounded-[18px] bg-[#f8fafc] px-4 py-3 text-[14px] leading-6 text-[#64748b]">
          {item.notes}
        </div>
      ) : null}
    </div>
  );
}

function SelectedMusicianCard({ item, index, onChange, onRemove }) {
  const statusMeta = getStatusMeta(item.status);

  return (
    <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-4 shadow-[0_8px_22px_rgba(17,24,39,0.04)] md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dot}`} />
            <div className="text-[20px] font-black text-[#0f172a]">
              {item.musician_name || 'Músico sem nome'}
            </div>
          </div>

          <div className="mt-1 text-[14px] font-semibold text-[#64748b]">
            {item.musician_phone || 'Sem telefone'}
            {item.musician_email ? ` • ${item.musician_email}` : ''}
          </div>

          {item.contact_tag_text ? (
            <div className="mt-2 text-[13px] font-semibold text-violet-600">
              Tag base: {item.contact_tag_text}
            </div>
          ) : null}
        </div>

        <div
          className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${statusMeta.badge}`}
        >
          {statusMeta.label}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Função / Instrumento
          </label>
          <input
            type="text"
            value={item.role}
            onChange={(e) => onChange(index, 'role', e.target.value)}
            placeholder="Ex.: Violão, Voz principal, Sax..."
            className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          />
        </div>

        <div>
          <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Status
          </label>
          <select
            value={item.status}
            onChange={(e) => onChange(index, 'status', e.target.value)}
            className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          >
            <option value="pending">Pendente</option>
            <option value="confirmed">Confirmado</option>
            <option value="declined">Recusado</option>
            <option value="backup">Reserva</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Observações
          </label>
          <textarea
            value={item.notes}
            onChange={(e) => onChange(index, 'notes', e.target.value)}
            rows={3}
            placeholder="Ex.: chega 1h antes, toca só receptivo, levar retorno..."
            className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-black text-red-700 transition hover:bg-red-100"
        >
          Remover
        </button>
      </div>
    </div>
  );
}

export default function EventoEscalaTab({ eventId }) {
  const [evento, setEvento] = useState(null);
  const [contatos, setContatos] = useState([]);
  const [escalaSalva, setEscalaSalva] = useState([]);
  const [escalaLocal, setEscalaLocal] = useState([]);
  const [templateAplicado, setTemplateAplicado] = useState(null);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(false);

  const buscaRef = useRef(null);

  async function carregarTudo() {
    if (!eventId) return;

    try {
      setCarregando(true);
      setErro('');

      const [eventoResp, contatosResp, escalaResp, templatesResp, templateItemsResp] =
        await Promise.all([
          supabase
            .from('events')
            .select('id, client_name, event_date, event_time, location_name, formation, instruments')
            .eq('id', eventId)
            .single(),
          supabase
            .from('contacts')
            .select('*')
            .order('name', { ascending: true }),
          supabase
            .from('event_musicians')
            .select('id, event_id, musician_id, role, status, notes, confirmed_at, created_at, updated_at')
            .eq('event_id', eventId)
            .order('created_at', { ascending: true }),
          supabase
            .from('scale_templates')
            .select('*')
            .eq('is_active', true),
          supabase
            .from('scale_template_items')
            .select('*')
            .order('sort_order', { ascending: true }),
        ]);

      if (eventoResp.error) throw eventoResp.error;
      if (contatosResp.error) throw contatosResp.error;
      if (escalaResp.error) throw escalaResp.error;
      if (templatesResp.error) throw templatesResp.error;
      if (templateItemsResp.error) throw templateItemsResp.error;

      const eventoData = eventoResp.data || null;
      const contatosData = contatosResp.data || [];
      const contatosMap = new Map(contatosData.map((contact) => [String(contact.id), contact]));

      const escalaData = (escalaResp.data || []).map((item) => {
        const contact = contatosMap.get(String(item.musician_id)) || null;

        return {
          id: item.id,
          event_id: item.event_id,
          musician_id: item.musician_id,
          role: item.role || '',
          status: item.status || 'pending',
          notes: item.notes || '',
          confirmed_at: item.confirmed_at || null,
          musician_name: contact?.name || '',
          musician_phone: contact?.phone || '',
          musician_email: contact?.email || '',
          contact_tag_text: getContactTagText(contact),
        };
      });

      let escalaInicial = escalaData;
      let templateSelecionado = null;

      if (escalaData.length === 0 && eventoData) {
        const bestTemplate = pickBestScaleTemplate(
          templatesResp.data || [],
          eventoData.formation,
          eventoData.instruments
        );

        if (bestTemplate) {
          const templateItems = (templateItemsResp.data || [])
            .filter((item) => String(item.template_id) === String(bestTemplate.id))
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

          const suggestedItems = templateItems
            .map((item) => {
              const contact = contatosMap.get(String(item.contact_id)) || null;
              if (!contact) return null;

              const tagText = getContactTagText(contact);

              return {
                id: undefined,
                event_id: eventId,
                musician_id: item.contact_id,
                role: item.role || tagText || '',
                status: 'pending',
                notes: '',
                confirmed_at: null,
                musician_name: contact.name || '',
                musician_phone: contact.phone || '',
                musician_email: contact.email || '',
                contact_tag_text: tagText,
              };
            })
            .filter(Boolean);

          if (suggestedItems.length > 0) {
            escalaInicial = suggestedItems;
            templateSelecionado = bestTemplate;
          }
        }
      }

      setEvento(eventoData);
      setContatos(contatosData);
      setEscalaSalva(escalaData);
      setEscalaLocal(escalaInicial);
      setTemplateAplicado(templateSelecionado);
    } catch (e) {
      console.error('Erro ao carregar escala do evento:', e);
      setErro(
        e?.message
          ? `Não foi possível carregar a escala deste evento. ${e.message}`
          : 'Não foi possível carregar a escala deste evento.'
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarTudo();
  }, [eventId]);

  useEffect(() => {
    if (!editando) return;

    const timer = setTimeout(() => {
      if (buscaRef.current) buscaRef.current.focus();
    }, 180);

    return () => clearTimeout(timer);
  }, [editando]);

  useEffect(() => {
    if (!sucesso) return;

    const timer = setTimeout(() => {
      setSucesso('');
    }, 2200);

    return () => clearTimeout(timer);
  }, [sucesso]);

  const instrumentosEsperados = useMemo(() => {
    const fromInstruments = splitCsvLike(evento?.instruments);
    if (fromInstruments.length > 0) return fromInstruments;
    return splitCsvLike(evento?.formation);
  }, [evento]);

  const escalaParaExibir = editando ? escalaLocal : (escalaSalva.length > 0 ? escalaSalva : escalaLocal);

  const contatosDisponiveis = useMemo(() => {
    const usados = new Set(escalaLocal.map((item) => String(item.musician_id)));
    return contatos.filter((contact) => !usados.has(String(contact.id)));
  }, [contatos, escalaLocal]);

  const contatosFiltrados = useMemo(() => {
    const termo = normalizeText(busca);
    if (!termo) return contatosDisponiveis.slice(0, 12);

    return contatosDisponiveis
      .filter((contact) => getContactSearchText(contact).includes(termo))
      .slice(0, 12);
  }, [busca, contatosDisponiveis]);

  const resumoStatus = useMemo(() => {
    const base = escalaParaExibir;
    const total = base.length;
    const confirmados = base.filter((item) => item.status === 'confirmed').length;
    const pendentes = base.filter((item) => item.status === 'pending').length;
    const recusados = base.filter((item) => item.status === 'declined').length;

    return { total, confirmados, pendentes, recusados };
  }, [escalaParaExibir]);

  function iniciarEdicao() {
    setEscalaLocal(escalaParaExibir);
    setBusca('');
    setSucesso('');
    setEditando(true);
  }

  function cancelarEdicao() {
    setEscalaLocal(escalaSalva.length > 0 ? escalaSalva : escalaLocal);
    setBusca('');
    setEditando(false);
  }

  function adicionarMusico(contact) {
    const tagText = getContactTagText(contact);

    const novoItem = {
      id: undefined,
      event_id: eventId,
      musician_id: contact.id,
      role: tagText || '',
      status: 'pending',
      notes: '',
      confirmed_at: null,
      musician_name: contact.name || '',
      musician_phone: contact.phone || '',
      musician_email: contact.email || '',
      contact_tag_text: tagText,
    };

    setEscalaLocal((prev) => [...prev, novoItem]);
    setBusca('');
  }

  function removerMusico(index) {
    setEscalaLocal((prev) => prev.filter((_, i) => i !== index));
  }

  function atualizarItem(index, field, value) {
    setEscalaLocal((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const next = {
          ...item,
          [field]: value,
        };

        if (field === 'status') {
          next.confirmed_at =
            value === 'confirmed' ? item.confirmed_at || new Date().toISOString() : null;
        }

        return next;
      })
    );
  }

  async function salvarEscala() {
    try {
      setSalvando(true);
      setSucesso('');

      const payload = escalaLocal.map((item) => ({
        event_id: eventId,
        musician_id: item.musician_id,
        role: item.role || item.contact_tag_text || null,
        status: item.status || 'pending',
        notes: item.notes || null,
        confirmed_at:
          item.status === 'confirmed'
            ? item.confirmed_at || new Date().toISOString()
            : null,
      }));

      const { error: deleteError } = await supabase
        .from('event_musicians')
        .delete()
        .eq('event_id', eventId);

      if (deleteError) throw deleteError;

      if (payload.length > 0) {
        const { error: insertError } = await supabase
          .from('event_musicians')
          .insert(payload);

        if (insertError) throw insertError;
      }

      await carregarTudo();
      setEditando(false);
      setTemplateAplicado(null);
      setSucesso('Escala salva com sucesso.');
    } catch (e) {
      console.error('Erro ao salvar escala:', e);
      alert(e?.message ? `Erro ao salvar escala: ${e.message}` : 'Erro ao salvar escala. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="rounded-[24px] border border-[#dbe3ef] bg-[#f8fafc] px-5 py-6 text-[15px] font-semibold text-[#64748b]">
        Carregando escala...
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-6 text-[15px] font-bold leading-7 text-red-700">
        {erro}
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="rounded-[26px] border border-[#dbe3ef] bg-gradient-to-br from-[#fcfcff] to-[#f8fafc] p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
              Escala do evento
            </div>

            <h3 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-[#0f172a]">
              {evento?.client_name || 'Evento'}
            </h3>

            <div className="mt-3 text-[15px] font-semibold leading-7 text-[#64748b]">
              {formatDateTimeBR(evento?.event_date, evento?.event_time)}
              {evento?.location_name ? ` • ${evento.location_name}` : ''}
            </div>

            <div className="mt-2 text-[15px] font-semibold leading-7 text-[#64748b]">
              <span className="font-black text-[#0f172a]">
                {evento?.formation || 'Sem formação definida'}
              </span>
              {instrumentosEsperados.length > 0 ? (
                <span>{` — ${instrumentosEsperados.join(', ')}`}</span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:max-w-[360px] xl:justify-end">
            <SummaryChip>{resumoStatus.total} músico(s)</SummaryChip>
            <SummaryChip tone="slate">{resumoStatus.confirmados} confirmados</SummaryChip>
            <SummaryChip tone="slate">{resumoStatus.pendentes} pendentes</SummaryChip>
            {resumoStatus.recusados > 0 ? (
              <SummaryChip tone="slate">{resumoStatus.recusados} recusados</SummaryChip>
            ) : null}
          </div>
        </div>

        {templateAplicado && escalaSalva.length === 0 ? (
          <div className="mt-5 rounded-[22px] border border-violet-200 bg-violet-50 px-4 py-4">
            <div className="text-[12px] font-black uppercase tracking-[0.08em] text-violet-700">
              Pré-escala sugerida
            </div>
            <div className="mt-1 text-[15px] font-semibold text-violet-800">
              Template aplicado: {templateAplicado.name}
            </div>
            <div className="mt-1 text-[14px] leading-6 text-violet-700">
              A sugestão foi montada a partir da formação do evento. Revise e ajuste antes de salvar.
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {!editando ? (
            <button
              type="button"
              onClick={iniciarEdicao}
              className="rounded-[18px] bg-violet-600 px-5 py-3 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] transition hover:translate-y-[-1px]"
            >
              {escalaParaExibir.length > 0 ? 'Editar escala' : 'Montar escala'}
            </button>
          ) : (
            <div className="rounded-[18px] border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] font-black text-violet-700">
              Modo edição ativo
            </div>
          )}

          {sucesso ? (
            <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-black text-emerald-700">
              {sucesso}
            </div>
          ) : null}
        </div>
      </div>

      {!editando ? (
        <>
          {escalaParaExibir.length === 0 ? (
            <EmptyState
              title="Sem escala ainda"
              text="Nenhum músico escalado neste evento. Monte a equipe para começar a operação deste evento."
              actionLabel="Montar escala"
              onAction={iniciarEdicao}
            />
          ) : (
            <div className="space-y-4">
              {escalaParaExibir.map((item) => (
                <PreviewScaleCard
                  key={`${item.musician_id}-${item.role}-${item.id || 'novo'}`}
                  item={item}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="rounded-[26px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[12px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                  Adicionar músicos
                </div>
                <div className="mt-1 text-[16px] font-semibold text-[#475569]">
                  Busque por nome, tag, WhatsApp ou email.
                </div>
              </div>

              <div className="text-[13px] font-semibold text-[#94a3b8]">
                {contatosDisponiveis.length} disponível(is)
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-[#e7edf5] bg-[#fafbff] p-4">
              <input
                ref={buscaRef}
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar músico... (nome, tag, whatsapp)"
                className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />

              <div className="mt-4 overflow-hidden rounded-[18px] border border-[#e7edf5] bg-white">
                {contatosFiltrados.length === 0 ? (
                  <div className="px-4 py-4 text-[14px] font-semibold text-[#64748b]">
                    Nenhum músico encontrado.
                  </div>
                ) : (
                  contatosFiltrados.map((contact, index) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => adicionarMusico(contact)}
                      className={`block w-full px-4 py-4 text-left transition hover:bg-[#f8fafc] ${
                        index > 0 ? 'border-t border-[#eef2f7]' : ''
                      }`}
                    >
                      <div className="text-[16px] font-black text-[#0f172a]">
                        {contact.name || 'Sem nome'}
                      </div>

                      <div className="mt-1 text-[14px] font-semibold leading-6 text-[#64748b]">
                        {[getContactTagText(contact), contact.phone, contact.email]
                          .filter(Boolean)
                          .join(' — ')}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {escalaLocal.length === 0 ? (
              <div className="mt-5 rounded-[18px] bg-[#f8fafc] px-4 py-4 text-[15px] font-semibold text-[#64748b]">
                Nenhum músico selecionado ainda.
              </div>
            ) : null}
          </div>

          {escalaLocal.length > 0 ? (
            <div className="space-y-4">
              {escalaLocal.map((item, index) => (
                <SelectedMusicianCard
                  key={`${item.musician_id}-${index}`}
                  item={item}
                  index={index}
                  onChange={atualizarItem}
                  onRemove={removerMusico}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-[#dbe3ef] bg-white px-4 py-5 text-[15px] font-semibold text-[#64748b]">
              Selecione músicos acima.
            </div>
          )}

          <div className="sticky bottom-0 z-10 -mx-5 border-t border-[#e6ebf2] bg-white/95 px-5 py-4 backdrop-blur md:-mx-6 md:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-[13px] font-semibold text-[#64748b]">
                {escalaLocal.length} músico(s) prontos para salvar
              </div>

              <div className="grid grid-cols-2 gap-3 md:w-auto">
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  disabled={salvando}
                  className="rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-4 text-[15px] font-black text-[#0f172a] disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={salvarEscala}
                  disabled={salvando}
                  className="rounded-[18px] bg-violet-600 px-5 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] disabled:opacity-60"
                >
                  {salvando ? 'Salvando...' : 'Salvar escala'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
