import {useState, type ReactNode} from 'react';
import {useTranslation} from '@/shared/i18n';
import type {DateRangeValue, FilterValue, NumberRangeValue} from '@/shared/api';
import {
  ActionBar,
  ActiveFilters,
  Button,
  CameraScanner,
  ConfirmModal,
  DataTable,
  DateRangeFilter,
  EmptyState,
  FilterChips,
  FilterDropdown,
  FilterSheet,
  FiltersButton,
  FormLayout,
  FormSection,
  KpiStrip,
  LanguageSwitch,
  Money,
  Num,
  PageHeader,
  Pager,
  PasswordField,
  RangeFilter,
  ScanInput,
  SearchBox,
  Skeleton,
  SlideOver,
  StatusBadge,
  TextFilterInput,
  ThemeSwitch,
  Toolbar,
  useToast,
  WarehouseSwitch,
  type Column,
  type FilterColumn,
  type TableQuery,
} from '@/shared/ui';
import {samplePage, type SampleOrder} from '../lib/sampleOrders';
import './kit-page.css';

// The dev-only specimen page (routes.tsx mounts it outside production): every kit component in its states, in the
// current theme and language, and the place to try the camera on a phone. Its sample texts are English on purpose:
// it is never shipped and never translated.

interface Sample {
  id: number;
  code: string;
  title: string;
  quantity: number;
  price: string;
}

const SAMPLES: Sample[] = [
  {
    id: 1,
    code: 'KF-01',
    title: 'Front lip spoiler',
    quantity: 100,
    price: '100.00',
  },
  {id: 2, code: 'KF-02', title: 'Rear diffuser', quantity: 0, price: '150.00'},
  {
    id: 3,
    code: 'KF-0003-LONG-SKU',
    title: 'Side skirts, pair',
    quantity: 12,
    price: '-20.50',
  },
];

const WAREHOUSES = [
  {id: 1, name: 'Colombia'},
  {id: 2, name: 'Usa'},
  {id: 3, name: 'España'},
];

const TOKENS = [
  'bg',
  'surface',
  'surface-sunken',
  'border-strong',
  'text',
  'text-muted',
  'accent',
  'accent-soft',
  'danger',
  'warning',
  'info',
  'sidebar',
];

const STATUS_OPTIONS = [
  {value: '1', label: 'Created'},
  {value: '2', label: 'Processed'},
  {value: '3', label: 'Completed'},
  {value: '4', label: 'Partial'},
  {value: '5', label: 'Sent'},
  {value: '6', label: 'Delivered'},
];

const ORDER_COLUMNS: Column<SampleOrder>[] = [
  {
    key: 'code',
    header: 'Order',
    render: (r) => r.code,
    mono: true,
    sortField: 'code',
    filter: {type: 'text', field: 'code'},
  },
  {
    key: 'customer',
    header: 'Customer',
    render: (r) => r.customer,
    sortField: 'customer',
    filter: {type: 'text', field: 'customer'},
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => STATUS_OPTIONS.find((o) => o.value === r.status)?.label,
    filter: {type: 'enum', field: 'status', options: STATUS_OPTIONS},
  },
  {
    key: 'created',
    header: 'Created',
    render: (r) => r.created,
    sortField: 'created',
    filter: {type: 'date', field: 'created'},
  },
  {
    key: 'total',
    header: 'Total',
    render: (r) => <Money amount={r.total} />,
    numeric: true,
    sortField: 'total',
    filter: {type: 'money', field: 'total'},
  },
];

const FILTER_COLUMNS: FilterColumn[] = ORDER_COLUMNS.flatMap((c) =>
  c.filter ? [{label: c.header, filter: c.filter}] : [],
);

