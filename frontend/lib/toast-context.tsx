'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Cancel01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import Icon from '@/components/Icon';

type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
  success: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4500;

const variantStyles: Record<
  ToastVariant,
  { container: string; icon: string; iconColor: string }
> = {
  success: {
    container: 'border-green-200 bg-white',
    icon: 'bg-green-50 text-green-600',
    iconColor: 'text-green-600',
  },
  error: {
    container: 'border-red-200 bg-white',
    icon: 'bg-red-50 text-red-600',
    iconColor: 'text-red-600',
  },
  info: {
    container: 'border-gray-200 bg-white',
    icon: 'bg-gray-100 text-gray-600',
    iconColor: 'text-gray-600',
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const styles = variantStyles[toast.variant];

  useEffect(() => {
    const enterTimer = setTimeout(() => setVisible(true), 10);
    const exitTimer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, [toast.id, onDismiss]);

  const toastIcon = CheckmarkCircle02Icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-300 ease-out ${styles.container} ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${styles.icon}`}
      >
        <Icon icon={toastIcon} size={20} className={styles.iconColor} />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
        {toast.description ? (
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{toast.description}</p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="btn-icon !h-8 !w-8 shrink-0 !border-transparent !shadow-none"
        aria-label="Dismiss notification"
      >
        <Icon icon={Cancel01Icon} size={14} />
      </button>
    </div>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-full max-w-sm flex-col gap-3"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(({ title, description, variant = 'info' }: ToastInput) => {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    setToasts((prev) => [...prev, { id, title, description, variant }]);
  }, []);

  const success = useCallback(
    (title: string, description?: string) => {
      showToast({ title, description, variant: 'success' });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, success }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
