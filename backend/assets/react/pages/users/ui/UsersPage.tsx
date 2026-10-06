import {useMemo} from 'react';
import {useNavigate} from 'react-router-dom';
import {listUsers, RoleBadges, type User} from '@/entities/user';
import {ApiError} from '@/shared/api';
import {useListQuery, useLoad} from '@/shared/lib';
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

/**
 * Users: every account, its roles in plain words, and the way into the form that edits it (ROLE_MANAGE_USERS).
 * Searched, filtered and paged on the server (the query in the address).
 */
export function UsersPage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const list = useListQuery({sort: 'name'});
  const key = JSON.stringify(list.query);
  const {data, loading, error, reload} = useLoad(
    () => listUsers({...list.query, facets: ['enabled']}),
    [key],
  );
  const enabledFilter = list.query.filters?.enabled;
  const status: StatusFilter | null = Array.isArray(enabledFilter)
    ? enabledFilter[0] === 'yes'
      ? 'active'
      : enabledFilter[0] === 'no'
        ? 'inactive'
        : null
    : null;

  const forbidden = error instanceof ApiError && error.status === 403;
  // The chips count what the search keeps (the enabled facet ignores the chip itself).
  const facet = data?.facets?.enabled ?? [];
  const activeCount = facet.find((f) => f.value === 'yes')?.count ?? 0;
  const allCount = facet.reduce((sum, f) => sum + f.count, 0);

  const columns = useMemo<Column<User>[]>(
    () => [
      {
        key: 'name',
        header: t('users.columns.name'),
        render: (user) => <strong>{user.name}</strong>,
        sortField: 'name',
      },
      {
        key: 'username',
        header: t('users.columns.username'),
        render: (user) => user.username,
        sortField: 'username',
        mono: true,
      },
      {
        key: 'email',
        header: t('users.columns.email'),
        render: (user) => user.email,
        sortField: 'email',
      },
      {
        key: 'roles',
        header: t('users.columns.roles'),
        render: (user) => <RoleBadges roles={user.roles} />,
      },
      {
        key: 'status',
        header: t('users.columns.status'),
        render: (user) => (
          <StatusBadge tone={user.enabled ? 'accent' : 'neutral'}>
            {user.enabled ? t('users.active') : t('users.inactive')}
          </StatusBadge>
        ),
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader
        title={t('users.title')}
        subtitle={
          data === undefined ? undefined : t('users.count', {count: allCount})
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
          {data !== undefined && (allCount > 0 || status !== null) && (
            <Toolbar label={t('users.filters.label')}>
              <FilterChips
                label={t('users.filters.label')}
                value={status}
                onChange={(key) =>
                  list.setFilter(
                    'enabled',
                    key === null
                      ? undefined
                      : [key === 'active' ? 'yes' : 'no'],
                  )
                }
                allCount={allCount}
                options={[
                  {
                    key: 'active',
                    label: t('users.filters.active'),
                    count: activeCount,
                  },
                  {
                    key: 'inactive',
                    label: t('users.filters.inactive'),
                    count: allCount - activeCount,
                  },
                ]}
              />
              {status !== null && (
                <ClearFilters
                  onClick={() => list.setFilter('enabled', undefined)}
                />
              )}
            </Toolbar>
          )}
          <DataTable
            columns={columns}
            rows={data?.items}
            query={list.query}
            onQueryChange={list.update}
            total={data?.total}
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
