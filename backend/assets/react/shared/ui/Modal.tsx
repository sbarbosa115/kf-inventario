import {useId, useRef, type ReactNode} from 'react';
import {useTranslation} from '@/shared/i18n';
import {useFocusTrap} from './useFocusTrap';

/**
 * A dialog over the page (Bootstrap 4's markup on the tokens, no jQuery): Escape and the close button call onClose,
 * the focus moves into it, stays inside it while it is open, and goes back when it closes.
 */
export function Modal({
  title,
  onClose,
  footer,
  size,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  size?: 'sm' | 'lg' | 'xl';
  children: ReactNode;
}) {
  const {t} = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog, onClose);

  return (
    <>
      <div
        className="modal d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialog}
      >
        <div className={`modal-dialog${size ? ` modal-${size}` : ''}`}>
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5" id={titleId}>
                {title}
              </h2>
              <button
                type="button"
                className="close"
                aria-label={t('common.close')}
                onClick={onClose}
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
