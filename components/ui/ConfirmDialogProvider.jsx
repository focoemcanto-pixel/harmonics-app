'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const ConfirmDialogContext = createContext(null);

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function useConfirm() {
  return useContext(ConfirmDialogContext);
}

export default function ConfirmDialogProvider({ children }) {
  const [dialogState, setDialogState] = useState(null);

  useEffect(() => {
    if (!dialogState || dialogState.disableEscClose) return undefined;

    function onKeyDown(event) {
      if (event.key !== 'Escape') return;
      console.info('[UI][CONFIRM_DIALOG_CANCEL]', { source: 'escape' });
      dialogState.resolve(false);
      setDialogState(null);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialogState]);

  const confirm = useCallback((options = {}) => {
    const config = {
      title: options.title || 'Confirmar ação',
      description: options.description || '',
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      tone: options.tone || 'default',
      disableBackdropClose: Boolean(options.disableBackdropClose),
      disableEscClose: Boolean(options.disableEscClose),
    };

    console.info('[UI][CONFIRM_DIALOG_OPEN]', config);

    return new Promise((resolve) => {
      setDialogState({
        ...config,
        resolve,
      });
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  function handleBackdropClick() {
    if (!dialogState || dialogState.disableBackdropClose) return;
    console.info('[UI][CONFIRM_DIALOG_CANCEL]', { source: 'backdrop' });
    dialogState.resolve(false);
    setDialogState(null);
  }

  function handleCancel() {
    if (!dialogState) return;
    console.info('[UI][CONFIRM_DIALOG_CANCEL]', { source: 'button' });
    dialogState.resolve(false);
    setDialogState(null);
  }

  function handleConfirm() {
    if (!dialogState) return;
    console.info('[UI][CONFIRM_DIALOG_CONFIRM]', { title: dialogState.title });
    dialogState.resolve(true);
    setDialogState(null);
  }

  const confirmButtonClass =
    dialogState?.tone === 'destructive'
      ? 'border border-red-500/30 bg-red-500 text-white hover:bg-red-400'
      : 'border border-violet-400/30 bg-violet-500 text-white hover:bg-violet-400';

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}

      {typeof document !== 'undefined' && dialogState
        ? createPortal(
            <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4">
              <button
                aria-label="Fechar diálogo"
                type="button"
                className="absolute inset-0 cursor-default bg-[#04010d]/78 backdrop-blur-[3px]"
                onClick={handleBackdropClick}
              />

              <div
                role="dialog"
                aria-modal="true"
                className="relative w-full max-w-[540px] rounded-[26px] border border-white/15 bg-[linear-gradient(180deg,#110d1f,#090612)] p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,.55)] transition-all"
              >
                <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-200/80">
                  Confirmação
                </div>
                <h3 className="mt-2 text-[26px] font-black tracking-[-0.03em]">
                  {dialogState.title}
                </h3>
                {dialogState.description ? (
                  <p className="mt-3 text-[15px] leading-7 text-white/70">{dialogState.description}</p>
                ) : null}

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-[16px] border border-white/15 bg-white/5 px-5 py-3 text-[14px] font-black text-white/90 transition hover:bg-white/10"
                  >
                    {dialogState.cancelText}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className={cx(
                      'rounded-[16px] px-5 py-3 text-[14px] font-black transition',
                      confirmButtonClass
                    )}
                  >
                    {dialogState.confirmText}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </ConfirmDialogContext.Provider>
  );
}
