'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdminShell from '../../components/admin/AdminShell';
import AdminPageHero from '../../components/admin/AdminPageHero';
import AdminSegmentTabs from '../../components/admin/AdminSegmentTabs';

// Helpers
import { mapStatus } from '../../lib/contratos/contratos-ui';
import { filterBySearch, filterByStatus } from '../../lib/contratos/contratos-filters';
import { getContratosSummary } from '../../lib/contratos/contratos-summary';

// Components
import ContratosResumoTab from '../../components/contratos/ContratosResumoTab';
import ContratosListaTab from '../../components/contratos/ContratosListaTab';
import ContratosFiltrosTab from '../../components/contratos/ContratosFiltrosTab';

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
    let resultado = contratos;
    resultado = filterBySearch(resultado, busca);
    resultado = filterByStatus(resultado, statusFiltro);
    return resultado;
  }, [contratos, busca, statusFiltro]);

  const resumo = useMemo(() => getContratosSummary(contratos), [contratos]);

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

        {/* Desktop - always shows all sections */}
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
          />
        </div>

        {/* Mobile tabs */}
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
