'use client';

import AdminSectionTitle from '../admin/AdminSectionTitle';
import { Input, Select } from '../admin/AdminFormPrimitives';
import ContractCard from './ContractCard';

export default function ContratosListaTab({
  contratosFiltrados,
  busca,
  setBusca,
  statusFiltro,
  setStatusFiltro,
  carregando,
  erro,
  onCopyLink,
  onDeleteContract,
}) {
  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
      <AdminSectionTitle
        title="Contratos"
        subtitle="Acompanhe visualização, assinatura e andamento."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[12px] font-bold text-[#64748b]">Buscar</label>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Cliente, evento, token, local..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-[12px] font-bold text-[#64748b]">Status</label>
          <Select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="LINK_GERADO">Link gerado</option>
            <option value="PREENCHENDO">Preenchendo</option>
            <option value="ASSINADO">Assinado</option>
          </Select>
        </div>
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

        {!carregando
          ? contratosFiltrados.map((item) => (
              <ContractCard
                key={item.precontractId || item.contractId || item.token}
                item={item}
                onCopyLink={onCopyLink}
                onDeleteContract={onDeleteContract}
              />
            ))
          : null}
      </div>
    </section>
  );
}
