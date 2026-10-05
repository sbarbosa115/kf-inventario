# KF Inventory design system

The plan and its reasons are in [`docs/pdr/prd-redesign.md`](../pdr/prd-redesign.md). This file is the reference
the screens are built from. Every component lives in `@/shared/ui` (`backend/assets/react/shared/ui`); the dev-only
page **`/admin/_kit`** shows each one in its states, in the current theme and language.

## Brand

- `backend/public/images/kf-mark.svg`: the KF mark traced from [`brand/kf-logo-180.png`](brand/kf-logo-180.png)
  (the site icon of kfvintagejdm.com): ring `#23241c`, disc `#5d7b2b`, white italic "KF", flat. A true vector file
  from the owner replaces the trace when there is one.
- `backend/public/favicon.svg` (the same mark), `backend/public/favicon.ico` (16 and 32 px, rendered from the SVG),
  `backend/public/apple-touch-icon.png` (the 180 px reference PNG itself).
- The product's name is "KF Inventory" in both languages (`shared/config/brand.ts`), and every tab reads
  "<page> · KF Inventory".

## Tokens

`shared/ui/styles/tokens.css` is the only stylesheet with colour values; everything else uses `var(--kf-*)`.
`tokens.test.ts` checks AA contrast for every pair the screens use, in both themes, and that no other `.css` under
`assets/react` holds a hex colour.

| Family | Tokens | Use |
|---|---|---|
| Surfaces | `--kf-bg`, `--kf-surface`, `--kf-surface-sunken`, `--kf-surface-raised` | page, cards/inputs, table headers/toolbars, dialogs/menus |
| Lines | `--kf-border` (dividers only), `--kf-border-strong` (inputs, controls: 3:1) | |
| Text | `--kf-text`, `--kf-text-muted` | |
| Accent | `--kf-accent`, `--kf-accent-hover`, `--kf-accent-soft`, `--kf-on-accent`, `--kf-link`, `--kf-focus` | the one main action, active states, links, the focus ring |
| Meaning | `--kf-danger*`, `--kf-warning*`, `--kf-info*`, `--kf-neutral-*` (each: colour, `-soft`, `-text`, `--kf-on-*`) | destructive; needs attention; a state; nothing special |
| Shell | `--kf-sidebar`, `--kf-sidebar-text`, `--kf-sidebar-muted`, `--kf-sidebar-active`, `--kf-sidebar-hover` | the logo's dark ring |
| Type | `--kf-font-sans` (Geist), `--kf-font-mono` (Geist Mono); `--kf-text-label` .75 · `-sm` .875 · `-body` 1 · `-lg` 1.125 · `-title` 1.375 · `-kpi` 1.75 rem | |
| Space | `--kf-space-1` 4 px … `--kf-space-8` 48 px | |
| Shape | `--kf-radius-control` 6, `--kf-radius-card` 10, `--kf-radius-pill`; `--kf-row-height` 44, `-comfortable` 52; `--kf-target` 44 | |
| Depth | `--kf-shadow-float` (floating things only: drawer, menu, toast, dialog, slide-over); `--kf-z-dropdown` 100 · `-sticky` 200 · `-drawer` 300 · `-dialog` 400 · `-toast` 500 | cards have a border, not a shadow |
| Layout | `--kf-content-max` 1200, `--kf-form-max` 720, `--kf-form-narrow` 640, `--kf-topbar-height`, `--kf-tabbar-height`; `--kf-toolbar-top` and `--kf-shell-bottom` set by the shell | |
| Motion | `--kf-duration-fast` 150 ms, `--kf-duration` 200 ms, `--kf-ease` (0 with reduced motion) | |

**Themes.** `html[data-theme="light" | "dark"]`, chosen in the top bar (Light / Dark / System), remembered in
`localStorage['kf.theme']`, applied before the first paint by the inline script of `templates/spa.html.twig` and kept by
`shared/lib/theme.ts` (System follows `prefers-color-scheme` live). Bootstrap 4's classes are mapped onto the tokens in
`bootstrap-overrides.css` (primary/success = accent, danger = danger, every other button = secondary), react-select in
`react-select.css` (`classNamePrefix="kf-select"`).

## Which component when

| Need | Use |
|---|---|
| A page's title and its actions | `PageHeader` (`title` also names the tab; one `primary`; `secondary` go behind "More" on phones; `back`) |
| Filters above a list | `Toolbar` with `WarehouseSwitch` (+ `useRememberedWarehouse`), `FilterChips` ("All" first, counts), `SearchBox`, `ClearFilters` |
| A list | `DataTable`: `rowLabel`, at most one `primaryAction`, the rest in `rowActions` (one "⋯" `RowMenu`), `onRowClick`, `selectionBar`, `cardTitle` + `cardFacts` for the phone cards, `mono`/`numeric` columns |
| Figures from the loaded list | `KpiStrip` (2–4), with `Money` / `Num` |
| Money, numbers, dates | `useFormat()` (`money`, `num`, `date`, `dateTime`: en-US / es-CO, USD, Bogotá time), `<Money>`, `<Num>` — never `toFixed` or a hard-coded locale |
| A status | `StatusBadge` (`tone`, `filled`, words always; the item maps its statuses to tones) |
| A detail or a quick edit, keeping the list in view | `SlideOver` (`md` 480 / `lg` 720 px, full width on phones) |
| Creating or editing a record | a page: `FormLayout` (`narrow`, `columns={2}`), `FormSection`s, `Field`s, `ActionBar` (`primary`, Cancel as `secondary`/ghost, `status` such as "3 things missing") |
| Before a destructive or state-changing action | `ConfirmModal` (title asks, body says the consequence, `danger` only when it destroys) |
| After a save or a failure | `useToast()`: `success(text, {action: {label, href}})` (5 s), `error(text)` (stays) — no Undo |
| Loading | `Skeleton` (`text`, `row`, `card`, `form`, `kpi`); `DataTable` draws skeleton rows itself. `Loader` only inside a button or for the session |
| Nothing to show | `EmptyState` (`icon`, `title`, `message`, `action`); the filtered-to-nothing state offers "Show all" |
| A button or a link that looks like one | `Button` (`primary` once per view, `secondary`, `ghost`, `danger`; `sm`/`md`/`lg` 48 px; `loading`; `icon`; `to` / `href`) |
| A password | `PasswordField` (show/hide, Caps Lock hint) |
| Scanning | `CameraScanner` (start after a tap, torch, the same label counted once, vibration + `beep()`) above `ScanInput` (Enter reads, keeps the focus); the sound toggle is `useSound()` |

