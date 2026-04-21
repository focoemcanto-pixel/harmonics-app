'use client';

export default function BulkActionBar({
  selectedCount,
  label,
  deleting = false,
  onClear,
  onDelete,
}) {
  if (!selectedCount) return null;

  return (
    <div className="sticky bottom-4 z-30 rounded-[20px] border border-[#e2e8f0] bg-white/95 px-4 py-3 shadow-[0_18px_35px_rgba(15,23,42,0.12)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] font-black text-[#0f172a]">
          {selectedCount} selecionado(s) • {label}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onClear}
            disabled={deleting}
            className="rounded-[12px] border border-[#dbe3ef] bg-white px-3 py-2 text-[12px] font-black text-[#0f172a] disabled:opacity-60"
          >
            Limpar seleção
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded-[12px] bg-red-600 px-3 py-2 text-[12px] font-black text-white disabled:opacity-70"
          >
            {deleting ? 'Excluindo...' : 'Excluir selecionados'}
          </button>
        </div>
      </div>
    </div>
  );
}
