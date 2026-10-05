# Redesign: KF Inventory's look, layout and UX

<!--
    PRD for docs/pdr/prd-redesign.md. Base branch feature/redesign (from origin/main). Written 2026-10-05 from an audit
    of main at d1a50fc (the restructure): every screen opened in the browser at 1440 px and at 390 px, the code of
    backend/assets/react read. Screenshots of today's screens: docs/design/audit/.
    `split.py plan` reads the table under "## Split".
-->

## What it is for

The people who use KF Inventory every day: the **warehouse staff** (stock, barcode reader, incoming, getting orders
ready, often standing, often with a scanner or a phone), the **sales office** (orders, customers, invoices, at a
desk) and the **admin** (users, warehouses). Today the app is the old SB Admin look carried over screen for screen:
it works, but every action is the same green, rows carry six identical icon buttons, the warehouse screens are not
built for scanning, and on a phone the menu covers the first screen of every page.

The job of this redesign: **the same app, faster to read and safer to operate.** One visual system built from the KF
brand, screens organised around the job each person does there, clear states (loading, empty, error, saved), and a
layout that works on a phone or handheld at the shelf. No route, role, API contract or database change.

## Goals and how we will know

| Goal | Measure (checked in the regression run) |
|---|---|
| Fewer mistakes on destructive or state-changing actions | Delete, status change and "Approve all" always confirm or are undoable; no destructive action shares a colour with a safe one |
| Faster warehouse work | A scan registers with visible + audible feedback in < 100 ms; the warehouse is chosen once and remembered; the scan field keeps focus |
| Everything usable on a 390 px phone | No horizontal page scroll on any screen; lists become cards; menu is a drawer |
| One consistent look | Every screen built from the shared kit (`@/shared/ui`); no screen-local button or table styles |
| Accessible | Lighthouse accessibility ≥ 95 on every screen; visible focus everywhere; WCAG AA contrast |
| Feels quick | Skeletons instead of spinners; first content of a list page < 1 s on the production build |

## Non-goals

- No change to routes, roles, the API (`/api/v1`), the database or the PDFs/emails (their redesign is a later PRD).
- **Bootstrap 4 stays** (no Tailwind or component-library migration): the redesign is a token layer and our own
  components on top of it.
- No marketing-site effects (grain, parallax, scroll-driven animation): this is an operations tool used for hours.
- No dark mode in this round (see Open questions).

---

## Audit: what is wrong today

Severity: **H** hurts the work or causes mistakes, **M** slows people down or looks broken, **L** polish.

### Global (every screen)

| # | Sev | Finding | Evidence |
|---|---|---|---|
| G1 | H | **One colour means everything.** `btn-success` green is used 36 times: create, edit, detail, download, approve, save, "add" (+). Red is used both for delete and for Cancel/Close. Colour carries no meaning, so it cannot warn. | all screenshots |
| G2 | H | **Phone layout is broken.** Under 768 px the sidebar stacks open above the page and fills the whole first screen; tables overflow sideways; product codes wrap mid-word (`KF-`/`01`). | `phone-390.jpg` |
| G3 | M | **No visual system.** Bootstrap 4 defaults (system font, `#007bff` blue, `#28a745` green, 4 px radius everywhere) plus 175 lines of screen CSS; no tokens for colour, type, spacing, elevation or z-index. | `assets/react/**/*.css` |
| G4 | M | **No brand.** The header says "Inventory" in plain text; the KF logo (olive green, `public/images/logo.jpeg`) appears only in the PDFs; the favicon is the old generic one; every tab is titled "KF Inventory". | `desktop-login.jpg` |
| G5 | M | **Icon-only buttons with no visible label** (edit, XLS, PDF, remaining PDF, delete, sync, +/−). They have `aria-label`s, but sighted users must hover or guess. | `desktop-orders.jpg` |
| G6 | M | **Spinners everywhere** (17 `Loader` uses), then the content jumps in. The shell, then the session, then the page chunk, then the data load one after another (≈2 s on dev). | browser timing |
| G7 | M | **Wide screens are wasted, narrow content is stretched.** Forms span the full 1,300 px (a 1,000 px wide "Price" input); lists sit in a card at the top with empty space below. No max-width. | `desktop-product-form.jpg` |
| G8 | M | **Inconsistent form actions:** small Save/Cancel at the left (product, user), full-width red Cancel + green Save (customer, invoice, getting-ready), Update with a paragraph of hint (order). | form screenshots |
| G9 | M | **Feedback is inconsistent.** Success messages are alerts at the top of the list page (sometimes), errors are alerts in different places, nothing confirms "saved" in place, no toast. | — |
| G10 | M | **Numbers and money are unformatted:** `100.00` with no currency, no thousands separator, proportional digits so columns do not line up; money built with `toFixed(2)`. | `desktop-invoices.jpg` |
| G11 | L | **Copy:** title case and generic titles ("View products", "View Orders", "View Users"), jargon ("Consecutive", "Aggregate Partials", "Rol"), raw role constants (`ROLE_MANAGE_INVENTORY`) shown to users. | `desktop-users.jpg` |
| G12 | L | **Accessibility gaps:** no skip link, no per-page `<title>`, the browser's default focus only, status shown by row tint alone (getting-ready), `table-sm` rows ~28 px high (below a 44 px touch target). | code |

