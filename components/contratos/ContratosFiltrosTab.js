'use client';

import AdminSectionTitle from '../admin/AdminSectionTitle';
import { Input, Select } from '../admin/AdminFormPrimitives';

export default function ContratosFiltrosTab({
  busca,
  setBusca,
  statusFiltro,
  setStatusFiltro,
}) {
  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
      <AdminSectionTitle
        title="Filtros"
        subtitle="Pesquise contratos e refine por status."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
    </section>
  );
}
