import {Link, useParams} from 'react-router-dom';
import {getUser} from '@/entities/user';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {ErrorState, Loader, PageCard} from '@/shared/ui';
import {UserForm} from './UserForm';

/** Add User (/admin/users/new) and Edit User (/admin/users/:id/edit): one form for both. */
export function UserFormPage() {
  const {t} = useTranslation();
  const {id} = useParams();
  return id === undefined ? (
    <PageCard title={t('users.form.newTitle')}>
      <UserForm />
    </PageCard>
  ) : (
    <EditUser id={id} />
  );
}

function EditUser({id}: {id: string}) {
  const {t} = useTranslation();
  const {data, error, reload} = useLoad(() => getUser(id), [id]);
  const missing = error instanceof ApiError && error.status === 404;

  return (
    <PageCard title={t('users.form.editTitle')}>
      {missing ? (
        <div className="alert alert-warning" role="alert">
          <p>{t('users.notFound')}</p>
          <Link to="/admin/users">{t('users.backToList')}</Link>
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data === undefined ? (
        <Loader />
      ) : (
        <UserForm user={data} />
      )}
    </PageCard>
  );
}
