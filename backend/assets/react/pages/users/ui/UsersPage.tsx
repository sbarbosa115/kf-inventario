import {useMemo} from 'react';
import {useNavigate} from 'react-router-dom';
import {listUsers, RoleBadges, type User} from '@/entities/user';
import {ApiError} from '@/shared/api';
import {ASSIGNABLE_ROLES} from '@/shared/config';
import {useListQuery, useLoad} from '@/shared/lib';
import {useTranslation} from '@/shared/i18n';
import {
  Button,
  DataTable,
  FilterChips,
  PageHeader,
  StatusBadge,
  Toolbar,
  type Column,
  type TableQuery,
} from '@/shared/ui';

type StatusFilter = 'active' | 'inactive';

/** The list columns whose values are counted (the status chips, the Roles and Status filters). */
const FACETS = ['enabled', 'roles'];

/**
 * Users: every account, its roles in plain words, and the way into the form that edits it (ROLE_MANAGE_USERS).
 * Searched, filtered under the headers (name, username and email text, the roles and the status from lists with
 * their counts; a sheet on a phone), sorted and paged on the server (the query in the address).
 */
export function UsersPage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const list = useListQuery({sort: 'name'});
  const key = JSON.stringify(list.query);
  const {data, loading, error, reload} = useLoad(
    () => listUsers({...list.query, facets: FACETS}),
    [key],
  );
  // The phone's sheet: how many users a draft keeps, one row asked.
  const countFor = (query: TableQuery) =>
    listUsers({...query, page: 1, perPage: 1}).then((page) => page.total);
  const enabledFilter = list.query.filters?.enabled;
  // A chip is pressed when its status is the one ticked; with both ticked, none is (not even All).
  const status: StatusFilter | 'both' | null = !Array.isArray(enabledFilter)
    ? null
    : enabledFilter.length > 1
      ? 'both'
      : enabledFilter[0] === 'yes'
        ? 'active'
        : enabledFilter[0] === 'no'
          ? 'inactive'
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
        filter: {type: 'text', field: 'name'},
      },
      {
        key: 'username',
        header: t('users.columns.username'),
        render: (user) => user.username,
        sortField: 'username',
        mono: true,
        filter: {type: 'text', field: 'username'},
      },
      {
        key: 'email',
        header: t('users.columns.email'),
        render: (user) => user.email,
        sortField: 'email',
        filter: {type: 'text', field: 'email'},
      },
      {
        key: 'roles',
        header: t('users.columns.roles'),
        render: (user) => <RoleBadges roles={user.roles} />,
        filter: {
          type: 'enum',
          field: 'roles',
          options: ASSIGNABLE_ROLES.map((role) => ({
            value: role,
            label: t(`roles.names.${role}`),
          })),
        },
      },
      {
        key: 'status',
        header: t('users.columns.status'),
        render: (user) => (
          <StatusBadge tone={user.enabled ? 'accent' : 'neutral'}>
            {user.enabled ? t('users.active') : t('users.inactive')}
          </StatusBadge>
        ),
        filter: {
          type: 'enum',
          field: 'enabled',
          options: [
            {value: 'yes', label: t('users.active')},
            {value: 'no', label: t('users.inactive')},
          ],
        },
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
            </Toolbar>
          )}
          <DataTable
            columns={columns}
            rows={data?.items}
            query={list.query}
            onQueryChange={list.update}
            total={data?.total}
            facets={data?.facets}
            countFor={countFor}
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
