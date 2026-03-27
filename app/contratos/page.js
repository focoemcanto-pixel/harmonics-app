'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import AdminShell from '../../components/admin/AdminShell';
import AdminPageHero from '../../components/admin/AdminPageHero';
import AdminSummaryCard from '../../components/admin/AdminSummaryCard';
import AdminSectionTitle from '../../components/admin/AdminSectionTitle';
import AdminSegmentTabs from '../../components/admin/AdminSegmentTabs';

function formatDateBR(value) {
  if (!value) return '-';

  const s = String(value);

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return s;

  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function getToneClasses(tone) {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-100 text-emerald-700';
    case 'amber':
      return 'bg-amber-100 text-amber-800';
    case 'red':
      return 'bg-red-100 text-red-700';
    case 'violet':
      return 'bg-violet-100 text-violet-700';
    case 'blue':
      return 'bg-sky-100 text-sky-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function Pill({ tone = 'default', children }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${getToneClasses(
        tone
      )}`}
    >
      {children}
    </span>
  );
}

function mapStatus(rawStatus, hasContract) {
  const s = String(rawStatus || '').toLowerCase();

  if (s === 'signed') {
    return {
      key: 'ASSINADO',
      label: 'Assinado',
      tone: 'emerald',
    };
  }

  if (s === 'client_filling') {
    return {
      key: 'PREENCHENDO',
      label: hasContract ? 'Preenchendo' : 'Preenchimento',
      tone: 'violet',
    };
  }

  if (s === 'link_generated') {
    return {
      key: 'LINK_GERADO',
      label: 'Link gerado',
      tone: 'blue',
    };
  }

  return {
    key: 'SEM_STATUS',
    label: 'Sem status',
    tone: 'default',
  };
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <label className="text-[12px] font-bold text-[#64748b]">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder = '' }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-4 text-[15px] font-semibold text-[#0f172a] outline-none"
    />
  );
}

function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-4 text-[15px] font-semibold text-[#0f172a] outline-none"
    >
      {children}
    </select>
  );
}

function ContractCard({
  item,
  onCopyLink,
}) {
  return (
    <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.04)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="text-[20px] font-black text-[#0f172a]">
            {item.clienteNome}
          </div>
          <div className="mt-1 text-[14px] font-semibold text-[#64748b]">
            {item.eventoTitulo}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Pill tone={item.statusTone}>{item.statusLabel}</Pill>

          {item.assinadoEm ? (
            <Pill tone="emerald">Assinado em {formatDateBR(item.assinadoEm)}</Pill>
          ) : null}

          {!item.assinadoEm && item.visualizado ? (
            <Pill tone="blue">Visualizado</Pill>
          ) : null}

          {!item.assinadoEm && !item.visualizado ? (
            <Pill tone="amber">Não visualizado</Pill>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-2">
          <p className="text-[14px] text-slate-700">
            <strong>Evento:</strong> {item.eventoTipo || 'Evento'} &nbsp;•&nbsp;
            <strong>Data:</strong> {formatDateBR(item.dataEvento)} &nbsp;•&nbsp;
            <strong>Local:</strong> {item.localEvento || '-'}
          </p>

          <p className="text-[14px] text-slate-700">
            <strong>WhatsApp:</strong> {item.whatsapp || '-'}
          </p>

          <p className="text-[14px] text-slate-500">
            <strong>Token:</strong> {item.token}
          </p>

          {item.observacoes ? (
            <p className="text-[14px] text-slate-500">{item.observacoes}</p>
          ) : null}
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-500">
            <strong>Link do contrato:</strong>
          </p>

          <div className="mt-2 break-all text-[13px] font-semibold text-[#475569]">
            {item.linkContrato}
          </div>

          <p className="mt-4 text-sm text-slate-500">
            <strong>Enviado em:</strong> {formatDateBR(item.enviadoEm)}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            <strong>Assinado em:</strong> {formatDateBR(item.assinadoEm)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={item.linkContrato}
          className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
        >
          Abrir contrato
        </Link>

        {item.eventoId ? (
          <Link
            href={`/eventos/${item.eventoId}`}
            className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
          >
            Abrir evento
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => onCopyLink(item.linkContrato)}
          className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
        >
          Copiar link
        </button>

        {item.pdfUrl ? (
          <a
            href={item.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
          >
            PDF final
          </a>
        ) : null}

        {item.docUrl ? (
          <a
            href={item.docUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
          >
            Documento
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default function ContratosPage() {
  const [mobileTab, setMobileTab] = useState('resumo');
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [contratos, setContratos] = useState([]);

  const mobileTabs = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'lista', label: 'Lista' },
    { key: 'filtros', label: 'Filtros' },
  ];

  const mobileActions = (
    <button
      type="button"
      className="rounded-[16px] bg-[#0f172a] px-4 py-3 text-[13px] font-black text-white"
    >
      Novo
    </button>
  );

  useEffect(() => {
    async function carregar() {
      try {
        setCarregando(true);
        setErro('');

        const [{ data: precontracts, error: preErr }, { data: contracts, error: conErr }] =
          await Promise.all([
            supabase
              .from('precontracts')
              .select('*')
              .order('created_at', { ascending: false }),
            supabase
              .from('contracts')
              .select('*')
              .order('created_at', { ascending: false }),
          ]);

        if (preErr) throw preErr;
        if (conErr) throw conErr;

        const contractsByPreId = new Map(
          (contracts || []).map((item) => [String(item.precontract_id), item])
        );

        const merged = (precontracts || []).map((pre) => {
          const contract = contractsByPreId.get(String(pre.id));
          const resolvedStatus = mapStatus(
            contract?.status || pre?.status,
            !!contract
          );

          const visualizado =
            String(pre?.status || '').toLowerCase() !== 'link_generated' ||
            !!contract;

          return {
            id: pre.id,
            token: pre.public_token,
            precontractId: pre.id,
            contractId: contract?.id || null,
            eventoId: contract?.event_id || pre?.event_id || null,
            clienteNome: pre.client_name || 'Sem cliente',
            eventoTitulo:
              pre.event_type && pre.client_name
                ? `${pre.event_type} • ${pre.client_name}`
                : pre.event_type || 'Contrato',
            eventoTipo: pre.event_type || '',
            dataEvento: pre.event_date || '',
            localEvento: pre.location_name || '',
            whatsapp: pre.client_phone || '',
            statusRaw: contract?.status || pre?.status || '',
            statusKey: resolvedStatus.key,
            statusLabel: resolvedStatus.label,
            statusTone: resolvedStatus.tone,
            visualizado,
            enviadoEm: pre.created_at || '',
            assinadoEm: contract?.signed_at || '',
            observacoes: pre.notes || '',
            linkContrato: `/contrato/${pre.public_token}`,
            pdfUrl: contract?.pdf_url || '',
            docUrl: contract?.doc_url || '',
          };
        });

        setContratos(merged);
      } catch (e) {
        console.error('Erro ao carregar contratos:', e);
        setErro('Não foi possível carregar os contratos.');
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, []);

  const contratosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return contratos.filter((item) => {
      const matchesBusca =
        !q ||
        String(item.clienteNome || '').toLowerCase().includes(q) ||
        String(item.eventoTitulo || '').toLowerCase().includes(q) ||
        String(item.token || '').toLowerCase().includes(q) ||
        String(item.localEvento || '').toLowerCase().includes(q);

      const matchesStatus =
        statusFiltro === 'todos' || item.statusKey === statusFiltro;

      return matchesBusca && matchesStatus;
    });
  }, [contratos, busca, statusFiltro]);

  const resumo = useMemo(() => {
    const total = contratos.length;
    const assinados = contratos.filter((item) => item.statusKey === 'ASSINADO').length;
    const pendentes = contratos.filter((item) => item.statusKey !== 'ASSINADO').length;
    const naoVisualizados = contratos.filter((item) => !item.visualizado).length;

    return {
      total,
      assinados,
      pendentes,
      naoVisualizados,
    };
  }, [contratos]);

  async function onCopyLink(link) {
    try {
      const full = `${window.location.origin}${link}`;
      await navigator.clipboard.writeText(full);
      alert('Link copiado com sucesso.');
    } catch (error) {
      console.error(error);
      alert('Não foi possível copiar o link.');
    }
  }

  function renderResumo() {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard
          label="Contratos"
          value={String(resumo.total)}
          helper="Total encontrado"
        />
        <AdminSummaryCard
          label="Assinados"
          value={String(resumo.assinados)}
          helper="Concluídos"
          tone="success"
        />
        <AdminSummaryCard
          label="Pendentes"
          value={String(resumo.pendentes)}
          helper="Aguardando ação"
          tone="warning"
        />
        <AdminSummaryCard
          label="Não visualizados"
          value={String(resumo.naoVisualizados)}
          helper="Ainda não abertos"
          tone="accent"
        />
      </div>
    );
  }

  function renderFiltros() {
    return (
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <AdminSectionTitle
          title="Filtros"
          subtitle="Pesquise contratos e refine por status."
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Buscar">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Cliente, evento, token, local..."
            />
          </Field>

          <Field label="Status">
            <Select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="LINK_GERADO">Link gerado</option>
              <option value="PREENCHENDO">Preenchendo</option>
              <option value="ASSINADO">Assinado</option>
            </Select>
          </Field>
        </div>
      </section>
    );
  }

  function renderLista() {
    return (
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <AdminSectionTitle
          title="Contratos"
          subtitle="Acompanhe visualização, assinatura e andamento."
        />

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Buscar">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Cliente, evento, token, local..."
            />
          </Field>

          <Field label="Status">
            <Select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="LINK_GERADO">Link gerado</option>
              <option value="PREENCHENDO">Preenchendo</option>
              <option value="ASSINADO">Assinado</option>
            </Select>
          </Field>
        </div>

        {erro ? (
          <div className="rounded-[20px] bg-red-50 px-4 py-5 text-[14px] font-semibold text-red-700">
            {erro}
          </div>
        ) : null}

        <div className="space-y-4">
          {!carregando && contratosFiltrados.length === 0 ? (
            <div className="rounded-[20px] bg-[#f8fafc] px-4 py-5 text-[14px] font-semibold text-[#64748b]">
              Nenhum contrato encontrado.
            </div>
          ) : null}

          {contratosFiltrados.map((item) => (
            <ContractCard
              key={item.id}
              item={item}
              onCopyLink={onCopyLink}
            />
          ))}
        </div>
      </section>
    );
  }

  if (carregando) {
    return (
      <AdminShell
        pageTitle="Contratos"
        mobileActions={mobileActions}
        activeItem="contratos"
      >
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <p className="text-center text-[#64748b]">Carregando contratos...</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      pageTitle="Contratos"
      mobileActions={mobileActions}
      activeItem="contratos"
    >
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Contratos"
          subtitle="Gerencie links, visualização, assinatura e andamento contratual."
          actions={
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-4 text-[14px] font-black text-[#0f172a]"
              >
                Exportar
              </button>

              <button
                type="button"
                className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
              >
                Novo contrato
              </button>
            </div>
          }
        />

        <div className="hidden md:block">{renderResumo()}</div>
        <div className="hidden md:block">{renderLista()}</div>

        <div className="md:hidden">
          <AdminSegmentTabs
            items={mobileTabs}
            active={mobileTab}
            onChange={setMobileTab}
          />
        </div>

        <div className="space-y-5 md:hidden">
          {mobileTab === 'resumo' && renderResumo()}
          {mobileTab === 'lista' && renderLista()}
          {mobileTab === 'filtros' && renderFiltros()}
        </div>
      </div>
    </AdminShell>
  );
}