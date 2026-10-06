import {Link, useParams} from 'react-router-dom';
import {getUser} from '@/entities/user';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {ErrorState, PageHeader, Skeleton} from '@/shared/ui';
import {UserForm} from './UserForm';

/** New user (/admin/users/new) and Edit user (/admin/users/:id/edit): one form for both. */
export function UserFormPage() {
  const {t} = useTranslation();
  const {id} = useParams();
  return id === undefined ? (
    <>
      <PageHeader title={t('users.form.newTitle')} back="/admin/users" />
      <UserForm />
    </>
  ) : (
    <EditUser id={id} />
  );
}

function EditUser({id}: {id: string}) {
  const {t} = useTranslation();
  const {data, error, reload} = useLoad(() => getUser(id), [id]);
  const missing = error instanceof ApiError && error.status === 404;

  return (
    <>
      <PageHeader
        title={t('users.form.editTitle')}
        subtitle={data?.name}
        back="/admin/users"
      />
      {missing ? (
        <div className="alert alert-warning" role="alert">
          <p>{t('users.notFound')}</p>
          <Link to="/admin/users">{t('users.backToList')}</Link>
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data === undefined ? (
        <Skeleton variant="form" />
      ) : (
        <UserForm user={data} />
      )}
    </>
  );
}
