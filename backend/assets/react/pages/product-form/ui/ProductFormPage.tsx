import {Link, useParams} from 'react-router-dom';
import {getProduct} from '@/entities/product';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {ErrorState, PageHeader, Skeleton} from '@/shared/ui';
import {ProductForm} from './ProductForm';

/** Create product (/admin/products/new) and Edit product (/admin/products/:uuid/edit): one form for both. */
export function ProductFormPage() {
  const {t} = useTranslation();
  const {uuid} = useParams();
  return uuid === undefined ? (
    <>
      <PageHeader title={t('products.form.newTitle')} back="/admin/products" />
      <ProductForm />
    </>
  ) : (
    <EditProduct uuid={uuid} />
  );
}

function EditProduct({uuid}: {uuid: string}) {
  const {t} = useTranslation();
  const {data, error, reload} = useLoad(() => getProduct(uuid), [uuid]);
  const missing = error instanceof ApiError && error.status === 404;
  const forbidden = error instanceof ApiError && error.status === 403;

  return (
    <>
      <PageHeader title={t('products.form.editTitle')} back="/admin/products" />
      {missing ? (
        <div className="alert alert-warning" role="alert">
          <p>{t('products.notFound')}</p>
          <Link to="/admin/products">{t('products.backToList')}</Link>
        </div>
      ) : forbidden ? (
        <div className="alert alert-warning" role="alert">
          {t('errors.forbidden')}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data === undefined ? (
        <Skeleton variant="form" />
      ) : (
        <ProductForm key={data.uuid} product={data} />
      )}
    </>
  );
}
