'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { diffEscala } from '../../lib/escalas/escalas-sync';
import { splitCsvLike, normalizeText } from '../../lib/templates-escala/templates-escala-match';
import { matchTemplatesForEvent } from '../../lib/scale/template-matcher';
import { useAppToast } from '@/components/ui/ToastProvider';
import {
  filterOperationalTeamContacts,
  getRoleInstrumentTagsFromEvent,
} from '../../lib/escalas/team-contacts';

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

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
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
      soft: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      order: 1,
    };
  }

  if (value === 'pending') {
    return {
      label: 'Pendente',
      badge: 'border-amber-200 bg-amber-50 text-amber-700',
      dot: 'bg-amber-500',
      soft: 'bg-amber-50 text-amber-700 border-amber-200',
      order: 2,
    };
  }

  if (value === 'backup') {
    return {
      label: 'Reserva',
      badge: 'border-sky-200 bg-sky-50 text-sky-700',
      dot: 'bg-sky-500',
      soft: 'bg-sky-50 text-sky-700 border-sky-200',
      order: 3,
    };
  }

  if (value === 'declined') {
    return {
      label: 'Recusado',
      badge: 'border-red-200 bg-red-50 text-red-700',
      dot: 'bg-red-500',
      soft: 'bg-red-50 text-red-700 border-red-200',
      order: 4,
    };
  }

  return {
    label: 'Pendente',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    soft: 'bg-amber-50 text-amber-700 border-amber-200',
    order: 5,
  };
}

function normalizeRoleText(value) {
  return normalizeText(String(value || '').trim());
}

function dedupeByMusician(list = []) {
  const map = new Map();
  for (const item of Array.isArray(list) ? list : []) {
    const key = String(item?.musician_id || '');
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, item);
      continue;
    }

    const prev = map.get(key);
    const merged = {
      ...prev,
      ...item,
      role: String(item?.role || prev?.role || '').trim(),
      notes: String(item?.notes || prev?.notes || '').trim(),
      status: item?.status || prev?.status || 'pending',
    };
    map.set(key, merged);
  }
  return Array.from(map.values());
}

function formatTemplateDisplay(template) {
  if (!template) return 'Formação sugerida';

  const formacao = String(template.formation || '').trim() || String(template.name || '').trim() || 'Formação sugerida';
  const composicao = String(template.instruments || '').trim();

  return composicao ? `${formacao} — ${composicao}` : formacao;
}

function getEventoEstadoResumo({ total, confirmados, pendentes, recusados, missing }) {
  if (!total || pendentes >= total) {
    return { label: 'Pendente', tone: 'amber' };
  }
  if (recusados > 0 || missing > 0 || pendentes > 0) {
    return { label: 'Atenção', tone: 'red' };
  }
  if (confirmados > 0) {
    return { label: 'Confirmado', tone: 'emerald' };
  }
  return { label: 'Pendente', tone: 'amber' };
}

function getRepertorioStatusLabel(status) {
  const normalized = String(status || '').trim().toUpperCase();
  if (!normalized) return 'Pendente';
  if (normalized === 'FINALIZADO') return 'Finalizado';
  if (normalized === 'EM_REVISAO' || normalized === 'AGUARDANDO_REVISAO') return 'Em revisão';
  if (normalized === 'NAO_INICIADO') return 'Pendente';
  return 'Pendente';
}

function SummaryChip({ children, tone = 'default' }) {
  const classes = {
    default: 'border-[#dbe3ef] bg-white text-[#0f172a]',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    slate: 'border-[#dbe3ef] bg-[#f8fafc] text-[#475569]',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
  };

  return (
    <div
      className={`inline-flex rounded-full border px-4 py-2 text-[13px] font-black ${classes[tone] || classes.default}`}
    >
      {children}
    </div>
  );
}