/** Every filter control on its own, then a server-mode table that uses them (DS-15, DS-16). */
function FilterKit() {
  const [text, setText] = useState('');
  const [statuses, setStatuses] = useState<string[]>(['1']);
  const [dates, setDates] = useState<DateRangeValue>({});
  const [money, setMoney] = useState<NumberRangeValue>({
    min: '100',
    max: '500',
  });
  const [quantity, setQuantity] = useState<NumberRangeValue>({});
  const [sheet, setSheet] = useState(false);
  const [page, setPage] = useState(3);
  const [query, setQuery] = useState<TableQuery>({
    page: 1,
    perPage: 10,
    sort: '-created',
  });
  const answer = samplePage(query);
  const filters: Record<string, FilterValue> = {
    code: text,
    status: statuses,
    created: dates,
    total: money,
  };

  return (
    <>
      <div className="kit-page__filters">
        <TextFilterInput label="Order" value={text} onChange={setText} />
        <FilterDropdown
          label="Status"
          options={STATUS_OPTIONS}
          counts={{'1': 12, '2': 3, '3': 0, '4': 7, '5': 21, '6': 40}}
          value={statuses}
          onChange={setStatuses}
        />
        <DateRangeFilter label="Created" value={dates} onChange={setDates} />
        <RangeFilter
          label="Total"
          kind="money"
          value={money}
          onChange={setMoney}
        />
        <RangeFilter
          label="Quantity"
          kind="number"
          value={quantity}
          onChange={setQuantity}
        />
        <FiltersButton count={4} onClick={() => setSheet(true)} />
      </div>
      <ActiveFilters
        columns={FILTER_COLUMNS}
        filters={filters}
        onRemove={(field) => {
          if (field === 'code') setText('');
          if (field === 'status') setStatuses([]);
          if (field === 'created') setDates({});
          if (field === 'total') setMoney({});
        }}
        onClear={() => {
          setText('');
          setStatuses([]);
          setDates({});
          setMoney({});
        }}
      />
      <Pager
        page={page}
        perPage={25}
        total={1240}
        onPage={setPage}
        onPerPage={() => undefined}
      />
      {sheet && (
        <FilterSheet
          columns={FILTER_COLUMNS}
          filters={filters}
          sort="-created"
          sortOptions={[
            {value: '-created', label: 'Created, descending'},
            {value: 'code', label: 'Order, ascending'},
          ]}
          count={async (draft) =>
            samplePage({page: 1, perPage: 1, filters: draft.filters}).total
          }
          onApply={(draft) => {
            setSheet(false);
            setText(
              typeof draft.filters.code === 'string' ? draft.filters.code : '',
            );
            setStatuses(
              Array.isArray(draft.filters.status) ? draft.filters.status : [],
            );
            setDates((draft.filters.created ?? {}) as DateRangeValue);
            setMoney((draft.filters.total ?? {}) as NumberRangeValue);
          }}
          onClose={() => setSheet(false)}
        />
      )}
      <h3 className="h6 mt-4">A table filtered on the server</h3>
      <DataTable
        columns={ORDER_COLUMNS}
        rows={answer.items}
        rowKey={(r) => r.id}
        rowLabel={(r) => r.code}
        query={query}
        onQueryChange={setQuery}
        total={answer.total}
        facets={answer.facets}
        countFor={async (draft) => samplePage({...draft, perPage: 1}).total}
        perPageOptions={[10, 25, 50]}
        cardTitle={(r) => `${r.code} · ${r.customer}`}
        cardFacts={['status', 'created', 'total']}
      />
    </>
  );
}

