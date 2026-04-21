'use client';

export default function DeleteConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  loading = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-[#020617]/45 px-4">
      <div className="w-full max-w-xl rounded-[24px] border border-[#e2e8f0] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#ef4444]">
          Confirmar exclusão
        </p>
        <h3 className="mt-2 text-[24px] font-black text-[#0f172a]">{title}</h3>
        <p className="mt-2 text-[14px] text-[#475569]">{description}</p>
        <p className="mt-1 text-[14px] font-semibold text-[#ef4444]">Essa ação é definitiva.</p>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-2 text-[13px] font-black text-[#0f172a] disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-[14px] bg-red-600 px-4 py-2 text-[13px] font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Excluindo...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
