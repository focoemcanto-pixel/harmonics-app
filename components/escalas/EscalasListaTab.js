'use client';

import SmartEmptyState from '@/components/onboarding/SmartEmptyState';
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
    <section className="rounded-[24px] border border-[#e4e7ec] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:p-6">
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
        {escalas.length === 0 && !String(busca || '').trim() && (!statusFiltro || statusFiltro === 'todos') ? (
          <SmartEmptyState
            icon="🎻"
            eyebrow="Escalas"
            title="Nenhuma escala ainda"
            description="Monte a escala dentro de cada evento: escolha os músicos, envie os convites e acompanhe as confirmações por aqui."
            primaryHref="/eventos"
            primaryLabel="Abrir eventos"
            secondaryHref="/contatos"
            secondaryLabel="Cadastrar músicos"
          />
        ) : escalas.length === 0 ? (
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
