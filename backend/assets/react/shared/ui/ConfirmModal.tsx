import type {ReactNode} from 'react';
import {useTranslation} from '@/shared/i18n';
import {Button} from './Button';
import {Modal} from './Modal';

/**
 * "Are you sure?" before an action that changes or removes something: the title asks, the children say the
 * consequence. Escape cancels; Cancel is secondary (never red); the confirm button is danger only when it destroys.
 */
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
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={busy}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
