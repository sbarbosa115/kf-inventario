import {useRef, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from '@/shared/i18n';
import {useFocusTrap} from './useFocusTrap';

/**
 * A panel from the right for a detail or a quick edit (480 / 720 px, the whole width on phones): the page stays in
 * view behind it and does not scroll, the focus stays inside, Escape and the × close it.
 */
export function SlideOver({
  title,
  onClose,
  width = 'md',
  header,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  width?: 'md' | 'lg';
  /** Extra header content under the title (a status, facts). */
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const {t} = useTranslation();
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, onClose);

  return createPortal(
    <div className="kf-slideover">
      <div
        className="kf-slideover__backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className={`kf-slideover__panel kf-slideover__panel--${width}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
      >
        <header className="kf-slideover__header">
          <div className="kf-slideover__heading">
            <h2 className="kf-slideover__title">{title}</h2>
            {header}
          </div>
          <button
            type="button"
            className="kf-btn kf-btn--ghost kf-btn--md kf-btn--icon"
            aria-label={t('common.close')}
            title={t('common.close')}
            onClick={onClose}
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </header>
        <div className="kf-slideover__body">{children}</div>
        {footer && <footer className="kf-slideover__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
