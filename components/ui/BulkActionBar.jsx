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
    <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] z-30 rounded-[20px] border border-[#e2e8f0] bg-white/95 px-4 py-3 shadow-[0_18px_35px_rgba(15,23,42,0.12)] backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 break-words text-[13px] font-black text-[#0f172a]">
          {selectedCount} selecionado(s) • {label}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={onClear}
            disabled={deleting}
            className="min-h-11 touch-manipulation rounded-[12px] border border-[#dbe3ef] bg-white px-3 py-2 text-[12px] font-black text-[#0f172a] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
          >
            Limpar seleção
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="min-h-11 touch-manipulation rounded-[12px] bg-red-600 px-3 py-2 text-[12px] font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100"
          >
            {deleting ? 'Excluindo...' : 'Excluir selecionados'}
          </button>
        </div>
      </div>
    </div>
  );
}