**SlideOver or page?** A slide-over for reading a record or changing one or two things where the list matters
(order detail, move stock, invoice detail). A page for creating or editing a record with sections of fields (product,
order, customer, invoice, user forms), so it has its own address and survives a reload.

## Copy

Sentence case; titles name the thing ("Products", not "View products"); confirmations say the consequence ("Delete
order W00001? Its products and comments are removed."); success messages without exclamation marks; errors say what
to do next. Spanish is neutral Latin American Spanish: buttons in the infinitive ("Guardar", "Crear pedido"),
sentences impersonal or with "usted", never "tú". Every string goes through `useTranslation()`, in
`shared/i18n/locales/en/<prefix>.json` **and** `es/<prefix>.json` (`i18n.test.ts` keeps their keys and placeholders
identical). The Spanish is final (no native review); a proofreading pass runs at the barrier.

### Glossary (binding, both languages)

| English | Spanish |
|---|---|
| Products / Product | Productos / Producto |
| Stock, in stock, out of stock | Existencias, con existencias, sin existencias |
| Warehouse | Bodega |
| Scan (nav), Barcode | Escanear, Código de barras |
| Upload a stock sheet | Cargar una hoja de existencias |
| Incoming | Entrantes |
| Approve all (N) | Aprobar todo (N) |
| Move to warehouse | Trasladar a bodega |
| Download stock sheet | Descargar hoja de existencias |
| Orders / Order / Order number | Pedidos / Pedido / Número de pedido |
| Created · Processed · Completed · Partial · Sent · Delivered | Creado · Procesado · Completado · Parcial · Enviado · Entregado |
| Getting ready · Shipment · Shipped so far · This shipment · Ship N products | Alistamiento · Envío · Enviado hasta ahora · Este envío · Enviar N productos |
| Sync shop orders | Sincronizar pedidos de las tiendas |
| Customers / Walk-in customer | Clientes / Cliente de mostrador |
| Invoices / Invoice / Sales tax | Facturas / Factura / Impuesto de ventas |
| Users / Roles / Sign in / Sign out | Usuarios / Roles / Iniciar sesión / Cerrar sesión |
| Save · Cancel · Close · Delete · Edit · Create · Search · Show all · Clear filters · More · Actions · Undo last scan | Guardar · Cancelar · Cerrar · Eliminar · Editar · Crear · Buscar · Mostrar todo · Quitar filtros · Más · Acciones · Deshacer el último escaneo |
| Nothing here yet. / Nothing matches these filters. / Loading / Saved / Try again | Aún no hay nada. / Nada coincide con estos filtros. / Cargando / Guardado / Reintentar |

## The shell

From 1024 px a sidebar (Warehouse, Sales, Admin), collapsible to a rail (`kf.sidebar`); below, a drawer behind
"Menu" and a bottom tab bar (the role's first three of Products, Scan, Incoming, Orders, Customers, Invoices, …, and
More). Only one navigation is in the page at a time. The top bar: "Open the reader" (inventory roles), EN/ES, the
theme, the person's name (username, email, Sign out). Smoke specs match names that the shell shares in part ("Products",
"Scan", "More") with `exact: true`.

## Testing the camera

`CameraScanner` needs a secure origin: production serves HTTPS; `http://localhost` also counts. On a plain
`http://<host-ip>` address the component says the camera needs a secure address and the typed input stays. Its
behaviour is covered by `CameraScanner.test.tsx` with a fake detector (DS-10/11); there is no real-phone run (the
user's decision). To try it by hand on a computer with a webcam, open `/admin/_kit` on `http://localhost:<HTTP_PORT>`
and hold a printed Code 128 or QR code to the camera.

## Licences of what the redesign adds

| Package | Version | Licence | Used for |
|---|---|---|---|
| `@fontsource-variable/geist` | 5.3 | OFL-1.1 | the UI font, self-hosted |
| `@fontsource-variable/geist-mono` | 5.3 | OFL-1.1 | codes, numbers in scan lists |
| `@zxing/browser` | 0.2.1 | MIT | camera barcode reading where the browser has no `BarcodeDetector` (its own lazy chunk) |
| `@zxing/library` | 0.23 | Apache-2.0 | the decoders `@zxing/browser` uses |
