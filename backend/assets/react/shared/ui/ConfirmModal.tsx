import type {ReactNode} from 'react';
import {useTranslation} from '@/shared/i18n';
import {Modal} from './Modal';

/** "Are you sure?" before an action that changes or removes something. */
export function ConfirmModal({
  title,
  children,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const {t} = useTranslation();
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel ?? t('common.confirm')}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
