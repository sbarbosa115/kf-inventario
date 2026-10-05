# Security audit — restructure — 2026-10-05

- **Branch:** `feature/restructure` at `44e68dc` (start of the audit), against `origin/master`; fixes in `237b736` …
  `5645e72`.
- **Scope:** everything since `origin/master`: the JSON API under `/api/v1` (sign-in/out/me, users, warehouses, stock,
  products with the spreadsheet upload and download, customers, locations, orders, comments, partials, order
  PDFs/XLS, the WooCommerce sync), the public WooCommerce webhook `/admin/order/1H39j0jpQPsWL958v9R4`, invoices and
  their PDF, the React app (`backend/assets/react`), the email queue (Messenger on Doctrine, cron-drained), the
  console command `app:migrate-user-roles`, `deploy/cpanel-update.sh` + `deploy/htaccess-symfony.conf` +
  `deploy/env.local.example`, the Docker stack, and the new/changed PHP and JS dependencies.
- **Tools:**
  - `composer audit`: 23 advisories in 5 packages at the start (dompdf 6, guzzle 9, guzzlehttp/psr7 4,
    phpspreadsheet 3 high, symfony/mailer 1); **clean** after `237b736`.
  - `npm audit --omit=dev`: clean (0 vulnerabilities).
  - Secrets in the diff: `APP_SECRET=5b1c…` in `backend/.env.dev` (dev only: loaded only with `APP_ENV=dev`;
    production sets `APP_ENV=prod` and its own `APP_SECRET` in `backend/.env.local`, which the deploy script
    requires); `backend/.env` holds local defaults with every secret empty; `backend/.env.test` a test-only secret.
    Nothing else. `origin/master`'s committed `.env.dist` held `APP_SECRET=a1040dfe…` (finding 16).
  - `debug:router`, `scripts/audit.py` (leads below), curl against the local stack as each fixture user
    (`sbarbosa115` admin, `inventory`, `invoices`) and as nobody.

## Findings

