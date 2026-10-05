import {useMemo} from 'react';
import {Link, useLocation} from 'react-router-dom';
import {listUsers, RoleBadges, type User} from '@/entities/user';
import {ApiError} from '@/shared/api';
import {useLoad} from '@/shared/lib';
import {useTranslation} from '@/shared/i18n';
import {DataTable, PageCard, type Column} from '@/shared/ui';

/** View Users: every account, its roles, and the way into the form that edits it (ROLE_MANAGE_USERS). */
export function UsersPage() {
  const {t} = useTranslation();
  const saved = (useLocation().state as {saved?: 'created' | 'updated'} | null)
    ?.saved;
  const {data, loading, error, reload} = useLoad(listUsers, []);

  const columns = useMemo<Column<User>[]>(
    () => [
      {
        key: 'id',
        header: t('users.columns.id'),
        render: (user) => user.id,
        sortValue: (user) => user.id,
        searchValue: (user) => user.id,
      },
      {
        key: 'name',
        header: t('users.columns.name'),
        render: (user) => user.name,
        sortValue: (user) => user.name.toLowerCase(),
        searchValue: (user) => `${user.name} ${user.username}`,
      },
      {
        key: 'email',
        header: t('users.columns.email'),
        render: (user) => user.email,
        sortValue: (user) => user.email ?? '',
        searchValue: (user) => user.email ?? null,
      },
      {
        key: 'roles',
        header: t('users.columns.roles'),
        render: (user) => <RoleBadges roles={user.roles} />,
        searchValue: (user) => user.roles.join(' '),
      },
      {
        key: 'options',
        header: t('users.columns.options'),
        render: (user) => (
          <Link
            to={`/admin/users/${user.id}/edit`}
            className="btn btn-sm btn-success"
          >
            <i className="fas fa-edit" aria-hidden="true" /> {t('users.edit')}
          </Link>
        ),
      },
    ],
    [t],
  );

  return (
    <PageCard
      title={t('users.title')}
      actions={
        <Link to="/admin/users/new" className="btn btn-sm btn-success">
          <i className="fas fa-people-carry" aria-hidden="true" />{' '}
          {t('users.create')}
        </Link>
      }
    >
      {saved && (
        <div className="alert alert-success" role="status">
          {t(`users.${saved}`)}
        </div>
      )}
      {error instanceof ApiError && error.status === 403 ? (
        <div className="alert alert-warning" role="alert">
          {t('errors.forbidden')}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={data}
          rowKey={(user) => user.id}
          loading={loading && data === undefined}
          error={error}
          onRetry={reload}
          emptyMessage={t('users.empty')}
        />
      )}
    </PageCard>
  );
}