### Screen by screen

| Screen | Sev | Findings |
|---|---|---|
| Sign in | M | A 240 px card in an empty grey field; no logo or product name; the disabled "Log In" looks broken (pale blue); no "show password"; no Caps Lock hint. |
| Product list | H | Warehouse is a full-width select; the three actions look identical and disabled ones are just faded green; "Warehouse" column repeats the filter; "Description" empty for most rows; the only row action is an unlabelled green icon; no total stock or stock value; no low-stock signal; selection count hidden. |
| Product form | M | Full-width inputs; a warning that the product "won't be shown until you add quantities using Excel" instead of letting the person enter the first stock; no live preview of what the list will show. |
| Upload | M | One run-on sentence with the two download buttons inside it; browser-default file input; the steps (download → fill → upload) are not shown as steps; the result is one line. |
| Barcode reader | H | The core warehouse tool: a 150 px input, the warehouse chosen **after** scanning (easy to add stock to the wrong one), no sound or flash per scan, no running total, no undo of the last scan; Add/Remove share one row with equal weight. |
| Incoming | M | Only "Approve all", no per-row approve, no count in the button ("Approve 12 products"), no confirm; empty state is one grey line. |
| Warehouses | L | A three-row table with a "#" column; editing opens a modal for one field; no stock count or orders per warehouse. |
| Orders list | H | Seven buttons per row (detail + five green icons + red delete); status is a bare `<select>` that changes the order on one click and has no colour; the order number is the 4th column and the comments button the 1st; no counts per status; the Sync button is an icon; "Created Date" without time. |
| Order detail | M | A modal with a dense paragraph of facts ("Source: Phone Status: Partial Customer: …"); a red **Close**; products and comments in tabs although both are short; no way to act (status, edit, ship) from where the information is. |
| Order form | M | Two columns that do not align; product rows without column headers; "Consecutive"; the warehouse locks silently; a long hint sentence explains why Update is disabled instead of marking the missing fields. |
| Getting ready | H | Every row starts tinted red (alarming before anything happened); "25 / 25" and "Aggregate Partials" need explaining; stock shown as a teal button that is not a button; full-width red Cancel equal to Save; scan input small. |
| Customers | L | Edit/delete as unlabelled icons; no order count or last order; the list is server-paged but shows no total. |
| Customer form | M | Address block offset by a floating green "+"; full-width red Cancel; Country/State/City order is fine but the City field sits alone. |
| Invoices list | M | "Invoice Detail" green button + unlabelled PDF icon; totals without currency; no filter by date or customer. |
| Invoice form | M | Line items have no column headers (product, qty, price, discount); totals small and right-aligned far from the lines; tax as a select of "0% / 6%" without saying what tax; full-width red Cancel; NIT field hidden although customers may ask for it on the invoice. |
| Users | M | Raw role constants as blue pills; "Rol"; the form lists nine role checkboxes with no explanation of what each grants. |

---

## Design direction

**An operations tool that is calm, legible and quick to scan.** Neutral surfaces, one accent from the KF brand, colour
only where it means something (status, danger), generous row height, tabular numbers, and the action a person most
likely wants made the most visible thing on each screen.

### Tokens (`shared/ui/tokens.css`, CSS custom properties, mapped onto Bootstrap's classes)

**Colour.** Contrast checked for every pair below (white on accent 5.1:1, muted on white 5.8:1, white on danger 6.6:1). One cool-neutral grey family and one accent taken from the logo's olive green (desaturated for UI).

