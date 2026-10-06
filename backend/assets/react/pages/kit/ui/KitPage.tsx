import {useState, type ReactNode} from 'react';
import {useTranslation} from '@/shared/i18n';
import {
  ActionBar,
  Button,
  CameraScanner,
  ConfirmModal,
  DataTable,
  EmptyState,
  FilterChips,
  FormLayout,
  FormSection,
  KpiStrip,
  LanguageSwitch,
  Money,
  Num,
  PageHeader,
  PasswordField,
  ScanInput,
  SearchBox,
  Skeleton,
  SlideOver,
  StatusBadge,
  ThemeSwitch,
  Toolbar,
  useToast,
  WarehouseSwitch,
  type Column,
} from '@/shared/ui';
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
