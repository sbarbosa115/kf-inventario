import {Link, useNavigate, useParams} from 'react-router-dom';
import {ORDER_STATUS_SENT, OrderStatusBadge} from '@/entities/order';
import {getPartials, RecordPartial} from '@/features/record-partial';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {ErrorState, PageHeader, Skeleton, useToast} from '@/shared/ui';

/**
 * Getting ready an order (/admin/orders/:id/getting-ready): the order's products are scanned into a shipment, which
 * is saved as a partial shipment (or sends the order when it completes it). Back to the orders list after a save,
 * with a toast. Everything comes from the partials endpoint, which needs only ROLE_USER like the legacy page.
 */
export function OrderGettingReadyPage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const {id = ''} = useParams();
  const partials = useLoad(() => getPartials(id), [id]);
  const error = partials.error;
  const code = partials.data?.code ?? '';

  let content;
  if (error instanceof ApiError && error.status === 404) {
    content = (
      <div className="alert alert-warning" role="alert">
        <p>{t('gettingReady.notFound')}</p>
        <Link to="/admin/orders">{t('gettingReady.backToList')}</Link>
      </div>
    );
  } else if (error instanceof ApiError && error.status === 403) {
    content = (
      <div className="alert alert-danger" role="alert">
        {t('errors.forbidden')}
      </div>
    );
  } else if (error) {
    content = <ErrorState error={error} onRetry={partials.reload} />;
  } else if (partials.data === undefined) {
    content = <Skeleton variant="card" lines={4} />;
  } else {
    content = (
      <RecordPartial
        partials={partials.data}
        onSaved={(answer) => {
          toast.success(
            t(
              answer.status === ORDER_STATUS_SENT
                ? 'gettingReady.savedSent'
                : 'gettingReady.savedPartial',
              {code},
            ),
          );
          navigate('/admin/orders');
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={
          partials.data
            ? t('gettingReady.title', {code})
            : t('gettingReady.titleLoading')
        }
        subtitle={
          partials.data ? (
            <OrderStatusBadge status={partials.data.status} />
          ) : undefined
        }
        back="/admin/orders"
      />
      {content}
    </>
  );
}