| Token | Value (proposal) | Use |
|---|---|---|
| `--kf-bg` | `#f6f7f5` | page background (a warm-neutral off-white instead of `#f8f9fa`) |
| `--kf-surface` | `#ffffff` | cards, tables, panels |
| `--kf-surface-sunken` | `#eef0ec` | table header, toolbar, inputs' read-only state |
| `--kf-border` | `#dfe3dc` | 1 px dividers |
| `--kf-text` | `#1d2420` | body text (not pure black) |
| `--kf-text-muted` | `#5d6862` | secondary text, ≥ 4.5:1 on white |
| `--kf-accent` | `#4f7a28` | primary actions, active nav, focus ring (KF olive, AA on white with white text) |
| `--kf-accent-hover` / `--kf-accent-soft` | `#42681f` / `#e8f0df` | hover; selected rows, active nav background (text on it uses `--kf-accent-hover`: the base accent is only 4.3:1 there) |
| `--kf-danger` | `#b42318` | destructive only (delete, remove stock) |
| `--kf-warning` | `#b54708` | needs attention (low stock, partial) |
| `--kf-info` | `#1f5f8b` | informational status |
| `--kf-sidebar` | `#1b211d` | the shell's sidebar (off-black, slightly green) |

Status colours (badges and row accents, always with a text label, never colour alone): Created = neutral, Processed =
info, Partial = warning, Completed = accent, Sent = info-strong, Delivered = accent-strong; Incoming = warning; Active /
Inactive product.

**Type.** **Geist** for UI text and **Geist Mono** for codes, SKUs and order numbers (both OFL, self-hosted woff2 in
`shared/ui/fonts`, no CDN). `font-variant-numeric: tabular-nums` on every number column and total. Scale (rem): 0.75
label / 0.875 body-sm (tables) / 1 body / 1.125 / 1.375 page title / 1.75 KPI. Weights 400 / 500 / 600 (no 700 except
KPIs). Sentence case everywhere; small uppercase only for the sidebar group labels (with +0.06 em tracking).

**Space, shape, depth.** 4 px spacing scale (4, 8, 12, 16, 24, 32, 48). Radius: 6 px inputs and buttons, 10 px cards and
panels, 999 px only for status badges. One elevation for floating things (drawer, menu, toast, dialog), tinted with the
sidebar hue instead of black; cards have a border, not a shadow. A z-index scale (dropdown 100, sticky 200, drawer 300,
dialog 400, toast 500) replaces Bootstrap's ad-hoc values.

**Motion.** 150 ms ease-out for hover/press, 200 ms for drawers and dialogs, `transform`/`opacity` only;
`prefers-reduced-motion` turns them off. Buttons press to `translateY(1px)`.

### Component kit (`@/shared/ui`, extended)

| Component | What changes |
|---|---|
| `Button` (new) | Variants with fixed meaning: **primary** (accent, one per view), **secondary** (neutral outline), **ghost** (text, for row actions), **danger** (destructive only). Sizes sm/md/lg (lg = 48 px for the warehouse screens). Loading state with spinner inside, keeps width. Icon + label by default; icon-only only with a tooltip. |
| `PageHeader` (new) | Title (sentence case), optional subtitle/count, primary action on the right, secondary actions in a "More" menu; replaces `PageCard`'s header. |
| `Toolbar` / `FilterBar` (new) | Warehouse as a segmented control or compact select, status filter as chips with counts, search with a clear button, "Clear filters". Sticky under the header. |
| `DataTable` | 44 px rows (52 px in "comfortable"), sticky header, numeric columns right-aligned + tabular, row click opens the detail, **row actions in a single "⋯" menu** plus at most one visible primary row action, selection bar that appears with "N selected" and the bulk actions, skeleton rows while loading, card layout under 600 px. |
| `StatusBadge` (new) | Text + colour + optional icon, one map per domain (order status, stock status). |
| `Money` / `Quantity` (new) | `Intl.NumberFormat` with the currency (USD? COP? see Open questions) and thousands separators, tabular, negative in danger colour. |
| `SlideOver` (new) | A right-hand panel for details and quick edits (order detail, warehouse rename, invoice detail) instead of centred modals; keeps the list visible. |
| `ConfirmDialog` | Names the thing and the consequence ("Delete order W00004? Its products and comments go too."), danger button for destructive confirms, Escape cancels. |
| `Toast` (new) | Bottom-right (bottom on phones), 5 s, for "saved", "moved", "deleted" (with **Undo** where the API allows it: comments, status change); errors stay until dismissed. |
| `Field` + `FormLayout` (new) | Max 720 px wide forms in sections with a heading and a one-line description; two-column grid ≥ 1024 px; inline errors under fields; a **sticky action bar** at the bottom (primary right, Cancel as secondary/ghost, never red). |
| `Skeleton` (new) | Shapes matching tables, cards and forms; replaces `Loader` for page loads (keep the spinner for in-button actions). |
| `EmptyState` | Icon, one sentence of what this list is, the primary action ("Upload your first stock sheet"), and "Clear filters" when filters hide everything. |
| `ScanInput` (new) | Large (48 px) autofocused input with a scan icon, keeps focus after every scan, flashes the row it changed, plays a short tone (on/off in the header), debounces scanner bursts. |
| `KpiStrip` (new) | 3–4 numbers at the top of a list (e.g. orders by status, stock units, stock value). |

