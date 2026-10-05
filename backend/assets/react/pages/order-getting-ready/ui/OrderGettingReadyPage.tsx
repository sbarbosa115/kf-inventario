import {Link, useNavigate, useParams} from 'react-router-dom';
import {getOrder, getPartials, RecordPartial} from '@/features/record-partial';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {ErrorState, Loader, PageCard} from '@/shared/ui';
import './getting-ready.css';

/**
 * Getting ready an order (/admin/orders/:id/getting-ready): the order's products are scanned into a shipment, which
 * is saved as a partial shipment (or sends the order when it completes it). Back to the orders list after a save,
 * as before.
 */
export function OrderGettingReadyPage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {id = ''} = useParams();
  const order = useLoad(() => getOrder(id), [id]);
  const partials = useLoad(() => getPartials(id), [id]);
  const error = order.error ?? partials.error;
  const code = order.data?.code ?? '';

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
    content = (
      <ErrorState
        error={error}
        onRetry={() => {
          order.reload();
          partials.reload();
        }}
      />
    );
  } else if (order.data === undefined || partials.data === undefined) {
    content = <Loader />;
  } else {
    content = (
      <RecordPartial
        order={order.data}
        partials={partials.data}
        onSaved={() =>
          navigate('/admin/orders', {state: {saved: 'partial', code}})
        }
      />
    );
  }

  return (
    <PageCard
      title={
        order.data
          ? t('gettingReady.title', {code})
          : t('gettingReady.titleLoading')
      }
    >
      {content}
    </PageCard>
  );
}
