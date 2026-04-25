'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import ConfirmModal from './ConfirmModal';

const ConfirmDialogContext = createContext(null);

export function useConfirm() {
  return useContext(ConfirmDialogContext);
}

export default function ConfirmDialogProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback((options = {}) => {
    const config = {
      title: options.title || 'Confirmar ação',
      description: options.description || 'Tem certeza que deseja continuar?',
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      variant: options.variant || (options.tone === 'destructive' ? 'danger' : 'primary'),
      disableBackdropClose: Boolean(options.disableBackdropClose),
      disableEscClose: Boolean(options.disableEscClose),
    };

    return new Promise((resolve) => {
      setState({ ...config, resolve });
    });
  }, []);

  const closeWithResult = useCallback((result) => {
    setState((current) => {
      if (!current) return null;
      current.resolve(result);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      {state && (
        <ConfirmModal
          open
          title={state.title}
          description={state.description}
          confirmText={state.confirmText}
          cancelText={state.cancelText}
          variant={state.variant}
          closeOnOverlay={!state.disableBackdropClose}
          onConfirm={() => closeWithResult(true)}
          onClose={() => closeWithResult(false)}
        />
      )}
    </ConfirmDialogContext.Provider>
  );
}