### Shell and navigation

- **Brand:** the KF mark (cleaned SVG of `logo.jpeg`) + "KF Inventory" in the sidebar; the favicon from the same mark.
- **Sidebar** (desktop ≥ 1024 px): 240 px, collapsible to a 64 px icon rail (remembered); groups "Warehouse"
  (Products, Upload, Barcode reader, Incoming, Warehouses), "Sales" (Orders, Customers, Invoices), "Admin" (Users).
  Products' sub-pages become first-level entries (no dropdown inside the sidebar). Active entry: accent bar + soft
  background.
- **Tablet/phone (< 1024 px):** the sidebar becomes a drawer behind a menu button; a **bottom tab bar** with the 3–4
  entries the person's roles reach most (warehouse: Products, Scan, Incoming; sales: Orders, Customers, Invoices).
- **Top bar:** page title (on phones), the person's **name** and role summary instead of the email, a menu with
  Sign out; a global "Scan" shortcut for warehouse roles.
- Per-page `<title>` ("Orders · KF Inventory"), a skip link, the session check and the page chunk loaded in parallel
  (prefetch the chunk of the route being opened), and the last warehouse chosen remembered per person
  (`localStorage`, try/catch).

---

## Screen proposals

Every screen keeps its route, data and roles. IDs refer to the audit above.

1. **Sign in** — split layout on desktop: the KF mark and "KF Inventory" on an olive panel left, the form right;
   single column on phones. Show/hide password, Caps Lock hint, the error inline above the button, primary button
   always full colour (disabled state only while signing in). (G4)
2. **Product list** — `PageHeader` "Products" with "Create product"; `Toolbar` with warehouse (remembered), search,
   status chips (In stock / Low / Out); `KpiStrip`: products, units, stock value. Table: Code (mono), Title, Detail
   (truncated, tooltip), Quantity (with a low-stock badge under a threshold), Price, ⋯ (Edit, Download row). The
   "Warehouse" column goes (it is the filter). Selecting rows shows a selection bar: "3 selected · Move to warehouse ·
   Download as Excel · Clear". Move opens a `SlideOver`, not a modal. (G1, G5, G7)
3. **Product form** — `FormLayout` 640 px: "Product" section (code, title, detail, price, status as a switch), and a
   new optional "First stock" section (warehouse + quantity) so the product appears in the list at once — **needs an
   API decision** (today stock comes only from Excel or the barcode reader); without it, replace the warning with a
   clear next step ("Add its stock with the barcode reader or a stock sheet"). Sticky Save bar. (G7, G8)
4. **Upload** — three numbered steps: 1 Download the template (or every product) · 2 Fill in the quantities · 3 Drop
   the file here (drag-and-drop zone with the file name, size and type check) + warehouse. The result as a summary
   card: "48 products stored in Usa · 3 new products · 2 rows skipped (no code)" with a link to the list filtered to
   that warehouse. (G9)
5. **Barcode reader (scan mode)** — the warehouse screen redesigned for the shelf: step 1 choose the warehouse and
   the mode (**Add** / **Remove**, a large segmented control, Remove in danger colour) — both stick until changed; step
   2 the `ScanInput` with a running list where the last scanned row flashes and moves to the top, each row with
   product title, count stepper and a remove ×; a sticky footer "12 items · 37 units · Add to Colombia" (primary,
   48 px); "Undo last scan" with Ctrl+Z. Unknown codes show inline in danger with "Not a product" and do not block.
   Full-width on phones with the footer above the bottom bar. (H)