function MetricCard({ label, value, tone = 'default', helper }) {
  const tones = {
    default: 'border-[#dbe3ef] bg-white text-[#0f172a]',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    violet: 'border-violet-200 bg-violet-50 text-violet-800',
  };

  return (
    <div className={`rounded-[22px] border p-4 ${tones[tone] || tones.default}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.1em] opacity-75">
        {label}
      </div>
      <div className="mt-2 text-[28px] font-black tracking-[-0.04em]">{value}</div>
      {helper ? (
        <div className="mt-1 text-[13px] font-semibold opacity-80">{helper}</div>
      ) : null}
    </div>
  );
}

function SectionCard({ eyebrow, title, subtitle, right, children }) {
  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          {eyebrow ? (
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
              {eyebrow}
            </div>
          ) : null}
          <h3 className="mt-1 text-[24px] font-black tracking-[-0.03em] text-[#0f172a] md:text-[28px]">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[#64748b]">
              {subtitle}
            </p>
          ) : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      <div className="mt-5">{children}</div>
    </section>
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

function CoveragePill({ label, tone = 'default' }) {
  const tones = {
    covered: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    pending: 'border-amber-200 bg-amber-50 text-amber-700',
    missing: 'border-red-200 bg-red-50 text-red-700',
    default: 'border-[#dbe3ef] bg-[#f8fafc] text-[#475569]',
  };

  return (
    <span
      className={`inline-flex max-w-full min-w-0 whitespace-normal break-words rounded-full border px-3 py-1.5 text-[12px] font-black leading-5 ${tones[tone] || tones.default}`}
    >
      {label}
    </span>
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
  const hasEmptyRole = !String(item.role || '').trim();

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

          <div className="mt-3 flex flex-wrap gap-2">
            {item.contact_tag_text ? (
              <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-violet-700">
                Base: {item.contact_tag_text}
              </span>
            ) : null}

            {hasEmptyRole ? (
              <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-red-700">
                Função pendente
              </span>
            ) : null}
          </div>
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
            className={`w-full rounded-[18px] border bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:ring-4 ${
              hasEmptyRole
                ? 'border-red-200 focus:border-red-300 focus:ring-red-100'
                : 'border-[#dbe3ef] focus:border-violet-300 focus:ring-violet-100'
            }`}
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

function SearchResultCard({ contact, onAdd }) {
  return (
    <button
      type="button"
      onClick={() => onAdd(contact)}
      className="flex w-full items-start justify-between gap-3 rounded-[18px] border border-[#e7edf5] bg-white px-4 py-4 text-left transition hover:border-violet-200 hover:bg-[#fcfbff]"
    >
      <div className="min-w-0">
        <div className="text-[16px] font-black text-[#0f172a]">
          {contact.name || 'Sem nome'}
        </div>

        <div className="mt-1 text-[14px] font-semibold leading-6 text-[#64748b]">
          {[getContactTagText(contact), contact.phone, contact.email]
            .filter(Boolean)
            .join(' — ')}
        </div>
      </div>

      <div className="shrink-0 rounded-[14px] bg-violet-50 px-3 py-2 text-[12px] font-black text-violet-700">
        Adicionar
      </div>
    </button>
  );
}

export default function EventoEscalaTab({ eventId, nextEventHref = '' }) {
  const [evento, setEvento] = useState(null);
  const [contatos, setContatos] = useState([]);
  const [escalaSalva, setEscalaSalva] = useState([]);
  const [escalaLocal, setEscalaLocal] = useState([]);
  const [templateSugerido, setTemplateSugerido] = useState(null);
  const [outrasSugestoes, setOutrasSugestoes] = useState([]);
  const [repertorioStatus, setRepertorioStatus] = useState('');

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(false);
  const [enviandoConvites, setEnviandoConvites] = useState(false);
  const [inviteProgress, setInviteProgress] = useState({ current: 0, total: 0 });
  const toast = useAppToast();

  const buscaRef = useRef(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function carregarTudo() {
    if (!eventId) {
      if (!isMountedRef.current) return;
      setCarregando(false);
      setErro('Evento inválido para carregar a escala.');
      return;
    }

    try {
      if (!isMountedRef.current) return;
      setCarregando(true);
      setErro('');

      const [eventoResp, contatosResp, escalaResp, templatesResp, templateItemsResp, repertorioResp] =
        await Promise.all([
          supabase
            .from('events')
            .select('id, client_name, event_date, event_time, location_name, formation, instruments, status, open_amount, payment_status')
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
          supabase
            .from('repertoire_config')
            .select('status')
            .eq('event_id', eventId)
            .maybeSingle(),
        ]);

      if (!isMountedRef.current) return;
      if (eventoResp.error) throw eventoResp.error;
      if (contatosResp.error) throw contatosResp.error;
      if (escalaResp.error) throw escalaResp.error;
      if (templatesResp.error) throw templatesResp.error;
      if (templateItemsResp.error) throw templateItemsResp.error;
      if (repertorioResp.error) throw repertorioResp.error;

      const eventoData = eventoResp.data || null;
      const contatosData = filterOperationalTeamContacts(contatosResp.data || []);
      const contatosMap = new Map(contatosData.map((contact) => [String(contact.id), contact]));

      const escalaData = (escalaResp.data || [])
        .filter((item) => contatosMap.has(String(item.musician_id)))
        .map((item) => {
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
      let templateSugeridoAtual = null;
      setRepertorioStatus(String(repertorioResp?.data?.status || ''));

      if (escalaData.length === 0 && eventoData) {
        const suggestion = matchTemplatesForEvent(
          {
            formation: eventoData.formation,
            instruments: eventoData.instruments,
            roleInstrumentTags: getRoleInstrumentTagsFromEvent(eventoData).join(', '),
          },
          templatesResp.data || []
        );

        const bestTemplate = suggestion.bestTemplate;

        if (bestTemplate) {
          templateSugeridoAtual = {
            ...bestTemplate,
            match_explanation: suggestion.suggestions?.[0]?.explanation || '',
            match_score: suggestion.suggestions?.[0]?.score || 0,
          };
        }

        const suggestions = (suggestion.suggestions || []).map((item) => ({
          ...item.template,
          match_score: item.score,
          match_explanation: item.explanation,
        }));

        setOutrasSugestoes(bestTemplate
          ? suggestions.filter((item) => String(item.id) !== String(bestTemplate.id)).slice(0, 3)
          : suggestions.slice(0, 3));
      }

      if (!isMountedRef.current) return;
      setEvento(eventoData);
      setContatos(contatosData);
      setEscalaSalva(escalaData);
      setEscalaLocal(escalaInicial);
      setTemplateSugerido(templateSugeridoAtual);
      if (escalaData.length > 0) setOutrasSugestoes([]);
    } catch (e) {
      console.error('Erro ao carregar escala do evento:', e);
      if (!isMountedRef.current) return;
      setErro(
        e?.message
          ? `Não foi possível carregar a escala deste evento. ${e.message}`
          : 'Não foi possível carregar a escala deste evento.'
      );
    } finally {
      if (isMountedRef.current) {
        setCarregando(false);
      }
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
      if (!isMountedRef.current) return;
      setSucesso('');
    }, 2600);

    return () => clearTimeout(timer);
  }, [sucesso]);

  const instrumentosEsperados = useMemo(() => {
    const fromInstruments = splitCsvLike(evento?.instruments);
    if (fromInstruments.length > 0) return fromInstruments;
    return splitCsvLike(evento?.formation);
  }, [evento]);

  const escalaBase = editando
    ? escalaLocal
    : escalaSalva.length > 0
      ? escalaSalva
      : escalaLocal;
  const escalaLocalSegura = Array.isArray(escalaLocal) ? escalaLocal : [];
  const escalaSalvaSegura = Array.isArray(escalaSalva) ? escalaSalva : [];
  const escalaParaExibir = Array.isArray(escalaBase) ? escalaBase : [];

  const escalaOrdenadaPreview = useMemo(() => {
    return [...escalaParaExibir].sort((a, b) => {
      const aMeta = getStatusMeta(a.status);
      const bMeta = getStatusMeta(b.status);

      if (aMeta.order !== bMeta.order) return aMeta.order - bMeta.order;
      return String(a.musician_name || '').localeCompare(String(b.musician_name || ''));
    });
  }, [escalaParaExibir]);

  const contatosDisponiveis = useMemo(() => {
    const baseLocal = Array.isArray(escalaLocal) ? escalaLocal : [];
    const usados = new Set(baseLocal.map((item) => String(item.musician_id)));
    return contatos.filter((contact) => !usados.has(String(contact.id)));
  }, [contatos, escalaLocal]);

  const contatosFiltrados = useMemo(() => {
    const termo = normalizeText(busca);
    if (!termo) return contatosDisponiveis.slice(0, 12);

    return contatosDisponiveis
      .filter((contact) => getContactSearchText(contact).includes(termo))
      .slice(0, 12);
  }, [busca, contatosDisponiveis]);

  const suggestedContacts = useMemo(() => {
    if (busca.trim()) return [];

    const expectedTokens = instrumentosEsperados.map((item) => normalizeText(item));
    if (expectedTokens.length === 0) return contatosDisponiveis.slice(0, 6);

    const scored = contatosDisponiveis
      .map((contact) => {
        const haystack = getContactSearchText(contact);
        let score = 0;

        expectedTokens.forEach((token) => {
          if (token && haystack.includes(token)) score += 1;
        });

        return { contact, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || String(a.contact.name || '').localeCompare(String(b.contact.name || '')))
      .slice(0, 6)
      .map((item) => item.contact);

    if (scored.length > 0) return scored;
    return contatosDisponiveis.slice(0, 6);
  }, [busca, contatosDisponiveis, instrumentosEsperados]);

  const resumoStatus = useMemo(() => {
    const base = escalaParaExibir;
    const total = base.length;
    const confirmados = base.filter((item) => item.status === 'confirmed').length;
    const pendentes = base.filter((item) => item.status === 'pending').length;
    const recusados = base.filter((item) => item.status === 'declined').length;
    const reservas = base.filter((item) => item.status === 'backup').length;

    return { total, confirmados, pendentes, recusados, reservas };
  }, [escalaParaExibir]);
  const sugestaoFormacao = useMemo(() => {
    const base = (evento?.formation || templateSugerido?.name || 'Formação sugerida').trim();
    if (!instrumentosEsperados.length) return base;
    return `${base} — ${instrumentosEsperados.slice(0, 2).join(' + ')}`;
  }, [evento?.formation, templateSugerido?.name, instrumentosEsperados]);

  const coverage = useMemo(() => {
    const expected = instrumentosEsperados;
    const used = escalaParaExibir;

    const covered = [];
    const pending = [];
    const missing = [];

    expected.forEach((expectedItem) => {
      const normalizedExpected = normalizeText(expectedItem);

      const matches = used.filter((item) => {
        const roleText = normalizeRoleText(item.role);
        const tagText = normalizeRoleText(item.contact_tag_text);
        return (
          (roleText && roleText.includes(normalizedExpected)) ||
          (tagText && tagText.includes(normalizedExpected))
        );
      });

      if (matches.some((item) => item.status === 'confirmed')) {
        covered.push(expectedItem);
      } else if (matches.some((item) => item.status === 'pending' || item.status === 'backup')) {
        pending.push(expectedItem);
      } else {
        missing.push(expectedItem);
      }
    });

    return {
      expected,
      covered,
      pending,
      missing,
    };
  }, [instrumentosEsperados, escalaParaExibir]);
  const estadoEvento = useMemo(
    () =>
      getEventoEstadoResumo({
        total: resumoStatus.total,
        confirmados: resumoStatus.confirmados,
        pendentes: resumoStatus.pendentes,
        recusados: resumoStatus.recusados,
        missing: coverage.missing.length,
      }),
    [resumoStatus, coverage.missing.length]
  );
  const repertorioLabel = useMemo(
    () => getRepertorioStatusLabel(repertorioStatus),
    [repertorioStatus]
  );

  const statusTela = useMemo(() => {
    if (coverage.missing.length === 0 && resumoStatus.pendentes === 0) return 'Confirmado';
    if (resumoStatus.total > 0) return 'Atenção';
    return 'Pendente';
  }, [coverage.missing.length, resumoStatus.pendentes, resumoStatus.total]);

  const diffResumo = useMemo(() => {
    const localSafe = Array.isArray(escalaLocal) ? escalaLocal : [];
    const savedSafe = Array.isArray(escalaSalva) ? escalaSalva : [];
    const { novos, removidos } = diffEscala(savedSafe, localSafe);
    const pendentes = localSafe.filter((item) => item.status === 'pending').length;
    const recusados = localSafe.filter((item) => item.status === 'declined').length;
    const reservas = localSafe.filter((item) => item.status === 'backup').length;
    const funcoesVazias = localSafe.filter((item) => !String(item.role || '').trim()).length;

    return {
      total: localSafe.length,
      novos: novos.length,
      removidos: removidos.length,
      pendentes,
      recusados,
      reservas,
      funcoesVazias,
      convitesNovos: novos.length,
      convitesRemovidos: removidos.length,
    };
  }, [escalaSalva, escalaLocal]);

  function iniciarEdicao() {
    setEscalaLocal([...escalaParaExibir]);
    setBusca('');
    setSucesso('');
    setEditando(true);
  }

  function aplicarTemplateSugerido() {
    if (!templateSugerido || itensTemplateSugerido.length === 0) return;
    setEscalaLocal([...itensTemplateSugerido]);
    setTemplateSugerido(null);
    setEditando(true);
    setSucesso('');
  }

  function iniciarMontagemManual() {
    setTemplateSugerido(null);
    setEscalaLocal([]);
    setEditando(true);
    setBusca('');
    setSucesso('');
  }

  function cancelarEdicao() {
    setEscalaLocal(Array.isArray(escalaSalva) ? escalaSalva : []);
    setBusca('');
    setEditando(false);
  }

  function adicionarMusico(contact) {
    if (!contact?.id) return;

    const alreadyExists = escalaLocal.some(
      (item) => String(item?.musician_id) === String(contact.id)
    );
    if (alreadyExists) {
      setBusca('');
      return;
    }

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

  function enrichScaleItems(items = []) {
    const contatosMap = new Map(
      (Array.isArray(contatos) ? contatos : []).map((contact) => [String(contact.id), contact])
    );

    return (Array.isArray(items) ? items : []).map((item) => {
      const contact = contatosMap.get(String(item?.musician_id || '')) || null;

      return {
        ...item,
        musician_name: item?.musician_name || contact?.name || '',
        musician_phone: item?.musician_phone || contact?.phone || '',
        musician_email: item?.musician_email || contact?.email || '',
        contact_tag_text: item?.contact_tag_text || getContactTagText(contact),
      };
    });
  }

async function persistirEscala() {
  const escalaLocalDedupe = dedupeByMusician(escalaLocalSegura).map((item) => ({
    musician_id: item.musician_id,
    role: item.role || item.contact_tag_text || null,
    status: item.status || 'pending',
    notes: item.notes || null,
    confirmed_at:
      item.status === 'confirmed'
        ? item.confirmed_at || new Date().toISOString()
        : null,
  }));

  const response = await fetch(`/api/events/${eventId}/scale`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ escalaLocal: escalaLocalDedupe }),
  });
  if (!isMountedRef.current) return { novos: 0 };

  const data = await response.json().catch(() => ({}));
  if (!isMountedRef.current) return { novos: 0 };

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || 'Não foi possível salvar a escala.');
  }
  const novaEscala = Array.isArray(data?.escala) ? data.escala : escalaLocalDedupe.map((item) => {
    const original = escalaLocalSegura.find(
      (localItem) => String(localItem?.musician_id) === String(item?.musician_id)
    );
    return {
      id: original?.id,
      event_id: eventId,
      musician_id: item.musician_id,
      role: item.role || '',
      status: item.status || 'pending',
      notes: item.notes || '',
      confirmed_at: item.confirmed_at || null,
      musician_name: original?.musician_name || '',
      musician_phone: original?.musician_phone || '',
      musician_email: original?.musician_email || '',
      contact_tag_text: original?.contact_tag_text || '',
    };
  });

  const escalaNormalizada = Array.isArray(novaEscala) ? novaEscala : [];
  const escalaVisual = enrichScaleItems(escalaNormalizada);
  if (isMountedRef.current) {
    setEscalaSalva(escalaVisual);
    setEscalaLocal(escalaVisual);
    setBusca('');
    setEditando(false);
    setSucesso('Escala salva com sucesso.');
    setTemplateSugerido(null);
  }

  return {
    novos: Number(data?.stats?.novosConvites || 0),
  };
}

function summarizeInviteDispatchResults(data) {
  const results = Array.isArray(data?.results) ? data.results : [];
  const computedSentCount = results.filter((result) => result?.ok === true).length;
  const computedFailedCount = results.filter((result) => result?.ok === false).length;
  const parsedSuccessCount = Number(data?.successCount);
  const parsedFailedCount = Number(data?.failedCount);
  const sentCount = Number.isFinite(parsedSuccessCount) ? parsedSuccessCount : computedSentCount;
  const failedCount = Number.isFinite(parsedFailedCount) ? parsedFailedCount : computedFailedCount;
  const total = results.length;

  return {
    total,
    sentCount,
    failedCount,
  };
}

async function fetchPendingInviteCount(eventId) {
  const { data, error } = await supabase
    .from('invites')
    .select('id, whatsapp_sent_at, status')
    .eq('event_id', eventId)
    .neq('status', 'removed');
  if (!isMountedRef.current) return 0;

  if (error) throw error;

  return (data || []).filter((invite) => !invite.whatsapp_sent_at).length;
}

async function salvarEscala() {
  try {
    setSalvando(true);
    setSucesso('');
    console.info('[automation][step] salvar_escala_started', { eventId });

    await persistirEscala();
    if (!isMountedRef.current) return;
    console.info('[automation][step] salvar_escala_persisted', { eventId });

    const response = await fetch('/api/whatsapp/send-event-invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    });
    if (!isMountedRef.current) return;
    console.info('[automation][step] send_event_invites_called', {
      eventId,
      responseStatus: response.status,
      ok: response.ok,
    });

    const data = await response.json().catch(() => ({}));
    if (!isMountedRef.current) return;
    const { total, sentCount, failedCount } = summarizeInviteDispatchResults(data);

    if (!response.ok && sentCount === 0) {
      throw new Error(
        data?.error ||
        `Escala salva, mas ${failedCount} convite(s) falharam no envio automático.`
      );
    }

    if (failedCount > 0 && sentCount > 0) {
      if (!isMountedRef.current) return;
      setSucesso(
        `Escala salva. Envio parcial: ${sentCount} convite(s) enviado(s) e ${failedCount} falha(s) no envio automático.`
      );
      return;
    }

    if (failedCount > 0 && sentCount === 0) {
      throw new Error(`Escala salva, mas ${failedCount} convite(s) falharam no envio automático.`);
    }

    if (!isMountedRef.current) return;
    setSucesso(
      total > 0
        ? `Escala salva e ${sentCount} convite(s) enviado(s) automaticamente.`
        : 'Escala salva. Nenhum convite pendente para envio automático.'
    );
  } catch (e) {
    console.error('[automation][step] salvar_escala_failed', e);
    if (!isMountedRef.current) return;
    toast.error(e?.message || 'Erro ao salvar escala.');
  } finally {
    if (isMountedRef.current) {
      setSalvando(false);
    }
  }
}
async function salvarEEnviarConvites() {
  try {
    setSalvando(true);
    setEnviandoConvites(true);
    setSucesso('');

    await persistirEscala();
    if (!isMountedRef.current) return;
    const totalPendentes = await fetchPendingInviteCount(eventId);
    if (!isMountedRef.current) return;
    setInviteProgress({ current: 0, total: totalPendentes });

    const response = await fetch('/api/whatsapp/send-event-invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    });
    if (!isMountedRef.current) return;

    const data = await response.json();
    if (!isMountedRef.current) return;

    const { total, sentCount, failedCount } = summarizeInviteDispatchResults(data);
    if (!isMountedRef.current) return;
    setInviteProgress({ current: total, total });

    if (!response.ok && sentCount === 0) {
      throw new Error(
        data?.error ||
        `Escala salva, mas ${failedCount} convite(s) falharam no envio.`
      );
    }

    if (failedCount > 0 && sentCount > 0) {
      if (!isMountedRef.current) return;
      setSucesso(`Escala salva. Envio parcial: ${sentCount} convite(s) enviado(s) e ${failedCount} falha(s).`);
      return;
    }

    if (failedCount > 0 && sentCount === 0) {
      throw new Error(`Escala salva, mas ${failedCount} convite(s) falharam no envio.`);
    }

    if (!isMountedRef.current) return;
    setSucesso(
      total > 0
        ? `Escala salva e ${sentCount} convite(s) enviado(s).`
        : 'Escala salva. Nenhum convite pendente.'
    );

  } catch (e) {
    console.error(e);
    if (!isMountedRef.current) return;
    toast.error(e?.message || 'Erro ao enviar convites');
  } finally {
    if (isMountedRef.current) {
      setSalvando(false);
      setEnviandoConvites(false);
      setInviteProgress((prev) => ({ current: prev.total, total: prev.total }));
    }
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
    <div className="space-y-4 md:space-y-5">
      <section className="space-y-3 rounded-[24px] border border-[#dbe3ef] bg-white p-4 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-5">
        <div>
          <h3 className="text-[22px] font-black tracking-[-0.03em] text-[#0f172a]">{evento?.client_name || 'Evento'}</h3>
          <p className="mt-1 text-[13px] font-semibold text-[#64748b]">
            {formatDateTimeBR(evento?.event_date, evento?.event_time)}
            {evento?.location_name ? ` • ${evento.location_name}` : ''}
          </p>
        </div>

        <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">Status</div>
          <div className="mt-1 text-[14px] font-black text-[#0f172a]">{statusTela}</div>
        </div>

        <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-[13px] font-semibold text-[#0f172a]">
          {resumoStatus.total} músicos • {resumoStatus.confirmados} confirmados • {resumoStatus.pendentes} pendentes
        </div>

        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-3">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-violet-700">Sugestão de formação</div>
          <div className="mt-1 text-[14px] font-black text-violet-900">{formatTemplateDisplay(templateSugerido) || sugestaoFormacao}</div>
          <div className="text-[12px] font-semibold text-violet-700">Recomendado para este evento</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={iniciarMontagemManual}
              className="rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-2 text-[13px] font-black text-[#0f172a]"
            >
              Montagem manual
            </button>
            <button
              type="button"
              onClick={iniciarEdicao}
              className="rounded-[14px] bg-violet-600 px-4 py-2 text-[13px] font-black text-white"
            >
              Ajustar escala
            </button>
          </div>
        </div>

      {!editando && escalaSalvaSegura.length === 0 && outrasSugestoes.length > 0 ? (
          <div className="rounded-2xl border border-[#e2e8f0] bg-white px-3 py-3">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">Outras opções</div>
            <div className="mt-2 space-y-1 text-[13px] font-semibold text-[#334155]">
              {outrasSugestoes.map((suggestion) => (
                <div key={suggestion.id}>{formatTemplateDisplay(suggestion)}</div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#e2e8f0] bg-white px-3 py-3">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">Financeiro</div>
            <div className="mt-1 text-[14px] font-black text-[#0f172a]">{formatMoney(evento?.open_amount)} pendente</div>
            <Link href="/pagamentos" className="mt-2 inline-flex rounded-[12px] border border-[#dbe3ef] px-3 py-1.5 text-[12px] font-black text-[#0f172a]">
              Ver pagamentos
            </Link>
          </div>
          <div className="rounded-2xl border border-[#e2e8f0] bg-white px-3 py-3">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">Repertório</div>
            <div className="mt-1 text-[14px] font-black text-[#0f172a]">{repertorioLabel}</div>
            <Link href="/repertorios" className="mt-2 inline-flex rounded-[12px] border border-[#dbe3ef] px-3 py-1.5 text-[12px] font-black text-[#0f172a]">
              Ver repertório
            </Link>
          </div>
        </div>

        <div className="mt-1 flex flex-wrap gap-3">
          {!editando && escalaSalvaSegura.length === 0 && templateSugerido && itensTemplateSugerido.length > 0 ? (
            <button
              type="button"
              onClick={aplicarTemplateSugerido}
              className="rounded-[18px] bg-violet-600 px-5 py-3 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] transition hover:translate-y-[-1px]"
            >
              Aplicar template sugerido
            </button>
          ) : null}

          {editando ? (
            <div className="rounded-[18px] border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] font-black text-violet-700">
              Modo edição ativo
            </div>
          ) : null}

          {sucesso ? (
            <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-black text-emerald-700">
              {sucesso}
            </div>
          ) : null}
        </div>
        {sucesso ? (
          <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-[13px] font-black text-emerald-700">
            {sucesso}
          </div>
        ) : null}
        {sucesso && nextEventHref ? (
          <div>
            <Link
              href={nextEventHref}
              className="inline-flex rounded-[14px] bg-violet-600 px-4 py-2 text-[13px] font-black text-white"
            >
              Próximo evento
            </Link>
          </div>
        ) : null}
      </section>

      <SectionCard
        eyebrow="Cobertura da equipe"
        title="Situação da equipe"
        subtitle="Resumo rápido do que já está completo e do que ainda precisa de ajuste."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Equipe atual"
            value={resumoStatus.total}
            tone="default"
            helper="músico(s) na escala"
          />
          <MetricCard
            label="Confirmados"
            value={resumoStatus.confirmados}
            tone="emerald"
            helper="já responderam positivamente"
          />
          <MetricCard
            label="Pendentes"
            value={resumoStatus.pendentes}
            tone="amber"
            helper="ainda aguardando resposta"
          />
          <MetricCard
            label="Lacunas"
            value={coverage.missing.length}
            tone={coverage.missing.length > 0 ? 'red' : 'sky'}
            helper={
              coverage.missing.length > 0
                ? 'funções ainda sem cobertura'
                : 'sem lacunas críticas'
            }
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0 rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-[12px] font-black uppercase tracking-[0.1em] text-emerald-700">
              Cobertos
            </div>
            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
              {coverage.covered.length > 0 ? (
                coverage.covered.map((item) => (
                  <CoveragePill key={`covered-${item}`} label={item} tone="covered" />
                ))
              ) : (
                <CoveragePill label="Nenhum ainda" />
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-[24px] border border-amber-200 bg-amber-50 p-4">
            <div className="text-[12px] font-black uppercase tracking-[0.1em] text-amber-700">
              Cobertura frágil
            </div>
            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
              {coverage.pending.length > 0 ? (
                coverage.pending.map((item) => (
                  <CoveragePill key={`pending-${item}`} label={item} tone="pending" />
                ))
              ) : (
                <CoveragePill label="Nada crítico" />
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-[24px] border border-red-200 bg-red-50 p-4">
            <div className="text-[12px] font-black uppercase tracking-[0.1em] text-red-700">
              Faltando
            </div>
            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
              {coverage.missing.length > 0 ? (
                coverage.missing.map((item) => (
                  <CoveragePill key={`missing-${item}`} label={item} tone="missing" />
                ))
              ) : (
                <CoveragePill label="Equipe coberta" />
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {!editando ? (
        <>
          {escalaOrdenadaPreview.length === 0 ? (
            <EmptyState
              title="Sem escala ainda"
              text="Nenhum músico escalado neste evento. Monte a equipe para iniciar a operação e preparar os convites."
              actionLabel="Montar escala"
              onAction={iniciarEdicao}
            />
          ) : (
            <SectionCard
              eyebrow="Equipe atual"
              title="Visualização da escala"
              subtitle="Acompanhe quem já está escalado, quem ainda está pendente e quem recusou sem precisar entrar no modo de edição."
            >
              <div className="space-y-4">
                {escalaOrdenadaPreview.map((item) => (
                  <PreviewScaleCard
                    key={`${item.musician_id}-${item.role}-${item.id || 'novo'}`}
                    item={item}
                  />
                ))}
              </div>
            </SectionCard>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard
              eyebrow="Montagem da equipe"
              title="Adicionar músicos"
              subtitle="Busque por nome, tag, WhatsApp ou email. O sistema já prioriza sugestões compatíveis com este evento."
              right={
                <div className="text-[13px] font-semibold text-[#94a3b8]">
                  {contatosDisponiveis.length} disponível(is)
                </div>
              }
            >
              <div className="space-y-4">
                <div className="rounded-[22px] border border-[#e7edf5] bg-[#fafbff] p-4">
                  <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                    Buscar músico
                  </label>
                  <input
                    ref={buscaRef}
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nome, tag, whatsapp ou email..."
                    className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  />
                </div>

                {!busca.trim() ? (
                  <div className="rounded-[22px] border border-violet-200 bg-violet-50 p-4">
                    <div className="text-[12px] font-black uppercase tracking-[0.08em] text-violet-700">
                      Sugestões rápidas
                    </div>
                    <div className="mt-2 text-[14px] leading-6 text-violet-700">
                      Contatos com maior chance de encaixe para esta formação.
                    </div>

                    <div className="mt-4 space-y-3">
                      {suggestedContacts.length > 0 ? (
                        suggestedContacts.map((contact) => (
                          <SearchResultCard
                            key={`suggested-${contact.id}`}
                            contact={contact}
                            onAdd={adicionarMusico}
                          />
                        ))
                      ) : (
                        <div className="rounded-[18px] bg-white px-4 py-4 text-[14px] font-semibold text-[#64748b]">
                          Nenhuma sugestão encontrada.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[22px] border border-[#e7edf5] bg-white p-4">
                  <div className="text-[12px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                    Resultados
                  </div>

                  <div className="mt-4 space-y-3">
                    {contatosFiltrados.length === 0 ? (
                      <div className="rounded-[18px] bg-[#f8fafc] px-4 py-4 text-[14px] font-semibold text-[#64748b]">
                        Nenhum músico encontrado.
                      </div>
                    ) : (
                      contatosFiltrados.map((contact) => (
                        <SearchResultCard
                          key={contact.id}
                          contact={contact}
                          onAdd={adicionarMusico}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Equipe do evento"
              title="Músicos selecionados"
              subtitle="Ajuste função, status e observações antes de salvar a escala."
            >
              {escalaLocalSegura.length > 0 ? (
                <div className="space-y-4">
                  {escalaLocalSegura.map((item, index) => (
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
                <div className="rounded-[22px] border border-dashed border-[#dbe3ef] bg-[#f8fafc] px-4 py-5 text-[15px] font-semibold text-[#64748b]">
                  Selecione músicos na coluna ao lado para montar esta equipe.
                </div>
              )}
            </SectionCard>
          </div>

          <div className="sticky bottom-0 z-10 -mx-5 border-t border-[#e6ebf2] bg-white/95 px-5 py-4 backdrop-blur md:-mx-6 md:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                <SummaryChip>{diffResumo.total} músico(s)</SummaryChip>
                {diffResumo.novos > 0 ? (
                  <SummaryChip tone="violet">{diffResumo.novos} novo(s)</SummaryChip>
                ) : null}
                {diffResumo.removidos > 0 ? (
                  <SummaryChip tone="red">{diffResumo.removidos} removido(s)</SummaryChip>
                ) : null}
                {diffResumo.pendentes > 0 ? (
                  <SummaryChip tone="amber">{diffResumo.pendentes} pendente(s)</SummaryChip>
                ) : null}
                {diffResumo.funcoesVazias > 0 ? (
                  <SummaryChip tone="red">{diffResumo.funcoesVazias} função(ões) vazia(s)</SummaryChip>
                ) : null}
              </div>

             <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:w-auto">
                <button
  type="button"
  onClick={cancelarEdicao}
  disabled={salvando || enviandoConvites}
  className="rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-4 text-[15px] font-black text-[#0f172a] disabled:opacity-60"
>
  Cancelar
</button>

<button
  type="button"
  onClick={salvarEscala}
  disabled={salvando || enviandoConvites}
  className="rounded-[18px] border border-violet-200 bg-violet-50 px-5 py-4 text-[15px] font-black text-violet-700 disabled:opacity-60"
>
  {salvando && !enviandoConvites ? 'Salvando...' : 'Salvar escala'}
</button>

<button
  type="button"
  onClick={salvarEEnviarConvites}
  disabled={salvando || enviandoConvites}
  className="rounded-[18px] bg-violet-600 px-5 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] disabled:opacity-60"
>
  {enviandoConvites
    ? `Enviando convites... (${inviteProgress.current}/${inviteProgress.total})`
    : 'Salvar e enviar convites'}
              </button>
              </div>
            </div>

            <div className="mt-3 text-[12px] font-semibold text-[#64748b]">
              {diffResumo.convitesNovos > 0 || diffResumo.convitesRemovidos > 0
                ? `Ao salvar: ${diffResumo.convitesNovos} convite(s) novo(s) e ${diffResumo.convitesRemovidos} atualização(ões) de remoção em invites.`
                : 'Ao salvar, a escala será sincronizada com os convites existentes sem duplicidade.'}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