| # | Severity | Category | Where | What an attacker could do | Status |
|---|---|---|---|---|---|
| 1 | High | A01 Access control | `POST /api/v1/orders/{id}/partials`, `PUT /api/v1/orders/{id}/comments`, `PUT /api/v1/warehouses/{id}`; reads `GET …/partials`, `GET …/xls`, `GET /api/v1/warehouses` | Any signed-in account, whatever its roles, records partial shipments (takes stock out, completes the order), replaces an order's comments (a comment left out is detached) and renames warehouses. Tried live as `invoices` (no order or inventory role): 200 on all three. | **Open: user decision.** Same as the legacy pages (PRD decision 11: "no item tightens them"); roles not changed. README Known gaps. Blocks the merge unless the user accepts it. |
| 2 | Medium | A07 / A01 Webhook | `POST\|GET /admin/order/1H39j0jpQPsWL958v9R4` | The only credentials are the path (committed in the repository since `master`) and `X-WC-Webhook-Source` (the shops' public addresses). Whoever has them places orders in any warehouse, updates the customer found by email/phone, and has the printer email sent (warehouse 1). Tried live: a forged POST placed order `99001`. | **Mitigation added, off by default** (`39464f6`): with `WOO_COMMERCE_WEBHOOK_SECRET` set, WooCommerce's `X-WC-Webhook-Signature` (base64 HMAC-SHA256 of the body) is required; a delivery without it is logged and not placed, and the answer stays `{status: true}`. Tests `testWithASecretASignedOrderIsPlaced`, `testWithASecretAnUnsignedOrForgedOrderIsLoggedAndNotPlaced`. **Open: recommend setting it in production** (README, `deploy/env.local.example`). |
| 3 | Medium | A06 / A04 DoS | `POST /api/v1/products/upload` (PhpSpreadsheet 2.4.5) | A corrupt `.xls` whose OLE sector chain loops made PhpSpreadsheet allocate until PHP died (CVE-2026-59933): an uncatchable fatal error and a 500 (reproduced: 256 MB exhausted in `OLERead.php:173`). Needs `ROLE_MANAGE_INVENTORY`; the legacy page had the same flaw. | **Fixed** in `237b736` (2.4.8 throws "Detected loop", caught → 422 `invalid_spreadsheet`), test `testAnXlsWhoseSectorChainLoopsIsInvalid` (`ce61431`). The reader is also limited to the Xls/Xlsx readers (`ce61431`, test `testTheReaderReadsOnlyExcelFiles`): `IOFactory::load` tried HTML, CSV, SYLK, Gnumeric, ODS… |
| 4 | Medium | A03 Injection | `GET /api/v1/products/template.xls`, `GET /api/v1/orders/{id}/xls` | A product code, title or detail starting with `=` (e.g. `=HYPERLINK("https://evil…","Click")`) was written as a **live formula** (PhpSpreadsheet's `setCellValue` makes any `=` text a formula): spreadsheet formula injection into the files staff open in Excel. Text starting with `+ - @` is a string cell in a binary xls and is not evaluated. | **Fixed** in `a99a107`: `Shared\Infrastructure\Spreadsheet\SafeCell` writes `=` text as a string cell, exactly as typed (it reads back the same on upload); numbers and other text unchanged. Tests `testTextStartingWithAnEqualsSignIsWrittenAsText`, `testAProductCodeStartingWithAnEqualsSignIsWrittenAsText`. |
| 5 | Medium | A07 Auth | `POST /api/v1/auth/login` | No sign-in throttling (password guessing), and a disabled user can still sign in. | **Open: user decision** (2026-10-05, PRD decision 3: behaviour kept as today). Already in README Known gaps. |
| 6 | Low | A06 | phpoffice/phpspreadsheet (CVE-2026-59931 WEBSERVICE SSRF, CVE-2026-59932 Gnumeric gzip bomb) | Not reachable here: `WEBSERVICE()` fetches only hosts on the spreadsheet's domain whitelist, which the app never sets; Gnumeric files fail the MIME check (415) and the reader no longer offers Gnumeric. | **Fixed** by the update to 2.4.8 (`237b736`). |
| 7 | Low | A06 | dompdf/dompdf 2.0.8 (6 advisories: SVG/data-URI local file read, file-existence oracles, image-size DoS, chroot bypass) | Not reachable: they need attacker-controlled HTML/CSS/SVG in the PDF, and every value in `templates/pdf/*` is autoescaped (tried: `<script>` and `<img src="file:///etc/passwd">` in a customer, address, comment; the PDF prints them as text). | **Fixed**: `^2.0` → `^3.1.6` (`237b736`; the 2.x line has no fix). The order, remaining and invoice PDFs render pixel-identical (compared at 110 dpi). |
| 8 | Low | A06 | guzzlehttp/guzzle 7.10 (1 high: CVE-2026-69246 host-check bypass; 8 medium), guzzlehttp/psr7 2.9 (4 medium) | Not reachable: a root requirement, but no app code uses Guzzle (the WooCommerce client uses cURL), and no URL comes from a user. | **Fixed**: 7.15.5 / 2.13.1 (`237b736`). Guzzle could be dropped from `composer.json` later (unused). |
| 9 | Low | A06 | symfony/mailer 8.0.8 (CVE-2026-45068, sendmail argument injection) | Not reachable: the transport is SMTP (`MAILER_DSN`), the recipients are fixed (printer + cc parameter). | **Fixed**: 8.0.15 (`237b736`). |
| 10 | Low | A05 Headers | every response | No `X-Content-Type-Options`, no framing policy (clickjacking of the signed-in app), no `Referrer-Policy`. | **Fixed** in `123542f` (`SecurityHeaders` listener: `nosniff`, `X-Frame-Options: DENY`, `CSP: frame-ancestors 'none'`, `Referrer-Policy: same-origin`), test `SecurityHeadersTest`. **Open:** a script/style CSP (the screens load Bootstrap, jQuery and Font Awesome from CDNs: it needs a list of sources and a browser pass) and HSTS (set it in cPanel once HTTPS is confirmed on the domain). |
| 11 | Low | A08 Deserialisation | `app:migrate-user-roles` | `unserialize()` without `allowed_classes` on the `user.roles` / `warehouse.urls` values: a serialized object in either column would be instantiated (object injection). Admin-run console only; the API writes those columns as JSON. | **Fixed** in `afeef6d` (`allowed_classes: false`, arrays only), tests `MigrateJsonColumnsCommandTest`. |
| 12 | Low | A02 Data exposure | `deploy/cpanel-update.sh` | The pre-migration `mysqldump` (every customer, every password hash) was written with the shell's umask (0644 on cPanel) under a predictable name in the home directory. | **Fixed** in `0ff8517` (created 0600 under `umask 077` in a subshell; gzip keeps it). Checked by hand: dump 600, `.gz` 600, other files still 644. No automated test (the script has none). |
| 13 | Low | A03 Header injection | `GET /api/v1/orders/{id}/xls` | The order code (typed, or the shop's) went into `Content-Disposition` as is: a `"` ended the filename early, a line break broke the header. | **Fixed** in `5645e72` (`"`, `\` and control characters → `_`; other codes keep the legacy name byte for byte), test `testTheXlsFilenameCannotBeBrokenByTheOrderCode`. |
| 14 | Low | A07 User enumeration | `POST /api/v1/auth/login` | The message is generic ("Wrong username or password.", the same for unknown users and malformed bodies), but timing tells: ~0.55 s for an existing username (bcrypt runs) vs ~0.15 s for an unknown one (dev stack). Same as the legacy form login. | **Open**, with the throttling decision (5): checking a dummy hash for unknown users would close it. README Known gaps. |
| 15 | Low | A08 Webhook replay | webhook | The same delivery posted twice places two orders (the sync skips known codes; the webhook never did, legacy included). | **Open: user decision** (behaviour as before). README Known gaps. |
| 16 | Low | A02 Secrets | `origin/master:.env.dist` | `APP_SECRET=a1040dfe1700e305abfd4b5e19cd6c59` was committed on `master`. If production still uses it, remember-me cookies rest on a public value (a forged remember-me cookie still needs the user's password hash). | **Open: recommendation.** When moving the settings to `backend/.env.local` at cutover, generate a fresh `APP_SECRET` (`deploy/env.local.example` says how); everyone signs in again at cutover anyway. |
| 17 | Low | A04 DoS | `POST /api/v1/products/upload` | A 12 MB (the upload limit) xlsx that decompresses to a huge sheet can exhaust memory or time. Needs `ROLE_MANAGE_INVENTORY`; legacy alike. | **Accepted / open**: authenticated staff only; PHP's `memory_limit` and time limit bound it to one failed request. |

Not a security finding, noted while trying the attacks: in **dev** (Twig `strict_variables`), an order whose address has
no city (a webhook order with an empty `shipping` block) makes `templates/pdf/order*.html.twig` throw, so the webhook
and that order's PDF answer 500 in dev. Production (`strict_variables` off) prints the blank field, as before.

## Leads from audit.py

All resolved:

- **[A05 Config] `backend/config/packages/security.yaml` (113 leads):** the whole file is new (moved). Checked: the
  role hierarchy is production's; `json_login` + `logout` + `remember_me` (7 days; `REMEMBERME` and `PHPSESSID` are
  `httponly; samesite=lax`, seen live in `Set-Cookie`); `access_control` makes only `/api/v1/auth/login`, the webhook
  and the SPA shell (`^/`, the HTML shell and the build, no data) public; `/api/` needs `ROLE_USER` and every
  controller action has its `#[IsGranted]` (ContractTest asserts route × role). The cheap test hasher is only
  `when@test`. Nothing found beyond findings 1 and 5.
- **[A01] new routes / "access check removed or loosened?" (~90 leads):** every `/api/v1` action checked against the
  README table and tried live with `inventory` and `invoices` (403 where a role is missing: users, orders, invoices,
  customers, stock, templates). Single-tenant app: no tenant filter. Every id route loads through a repository or
  query (`Orders::get`, `Products::byUuid`, …) and soft-deleted rows answer 404 (tried live on a deleted order: GET,
  pdf, remaining-pdf, xls, partials GET/POST, comments, status, PUT → 404; a deleted customer GET/PUT → 404). Open:
  finding 1.
- **[A04 Mass assignment] `InputMapper.php:40`:** it denormalises into Input DTOs only (`UserInput`, `ProductInput`,
  `OrderInput`, …), never an entity; `roles` is a choice of the nine assignable roles (tried `ROLE_SUPER_ADMIN` → 422);
  a blank password keeps the hash; authors come from the session. Nothing found.
- **[A08 Uploads] `ProductController.php`:** MIME from the content (`getMimeType()`, fileinfo) against the legacy
  list; size bounded by PHP and nginx (12 MB); the file is never stored (the handler reads PHP's temp file). Tried: a
  PHP shell renamed `.xls` and sent as `application/vnd.ms-excel` → 415; an HTML table as `.xls` → 415; 3 MB of random
  bytes → 415. Findings 3 and 17.
- **[A08 Path traversal] `InvoiceDocumentRenderer.php:53`:** the logo path is `public/images/` + one of four fixed
  names (no user input). The other leads are tests. Nothing found.
- **[A10 SSRF] (~30 leads):** all are test-client requests or the logo read above. The only outbound requests are the
  WooCommerce REST client (URL and keys from env, not from a user) and Dompdf (remote fetching off). Nothing found.
- **[A03 XSS] React hrefs (10 leads):** every `href` is built from the API base and a numeric id or encoded uuids
  (`orderPdfUrl(id)`, `invoicePdfUrl(id)`, `stockSheetUrl(uuids)` with `encodeURIComponent`), or a constant
  (`TEMPLATE_URL`, `LegacyScreen`'s route constants). No scheme comes from data. Nothing found.
- **[Frontend] `target=_blank` without rel (6 leads):** false positives: each link has `rel="noopener noreferrer"` on
  the next line, and all point at the same origin.
- **[Frontend] open redirect `RequireSession.tsx:9`:** the return path travels in React Router state (not a query
  parameter an attacker can set) and is followed with `navigate()`, which stays on the origin. Nothing found.

## Checked, nothing found

- **A01:** see the leads. Lists are scoped as their legacy pages (per warehouse; customers paginated); exports need
  the same role as their screen (template `ROLE_MANAGE_INVENTORY`, PDFs `ROLE_CAN_READ_*`), except the order XLS
  (finding 1). Files are generated per request behind the firewall, never at public URLs.
- **A02:** bcrypt kept (`password_hashers: bcrypt`; cost 4 only in `when@test`). The users endpoints, `auth/me` and
  order details never return a hash or a `password` field (grep of live responses: 0 matches). The app generates no
  tokens or codes. WooCommerce keys: only in env, used by the client, never in a response; the failure log carries the
  client's message (the shop's or cURL's error), not the keys.
- **A03:** no string-built DQL/SQL with user input (`MigrateJsonColumnsCommand` interpolates its own constant table
  names); no `LIKE`; query parameters are typed (`warehouse_id=1 OR 1=1`, arrays, quotes → 400). Twig autoescaping is
  on for `templates/pdf/*` (no `|raw`); stored `<script>`/`<img>` payloads print as text in the order PDFs and come
  back JSON-escaped from the API. No `dangerouslySetInnerHTML`, `innerHTML` or `eval` in `assets/react`. No
  `exec`/`shell_exec`/`proc_open`. Email: the subject `Order #<code> was created` goes through Symfony Mime (a CRLF in
  the code is folded and encoded, no header injection; tried); the recipients are fixed.
- **A04:** state transitions are the domain's (a partial on a completed order → 409, more than ordered → 409,
  insufficient stock → 422).
- **A05:** `APP_ENV=prod` is required by the deploy script; the profiler and API-doc bundles are dev/test only; API
  errors in prod are `{"error":"internal_error"}` without a trace (`ApiExceptionSubscriber`). No CORS bundle: same
  origin only. Cookies `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS (`cookie_secure: auto`). nginx and
  `htaccess-symfony.conf` send every non-file to `index.php`; `public/` holds only `index.php`, the build, bundles,
  images and the favicon; nginx 404s any other `.php`.
- **A07 / CSRF:** session cookie `SameSite=Lax` plus `SameOriginWrites` on every `/api/` write, the login included.
  Tried live: `Origin: https://evil.example` → 403 (PUT, DELETE, multipart upload, login), `Origin: null` → 403,
  `Sec-Fetch-Site: cross-site` → 403, `GET /api/v1/auth/logout` → 405 (sign-out is POST only). Sign-in errors are one
  generic message (finding 14 for timing). Symfony migrates the session id on sign-in. (If production ever sits
  behind a TLS-terminating proxy, `TRUSTED_PROXIES` must be set, or the Origin check refuses every write.)
- **A08:** Messenger messages carry ids; the doctrine transport serialises only the app's own messages.
- **A09:** webhook refusals and unplaced orders, sync failures and email failures are logged (email failures also as
  a `log` row). No dedicated audit row for failed sign-ins (as before).
- **A10 / Dompdf:** Dompdf 3.1.6 defaults: `isRemoteEnabled` false, `isPhpEnabled` false, `chroot` = Dompdf's own
  directory; the invoice logo is inlined as a data URI from a fixed path. No user-supplied URL is fetched server-side.
- **Frontend:** no secrets in the bundle (no `process.env`/`import.meta.env` in `assets/react`); the session is an
  HttpOnly cookie, not `localStorage`. A 401 from `auth/me` shows the sign-in page; a 401 from another call (a session
  expired mid-page) shows the API error until the page is reloaded (UX, not a security issue: the server refuses).
- **Deploy script:** `DATABASE_URL` is parsed by PHP into a 0600 `--defaults-extra-file` (the password is never a
  command-line argument visible in `ps`), removed by a trap; `.env.local` must hold `APP_ENV=prod` and an
  `APP_SECRET` of 16+ characters; it warns when the committed `backend/.env` is edited on the server. Finding 12.
- **Dependencies:** `npm audit --omit=dev` clean; the new PHP packages (dompdf 3 and its `dompdf/php-font-lib`,
  `dompdf/php-svg-lib` 1.0, `sabberworm/php-css-parser` 9) are the maintained upstream line, pinned by `composer.lock`.

## Not applicable

- Multi-tenant IDOR: one company, one tenant; access is by role only (finding 1 covers the roles).
- JWT / refresh tokens: the app uses a session cookie.
- Sign-in codes, reset tokens, invitations: the app has none.
- Rich-text sanitising (`symfony/html-sanitizer`): no field holds HTML; everything is escaped as text.