6. **Incoming** — header "Incoming in Usa · 12 products · 40 units"; per-row checkbox and "Approve" + a primary
   "Approve all (12)" with a confirm that states the total; approved rows animate out; empty state "Nothing waiting —
   products moved here from another warehouse show up here". (G1, G9)
7. **Warehouses** — cards instead of a 3-row table: name, number of products in stock, units, open orders, the shop
   addresses that send WooCommerce orders; rename inline (click the name), no modal. (G7)
8. **Orders list** — `KpiStrip` / status chips with counts ("Created 4 · Processed 2 · Partial 3 · Sent 1"), a
   warehouse switch, search by code or customer, date range. Columns: Order (mono, bold, links to the detail),
   Customer (name, email under it in muted), Source (icon + label), Status (`StatusBadge`), Created (date + time),
   Comments (count icon), ⋯ (Edit, Getting ready, PDF, Remaining PDF, Excel, Delete). Changing status moves to the
   detail panel (or a status menu with a confirm for Sent/Delivered), not a bare select in the row. Sync becomes a
   labelled secondary button "Sync shop orders" with the last-sync time. Row click opens the detail `SlideOver`.
   (G1, G5, H)
9. **Order detail (`SlideOver`)** — header: order code, status badge, source, created; actions at the top: change
   status, Edit, Getting ready, Documents (PDF, remaining, Excel); sections instead of tabs: Customer (with address),
   Products (table with ordered / shipped / pending), Comments (thread with author and date, add inline), History
   (status changes from `order_status`, read-only). Close is a neutral ×. (G1)
10. **Order form** — two aligned columns ≥ 1280 px (Customer · Order), one column below; product lines as a real
    table with headers (Product, Quantity, In stock, ×) and "Add product" below; the warehouse lock explained inline
    ("Remove the products to change the warehouse"); the code field labelled "Order number"; required fields marked,
    missing ones listed in the sticky save bar ("3 things missing") and highlighted on click. (G8, G11)
11. **Getting ready** — neutral rows at start; per row a progress bar "shipped 10 of 25 · this shipment 3 · stock 100"
    replacing "25 / 25" and "Aggregate Partials"; rows turn accent when the shipment completes them, warning when it
    exceeds stock; `ScanInput` on top as in the barcode reader; footer "Ship 3 products" (primary) and Cancel (ghost).
    (H, G1, G11)
