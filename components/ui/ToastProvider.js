'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function subscribeNoop() {
  return () => {};
}

export function useToast() {
  return useContext(ToastContext);
}

export function useAppToast() {
  const context = useToast() || {};
  const showToast = context.showToast || (() => {});

  const notify = (message, type = 'default') => {
    if (type === 'error') {
      console.info('[UI][ACTION_ERROR_TOAST]', { message });
    } else {
      console.info('[UI][ACTION_SUCCESS_TOAST]', { message, type });
    }
    showToast(message, type);
  };

  return {
    showToast,
    notify,
    success: (message) => notify(message, 'success'),
    error: (message) => notify(message, 'error'),
    warning: (message) => notify(message, 'warning'),
    info: (message) => notify(message, 'info'),
  };
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const portalTarget = useSyncExternalStore(
    subscribeNoop,
    () => (typeof document !== 'undefined' ? document.body : null),
    () => null
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = 'default') => {
      const id = Date.now() + Math.random();

      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        removeToast(id);
      }, 2800);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {portalTarget
        ? createPortal(
            <div className="pointer-events-none fixed bottom-[100px] left-0 right-0 z-[999] flex flex-col items-center gap-2 px-4">
              {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} />
              ))}
            </div>,
            portalTarget
          )
        : null}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast }) {
  const toneMap = {
    default: 'bg-[#241a14] text-white',
    success: 'bg-emerald-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-amber-400 text-[#241a14]',
    info: 'bg-violet-600 text-white',
  };

  return (
    <div
      className={cx(
        'pointer-events-auto w-full max-w-[420px] rounded-[18px] px-4 py-3 text-[14px] font-bold shadow-[0_14px_32px_rgba(0,0,0,0.18)]',
        toneMap[toast.type] || toneMap.default
      )}
    >
      {toast.message}
    </div>
  );
}
