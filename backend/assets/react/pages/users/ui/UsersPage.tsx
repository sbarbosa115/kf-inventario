import {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {listUsers, RoleBadges, visibleRoles, type User} from '@/entities/user';
import {ApiError} from '@/shared/api';
import {useLoad} from '@/shared/lib';
import {useTranslation} from '@/shared/i18n';
import {
  Button,
  DataTable,
  ClearFilters,
  FilterChips,
  PageHeader,
  StatusBadge,
  Toolbar,
  type Column,
} from '@/shared/ui';

type StatusFilter = 'active' | 'inactive';

/** Users: every account, its roles in plain words, and the way into the form that edits it (ROLE_MANAGE_USERS). */
export function UsersPage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {data, loading, error, reload} = useLoad(listUsers, []);
  const [status, setStatus] = useState<StatusFilter | null>(null);

  const forbidden = error instanceof ApiError && error.status === 403;
  const activeCount = data?.filter((user) => user.enabled).length ?? 0;
  const rows = useMemo(
    () =>
      status === null
        ? data
        : data?.filter((user) => user.enabled === (status === 'active')),
    [data, status],
  );

  const columns = useMemo<Column<User>[]>(
    () => [
      {
        key: 'name',
        header: t('users.columns.name'),
        render: (user) => <strong>{user.name}</strong>,
        sortValue: (user) => user.name.toLowerCase(),
        searchValue: (user) => `${user.name} ${user.username}`,
      },
      {
        key: 'username',
        header: t('users.columns.username'),
        render: (user) => user.username,
        sortValue: (user) => user.username.toLowerCase(),
        mono: true,
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
        searchValue: (user) =>
          visibleRoles(user.roles)
            .map((role) => `${role} ${t(`roles.names.${role}`)}`)
            .join(' '),
      },
      {
        key: 'status',
        header: t('users.columns.status'),
        render: (user) => (
          <StatusBadge tone={user.enabled ? 'accent' : 'neutral'}>
            {user.enabled ? t('users.active') : t('users.inactive')}
          </StatusBadge>
        ),
        sortValue: (user) => (user.enabled ? 0 : 1),
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader
        title={t('users.title')}
        subtitle={
          data === undefined
            ? undefined
            : t('users.count', {count: data.length})
        }
        primary={
          <Button to="/admin/users/new" variant="primary" icon="fa-plus">
            {t('users.create')}
          </Button>
        }
      />
      {forbidden ? (
        <div className="alert alert-warning" role="alert">
          {t('errors.forbidden')}
        </div>
      ) : (
        <>
          {data !== undefined && data.length > 0 && (
            <Toolbar label={t('users.filters.label')}>
              <FilterChips
                label={t('users.filters.label')}
                value={status}
                onChange={(key) => setStatus(key as StatusFilter | null)}
                allCount={data.length}
                options={[
                  {
                    key: 'active',
                    label: t('users.filters.active'),
                    count: activeCount,
                  },
                  {
                    key: 'inactive',
                    label: t('users.filters.inactive'),
                    count: data.length - activeCount,
                  },
                ]}
              />
              {status !== null && (
                <ClearFilters onClick={() => setStatus(null)} />
              )}
            </Toolbar>
          )}
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(user) => user.id}
            rowLabel={(user) => user.name}
            loading={loading && data === undefined}
            error={error}
            onRetry={reload}
            emptyMessage={
              status === null ? t('users.empty') : t('common.filteredEmpty')
            }
            onRowClick={(user) => navigate(`/admin/users/${user.id}/edit`)}
            rowActions={(user) => [
              {
                label: t('users.edit'),
                icon: 'fa-edit',
                href: `/admin/users/${user.id}/edit`,
              },
            ]}
          />
        </>
      )}
    </>
  );
}
