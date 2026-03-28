'use client';

import AdminSectionTitle from '../admin/AdminSectionTitle';
import { Input, Select } from '../admin/AdminFormPrimitives';
import EscalaCard from './EscalaCard';

export default function EscalasListaTab({
  escalas,
  busca,
  setBusca,
  statusFiltro,
  setStatusFiltro,
  onEdit,
  onDelete,
  onChangeStatus,
  onEnviarConvite,
}) {
  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
      <AdminSectionTitle
        title="Escalas"
        subtitle="Músicos escalados por evento."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[12px] font-bold text-[#64748b]">Buscar</label>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Músico, evento, função..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-[12px] font-bold text-[#64748b]">Status</label>
          <Select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="confirmed">Confirmados</option>
            <option value="pending">Pendentes</option>
            <option value="declined">Declinados</option>
            <option value="backup">Backup</option>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {escalas.length === 0 ? (
          <div className="rounded-[20px] bg-[#f8fafc] px-4 py-5 text-[14px] font-semibold text-[#64748b]">
            Nenhuma escala encontrada.
          </div>
        ) : null}

        {escalas.map((escala) => (
          <EscalaCard
            key={escala.id}
            escala={escala}
            onEdit={onEdit}
            onDelete={onDelete}
            onChangeStatus={onChangeStatus}
            onEnviarConvite={onEnviarConvite}
          />
        ))}
      </div>
    </section>
  );
}
