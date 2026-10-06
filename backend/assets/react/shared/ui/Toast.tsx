import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from '@/shared/i18n';

interface ToastAction {
  label: string;
  href: string;
}

interface ToastItem {
  id: number;
  kind: 'success' | 'error';
  text: string;
  action?: ToastAction;
}

export interface ToastApi {
  /** Gone after 5 s; an action is a link (no Undo: confirming first is the safeguard). */
  success: (text: string, options?: {action?: ToastAction}) => void;
  /** Stays until dismissed. */
  error: (text: string) => void;
}

export const TOAST_SUCCESS_MS = 5000;

const ToastContext = createContext<ToastApi | null>(null);

/** The app's notifications: bottom-right (bottom-centre above the tab bar on phones), announced to screen readers. */
export function ToastProvider({children}: {children: ReactNode}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const dismiss = useCallback(
    (id: number) => setToasts((now) => now.filter((toast) => toast.id !== id)),
    [],
  );
  const api = useMemo<ToastApi>(
    () => ({
      success: (text, options) =>
        setToasts((now) => [
          ...now,
          {id: next.current++, kind: 'success', text, action: options?.action},
        ]),
      error: (text) =>
        setToasts((now) => [...now, {id: next.current++, kind: 'error', text}]),
    }),
    [],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="kf-toasts">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const {t} = useTranslation();
  useEffect(() => {
    if (toast.kind !== 'success') return;
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_SUCCESS_MS);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      className={`kf-toast kf-toast--${toast.kind}`}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
    >
      <i
        className={`fas ${toast.kind === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'} kf-toast__icon`}
        aria-hidden="true"
      />
      <span className="kf-toast__text">{toast.text}</span>
      {toast.action && (
        <Link
          className="kf-toast__action"
          to={toast.action.href}
          onClick={() => onDismiss(toast.id)}
        >
          {toast.action.label}
        </Link>
      )}
      <button
        type="button"
        className="kf-toast__close"
        aria-label={t('common.dismiss')}
        title={t('common.dismiss')}
        onClick={() => onDismiss(toast.id)}
      >
        <i className="fas fa-times" aria-hidden="true" />
      </button>
    </div>
  );
}

const SILENT: ToastApi = {success: () => undefined, error: () => undefined};

/** The notifications; outside a ToastProvider (a component test) they go nowhere. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? SILENT;
}
