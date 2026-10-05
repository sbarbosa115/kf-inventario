import {failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';

/** A load that failed: what happened, in the person's words, and a way to try again. */
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const {t} = useTranslation();
  return (
    <div className="alert alert-danger d-flex align-items-center" role="alert">
      <span className="mr-auto">{failureMessage(error, t)}</span>
      {onRetry && (
        <button
          type="button"
          className="btn btn-sm btn-outline-danger"
          onClick={onRetry}
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
