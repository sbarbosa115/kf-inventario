# Redesign: KF Inventory's look, layout and UX

<!--
    PRD for docs/pdr/prd-redesign.md. Base branch feature/redesign (from origin/main at d1a50fc, the restructure).
    Written 2026-10-05 from an audit of every screen in the browser at 1440 px and 390 px and a read of
    backend/assets/react; reviewed and finalised by the planning model against the real code, the API (controllers in
    backend/src/*/UI/Http/Controller, roles in backend/config/packages/security.yaml) and the smoke suite (backend/e2e).
    Screenshots of today's screens: docs/design/audit/. `split.py plan` reads the table under "## Split".
-->

## What it is for

The people who use KF Inventory every day: the **warehouse staff** (stock, barcode reader, incoming, getting orders
ready; standing at the shelf with their phone), the **sales office** (orders, customers, invoices, at a desk) and the
**admin** (users, warehouses). Today the app is the old SB Admin look carried over screen for screen: it works, but
every action is the same green, rows carry six identical icon buttons, the warehouse screens are not built for
scanning, and on a phone the menu covers the first screen of every page.

The job of this redesign: **the same app, faster to read and safer to operate.** One visual system built from the KF
brand, screens organised around the job each person does there, clear states (loading, empty, error, saved), a phone
camera as the barcode reader, English and Spanish, light and dark. No route, role, API contract, database or business
rule changes: everything below is presentation over today's endpoints.

## Goals and how we will know

| Goal | Measure (checked in the regression run) |
|---|---|
| Fewer mistakes on destructive or state-changing actions | Delete, status change, "Remove stock" and "Approve all" confirm first and name what will happen; Cancel/Close are never red; danger colour appears only on destructive actions |
| Faster warehouse work | The warehouse and the mode (add/remove) are chosen **before** scanning and remembered; a scan registers with a flash, a vibration and a tone in < 100 ms; the typed input never loses focus; a camera read lands in the list in < 1 s and the camera stays open between reads |
| Everything usable on a 390 px phone | No horizontal page scroll on any screen; lists become cards under 600 px; the menu is a drawer; a bottom tab bar; 44 px targets |
| One consistent look | Every screen built from `@/shared/ui`; no screen-local button or table styles; no hex colour outside `tokens.css` (a Vitest test greps the CSS) |
| Accessible | Lighthouse accessibility ≥ 95 on every screen, light and dark (DevTools, by hand); visible focus everywhere; AA contrast for every token pair (a Vitest test over the token map, both themes) |
| Bilingual | Every visible string in English and Spanish; the catalogues have the same keys (Vitest); switching keeps the page and its data; no raw key on any screen |
| Feels quick | Skeletons instead of spinners for page loads; the session check and the page chunk load in parallel |

## Non-goals

- No change to routes, roles, the API (`/api/v1`), the database, the PDFs, the XLS files or the emails (their
  redesign is a later PRD; they stay English and server-rendered).
- **Bootstrap 4 stays** (no Tailwind or component-library migration): the redesign is a token layer, a few
  Bootstrap overrides and our own components on top of it.
- No marketing-site effects (grain, parallax, scroll-driven animation): this is an operations tool used for hours.
- **No new business logic** (user, 2026-10-05): no new fields (the invoice NIT stays as it is), no new endpoints, no
  new rules (no low-stock threshold, no per-row approve, no status history, no customer search across pages, no
  figures the loaded lists cannot give). Dropped from the first draft for this reason: "N new products · N rows
  skipped" in the upload summary (the API answers `{stored}` only), orders or stock counts on the warehouse cards,
  order counts on customers, Undo in toasts, status history in the order detail.
- No dependency beyond the four named in Decisions 10 (two fonts, the two ZXing packages).

## Answers from the user (2026-10-05)

1. **Brand:** build on the KF logo's olive. The reference is the site icon `docs/design/brand/kf-logo-180.png`
   (from kfvintagejdm.com): olive `#5d7b2b`, ring `#23241c`. It is a 180 px PNG; item 0 traces it to an SVG for the
   shell and the favicon, and uses the PNG itself as the `apple-touch-icon` (180 px is exactly that size). A true
   vector file replaces the trace when the owner has one.
2. **Currency: USD** everywhere (prices, totals, invoices).
3. **English and Spanish, with a toggle** in the top bar (remembered per browser; first visit follows the browser's
   language). Numbers and dates follow the chosen language: `en-US` → `$1,250.00` · `Oct 5, 2026, 2:30 PM`; `es-CO`
   → `US$ 1.250,00` · `5 oct 2026, 2:30 p. m.` (`Intl` decides the symbol and separators; the time zone stays
   America/Bogota as today). PDFs and emails stay English.
4. **Warehouse staff use their phones, scanning with the camera.** The scan screens are phone-first with a camera
   viewfinder; typing (or a keyboard-wedge scanner) stays as a fallback and is what the smoke suite drives.
5. **No API additions.** The app centralises the orders of **four WooCommerce shops**; this redesign only changes how
   it looks and works.
6. **Dark mode: yes** — light, dark, or follow the system, from the top bar.
7. **NIT:** not added (no new logic).
8. **Spanish:** our translations are final, no native review; a Spanish proofreading pass runs at the barrier.
9. **Production serves HTTPS** (confirmed).
10. **No real-phone camera tests:** DS-10/11 are covered by `CameraScanner`'s tests with a fake detector and are not
    run by hand.

---

## Audit: what is wrong today

Severity: **H** hurts the work or causes mistakes, **M** slows people down or looks broken, **L** polish.

### Global (every screen)

| # | Sev | Finding | Evidence |
|---|---|---|---|
| G1 | H | **One colour means everything.** `btn-success` green is used 36 times: create, edit, detail, download, approve, save, "add" (+). Red is used both for delete and for Cancel/Close. Colour carries no meaning, so it cannot warn. | all screenshots |
| G2 | H | **Phone layout is broken.** Under 768 px the sidebar stacks open above the page and fills the whole first screen; tables overflow sideways; product codes wrap mid-word (`KF-`/`01`). | `phone-390.jpg` |
| G3 | M | **No visual system.** Bootstrap 4 defaults (system font, `#007bff` blue, `#28a745` green, 4 px radius everywhere) plus ~175 lines of screen CSS; no tokens for colour, type, spacing, elevation or z-index. | `assets/react/**/*.css` |
| G4 | M | **No brand.** The header says "Inventory" in plain text; the KF logo (`public/images/logo.jpeg`) appears only in the PDFs; the favicon is the generic one; every tab is titled "KF Inventory". | `desktop-login.jpg` |
| G5 | M | **Icon-only buttons with no visible label** (edit, XLS, PDF, remaining PDF, delete, sync, +/−). They have `aria-label`s, but sighted users must hover or guess. | `desktop-orders.jpg` |
| G6 | M | **Spinners everywhere** (`Loader` in 18 files), then the content jumps in. Shell → session → page chunk → data, one after another. | browser timing |
| G7 | M | **Wide screens are wasted, narrow content is stretched.** Forms span the full 1,300 px (a 1,000 px wide "Price" input); lists sit in a card at the top with empty space below. No max-width. | `desktop-product-form.jpg` |
| G8 | M | **Inconsistent form actions:** small Save/Cancel at the left (product, user), full-width red Cancel + green Save (customer, invoice, getting-ready), Update with a paragraph of hint (order). | form screenshots |
| G9 | M | **Feedback is inconsistent.** Success messages are alerts at the top of the list page (sometimes), errors are alerts in different places, nothing confirms "saved" in place, no toast. | — |
| G10 | M | **Numbers and money are unformatted:** `100.00` with no currency, no thousands separator, proportional digits so columns do not line up; invoice money built with `toFixed(2)`; dates hard-coded to `en-GB`/`en-US`. | `desktop-invoices.jpg`, `entities/*/lib` |
| G11 | L | **Copy:** title case and generic titles ("View products", "View Orders", "View Users"), jargon ("Consecutive", "Aggregate Partials", "Rol"), raw role constants (`ROLE_MANAGE_INVENTORY`) shown to users. | `desktop-users.jpg` |
| G12 | L | **Accessibility gaps:** no skip link, no per-page `<title>`, the browser's default focus only, status shown by row tint alone (getting-ready), `table-sm` rows ~28 px high (below a 44 px touch target), 1 px borders at 1.3:1. | code |

### Screen by screen

| Screen | Sev | Findings |
|---|---|---|
| Sign in | M | A 24 rem card in an empty grey field; no logo or product name; the disabled "Log In" looks broken (pale blue); no "show password"; no Caps Lock hint. |
| Product list | H | Warehouse is a half-width select; the three actions look identical and disabled ones are just faded green; "Warehouse" column repeats the filter; "Description" empty for most rows; the only row action is an unlabelled green icon; no totals; selection count hidden. |
| Product form | M | Full-width inputs; a warning that the product "won't be shown until you add quantities using Excel" instead of a clear next step; Status select first. |
| Upload | M | One run-on sentence with the two download buttons inside it; browser-default file input; the steps (download → fill → upload) are not shown as steps; the result is one line. |
| Barcode reader | H | The core warehouse tool: a 150 px input, the warehouse chosen **after** scanning (easy to add stock to the wrong one), no sound or flash per scan, no running total, no undo of the last scan; Add/Remove share one row with equal weight; exists/missing shown as fake buttons. |
| Incoming | M | "Approve all" has no count in the label and no confirm; the empty state is one grey line. |
| Warehouses | L | A three-row table with a "#" column; editing opens a modal for one field; the shop addresses each warehouse serves (`urls`) are not shown. |
| Orders list | H | Seven buttons per row (detail + five green icons + red delete); status is a bare `<select>` that changes the order on one click and has no colour; the order number is the 3rd column and the comments button the 1st; no counts per status; Sync is an icon; "Created Date" without time. |
| Order detail | M | A modal with a dense line of facts ("Source: Phone Status: Partial Customer: …"); a red **Close**; products and comments in tabs although both are short; no way to act from where the information is. |
| Order form | M | Two columns that do not align; product rows without column headers; "Consecutive"; the warehouse locks silently; a long hint sentence explains why Update is disabled instead of marking the missing fields. |
| Getting ready | H | Every row starts tinted red (alarming before anything happened); "25 / 25" and "Aggregate Partials" need explaining; stock shown as a teal button that is not a button; full-width red Cancel equal to Save; scan input small; refusals as modals that steal the scanner's focus. |
| Customers | L | Edit/delete as unlabelled icons; the search box looks global but searches the current page only; the total is in a small line under the table. |
| Customer form | M | Address block offset by a floating green "+"; full-width red Cancel; the City field sits alone. |
| Invoices list | M | "Invoice Detail" green button + unlabelled PDF icon; totals without currency; no date or customer filter (client-side is enough: the list is loaded whole). |
| Invoice form | M | Line items have no column headers (product, qty, price); totals small and right-aligned far from the lines; tax as a select of "0% / 6%" without saying what tax; full-width red Cancel. |
| Users | M | Raw role constants as blue pills; "Rol"; the form lists nine role checkboxes with no explanation of what each grants. |

---

## Design direction

**An operations tool that is calm, legible and quick to scan.** Neutral surfaces, one accent from the KF brand, colour
only where it means something (status, danger), generous row height, tabular numbers, and the action a person most
likely wants made the most visible thing on each screen.

### Tokens (`shared/ui/styles/tokens.css`, CSS custom properties; Bootstrap's classes mapped onto them in `shared/ui/styles/bootstrap-overrides.css`)

**Colour, light theme.** Every pair below was computed (WCAG 2.x relative luminance) and is asserted by
`shared/ui/styles/tokens.test.ts` in both themes. One warm-neutral grey family (tinted towards the olive) and one
accent, the logo's olive.

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--kf-bg` | `#f6f7f5` | page background | — |
| `--kf-surface` | `#ffffff` | cards, tables, panels, inputs | — |
| `--kf-surface-sunken` | `#eef0ec` | table header, toolbar, read-only inputs | — |
| `--kf-border` | `#dfe3dc` | 1 px dividers (decorative) | 1.3:1 (dividers only) |
| `--kf-border-strong` | `#848c85` | input and control borders, checkbox outlines (WCAG 1.4.11 needs 3:1) | 3.1:1 on white |
| `--kf-text` | `#1d2420` | body text | 15.8:1 on white |
| `--kf-text-muted` | `#5d6862` | secondary text | 5.8:1 on white, 5.4:1 on bg, 5.1:1 on sunken |
| `--kf-accent` | `#5d7b2b` | primary buttons, active nav bar, focus ring, selected checkbox | white on it 4.85:1; ring on white 4.85:1 |
| `--kf-accent-hover` | `#4d6823` | hover/pressed; **link text** (plain `#5d7b2b` on `--kf-bg` is only 4.51:1) | white on it 6.3:1; on white 7.5:1 |
| `--kf-accent-soft` | `#e9efe0` | selected rows, active nav background, accent badges | `--kf-accent-hover` on it 5.4:1 |
| `--kf-danger` / `--kf-danger-soft` | `#b42318` / `#fbe9e7` | destructive only (delete, remove stock); danger badge text `#8a1c12` | white on danger 6.6:1; `#8a1c12` on soft 7.9:1 |
| `--kf-warning` / `--kf-warning-soft` | `#b54708` / `#fbeedc` | needs attention (partial, incoming, short stock); badge text `#7a3103` | white on warning 5.4:1; `#7a3103` on soft 8.1:1 |
| `--kf-info` / `--kf-info-soft` | `#1f5f8b` / `#e3eef7` | informational status (processed, sent); badge text `#174a6e` | white on info 6.8:1; `#174a6e` on soft 8.0:1 |
| `--kf-neutral-soft` | `#eef0ec` | neutral badge (created, inactive); text `#3f4843` | 8.3:1 |
| `--kf-sidebar` / `--kf-sidebar-text` / `--kf-sidebar-muted` | `#23241c` / `#e8ebe4` / `#8f9189` | the shell's sidebar — the logo's dark ring; the active entry uses `#9cc263` | 13:1 / 4.9:1 / 7.7:1 |

**Dark theme** (`html[data-theme="dark"]`): bg `#141612`, surface `#1c1f19`, raised `#24281f`, border `#30352a`
(dividers), border-strong `#6b7364` (3.2:1 on surface), text `#e8ebe4` (13.8:1 on surface, 15.1:1 on bg), muted
`#a3ab9c` (7.0:1 on surface, 6.3:1 on raised), accent `#9cc263` with **dark text `#141612` on accent buttons**
(8.9:1) and as link/active colour (8.2:1), accent-soft `#2a3620`, danger `#ff8a7a` (7.3:1), warning `#f0b35a`
(9.0:1), info `#7ab8e0` (7.8:1), sidebar = bg. The theme is chosen in the top bar (Light / Dark / System),
remembered in `localStorage['kf.theme']`, applied **before the first paint** by an inline script in
`templates/spa.html.twig` (Decisions 6), and `<meta name="color-scheme" content="light dark">` makes native controls
(selects, scrollbars, the file input) follow it. Status badges, tables, inputs, react-select, the sidebar, the
viewfinder and the kit page have both themes; PDFs opened from the app stay as they are.

**Status colours** (`StatusBadge`, always with a text label, never colour alone): Created = neutral, Processed =
info, Completed = accent, Partial = warning, Sent = info, Delivered = accent (filled); Incoming = warning; product
Active = accent / Inactive = neutral; stock 0 = warning.

**Type.** **Geist** (UI) and **Geist Mono** (codes, SKUs, order and invoice numbers, quantities in the scan list),
self-hosted from `@fontsource-variable/geist` and `@fontsource-variable/geist-mono` 5.3 (OFL-1.1, one variable woff2
each, imported in `app/index.tsx`; Encore copies them to `public/build/fonts/`; `font-display: swap`, fallback
`system-ui, sans-serif`). `font-variant-numeric: tabular-nums` on every number column and total. Scale (rem): 0.75
label / 0.875 body-sm (tables) / 1 body / 1.125 / 1.375 page title / 1.75 KPI. Weights 400 / 500 / 600 (700 only
for KPI figures). Sentence case everywhere; small uppercase only for sidebar group labels (+0.06 em tracking).

**Space, shape, depth.** 4 px scale (`--kf-space-1` 4 … `--kf-space-8` 48). Radius: 6 px inputs/buttons, 10 px
cards/panels, 999 px status badges. Cards have a border, not a shadow; one elevation token (`--kf-shadow-float`,
tinted with the sidebar hue) for floating things (drawer, menu, toast, dialog, slide-over). Z-index scale: dropdown
100, sticky 200, drawer 300, dialog 400, toast 500 (Bootstrap's `.modal`/`.modal-backdrop` are re-mapped onto it).
Breakpoints: `< 600 px` lists become cards; `< 1024 px` drawer + bottom bar; `≥ 1280 px` two-column forms. Content
max-width 1,200 px; forms 720 px (640 px for the product and warehouse forms).

**Motion.** 150 ms ease-out for hover/press, 200 ms for drawers, dialogs and slide-overs, `transform`/`opacity`
only; `prefers-reduced-motion` turns them off. Buttons press to `translateY(1px)`. A changed scan row flashes
`--kf-accent-soft` for 600 ms.

### Component kit (`@/shared/ui`, item 0; every screen item builds only from it)

Existing components keep their names (no rename churn): `Modal`, `ConfirmModal`, `Field`, `EmptyState`,
`ErrorState`, `Loader` (kept for in-button and session states), `DataTable` (extended, every current prop kept so
untouched screens still compile), `PageCard` (restyled: header + content without card chrome; items replace it with
`PageHeader`; the coordinator deletes it at the barrier if nothing uses it). `LegacyScreen` is unused and is deleted.

| Component | API (props) and behaviour |
|---|---|
| `Button` (new) | `variant: 'primary' \| 'secondary' \| 'ghost' \| 'danger'`, `size: 'sm' \| 'md' \| 'lg'` (lg = 48 px, warehouse screens), `loading` (spinner inside, width kept, `aria-busy`), `icon?` (Font Awesome class) + children label; icon-only needs `aria-label` and gets a `title`. `as` = `Link`/`a` for navigation. One primary per view. |
| `PageHeader` (new) | `title`, `subtitle?` (count or context), `primary?` (ReactNode), `secondary?` (actions → a "More" menu on phones), `back?` (href). Sets the page title through `usePageTitle`. |
| `Toolbar` (new) | A sticky row under the header: children laid out with wrapping; `FilterChips` (`options: {key,label,count?}`, `value`, `onChange`, "All" first), `SearchBox` (`value`, `onChange`, clear button, `role="searchbox"`), `ClearFilters` button. |
| `WarehouseSwitch` (new, `shared/ui`, data passed in) | `warehouses`, `value`, `onChange`: a segmented control ≤ 4 warehouses, a compact `select` beyond; `aria-label` "Warehouse". Used with `useRememberedWarehouse`. |
| `DataTable` (extended) | New props: `rowActions?: (row) => RowAction[]` (rendered as one `RowMenu` "⋯" button, `aria-label` "Actions for <rowKey label>"), `primaryAction?: (row) => ReactNode`, `onRowClick?`, `selectionBar?: (rows) => ReactNode` (appears with "N selected", sticky), `density?: 'default' \| 'comfortable'` (44 / 52 px rows), `skeletonRows?` (default 6), `cardTitle?: (row) => ReactNode` and `cardFacts?: string[]` (column keys shown on the card under 600 px), `stickyHeader`. **Card mode is CSS** (`@media (max-width: 599px)`) with explicit `role="table/row/cell/columnheader"` on the elements and `data-label` on cells, so `getByRole('row')` locators work at every width. Numeric columns right-aligned + tabular. Loading renders skeleton rows, never a spinner. |
| `RowMenu` (new) | The "⋯" menu: `actions: {label, icon?, onSelect \| href, danger?, disabled?}[]`; arrow keys, Escape, `role="menu"`. |
| `StatusBadge` (new) | `tone: 'neutral' \| 'info' \| 'accent' \| 'warning' \| 'danger'`, `filled?`, `icon?`, children label. Item-level maps (order status → tone) live in the items. |
| `Money` / `Num` (new) + `useFormat()` (`shared/lib/format.ts`) | `useFormat()` → `{money(amount), num(n), date(iso), dateTime(iso)}` by the current locale (`en-US` / `es-CO`, currency USD, time zone America/Bogota). `<Money amount>` tabular, negative in danger; `<Num value>` tabular. `amount` accepts number or the API's decimal strings. |
| `SlideOver` (new) | `title`, `onClose`, `width: 'md' \| 'lg'` (480 / 720 px, full width under 600 px), `header?` (extra), `footer?`; `role="dialog"` + `aria-label` = title, focus trap, Escape, the page stays visible and scroll-locked. |
| `ConfirmModal` (kept, upgraded) | `title`, children (the consequence), `confirmLabel`, `danger`, `busy`; Escape cancels; the confirm button is `danger` when `danger`; Cancel is `secondary` (never red). |
| `Toast` + `ToastProvider` + `useToast()` (new) | `toast.success(text, {action?: {label, href}})`, `toast.error(text)`; bottom-right (bottom-centre above the tab bar on phones), success 5 s, error until dismissed, `role="status"` / `role="alert"` with `aria-live`. Replaces the per-page `alert` blocks (the specs locate "status" by text, as today). |
| `FormLayout` + `FormSection` + `ActionBar` (new) | `FormLayout` (max-width, two columns ≥ 1280 px when `columns={2}`), `FormSection` (`title`, `description?`, children), `ActionBar` (sticky bottom: `primary`, `secondary?` (Cancel, ghost), `status?` text such as "3 things missing", above the tab bar on phones). |
| `Field` (kept) + `PasswordField` (new) | `PasswordField` adds show/hide and a Caps Lock hint (`aria-live`). |
| `Skeleton` (new) | `variant: 'text' \| 'row' \| 'card' \| 'form' \| 'kpi'`, `lines?`; `aria-hidden`, the wrapper carries `role="status"` + "Loading". |
| `EmptyState` (kept, extended) | `icon?`, `title?`, `message`, `action?` (ReactNode). |
| `KpiStrip` (new) | `items: {label, value: ReactNode, tone?}[]`, 2–4 across, stacked under 600 px. |
| `ScanInput` (new) | `label`, `onScan(code)`, `size: 'md' \| 'lg'`, `autoFocus`; clears and **keeps focus** after Enter, `autoCapitalize="off"`, `autoComplete="off"`, `enterKeyHint="done"`, scan icon; debounces keyboard-wedge bursts (Enter within 50 ms of the last key is one scan). |
| `CameraScanner` (new) | `onScan(code)`, `formats?` (default CODE_128, CODE_39, EAN_13, EAN_8, UPC_A, QR_CODE), `paused?`, `detector?` (injected in tests). A "Start camera" button (permission must follow a tap), the viewfinder (`<video>` + framing guide), torch toggle when `track.getCapabilities().torch`, a status line (asking / denied / no camera / not a secure origin, each in words with the typed fallback below), the same code ignored for 1.5 s, `navigator.vibrate?.(60)` + `beep()` per read. Uses the browser's `BarcodeDetector` when present and `getSupportedFormats()` covers the formats (Chrome on Android), otherwise `@zxing/browser`, **dynamically imported** only when the camera starts. No frame ever leaves the phone. |
| `beep()` + `useSound()` (`shared/lib`) | A 70 ms Web Audio tone; on/off remembered in `localStorage['kf.sound']`; the toggle lives in the scan screens' header. |
| `LanguageSwitch`, `ThemeSwitch` (new, `shared/ui`) | A two-option segmented control "EN / ES" (`role="radiogroup"`, `aria-label` "Language"); a menu "Theme: Light / Dark / System". Both remembered per browser. |

A dev-only page `/admin/_kit` (`pages/kit`, mounted in `routes.tsx` when `process.env.NODE_ENV !== 'production'`)
shows every component in every state in both themes, and is where the camera is tried on a real phone.

### Shell and navigation (`widgets/app-shell`, item 0)

- **Brand:** the traced KF mark (`public/images/kf-mark.svg`: the dark ring, the olive disc, the white italic "KF")
  + "KF Inventory" in the sidebar/top bar; `public/favicon.svg` and a regenerated `public/favicon.ico` from the same
  mark; `public/apple-touch-icon.png` = the 180 px reference PNG.
- **Desktop (≥ 1024 px):** sidebar 240 px, collapsible to a 64 px icon rail (remembered, `kf.sidebar`); groups
  **Warehouse** (Products, Upload, Scan, Incoming, Warehouses), **Sales** (Orders, Customers, Invoices), **Admin**
  (Users); the same role rules as today (`useCan`); Products' sub-pages become first-level entries (no dropdown).
  Active entry: 3 px accent bar + soft background.
- **Tablet/phone (< 1024 px):** the sidebar becomes a drawer behind a "Menu" button; a **bottom tab bar** with the
  first three entries the person's roles reach (sidebar order) + "More" (opens the drawer). The shell renders
  **either** the sidebar **or** the drawer + tab bar (a `useViewport()` matchMedia hook), never both, so a link name
  never appears twice in the DOM (Playwright strict mode).
- **Top bar:** page title (phones), a "Scan" shortcut (`ROLE_MANAGE_INVENTORY`, to `/admin/products/barcode`),
  `LanguageSwitch`, `ThemeSwitch`, the person's **name** (`SessionOutput.name`, username as fallback) opening a
  menu with the username, the email and "Sign out".
- Skip link ("Skip to content") as the first focusable element; landmarks `header`, `nav` (labelled), `main`;
  per-page `<title>` through `usePageTitle(title)` → "Orders · KF Inventory"; the page chunk of the route being
  opened is prefetched while `/auth/me` is still pending (`routes.tsx` exports `prefetchRoute(pathname)`, called
  from `App` on mount); `RequireSession` shows the shell skeleton, not a spinner; the last warehouse chosen is
  remembered per browser (`shared/lib/useRememberedWarehouse(warehouses)` → `[current, pick]`; a `?warehouse=<id>`
  search param wins and is remembered; `localStorage['kf.warehouse']`, try/catch).
- **Sign in** (`pages/login`, item 0): split layout on desktop (the mark + "KF Inventory" on an olive panel left,
  the form right), single column on phones; `PasswordField` (show/hide, Caps Lock hint); the error inline above the
  button (`role="alert"`); the button is full colour and disabled only while signing in; the language switch under
  the form. **Not found** (`pages/not-found`): the mark, "Page not found", the way back.

---

## Screen proposals

Every screen keeps its route, data, API calls and roles. IDs refer to the audit above. Every figure shown is
computed in the browser from what the screen already loads.

1. **Sign in / not found** — as in "Shell" (item 0). (G4)
2. **Product list** (item 1) — `PageHeader` "Products" with "Create product" (primary); `Toolbar` with
   `WarehouseSwitch` (remembered), `SearchBox`, `FilterChips` All / In stock / Out of stock (quantity 0; client
   filter on the loaded list); `KpiStrip`: products, units (Σ quantity), stock value (Σ quantity × price, `Money`).
   Table: Code (mono), Title, Detail (truncated, `title` tooltip), Quantity (`Num`), Price (`Money`), ⋯ (Edit,
   Download stock sheet for this row = `template.xls?uuid[]=`). The "Warehouse" column goes (it is the filter).
   Selection bar: "3 selected · Move to warehouse · Download stock sheet · Clear". Move opens a `SlideOver` (the
   same per-row quantity selects and destination, posting the same `/moves` body). Row click opens Edit. (G1, G5, G7)
3. **Product form** (item 1) — `FormLayout` 640 px, one `FormSection` "Product": code (mono), title, detail, price
   (`inputMode="decimal"`, "$" prefix), status as a switch (Active) last; `ActionBar` Save / Cancel. After a create
   the list shows a toast "Product saved" with the actions "Scan stock" and "Upload a stock sheet" (both routes
   exist); the yellow warning goes. (G7, G8)
4. **Upload** (item 2) — three numbered steps: 1 Download the template (or every product) · 2 Fill in the
   quantities · 3 Choose the warehouse and drop the file (a drag-and-drop zone that wraps the same `<input
   type="file" accept=".xls,.xlsx">`, showing name, size and type; a wrong type refused in place). Result as a
   summary card: "48 rows stored in Usa" (the API's `stored`) with a link to `/admin/products?warehouse=2`. (G9)
5. **Scan** (barcode reader, item 2) — phone-first, full height: **step 1** `WarehouseSwitch` and the mode as a
   large segmented control **Add / Remove** (Remove in danger colour) — both stick (`kf.warehouse`, `kf.scanMode`);
   **step 2** `CameraScanner` (full width, torch, vibration + tone, sound toggle in the header) with `ScanInput`
   (lg) under it as the typed fallback; both feed one `onScan(code)`. The running list: last scanned row moves to
   the top and flashes; each row: code (mono), product title once the by-code lookup answers (today's
   `productExists` call, now keeping the title), a count stepper (−/+, editable), a remove ×; an unknown code shows
   "Not a product" inline in danger and does not block. Sticky footer: "12 items · 37 units" and the primary
   **"Add to Colombia"** (48 px; one tap, the warehouse named in the button) or **"Remove from Colombia"** (danger,
   opens `ConfirmModal` naming the warehouse and the units). "Undo last scan" (secondary; Ctrl+Z on desktop).
   Success → toast, the list clears, focus back to `ScanInput`. (H, G1)
6. **Incoming** (item 2) — `PageHeader` "Incoming" with subtitle "in Usa · 12 products · 40 units";
   `WarehouseSwitch`; primary **"Approve all (12)"** → `ConfirmModal` ("Approve 12 products, 40 units, into
   Usa's stock?"); approved rows fade out; toast with the API's `approved` count; empty state "Nothing waiting —
   products moved here from another warehouse show up here". Card mode on phones. (G1, G9)
7. **Warehouses** (item 2) — cards instead of a table: name (rename inline: click the name or "Rename" in ⋯, Enter
   saves, Escape cancels, the same `PUT /warehouses/{id}`), and the shop addresses whose orders arrive there
   (`urls`, mono, muted). No modal, no counts (no endpoint gives them). (G7)
8. **Orders list** (item 3) — `PageHeader` "Orders" with "Create order" (primary) and "Sync shop orders"
   (secondary, labelled; result as a toast); `Toolbar`: `WarehouseSwitch`, `FilterChips` with counts computed from
   the loaded list ("All 12 · Created 2 · Processed 2 · Completed 2 · Partial 2 · Sent 2 · Delivered 2"),
   `SearchBox` (code or customer), a date range (two `<input type="date">`, client filter on `created_at`).
   Columns: Order (mono, 600, first), Customer (name; email under it in muted), Source (icon + label), Status
   (`StatusBadge` as a **menu button** "Status of order W00001": choosing a status opens `ConfirmModal` "Mark W00001
   as Processed?" then posts `/status`; choosing Sent goes to the getting-ready screen as today), Created
   (`dateTime`), Comments (count + icon, opens the detail on Comments), ⋯ (Edit, Getting ready, PDF, Remaining PDF,
   Excel, Delete — Delete in danger, with the existing confirm). Row click opens the detail `SlideOver`. Card mode on
   phones. (G1, G5, H)
9. **Order detail** (item 3, `SlideOver` `widgets/order-detail`) — header: order code (mono), `StatusBadge`, source,
   warehouse, created; actions row: Change status (same menu), Edit, Getting ready, Documents (PDF, Remaining PDF,
   Excel); sections instead of tabs: Customer (name, email, phone, first address), Products (code, title, ordered),
   Comments (edit and add inline, as today's `OrderComments` restyled). Close is a neutral ×. (G1)
10. **Order form** (item 4) — `FormLayout columns={2}` (Customer · Order) ≥ 1280 px, one column below; product
    lines as a table with headers (Product, Quantity, ×) and "Add product" under it; the warehouse lock explained
    inline ("Remove the products to change the warehouse"); "Consecutive" → "Order number"; required fields
    marked; `ActionBar` with Create/Update (primary, disabled until valid as today) and the status text "3 things
    missing: last name, warehouse, source" (click highlights them). (G8, G11)
11. **Getting ready** (item 4) — `PageHeader` "Getting ready · W00004" with the `StatusBadge`; `CameraScanner` +
    `ScanInput` on top (phone-first, as the Scan screen); rows start neutral; per row: code (mono), title, a
    progress bar "shipped 10 of 25 · this shipment 3" replacing "25 / 25" and "Aggregate Partials", "in stock 100"
    as muted text (not a button), stepper −/+; a row turns accent when this shipment completes it, warning when the
    warehouse holds fewer than what is left; the three refusals (not on the order, limit reached, no stock) become
    inline `role="alert"` messages under the scan input that do not steal focus; `ActionBar`: "Ship 3 products"
    (primary; disabled for sent/delivered orders as today) and Cancel (ghost). (H, G1, G11)
12. **Customers** (item 5) — `PageHeader` "Customers" (subtitle "1–100 of 1,240"), "Create customer"; columns Name
    (600), Email, Phone, City (first address), ⋯ (Edit, Delete); the search box labelled "Search this page" (the
    API pages without searching); server paging as a compact pager. Card mode on phones.
13. **Customer form** (item 5) — `FormLayout`: section Contact (first name, last name, email, phone) and section
    Addresses as cards with "Address 1 · Billing/Shipping" labels (`address_type` when present), "Add address" as a
    secondary button under the cards, remove as ghost; Country → State → City in one row on desktop (react-select
    with the kit's `kf-select` styles). `ActionBar`. (G8)
14. **Invoices list** (item 6) — Invoice (mono), Customer or "Walk-in customer" (for `POS Client`), Total (`Money`),
    Date, ⋯ (Detail, PDF); `Toolbar` with a date range and a customer search (client filters); detail as a
    `SlideOver` with the lines, totals (`Money`) and "Open PDF".
15. **Invoice form** (item 6) — document-like: Customer section left, Invoice section right (number, date,
    payment method, "Sales tax" 0 % / 6 %); lines as a table with headers (Product, Description, Qty, Unit price,
    Line total, ×), "Add line" and "Add all products from <warehouse>" under it; totals block under the lines
    (Subtotal, Sales tax 6 %, **Total** large), all `Money`; `ActionBar` "Create invoice". The `data-testid`s
    `subtotal/tax/total` stay. (G10)
16. **Users** (item 6 → item 7) — roles as `StatusBadge`s with plain names ("Admin", "Inventory", "Orders",
    "Orders: update", "Invoices: update", "Invoices: read", "Invoices: create", "Users", "Warehouses"); the form
    groups the nine checkboxes under Warehouse / Sales / Invoices / Admin, each with a one-line description of what
    it opens, and the note "Admin includes everything except invoices" (security.yaml's hierarchy). "Rol" → "Roles".
    `FormLayout` + `ActionBar`. (G11)

### Phone and handheld

Phone-first for the warehouse screens (Scan, Incoming, Getting ready, Products): drawer + bottom tab bar; lists as
cards; forms single column with the `ActionBar` above the tab bar; scan screens full height with 48 px targets and
the camera on top; tables never scroll the page sideways (`min-width: 0` everywhere, long codes break with
`overflow-wrap: anywhere`). Tested at 390 × 844 (iPhone) and 360 × 800 (Android), light and dark.

### Accessibility

Visible 2 px accent focus ring (`:focus-visible`, 2 px offset), skip link, per-page titles, landmarks,
`aria-live="polite"` for toasts and scan results, status never by colour alone, 44 px minimum targets on touch,
AA contrast for every token pair (Vitest), inputs with ≥ 3:1 borders, forms announce errors (`Field` already sets
`aria-invalid` + `aria-describedby`), menus and dialogs with arrow keys, Escape and a focus trap, `lang` on `<html>`
following the chosen language, reduced motion honoured.

### Copy and glossary (both languages)

Sentence case; titles name the thing ("Products", not "View products"); confirmations say the consequence; success
messages without exclamation marks; errors say what to do next. Spanish is **neutral Latin American Spanish**, no
pronoun where a form avoids it (buttons in the infinitive: "Guardar", "Crear pedido"; sentences in impersonal or
"usted" form, never "tú"). The glossary below is the binding translation of the domain terms; items reuse it word
for word (`docs/design/README.md` holds it too):

| English | Spanish | Replaces |
|---|---|---|
| Products / Product | Productos / Producto | "View products", "Product List" |
| Stock, in stock, out of stock | Existencias, con existencias, sin existencias | — |
| Warehouse | Bodega | — |
| Scan (nav), Barcode | Escanear, Código de barras | "Barcode reader", "Update by bar code" |
| Upload a stock sheet | Cargar una hoja de existencias | "Upload products" |
| Incoming | Entrantes | "Incoming products" |
| Approve all (N) | Aprobar todo (N) | — |
| Move to warehouse | Trasladar a bodega | "Move to Warehouse" |
| Download stock sheet | Descargar hoja de existencias | "Update Selected Using Excel" |
| Orders / Order / Order number | Pedidos / Pedido / Número de pedido | "View Orders", "Consecutive", "Order #" |
| Created · Processed · Completed · Partial · Sent · Delivered | Creado · Procesado · Completado · Parcial · Enviado · Entregado | — |
| Getting ready · Shipment · Shipped so far · This shipment · Ship N products | Alistamiento · Envío · Enviado hasta ahora · Este envío · Enviar N productos | "Aggregate Partials", "This Order", "Save Current" |
| Sync shop orders | Sincronizar pedidos de las tiendas | "Sync Orders" |
| Customers / Walk-in customer | Clientes / Cliente de mostrador | "POS Client" |
| Invoices / Invoice / Sales tax | Facturas / Factura / Impuesto de ventas | "Sale Tax" |
| Users / Roles / Sign in / Sign out | Usuarios / Roles / Iniciar sesión / Cerrar sesión | "Rol", "Log In", "Logout" |
| Save · Cancel · Close · Delete · Edit · Create · Search · Show all · Clear filters · More · Actions · Undo last scan | Guardar · Cancelar · Cerrar · Eliminar · Editar · Crear · Buscar · Mostrar todo · Quitar filtros · Más · Acciones · Deshacer el último escaneo | — |
| Nothing here yet. / Nothing matches these filters. / Loading / Saved / Try again | Aún no hay nada. / Nada coincide con estos filtros. / Cargando / Guardado / Reintentar | — |

---

## Contract (item 0)

Built by the coordinator alone on `feature/redesign`, in this order; each sub-step ends with the verification
named. Item 0 leaves every screen working (the old markup on the new tokens and shell) and the **whole smoke suite
green** before wave 1 starts; the screen items then only replace what their row owns.

**0.1 Brand, fonts, dependencies.** Trace `docs/design/brand/kf-logo-180.png` to `public/images/kf-mark.svg` (ring
`#23241c`, disc `#5d7b2b`, white italic "KF"; flat, no gloss); `public/favicon.svg`, `public/favicon.ico` (16/32,
regenerated from the SVG), `public/apple-touch-icon.png` (the PNG copied); `templates/spa.html.twig` links the
three and sets `<meta name="theme-color">` per scheme. `npm install @fontsource-variable/geist@^5.3
@fontsource-variable/geist-mono@^5.3 @zxing/browser@^0.2.1 @zxing/library@^0.23` — the only dependency changes of
the feature; items add none. *Verify:* `npm run build` emits the woff2 files under `public/build/fonts/` and the
production bundle does not contain `@zxing` in the main chunk (it is a separate chunk); the tab shows the mark;
the licences (OFL-1.1, MIT, Apache-2.0) are listed in `docs/design/README.md`.

**0.2 Tokens, Bootstrap overrides, dark theme, theme before paint.** `shared/ui/styles/{tokens.css,
bootstrap-overrides.css,react-select.css}` imported from `app/index.tsx` after Bootstrap and Font Awesome;
`app/styles/global.css` trimmed to the layout rules; the overrides map `.btn-primary`/`.btn-success` → accent,
`.btn-danger` → danger, `.btn-secondary`/`.btn-info`/`.btn-outline-*` → secondary, `.form-control`, `.custom-select`,
`.table`, `.card`, `.alert`, `.badge`, `.modal`, `.nav-tabs`, `.pagination`, `.dropdown-menu`, focus and links onto
the tokens, in both themes. `templates/spa.html.twig` gets, before the stylesheets, the inline theme script
(reads `kf.theme`, `prefers-color-scheme`, sets `document.documentElement.dataset.theme` and `lang` from
`kf.locale`, in a try/catch) and `<meta name="color-scheme" content="light dark">`. `shared/ui/styles/tokens.test.ts`
asserts the contrast table above for both themes (a small luminance function over the pairs; no library) and that
no `.css` under `assets/react` outside `tokens.css` contains a hex colour. *Verify:* `npm test`, `gate.sh`, the whole
smoke suite still green (no label changed), every screen opened at 1440 and 390 in both themes: nothing unreadable,
no white flash when dark is chosen and the page is reloaded.

**0.3 i18n: Spanish, per-prefix catalogues, formatting.** `shared/i18n/locales/en.json` is split into
`shared/i18n/locales/en/<prefix>.json` (`common, nav, auth, errors, users, products, stock, customers, address,
orders, orderForm, gettingReady, invoices, roles`) assembled by `locales/en/index.ts`; `locales/es/<prefix>.json`
mirrors it with **every existing key translated by item 0** (so the base is already fully Spanish; items translate
only what they add or rename, in their own files). `i18n.ts`: `Locale = 'en' | 'es'`, `CATALOGS = {en, es}`,
`Intl.PluralRules` per locale; `I18nProvider` reads `localStorage['kf.locale']`, else `navigator.language`
(`es*` → `es`), else `en`, exposes `setLocale`, writes `document.documentElement.lang`. `shared/lib/format.ts`
(`useFormat`, `Money`, `Num` in `shared/ui`). `shared/i18n/i18n.test.ts` grows a **key-parity test** (every key of
`en` exists in `es` and vice versa, no empty string) replacing the old "one empty section per prefix" test.
*Verify:* `npm test`; with `kf.locale=es` every current screen shows Spanish and no raw key (by eye, both themes);
with a fresh profile and Playwright's `locale: 'en-US'` the suite is unchanged and green.

**0.4 The kit.** Every component of the table above, each with a Vitest file next to it (Button variants and
loading; PageHeader sets the title; Toolbar chips and search; DataTable row menu, selection bar, skeleton, card-mode
roles; RowMenu keyboard; StatusBadge; Money/Num per locale; SlideOver focus trap and Escape; ConfirmModal danger;
Toast live region and timing (fake timers); FormLayout/ActionBar; PasswordField caps lock; Skeleton; KpiStrip;
ScanInput keeps focus and debounces; CameraScanner with a fake detector (emits a code, the same code twice within
1.5 s counts once, vibration/beep called); LanguageSwitch; ThemeSwitch persists), the `/admin/_kit` page. *Verify:*
`npm test`, `gate.sh`, the kit page in both themes at 1440 and 390 with no console error.

**0.5 The shell, sign-in and not-found.** `widgets/app-shell` rebuilt as described (sidebar/rail, drawer + bottom
bar, top bar, skip link, landmarks), `usePageTitle`, `prefetchRoute` in `app/routes.tsx`, `useRememberedWarehouse`
and `useViewport` in `shared/lib`, `RequireSession` with the shell skeleton, `pages/login` and `pages/not-found`
redesigned, `CLAUDE.md` house-style paragraph rewritten ("Screens look like…" → the kit rules). The shell's labels
change (`nav.*`: "Product List" → "Products", "Upload products" → "Upload a stock sheet", "Barcode reader" → "Scan",
"Incoming products" → "Incoming"; the top bar shows the name "Sergio Barbosa" instead of the email; "Logout" → "Sign
out"; `auth.*`: "Log In" → "Sign in"): **item 0 updates those locators in every spec that uses them**
(`auth.spec.ts` AUTH-01/02/03/04, NAV-01/02; `products.spec.ts` INV-08; `stock.spec.ts` INV-11; `orders.spec.ts`
ORD-10; `customers.spec.ts` CUS-06; `invoices.spec.ts` INVC-06; `users.spec.ts` USR-06) and the matching case texts
in `docs/tests/ui-regression.md`. *Verify:* `AppShell.test.tsx` (role rules, rail, drawer, tab bar entries per
role, no duplicate link names), `LoginPage.test.tsx`; the **whole smoke suite green**; by eye at 390: the drawer,
the tab bar, no horizontal scroll on any current screen.

**0.6 Scanning on a phone over HTTPS in dev — dropped** (the user, 2026-10-05: no real-phone camera tests; no
nginx 443 block, no new port). What it was: `CameraScanner` is already in 0.4; this step makes it testable on a
real phone: `docker/nginx/default.conf` gains a second `server { listen 443 ssl; }` block with a self-signed
certificate generated once by `docker/nginx/entrypoint.sh` (openssl, into a named volume) and `docker-compose.yml`
publishes `${HTTPS_PORT:-8443}:443` (`.env.example` documents it; `gate.d/compose-cpus` unchanged, no new service).
Android: alternatively `adb reverse tcp:8080 tcp:8080` makes `http://localhost:8080` a secure origin on the phone.
iPhone: Safari needs the HTTPS port (trust the certificate once in Settings). `README.md` "Running it locally" gets
these three lines. *Verify:* `/admin/_kit` on an Android phone and an iPhone over `https://<host-ip>:8443`: the
camera opens after the tap, a printed Code 128 label and a QR code are read, the torch toggle appears where the
phone has one, the typed fallback works with the camera closed; on `http://<host-ip>:8080` the component explains
that the camera needs a secure address and shows the typed input only.

**0.7 Regression suite, docs, ownership stubs.** `docs/tests/ui-regression.md`: section `10. Design system (DS)`
with DS-01 – 14 (below), AUTH-07 – 08 and NAV-04 – 06 in section 1, and **one stub subsection per item** in the
existing sections with the item's new ID range and a comment naming the owner ("<!-- Item 1 (products-ui) adds
INV-17 – 22 -->"), so no two items add a heading at the same place; `e2e/design-system.spec.ts` (the smoke part of
DS, with `test.use({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true})` inside its phone
`describe`); `docs/design/README.md` (tokens, which component when, SlideOver vs page, copy rules, the glossary,
licences, how to test the camera); `README.md` gets a "Design system" paragraph and the known gaps of this PRD.
*Verify:* `split.py plan docs/pdr/prd-redesign.md` prints the waves; `gate.sh`; `dod.py --quick`; the whole smoke
suite (now with `design-system.spec.ts`) green on the base branch — the commit the items are cut from.

### Ownership (who may edit what; an item that needs another's file stops and reports a missed dependency)

| Files | Owner |
|---|---|
| `app/**` (routes.tsx, providers, styles), `shared/**` (ui, lib, api, config except `roles.ts`, i18n machinery and the `common, nav, auth, errors` catalogues in both languages, test), `widgets/app-shell/**`, `entities/session/**`, `pages/{login,logout,not-found,kit}/**`, `templates/spa.html.twig`, `public/favicon.*`, `public/apple-touch-icon.png`, `public/images/kf-mark.svg`, `package.json` + lock, `webpack.config.js`, `vitest.config.mts`, `playwright.config.ts`, `eslint.config.mjs`, `docker/nginx/**`, `docker-compose.yml`, `.env.example`, `e2e/support/**`, `e2e/auth.spec.ts`, `e2e/design-system.spec.ts`, `docs/design/**`, `docs/tests/ui-regression.md` sections 1 and 10 and every stub heading, `CLAUDE.md`, `README.md` | 0 |
| `shared/i18n/locales/{en,es}/<prefix>.json` | the item of the prefix: `products` → 1; `stock` → 2; `orders` → 3; `orderForm`, `gettingReady` → 4; `customers`, `address` → 5; `invoices` → 6; `users`, `roles` → 7 |
| `entities/product/**`, `entities/warehouse/**` | 1 (items 2, 4, 6 import their public API only) |
| `entities/order/**` | 3 (item 4 imports only) |
| `entities/customer/**`, `entities/location/**`, `widgets/address-form/**` | 5 (items 4, 6 import only) |
| `entities/invoice/**` | 6 |
| `entities/user/**`, `shared/config/roles.ts` | 7 |
| A page/widget/feature slice | the item in whose row it is listed, and no other |
| `e2e/<area>.spec.ts` | the item whose screens it drives (table below); `orders-sync.spec.ts` and `webhook.spec.ts` are API-only and nobody edits them |
| `docs/tests/ui-regression.md` | each item fills its own stub subsection and updates the texts of its existing cases; nothing else |
| CSS | each slice keeps its own `ui/<slice>.css` using tokens only; `shared/ui/styles/*` is item 0's |

### Regression cases of item 0 (section 10, DS)

DS-01 shell at 1440: mark, "KF Inventory", the person's name, skip link first on Tab (smoke) · DS-02 the sidebar
collapses to a rail and stays collapsed after a reload (smoke) · DS-03 at 390: the Menu button opens the drawer,
the tab bar shows the role's entries, `document.documentElement.scrollWidth === clientWidth` on the products,
orders and scan screens (smoke part; by hand: looks right) · DS-04 focus ring visible on buttons, links, inputs,
rows (manual) · DS-05 the tab title follows the page ("Orders · KF Inventory") (smoke) · DS-06 the language switch
to ES changes the shell and the page, keeps the URL and the table's rows, survives a reload; back to EN (smoke) ·
DS-07 theme Dark sets `data-theme="dark"`, survives a reload; System follows `prefers-color-scheme` (smoke via
`emulateMedia`; by hand: no flash, colours) · DS-08 a toast appears for 5 s with `role="status"`, an error toast
stays until dismissed (smoke, on `/admin/_kit`) · DS-09 no raw key on any screen in Spanish, light and dark
(manual, after the barrier) · DS-10 camera permission asked only after the tap; denied → the explanation and the
typed input (covered by `CameraScanner.test.tsx` with a fake detector; not run by hand) · DS-11 a camera read
lands in the list, the same label held still is counted once, tone and vibration (covered by
`CameraScanner.test.tsx` with a fake detector; not run by hand) · DS-12 Lighthouse accessibility ≥ 95 on every screen, both themes (manual) ·
DS-13 sign-in: show password, Caps Lock hint, the error inline (smoke part) · DS-14 not-found page is branded with
the way back (smoke). AUTH-07 the sign-in page in Spanish (smoke) · AUTH-08 the name in the top bar and "Sign out"
in the menu (smoke) · NAV-04 the rail shows icons with tooltips (manual) · NAV-05 the tab bar for the inventory
clerk: Products, Scan, Incoming, More (smoke, 390) · NAV-06 the "Scan" shortcut only for inventory roles (smoke).

## Split

| # | Slug | Item | Owns (context / slice, files) | Tests first | Browser cases | Depends on | Model |
|---|---|---|---|---|---|---|---|
| 0 | contract | Tokens (light + dark), fonts, brand, kit, camera scanner, shell, sign-in, EN/ES catalogues of every current key, formatting, dev HTTPS, regression section 10 and the stubs | `app/**`, `shared/**` (incl. `locales/{en,es}/{common,nav,auth,errors}.json`), `widgets/app-shell`, `entities/session`, `pages/{login,logout,not-found,kit}`, `templates/spa.html.twig`, `public/favicon.*`, `public/apple-touch-icon.png`, `public/images/kf-mark.svg`, `package.json`, `docker/nginx/**`, `docker-compose.yml`, `.env.example`, `e2e/support/**`, `e2e/auth.spec.ts`, `e2e/design-system.spec.ts`, the shell-label locators in the other specs, `docs/design/**`, `docs/tests/ui-regression.md` (sections 1, 10, stubs), `CLAUDE.md`, `README.md` | kit components' Vitest (Button, DataTable card roles/row menu/selection bar, SlideOver focus trap, Toast live region, ScanInput keeps focus, CameraScanner with a fake detector), `tokens.test.ts` (contrast both themes, no hex outside tokens), `i18n.test.ts` (key parity en/es), `format.test.ts` (en-US/es-CO money and dates), `AppShell.test.tsx`, `LoginPage.test.tsx` | AUTH-07 – 08, NAV-04 – 06, DS-01 – 14 | — | — |
| 1 | products-ui | Product list (toolbar, chips, KPIs, row menu, selection bar, card mode), product form, move SlideOver | `pages/products`, `pages/product-form`, `widgets/stock-table`, `features/move-stock`, `features/download-stock-sheet`, `entities/product`, `entities/warehouse`, `locales/{en,es}/products.json`, `e2e/products.spec.ts` (INV-01 – 08 updated) | `StockTable.test.tsx` (chips filter, KPIs computed, selection bar, row menu, `?warehouse=` and remembered warehouse), `MoveStock.test.tsx` (SlideOver, same body), `ProductForm.test.tsx` (sections, action bar, toast with the two links) | INV-17 – 22 | 0 | sonnet |
| 2 | warehouse-ops-ui | Scan screen (warehouse + mode first, camera + typed input, running list, undo, footer), Incoming, Upload steps, Warehouse cards | `pages/barcode-reader`, `pages/incoming-stock`, `pages/products-upload`, `pages/warehouses`, `features/{scan-stock,approve-incoming,upload-products,rename-warehouse}`, `locales/{en,es}/stock.json`, `e2e/stock.spec.ts` (INV-09 – 16, WH-01 – 03 updated) | `ScanStock.test.tsx` (mode and warehouse stick, camera read → row with title, same code increments, undo last, unknown code inline, Add one tap / Remove confirms, focus returns), `ApproveIncoming.test.tsx` (count in the label, confirm names units), `UploadProducts.test.tsx` (steps, dropzone type check, summary with the `stored` count and the warehouse link), `Warehouses.test.tsx` (cards, inline rename, urls shown) | INV-23 – 30, WH-04 – 05 | 0 | opus |
| 3 | orders-ui | Orders list (chips with counts, date range, status menu + confirm, row menu, card mode), order detail SlideOver, sync as a labelled button | `pages/orders`, `widgets/order-table`, `widgets/order-detail`, `features/{change-order-status,delete-order,sync-orders,edit-order-comments}`, `entities/order`, `locales/{en,es}/orders.json`, `e2e/orders.spec.ts` (ORD-01 – 10 updated) | `OrderTable.test.tsx` (counts per status, date range, search, row menu by role, card roles), `OrderStatusMenu.test.tsx` (confirm then POST; Sent navigates), `OrderDetail.test.tsx` (sections, actions, comments inline), `SyncOrders.test.tsx` (toast) | ORD-21 – 28 | 0 | opus |
| 4 | order-forms-ui | Order form (two aligned columns, lines table, missing-fields action bar), getting ready (camera + scan input, progress rows, inline refusals, Ship action bar) | `pages/order-form`, `pages/order-getting-ready`, `features/record-partial`, `locales/{en,es}/{orderForm,gettingReady}.json`, `e2e/order-forms.spec.ts` (ORD-11 – 18, MAIL-01 – 02 updated) | `OrderForm.test.tsx` (missing list, highlight on click, lines table, lock explained), `RecordPartial.test.tsx` (progress per row, inline refusals keep focus, warning when stock is short, ship label with count) | ORD-29 – 34 | 0, 1, 3, 5 | opus |
| 5 | customers-ui | Customers list (card mode, pager, "Search this page"), customer form (sections, address cards), address widget restyled | `pages/customers`, `pages/customer-form`, `widgets/address-form`, `features/delete-customer`, `entities/customer`, `entities/location`, `locales/{en,es}/{customers,address}.json`, `e2e/customers.spec.ts` (CUS-01 – 06 updated) | `Customers.test.tsx` (columns, row menu, subtitle range, card roles), `CustomerForm.test.tsx` (sections, action bar), `AddressForm.test.tsx` (cards, type label, add/remove, kf-select styles) | CUS-07 – 10 | 0 | sonnet |
| 6 | invoices-ui | Invoices list + SlideOver (Money, filters), invoice form (document layout, lines table, totals) | `pages/invoices`, `pages/invoice-form`, `widgets/invoice-detail`, `features/add-all-products`, `entities/invoice`, `locales/{en,es}/invoices.json`, `e2e/invoices.spec.ts` (INVC-01 – 06 updated) | `Invoices.test.tsx` (Money column, date/customer filters, SlideOver), `InvoiceForm.test.tsx` (lines table, totals as Money, testids kept, action bar) | INVC-07 – 11 | 0, 1, 5 | sonnet |
| 7 | users-ui | Users list with plain role chips, user form with grouped, described roles | `pages/users`, `pages/user-form`, `entities/user`, `shared/config/roles.ts`, `locales/{en,es}/{users,roles}.json`, `e2e/users.spec.ts` (USR-01 – 06 updated) | `UsersPage.test.tsx` (role chips by plain name, row menu), `UserForm.test.tsx` (groups, descriptions, the admin note, action bar) | USR-07 – 09 | 0 | sonnet |

Waves (what `split.py plan` prints): 1 → {1, 2, 3, 5, 7}; 2 → {4, 6}. Run at most four stacks at once: start 1, 2,
3, 5 together and 7 when the first of them is merged (`split.py start <prd> users-ui`). Every item updates the
smoke spec of its screens (labels, roles, dialogs → slide-overs, confirms) keeping the case IDs and the case
semantics, and writes its new cases in its ID range (the simple ones as smoke tests in the same spec file). An item
never runs the suite; the coordinator runs it once at the barrier.

## Decisions

1. **Bootstrap 4 stays**; tokens are CSS custom properties; the kit is ours. A later move to Bootstrap 5 is easier
   afterwards, not part of this.
2. **One accent (KF olive)**; danger only for destructive actions (delete, remove stock); Cancel and Close are never
   red; link text uses `--kf-accent-hover` (the plain accent is 4.51:1 on the page background, too close to the
   line).
3. **SlideOver for details and quick edits (order detail, move stock, invoice detail), pages for create/edit forms**,
   `ConfirmModal` for destructive or state-changing actions (delete, remove stock, approve all, change status).
   **No Undo in toasts**: undoing a status change would write another history row and "Sent" is not reversible;
   confirming first is the safeguard. Adding scanned stock is one tap (the button names the warehouse and the units;
   the warehouse and mode are chosen first); removing confirms.
4. **Lists: at most one visible row action**; the rest in "⋯". Row click opens the detail (orders, invoices) or the
   edit form (products, customers, users). Card mode is CSS with explicit table roles so locators work at 390 px.
5. **Fonts self-hosted** (`@fontsource-variable/geist`, `@fontsource-variable/geist-mono`, OFL-1.1; no CDN,
   offline warehouses). No `<link rel=preload>` (Encore hashes the file names); `font-display: swap`.
6. **Theme before paint:** an inline script in `spa.html.twig` (there is no CSP today — README known gaps — so an
   inline script is allowed; if a CSP is added later it gets a nonce). Keys: `kf.theme` (`light|dark|system`),
   `kf.locale`, `kf.warehouse`, `kf.scanMode`, `kf.sound`, `kf.sidebar`; every read/write in try/catch; per browser,
   not per user (no API change).
7. **Languages:** `en` and `es`, formatted as `en-US` and `es-CO` (Colombia is the company's base and the server's
   time zone); currency USD, `Intl` chooses the symbol (`$` / `US$`) and separators. Catalogues are **one JSON file
   per prefix per language** so no two items edit one file (the restructure's `en.json` conflicts); a Vitest test
   keeps the two languages' keys identical, so an item that adds a key in `en/products.json` must add it to
   `es/products.json` in the same commit. Item 0 translates everything that exists today; each item translates
   what it adds, using the glossary. The smoke specs run in English because Playwright's context has
   `locale: 'en-US'` and no `kf.locale`; DS-06/AUTH-07 switch inside their own context, which is discarded.
8. **Screens keep their routes and roles;** the smoke suite's case IDs stay; their locators follow the new labels.
   Item 0 edits the shell-owned locators in every spec so the suite is green before wave 1; items edit only their
   own spec afterwards.
9. **Camera scanning:** native `BarcodeDetector` when present and it supports the formats (Chrome on Android),
   otherwise `@zxing/browser` (pure JS, no WASM, no CDN; rejected: `barcode-detector`/zxing-wasm, which fetches a
   WASM file from jsDelivr by default, and `html5-qrcode`, unmaintained). The ZXing chunk is loaded only when the
   camera starts. Formats: CODE_128, CODE_39, EAN_13, EAN_8, UPC_A, QR_CODE. The camera needs a secure origin:
   production serves HTTPS (cPanel AutoSSL; confirmed by the user); no dev HTTPS port (0.6 dropped): on plain
   `http://<host-ip>` the component says the camera needs a secure address and offers the typed input.
10. **Dependencies added by item 0 only:** `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`,
    `@zxing/browser`, `@zxing/library`. Items add none.
11. **Figures are computed from the loaded lists** (counts per status, units, stock value, incoming totals,
    pager ranges); nothing is requested that a screen did not already request, with one exception that is still
    today's API: none. The order detail no longer calls the partials endpoint (dropped: it would be a second request
    for a figure the detail does not need).
12. **Refusals on the scan screens are inline, not modals**, so the scanner keeps focus; the getting-ready rules
    (`features/record-partial/model/shipment.ts`) do not change.
13. **Models.** 2, 3 and 4 are `opus` (device APIs and real client state; menus with confirms and a slide-over
    with actions; a form with a computed missing-fields list and a scanning screen). 1, 5 and 6 are `sonnet`: list
    and form screens rebuilt on the kit with the logic already written. 7 is `sonnet`, not `haiku`: it rebuilds
    two screens test-first and rewrites a spec, more than a rename (an agent that fails the gate twice is relaunched
    one model up, §2b.4).
14. **`PageCard`, `Loader`, `Modal`, `ConfirmModal`, `Field` keep their names**; `LegacyScreen` is deleted in item 0.
15. The "What changed" note for the warehouse staff is a dismissible one-line banner on the Scan screen
    (`kf.scanIntroSeen`), item 2 — presentation only, no dates.

## Risks

- **Muscle memory:** the barcode reader changes most (warehouse first, one-tap add). Mitigation: same route, same
  keys (Enter adds), the dismissible note, the typed input always visible under the camera.
- **Smoke specs** select by labels and roles; every renamed label breaks a spec. Mitigation: the glossary is fixed
  in item 0; item 0 updates the shell's locators and runs the whole suite green; each item updates its own spec in
  the same branch; the coordinator runs the suite once at the barrier.
- **Playwright strict mode** fails on duplicate link names: the shell renders one navigation at a time (Decision
  in "Shell"), and `AppShell.test.tsx` asserts there is one link per entry.
- **Camera support varies:** `BarcodeDetector` only on Chrome/Android; ZXing's decode rate on low-light labels is
  lower; iOS Safari needs HTTPS. The typed input is always there; DS-10/11 are covered by `CameraScanner`'s tests with a
  fake detector (no real-phone run, the user's decision).
- **Bundle size:** two variable fonts (~90 KB woff2 each) and the ZXing chunk (~300 KB, lazy). Checked in 0.1.
- **Dark mode on Bootstrap 4:** Bootstrap has no dark theme; the overrides cover the components the app uses. The
  kit page in dark is the checklist; anything missed shows up in DS-09/12.
- **Translation quality:** item 0 and the items write the Spanish; the translations are final (no native
  review, the user's decision); a Spanish proofreading pass runs at the barrier.
- **Logo resolution:** the reference is a 180 px PNG; the traced SVG is close, not exact, until a vector arrives.
- **Merge conflicts in `docs/tests/ui-regression.md`:** every item edits it. Mitigation: item 0 writes the stub
  subsections so items change different, non-adjacent blocks; the coordinator resolves the rest while merging.

## Open questions for the user

1. **Four WooCommerce shops, one set of sync keys** (recorded, out of scope). The webhook already receives every
   shop's orders, but "Sync shop orders" (`WOO_COMMERCE_URL/_API_KEY/_API_SECRET`) pulls from one shop only. Making
   it pull all four is logic and belongs to a separate small PRD, or it stays as it is.

## Acceptance

`dod.py` green; `npm test` includes the contrast, key-parity and no-hex tests; the whole smoke suite green with the
updated specs plus `design-system.spec.ts`; a manual run of the DS-* and the items' new cases at 1440 and 390 px,
in English and Spanish, light and dark; DS-10/11 by `CameraScanner`'s tests (no real-phone run, the user's
decision); Lighthouse accessibility ≥ 95 on every screen (DS-12); the before/after screenshots of every screen in
`docs/design/after/` next to `docs/design/audit/`.

### Critical Files for Implementation
- /home/sbarbosa/Development/kf-inventory-redesign/backend/assets/react/shared/ui/DataTable.tsx (the table every list is built on: row menu, selection bar, skeleton, card mode with explicit roles)
- /home/sbarbosa/Development/kf-inventory-redesign/backend/assets/react/widgets/app-shell/ui/AppShell.tsx (sidebar/rail, drawer + tab bar, top bar with language and theme; renders one navigation at a time)
- /home/sbarbosa/Development/kf-inventory-redesign/backend/assets/react/shared/i18n/i18n.ts (second locale, per-prefix catalogues, locale detection and persistence; the key-parity test next to it)
- /home/sbarbosa/Development/kf-inventory-redesign/backend/templates/spa.html.twig (theme-before-paint script, color-scheme meta, favicon and apple-touch-icon links)
- /home/sbarbosa/Development/kf-inventory-redesign/backend/e2e/support/test.ts (the fixtures every spec uses; `signedInAs` contexts carry the English locale and fresh localStorage, which is what keeps the toggle out of the suite)