12. **Customers** — name (primary), email and phone, city, orders count; ⋯ (Edit, Delete); server paging with total
    ("1–100 of 1,240"); search across pages (needs the API's `?q=` — today search is the current page only).
13. **Customer form** — `FormLayout`: Contact (first, last, email, phone) and Addresses as cards with a type label
    (Billing/Shipping) and "Add address" as a secondary button; Country → State → City in one row on desktop. (G8)
14. **Invoices list** — Invoice (mono), Customer or "Walk-in customer" (instead of "POS Client"), Total (`Money`),
    Date, ⋯ (Detail, PDF); filters by date range and customer; detail as `SlideOver` with "Open PDF".
15. **Invoice form** — a document-like layout: Customer card on the left, Invoice meta (number, date, payment, tax
    rate with its name) on the right, the lines as a table with headers (Product, Description, Qty, Unit price,
    Discount, Line total) and "Add line / Add all products from <warehouse>", totals block under the lines (Subtotal,
    Tax 6 %, **Total** large); sticky "Create invoice" bar; optional NIT shown if the business wants it (Open
    questions). (G10)
16. **Users** — roles as plain-language chips ("Inventory", "Orders (manage)", "Invoices: read", …); the form groups
    the nine roles under Warehouse / Sales / Invoices / Admin with a one-line description of what each opens, and
    "Admin includes everything except invoices" stated. "Rol" → "Roles". (G11)

### Phone and handheld (all screens)

Drawer + bottom tab bar; lists as cards (title line, status badge, 2–3 facts, ⋯); forms single column with the sticky
action bar above the tab bar; scan screens full height with 48 px targets; tables never scroll the page sideways.
Tested at 390 × 844 and on a 360 px Android handheld.

### Accessibility

Visible 2 px accent focus ring (`:focus-visible`), skip link, per-page titles, landmarks (`nav`, `main`, `header`),
`aria-live="polite"` for toasts and scan results, status never by colour alone, 44 px minimum targets on touch, AA
contrast for every token pair (checked by a Vitest test over the token map), forms announce errors (`aria-invalid`,
`aria-describedby` — `Field` already does).

### Copy and content

Sentence case; titles name the thing ("Products", not "View products"); glossary: Consecutive → Order number, Aggregate
Partials → Shipped so far, This Order → This shipment, POS Client → Walk-in customer, Rol → Roles, ROLE_* → plain names;
confirmations say the consequence; success messages without exclamation marks; errors say what to do next. All
through `en.json` (keys change → the items update their tests and the smoke specs).

---

## Contract (item 0)

Built first, alone, on `feature/redesign`; every screen item builds only from it.

- `shared/ui/tokens.css` (the tokens above) loaded after Bootstrap, plus a small `bootstrap-overrides.css` that maps
  `.btn-primary`, `.form-control`, `.table`, `.badge`, focus, links to the tokens (so untouched markup already looks
  right), the Geist fonts self-hosted, and the z-index scale.
- The new kit: `Button`, `PageHeader`, `Toolbar`/`FilterBar`, `StatusBadge`, `Money`/`Quantity`, `SlideOver`, `Toast`
  (+ provider), `FormLayout` + sticky `ActionBar`, `Skeleton`, `ScanInput`, `KpiStrip`; `DataTable` extended (row
  menu, selection bar, card mode, skeleton, density). Each with Vitest tests and a story-like demo page at
  `/admin/_kit` (dev only).
- The shell: brand (SVG mark + favicon), sidebar with rail, drawer + bottom bar under 1024 px, top bar with name,
  per-page titles (`usePageTitle`), skip link, parallel session + chunk loading, remembered warehouse
  (`shared/lib/useRememberedWarehouse`).
- i18n: the glossary keys (`common.*`, `nav.*`, `roles.*`, `status.*`) and an empty prefix per item.
- Regression suite: section `10 Design system (DS)` with DS-01 – 08 (shell at 1440 and 390, drawer, bottom bar,
  focus ring, toast, skip link, titles); the item ranges below.
- `docs/design/README.md`: the tokens, the component rules (which button when, when a SlideOver vs a page), copy rules.

## Split

| # | Slug | Item | Owns (context / slice, files) | Tests first | Browser cases | Depends on | Model |
|---|---|---|---|---|---|---|---|
| 0 | contract | Tokens, fonts, kit, shell, glossary | `shared/ui/**`, `shared/lib/**` (new hooks), `app/**`, `widgets/app-shell`, `pages/login`, `pages/not-found`, `en.json` `common/nav/roles/status`, `public/favicon.*`, `docs/design/README.md` | kit components' Vitest (Button variants, DataTable card mode and row menu, SlideOver focus trap, Toast live region, ScanInput keeps focus), token contrast test | DS-01 – 08 | — | — |
| 1 | products-ui | Product list, product form, move SlideOver | `pages/products`, `pages/product-form`, `widgets/stock-table`, `features/move-stock`, `features/download-stock-sheet`, `en.json` `products.*` | StockTable (selection bar, card mode), MoveStock SlideOver, ProductForm sections | RD-INV-01 – 06 | 0 | sonnet |
| 2 | warehouse-ops-ui | Barcode scan mode, incoming, upload steps, warehouses cards | `pages/barcode-reader`, `pages/incoming-stock`, `pages/products-upload`, `pages/warehouses`, `features/{scan-stock,approve-incoming,upload-products,rename-warehouse}`, `en.json` `stock.*` | ScanStock (mode sticks, undo last, unknown code inline, tone toggle), ApproveIncoming (count + confirm), UploadProducts (dropzone, summary) | RD-WH-01 – 08 | 0 | opus |
| 3 | orders-ui | Orders list, order detail SlideOver | `pages/orders`, `widgets/order-table`, `widgets/order-detail`, `features/{change-order-status,delete-order,sync-orders,edit-order-comments}`, `entities/order` (UI only), `en.json` `orders.*` | OrderTable (status chips with counts, row menu, card mode), OrderDetail (sections, actions, history), ChangeStatus (confirm for Sent/Delivered) | RD-ORD-01 – 08 | 0 | opus |
| 4 | order-forms-ui | Order form, getting ready | `pages/order-form`, `pages/order-getting-ready`, `features/record-partial`, `en.json` `orderForm.*`, `gettingReady.*` | OrderForm (missing fields in the action bar, lines table), RecordPartial (progress per row, scan focus) | RD-ORD-09 – 14 | 0, 3 | opus |
| 5 | customers-ui | Customers list, customer form, address widget | `pages/customers`, `pages/customer-form`, `widgets/address-form`, `features/delete-customer`, `en.json` `customers.*`, `address.*` | Customers (card mode, total), AddressForm (cards, type label) | RD-CUS-01 – 04 | 0 | sonnet |
| 6 | invoices-ui | Invoices list + SlideOver, invoice form | `pages/invoices`, `pages/invoice-form`, `widgets/invoice-detail`, `features/add-all-products`, `entities/invoice` (UI), `en.json` `invoices.*` | InvoiceForm (lines table, totals with Money), Invoices (SlideOver) | RD-INVC-01 – 05 | 0, 5 | sonnet |
| 7 | users-ui | Users list and form with plain role names | `pages/users`, `pages/user-form`, `entities/user` (UI), `shared/config/roles.ts` (labels), `en.json` `users.*` | UsersPage (role chips), UserForm (grouped roles with descriptions) | RD-USR-01 – 03 | 0 | haiku |

Waves: 1 → {1, 2, 3, 5, 7}; 2 → {4, 6}. Every item updates the smoke specs of its screens (labels and roles change)
and keeps their case IDs; new cases take its RD-* range.

## Decisions

1. **Bootstrap 4 stays**; tokens are CSS custom properties; no Tailwind, no component library. A later move to
   Bootstrap 5 is easier afterwards, not part of this.
2. **One accent (KF olive)**; danger only for destructive actions; Cancel and Close are never red.
3. **SlideOver for details and quick edits, pages for create/edit forms**, `ConfirmDialog` only for destructive or
   irreversible actions.
4. **Lists: at most one visible row action**; the rest in "⋯". Row click opens the detail.
5. **Fonts self-hosted** (Geist / Geist Mono, OFL) — no Google Fonts or CDN (privacy, offline warehouses).
6. **No API change in this PRD** except where marked "needs an API decision" (first stock on product create,
   customers `?q=` across pages, order status history endpoint for the detail's History section — today
   `order_status` rows exist but are not exposed). Those three go to a small backend item or a follow-up PRD.
7. **Remembered warehouse and sound on/off** are per browser (`localStorage`, wrapped in try/catch), not per user.
8. Screens keep their routes; the smoke suite's case IDs stay, their locators follow the new labels.

## Risks

- **Muscle memory:** warehouse staff learned the old screens; the barcode reader changes most. Mitigation: same
  route, same keys (Enter adds), a one-line "What changed" banner for two weeks.
- **Smoke specs** select by labels and roles; every renamed label breaks a spec — each item updates its specs in the
  same branch (gate + smoke at the barrier).
- **Font weight:** two variable woff2 files (~120 KB) — preload only the UI font, mono on demand.
- **Colour of the brand:** the olive is taken from a JPEG logo; confirm with the owner before item 0 is merged.

## Open questions for the user

1. **Brand colours and logo:** is the olive green of the KF logo the colour to build on, and is there a vector logo
   (SVG/AI) instead of the 245 px JPEG?
2. **Currency:** prices and invoice totals — USD (the invoice PDF's Florida address) or COP, or per warehouse
   (Colombia / Usa / España)?
3. **Language:** should the UI also be in Spanish (warehouse in Colombia and España)? The i18n layer is ready; it
   would be one more catalogue.
4. **Phones/handhelds:** do the warehouse staff use phones or dedicated scanners at the shelf? (Decides how far the
   bottom bar and scan mode go.)
5. **The three API additions** (first stock on create, customer search across pages, order status history): in this
   PRD as a small backend item, or later?
6. **NIT on invoices:** the field exists but is not stored (as before); show and store it?
7. **Dark mode:** wanted for the warehouse floor, or out?

## Acceptance

`dod.py` green; Lighthouse accessibility ≥ 95 on every screen (production build); no horizontal scroll at 390 px; the
smoke suite green with the updated specs; a manual run of the RD-* cases at 1440 and 390 px; the before/after
screenshots of every screen in `docs/design/after/` next to `docs/design/audit/`.
