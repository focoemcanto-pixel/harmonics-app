'use client';

import AppModal from './AppModal';
import Button from './Button';

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Confirmar ação',
  description = 'Tem certeza que deseja continuar?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  closeOnOverlay = true,
}) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      closeOnOverlay={closeOnOverlay}
      title={title}
      hideDefaultFooter={true}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          {description}
        </p>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose}>
            {cancelText}
          </Button>

          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