function Section({title, children}: {title: string; children: ReactNode}) {
  return (
    <section className="kit-page__section" aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function KitPage() {
  const {t} = useTranslation();
  const toast = useToast();
  const [warehouse, setWarehouse] = useState<number | null>(1);
  const [chip, setChip] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [password, setPassword] = useState('');
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [slideOver, setSlideOver] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [scans, setScans] = useState<string[]>([]);
  const scan = (code: string) => setScans((now) => [code, ...now].slice(0, 8));

  const columns: Column<Sample>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (r) => r.code,
      mono: true,
      sortValue: (r) => r.code,
      searchValue: (r) => r.code,
    },
    {
      key: 'title',
      header: 'Title',
      render: (r) => r.title,
      searchValue: (r) => r.title,
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (r) => <Num value={r.quantity} />,
      numeric: true,
      sortValue: (r) => r.quantity,
    },
    {
      key: 'price',
      header: 'Price',
      render: (r) => <Money amount={r.price} />,
      numeric: true,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Kit"
        subtitle="Every component of @/shared/ui, in the current theme and language"
        primary={
          <Button variant="primary" icon="fa-plus">
            Primary action
          </Button>
        }
        secondary={
          <>
            <Button icon="fa-download">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
          </>
        }
      />

      <Section title="Theme and language">
        <div className="kit-page__row">
          <ThemeSwitch className="kf-btn kf-btn--secondary kf-btn--md kf-btn--icon" />
          <LanguageSwitch />
        </div>
        <div className="kit-page__swatches">
          {TOKENS.map((token) => (
            <div
              key={token}
              className="kit-page__swatch"
              style={{
                background: `var(--kf-${token})`,
                color: [
                  'accent',
                  'danger',
                  'warning',
                  'info',
                  'sidebar',
                  'text',
                  'text-muted',
                  'border-strong',
                ].includes(token)
                  ? 'var(--kf-bg)'
                  : 'var(--kf-text)',
              }}
            >
              --kf-{token}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="kit-page__row">
          <Button variant="primary">Save</Button>
          <Button>Cancel</Button>
          <Button variant="ghost">Close</Button>
          <Button variant="danger" icon="fa-trash">
            Delete
          </Button>
          <Button variant="primary" loading>
            Saving
          </Button>
          <Button disabled>Disabled</Button>
          <Button icon="fa-sync" aria-label="Sync shop orders" />
        </div>
        <div className="kit-page__row">
          <Button variant="primary" size="lg">
            Add to Colombia
          </Button>
          <Button variant="danger" size="lg">
            Remove from Colombia
          </Button>
          <Button size="sm">Small</Button>
        </div>
      </Section>

      <Section title="Status badges">
        <div className="kit-page__row">
          <StatusBadge>Created</StatusBadge>
          <StatusBadge tone="info">Processed</StatusBadge>
          <StatusBadge tone="accent">Completed</StatusBadge>
          <StatusBadge tone="warning">Partial</StatusBadge>
          <StatusBadge tone="info" icon="fa-truck">
            Sent
          </StatusBadge>
          <StatusBadge tone="accent" filled icon="fa-check">
            Delivered
          </StatusBadge>
          <StatusBadge tone="danger">Not a product</StatusBadge>
        </div>
      </Section>

      <Section title="Toolbar, figures and table">
        <Toolbar label="Filters">
          <WarehouseSwitch
            warehouses={WAREHOUSES}
            value={warehouse}
            onChange={setWarehouse}
          />
          <FilterChips
            label="Stock"
            allCount={3}
            options={[
              {key: 'in', label: 'In stock', count: 2},
              {key: 'out', label: 'Out of stock', count: 1},
            ]}
            value={chip}
            onChange={setChip}
          />
          <SearchBox value={query} onChange={setQuery} />
        </Toolbar>
        <KpiStrip
          items={[
            {label: 'Products', value: <Num value={3} />},
            {label: 'Units', value: <Num value={112} />},
            {label: 'Stock value', value: <Money amount={11754} />},
            {label: 'Out of stock', value: <Num value={1} />, tone: 'warning'},
          ]}
        />
        <DataTable
          columns={columns}
          rows={SAMPLES}
          rowKey={(r) => r.id}
          rowLabel={(r) => r.code}
          selected={selected}
          onSelectedChange={setSelected}
          selectionBar={() => (
            <>
              <Button size="sm" icon="fa-people-carry">
                Move to warehouse
              </Button>
              <Button size="sm" icon="fa-file-excel">
                Download stock sheet
              </Button>
            </>
          )}
          rowActions={(r) => [
            {
              label: 'Edit',
              icon: 'fa-pen',
              onSelect: () => toast.success(`Edit ${r.code}`),
            },
            {
              label: 'Download stock sheet',
              icon: 'fa-file-excel',
              onSelect: () => undefined,
            },
            {
              label: 'Delete',
              icon: 'fa-trash',
              danger: true,
              onSelect: () => setConfirm(true),
            },
          ]}
          cardTitle={(r) => r.title}
          cardFacts={['code', 'quantity', 'price']}
        />
        <h3 className="h6 mt-4">Loading</h3>
        <DataTable
          columns={columns}
          rows={undefined}
          rowKey={(r) => r.id}
          skeletonRows={3}
        />
        <h3 className="h6 mt-4">Empty</h3>
        <EmptyState
          icon="fa-box-open"
          title="Nothing waiting"
          message="Products moved here from another warehouse show up here."
          action={<Button size="sm">Show all</Button>}
        />
        <h3 className="h6 mt-4">Skeletons</h3>
        <Skeleton variant="kpi" lines={3} />
        <Skeleton variant="text" lines={3} />
      </Section>

      <Section title="Table filters">
        <FilterKit />
      </Section>

      <Section title="Dialogs and notifications">
        <div className="kit-page__row">
          <Button onClick={() => setSlideOver(true)}>Open a slide-over</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Delete something
          </Button>
          <Button
            onClick={() =>
              toast.success('Product saved', {
                action: {label: 'Scan stock', href: '/admin/products/barcode'},
              })
            }
          >
            Show a success toast
          </Button>
          <Button
            onClick={() => toast.error('The shops could not be reached.')}
          >
            Show an error toast
          </Button>
        </div>
      </Section>

      <Section title="Form">
        <FormLayout
          narrow
          onSubmit={(event) => event.preventDefault()}
          label="Sample form"
        >
          <FormSection
            title="Product"
            description="The code and the title are required."
          >
            <div className="form-group">
              <label htmlFor="kit-code">Code</label>
              <input
                id="kit-code"
                className="form-control kf-mono"
                defaultValue="KF-01"
              />
            </div>
            <div className="form-group">
              <label htmlFor="kit-price">Price</label>
              <input
                id="kit-price"
                className="form-control is-invalid"
                inputMode="decimal"
                aria-describedby="kit-price-error"
              />
              <div className="invalid-feedback" id="kit-price-error">
                This value should be a valid number.
              </div>
            </div>
            <PasswordField
              label={t('auth.password')}
              value={password}
              onChange={setPassword}
            />
          </FormSection>
          <ActionBar
            status="1 thing missing: price"
            secondary={<Button variant="ghost">Cancel</Button>}
            primary={
              <Button variant="primary" type="submit">
                Save
              </Button>
            }
          />
        </FormLayout>
      </Section>

      <Section title="Scanning">
        <CameraScanner onScan={scan} />
        <div className="mt-3">
          <ScanInput onScan={scan} size="lg" />
        </div>
        <ol className="kit-page__scans" aria-label="Codes read">
          {scans.map((code, i) => (
            <li key={`${code}-${i}`}>{code}</li>
          ))}
        </ol>
      </Section>

      {slideOver && (
        <SlideOver
          title="Order W00001"
          width="md"
          onClose={() => setSlideOver(false)}
          header={<StatusBadge tone="warning">Partial</StatusBadge>}
          footer={<Button variant="primary">Edit</Button>}
        >
          <p>Sections instead of tabs: customer, products, comments.</p>
        </SlideOver>
      )}
      {confirm && (
        <ConfirmModal
          title="Delete KF-01?"
          confirmLabel="Delete"
          danger
          onConfirm={() => setConfirm(false)}
          onCancel={() => setConfirm(false)}
        >
          The product and its stock in every warehouse are removed.
        </ConfirmModal>
      )}
    </div>
  );
}
