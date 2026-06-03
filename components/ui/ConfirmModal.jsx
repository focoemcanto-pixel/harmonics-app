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
        <p className="break-words text-sm leading-6 text-slate-500">
          {description}
        </p>

        <div className="grid grid-cols-1 gap-2 pt-4 sm:flex sm:justify-end sm:gap-3">
          <Button variant="ghost" onClick={onClose} className="min-h-11 w-full sm:w-auto">
            {cancelText}
          </Button>

          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            className="min-h-11 w-full sm:w-auto"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
