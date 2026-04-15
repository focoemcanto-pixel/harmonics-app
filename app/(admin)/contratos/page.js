'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminShell from '@/components/admin/AdminShell';
import AdminPageHero from '@/components/admin/AdminPageHero';
import AdminSegmentTabs from '@/components/admin/AdminSegmentTabs';

// Helpers
import { mapStatus } from '@/lib/contratos/contratos-ui';
import { filterBySearch, filterByStatus } from '@/lib/contratos/contratos-filters';
import { getContratosSummary } from '@/lib/contratos/contratos-summary';

// Components
import ContratosResumoTab from '@/components/contratos/ContratosResumoTab';
import ContratosListaTab from '@/components/contratos/ContratosListaTab';
import ContratosFiltrosTab from '@/components/contratos/ContratosFiltrosTab';

function formatDateBR(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",;\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function getResolvedToken(precontract, contract) {
  return String(precontract?.public_token || contract?.public_token || '').trim();
}

export default function ContratosPage() {
  const router = useRouter();

  const [mobileTab, setMobileTab] = useState('resumo');
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [contratos, setContratos] = useState([]);
  const [exportando, setExportando] = useState(false);

  const mobileTabs = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'lista', label: 'Lista' },
    { key: 'filtros', label: 'Filtros' },
  ];

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
              .neq('status', 'archived')
              .order('created_at', { ascending: false }),
            supabase
              .from('contracts')
              .select('*')
              .neq('status', 'archived')
              .order('created_at', { ascending: false }),
          ]);

        if (preErr) throw preErr;
        if (conErr) throw conErr;

        const contractsByPreId = new Map(
          (contracts || []).map((item) => [String(item.precontract_id), item])
        );

        const merged = (precontracts || []).map((pre) => {
          const contract = contractsByPreId.get(String(pre.id));
          const resolvedToken = getResolvedToken(pre, contract);
          const resolvedStatus = mapStatus(
            contract?.status || pre?.status,
            !!contract
          );

          const visualizado =
            String(pre?.status || '').toLowerCase() !== 'link_generated' ||
            !!contract;

          const clienteNome = pre.client_name || 'Cliente a confirmar';

          const eventoTitulo = pre.event_type
            ? pre.client_name
              ? `${pre.event_type} • ${pre.client_name}`
              : `${pre.event_type} • Cliente a confirmar`
            : 'Contrato';

          return {
            id: pre.id,
            token: resolvedToken,
            precontractId: pre.id,
            contractId: contract?.id || null,
            eventoId: contract?.event_id || pre?.event_id || null,
            clienteNome,
            eventoTitulo,
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
            linkContrato: resolvedToken ? `/contrato/${resolvedToken}` : '',
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
    let resultado = contratos;
    resultado = filterBySearch(resultado, busca);
    resultado = filterByStatus(resultado, statusFiltro);
    return resultado;
  }, [contratos, busca, statusFiltro]);

  const resumo = useMemo(() => getContratosSummary(contratos), [contratos]);

  function handleNovoContrato() {
    router.push('/pre-contratos');
  }

  async function onCopyLink(link) {
    if (!link) {
      alert('Este contrato ainda não possui link público.');
      return;
    }

    try {
      const full = `${window.location.origin}${link}`;
      await navigator.clipboard.writeText(full);
      alert('Link copiado com sucesso.');
    } catch (error) {
      console.error(error);
      alert('Não foi possível copiar o link.');
    }
  }

  async function onDeleteContract(item) {
    if (!item?.precontractId) return;

    const confirmed = window.confirm('Tem certeza que deseja excluir este contrato?');
    if (!confirmed) return;

    try {
      const nowIso = new Date().toISOString();
      const updates = [
        supabase
          .from('precontracts')
          .update({
            status: 'archived',
            updated_at: nowIso,
          })
          .eq('id', item.precontractId),
      ];

      if (item.contractId) {
        updates.push(
          supabase
            .from('contracts')
            .update({
              status: 'archived',
              updated_at: nowIso,
            })
            .eq('id', item.contractId)
        );
      }

      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      setContratos((prev) =>
        prev.filter((entry) => String(entry.precontractId) !== String(item.precontractId))
      );
      alert('Contrato removido com sucesso.');
    } catch (error) {
      console.error('Erro ao remover contrato:', error);
      alert('Não foi possível remover o contrato.');
    }
  }

  function handleExportar() {
    try {
      setExportando(true);

      const linhas = [
        [
          'Cliente',
          'Título',
          'Tipo',
          'Data do evento',
          'Local',
          'WhatsApp',
          'Status',
          'Visualizado',
          'Enviado em',
          'Assinado em',
          'Link público',
          'PDF',
          'DOC',
          'Observações',
        ],
        ...contratosFiltrados.map((item) => [
          item.clienteNome,
          item.eventoTitulo,
          item.eventoTipo,
          formatDateBR(item.dataEvento),
          item.localEvento,
          item.whatsapp,
          item.statusLabel,
          item.visualizado ? 'Sim' : 'Não',
          item.enviadoEm ? new Date(item.enviadoEm).toLocaleString('pt-BR') : '',
          item.assinadoEm ? new Date(item.assinadoEm).toLocaleString('pt-BR') : '',
          item.linkContrato ? `${window.location.origin}${item.linkContrato}` : '',
          item.pdfUrl || '',
          item.docUrl || '',
          item.observacoes || '',
        ]),
      ];

      const csvContent = linhas
        .map((linha) => linha.map(escapeCsv).join(';'))
        .join('\n');

      const blob = new Blob([`\uFEFF${csvContent}`], {
        type: 'text/csv;charset=utf-8;',
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const dataAtual = new Date().toISOString().slice(0, 10);

      anchor.href = url;
      anchor.download = `contratos-harmonics-${dataAtual}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar contratos:', error);
      alert('Não foi possível exportar os contratos.');
    } finally {
      setExportando(false);
    }
  }

  const mobileActions = (
    <button
      type="button"
      onClick={handleNovoContrato}
      className="rounded-[16px] bg-[#0f172a] px-4 py-3 text-[13px] font-black text-white transition hover:opacity-95 active:scale-[0.99]"
    >
      Novo
    </button>
  );

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
                onClick={handleExportar}
                disabled={exportando || !contratosFiltrados.length}
                className="rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-4 text-[14px] font-black text-[#0f172a] transition hover:border-[#cbd5e1] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exportando ? 'Exportando...' : 'Exportar'}
              </button>

              <button
                type="button"
                onClick={handleNovoContrato}
                className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] transition hover:bg-violet-700 active:scale-[0.99]"
              >
                Novo contrato
              </button>
            </div>
          }
        />

        <div className="hidden space-y-5 md:block">
          <ContratosResumoTab resumo={resumo} setMobileTab={setMobileTab} />
          <ContratosListaTab
            contratosFiltrados={contratosFiltrados}
            busca={busca}
            setBusca={setBusca}
            statusFiltro={statusFiltro}
            setStatusFiltro={setStatusFiltro}
            carregando={carregando}
            erro={erro}
            onCopyLink={onCopyLink}
            onDeleteContract={onDeleteContract}
          />
        </div>

        <div className="md:hidden">
          <AdminSegmentTabs
            items={mobileTabs}
            active={mobileTab}
            onChange={setMobileTab}
          />
        </div>

        <div className="space-y-5 md:hidden">
          {mobileTab === 'resumo' && (
            <ContratosResumoTab resumo={resumo} setMobileTab={setMobileTab} />
          )}

          {mobileTab === 'lista' && (
            <ContratosListaTab
              contratosFiltrados={contratosFiltrados}
              busca={busca}
              setBusca={setBusca}
              statusFiltro={statusFiltro}
              setStatusFiltro={setStatusFiltro}
              carregando={carregando}
              erro={erro}
              onCopyLink={onCopyLink}
              onDeleteContract={onDeleteContract}
            />
          )}

          {mobileTab === 'filtros' && (
            <ContratosFiltrosTab
              busca={busca}
              setBusca={setBusca}
              statusFiltro={statusFiltro}
              setStatusFiltro={setStatusFiltro}
            />
          )}
        </div>
      </div>
    </AdminShell>
  );
}
