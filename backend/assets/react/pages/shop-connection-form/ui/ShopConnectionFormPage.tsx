import {Link, useLocation, useParams} from 'react-router-dom';
import {getShop} from '@/entities/shop-connection';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {ErrorState, PageHeader, Skeleton} from '@/shared/ui';
import {FailedUpdates} from './FailedUpdates';
import {ShopConnectionForm} from './ShopConnectionForm';
import './shop-connection-form.css';

/**
 * A shop connection (ROLE_ADMIN): Add connection (/admin/settings/shops/new) and Edit connection
 * (/admin/settings/shops/:id), one form for both; the edit page also lists the updates that did not reach the shop.
 */
export function ShopConnectionFormPage() {
  const {t} = useTranslation();
  const {id} = useParams();
  return id === undefined ? (
    <>
      <PageHeader
        title={t('shops.form.newTitle')}
        back="/admin/settings/shops"
      />
      <ShopConnectionForm />
    </>
  ) : (
    <EditConnection id={Number(id)} />
  );
}

function EditConnection({id}: {id: number}) {
  const {t} = useTranslation();
  const location = useLocation();
  const {data, error, reload} = useLoad(() => getShop(id), [id]);
  const missing = error instanceof ApiError && error.status === 404;
  // The secret the create answered, handed over by the form that created the connection (shown once, at once).
  const secret =
    (location.state as {secret?: string | null} | null)?.secret ?? null;

  return (
    <>
      <PageHeader
        title={t('shops.form.editTitle')}
        subtitle={data?.name}
        back="/admin/settings/shops"
      />
      {missing ? (
        <div className="alert alert-warning" role="alert">
          <p>{t('shops.errors.shop_not_found')}</p>
          <Link to="/admin/settings/shops">{t('shops.form.back')}</Link>
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data === undefined ? (
        <Skeleton variant="form" />
      ) : (
        <>
          <ShopConnectionForm
            key={data.id}
            shop={data}
            initialSecret={secret}
          />
          {data.health.failed_pushes > 0 && <FailedUpdates shopId={data.id} />}
        </>
      )}
    </>
  );
}
