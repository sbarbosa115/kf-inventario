# UI regression suite

The regression baseline: what a user does with the app **today** (after the redesign and the shops and settings
work), case by case, and what must happen. Every case is a Playwright smoke test against the Docker stack
(`backend/e2e/`); there are no manual cases. The whole suite is the regression run:

```bash
python3 ~/.claude/skills/symfony-react-app/scripts/smoke.py    # resets the dev database, runs everything, records it
backend/e2e/smoke.sh orders                                     # one spec while working on it (not recorded)
```

What the suite cannot reach (a real WooCommerce shop, a phone's camera, a real SMTP server, the production cutover)
is listed once in the README, "Not covered by the smoke suite"; it is not a case here.

**The format.** Each case is `**AREA-NN · What the user does**`, then `Smoke:` with the spec that runs it, then what
happens today. Exactly one test runs each case, and its title starts with the case's ID (`ORD-03 · …`): a failure
reads as a case of this file, and no test exists without a case. IDs are stable: a new case takes the next number in
its section, and a removed case leaves a gap (the cases removed when this baseline was made are listed in
`runs/2026-10-06-baseline.md`).

**The runs.** Each run is recorded in [`runs/`](runs/): `smoke.py` adds a row per attempt of the whole suite to the
feature's run file, with the commit and the cases that failed; a failure is written up under "Smoke findings" with
its cause and fix, and the suite is run again until it is green.

## Before you start

**Known data, not whatever the last run left.** `backend/e2e/prepare.sh` (which `smoke.sh` runs first) drops the
stack's dev database, migrates it, loads the fixtures (`app:smoke:prepare --seed`), adds FLT-05's 1,240 customers,
restarts the worker and empties the mail catcher. The fixtures:

- Warehouses Colombia (1), Usa (2) and España (3); products KF-01, KF-02 and KF-03 ($100, $150, $200) in stock in
  Colombia only.
- Twelve orders in Colombia: W00001 – W00006 by phone with the statuses Created, Processed, Completed, Partial, Sent and
  Delivered, W00007 – W00012 from the web likewise; customer Jose Perez; each with one comment (W00003's has no date)
  and the three products.
- Invoice INV-0001 ($100.00, a walk-in customer, no payment method).
- The "Fake shop" connection (Colombia, prints its orders, both write-back capabilities on), answered by the dev
  stack's fake WooCommerce shop at `/_fake-shop` (its state at `/_fake-shop/_state`).

**Accounts.** Dev only (`src/DataFixtures/UserFixtures.php`), never reuse these passwords.

| Role | Sign in with | Lands on |
|---|---|---|
| Admin (`ROLE_ADMIN`: inventory, warehouses, orders, customers, users, settings) | `sbarbosa115` / `123456` | `/admin/products` |
| Inventory clerk (`ROLE_MANAGE_INVENTORY`) | `inventory` / `123456` | `/admin/products` |
| Invoice clerk (the invoice roles + customers) | `invoices` / `123456` | `/admin/products` |
| Sales clerk (the invoice roles + customers + inventory: invoices with products) | `sales` / `123456` | `/admin/products` |

Specs that need another role create their account through the API (`smoke-orders`, `smoke-orders-update`,
`smoke-settings`, all `123456`).

**Lanes.** The specs run in Playwright projects, each one worker in file order (`backend/playwright.config.ts`).
First three side by side: *orders and stock* (order forms, orders, products, stock), *lists* (auth, customers, design
system, filters, invoices, users) and *screens*; then, alone, *shops and settings* (comments, shop sync, settings,
shops, webhook): their pulls from the fake shop are served by the stack's own PHP, and Settings switches the SMTP
server every email goes through. A lane never counts or changes what another lane changes: the cases say which data
they keep to (their own records, España, KF-03, the fixtures' delivered and partial orders).

**On every screen.** Section 14 opens each screen at 1440 px and at 390 px (touch), light and dark, English and
Spanish, and checks the same things on all of them: the title (h1) shown, the theme and the language applied, no
sideways scroll, no raw translation key (`orders.title`) or unfilled `{{param}}` in the text or the accessible names,
no console error, and on a phone every button, link, field and tab at least 44 × 44 px.

---

## 1. Authentication and shell (AUTH, NAV)

**AUTH-01 · Signing in opens the product list**
Smoke: `e2e/auth.spec.ts`.
`/admin/login`, sign in as the admin: the product list opens, the top bar shows `Sergio Barbosa`, no console error.

**AUTH-02 · A wrong password is refused**
Smoke: `e2e/auth.spec.ts`.
`sbarbosa115` with a wrong password: "Wrong username or password." in place, and the page stays on the sign-in form.

**AUTH-03 · A page opened signed out comes back after signing in**
Smoke: `e2e/auth.spec.ts`.
Signed out, `/admin/warehouses` asks to sign in; after signing in, the Warehouses page opens.

**AUTH-04 · Sign out ends the session**
Smoke: `e2e/auth.spec.ts`.
Top bar › `Sergio Barbosa` › Sign out: the sign-in page; `/admin/products` asks to sign in again.

**AUTH-05 · A legacy bookmark opened signed out goes to the sign-in page**
Smoke: `e2e/auth.spec.ts`.
Signed out, `/admin/product/` (the previous version's address) ends on `/admin/login`.

**AUTH-06 · Remember me keeps you signed in after closing the browser**
Smoke: `e2e/auth.spec.ts`.
Sign in with "Remember me" ticked, close the browser (only the cookies with a date survive), open `/admin/products`:
still signed in. Without it, the same steps end on the sign-in page.

**AUTH-07 · The sign-in page in Spanish**
Smoke: `e2e/design-system.spec.ts`.
On `/admin/login`, ES: "Iniciar sesión", "Usuario"; still Spanish after a reload. A browser whose language is Spanish
(es-CO) opens the sign-in page in Spanish the first time.

**AUTH-08 · The name in the top bar, Sign out in its menu**
Smoke: `e2e/design-system.spec.ts`.
The top bar shows `Sergio Barbosa`; its menu holds the username `sbarbosa115`, the email and "Sign out"
(`/admin/logout`).

**NAV-01 · The admin sees every section**
Smoke: `e2e/auth.spec.ts`.
Products, Upload a stock sheet, Scan, Incoming, Warehouses, Orders, Customers and Users in the sidebar.

**NAV-02 · The inventory clerk sees the warehouse entries only**
Smoke: `e2e/auth.spec.ts`.
As `inventory`: Products; no Warehouses, Orders, Customers, Users or Invoices.

**NAV-03 · An unknown address shows "Page not found"**
Smoke: `e2e/auth.spec.ts`.
`/admin/nothing-here` signed in: "Page not found" inside the app.

**NAV-05 · The tab bar of the inventory clerk on a phone**
Smoke: `e2e/design-system.spec.ts`.
At 390 px as `inventory`: the bottom tab bar holds Products, Scan, Incoming and More; More opens the whole menu (Upload
a stock sheet in it).

**NAV-06 · The scan shortcut only for the inventory roles**
Smoke: `e2e/design-system.spec.ts`.
As `inventory`, the top bar's "Open the reader" leads to `/admin/products/barcode`; as `invoices`, it is not there.

## 2. Products (INV)

**INV-01 · The product list opens on the first warehouse, and the old address lands on it**
Smoke: `e2e/products.spec.ts`.
`/admin/product/` opens `/admin/products`, "Products", Colombia chosen, KF-01 with `$100.00` and its "Actions for
KF-01" menu; no console error.

**INV-02 · Another warehouse reloads the list; the search narrows it**
Smoke: `e2e/products.spec.ts`.
España: "This warehouse has no products in stock…"; Colombia: its rows. `KF-02` in the search leaves KF-02 alone; a
search nothing matches says "Nothing matches these filters." and "Show all" brings the rows back.

**INV-03 · The ticked products download as the stock spreadsheet**
Smoke: `e2e/products.spec.ts`.
Download stock sheet appears only once rows are ticked. KF-01 and KF-02 ticked ("2 selected") download `Products.xls`
with the header (Code, Title, Detail, Quantity, Price) and those two products, not KF-03. "Select all" ticks every row
of the page.

**INV-04 · Move to warehouse moves the chosen quantity; it arrives as incoming**
Smoke: `e2e/products.spec.ts`.
KF-03 ticked, Move to warehouse: the destinations are every warehouse but Colombia; Usa, 2, Move: "Moved to Usa. The
products arrive there as incoming.", the panel closes, KF-03 shows 2 fewer, and Incoming › Usa lists KF-03.

**INV-05 · A move the warehouse can no longer cover is refused, and nothing moves**
Smoke: `e2e/products.spec.ts` (its own product, in España).
With the move panel open on 3 units of `SMOKE-INV-05`, the three leave for Usa from elsewhere; Move: "Only 0 of
SMOKE-INV-05 are available." inside the panel, which stays open with Move enabled; Cancel closes it, and Usa holds only
the three moved elsewhere.

**INV-06 · A new product is created, and the form names what is missing**
Smoke: `e2e/products.spec.ts`.
Create product, Save empty: Code and Title are marked; Code `CODE` is refused ("This value should not be equal to
"CODE"."). `SMOKE-INV-06`, a title and price `25.5`: back on the list with "Product saved", and the product exists.

**INV-07 · A product is edited, from the list and from its old address**
Smoke: `e2e/products.spec.ts`.
`/admin/product/edit/<uuid>` opens `/admin/products/<uuid>/edit`, "Edit product", filled in. A new title and Active
off, Save: "Product saved" with no next-step links, and the API has both. A row's "⋯" › Edit opens that product; an
unknown uuid says "This product no longer exists."

**INV-08 · A person without the inventory role is refused**
Smoke: `e2e/products.spec.ts`.
As `invoices`: no Products entry, `/admin/products` says "You do not have permission to do this.", the stock API
answers 403.

**INV-09 · The upload screen shows its three steps and links to the template and to every product**
Smoke: `e2e/stock.spec.ts`.
`/admin/product/upload` opens `/admin/products/upload`, "Upload a stock sheet", three steps; Download the template and
Download every product link to the spreadsheet, which downloads as an attachment.

**INV-10 · Upload names what is missing and refuses a file that is not a spreadsheet**
Smoke: `e2e/stock.spec.ts`.
Upload with no file: "Choose the stock sheet to upload."; a `.txt`: "notes.txt is not an Excel sheet. Choose an .xls
or .xlsx file." at once, and Upload sends nothing.

**INV-11 · A spreadsheet from the template is stored in the chosen warehouse**
Smoke: `e2e/stock.spec.ts` (its own product: a sheet also sets each product's title and price, as before).
The sheet of `SMOKE-INV-11` into España: "1 row stored in España"; "Open the products of España" opens the list on
España with it. A sheet with other columns (an order's Excel sheet) says "The spreadsheet could not be read. Use the
template and try again."

**INV-12 · The scan screen lists a code on Enter, counts a repeated one and says when one is not a product**
Smoke: `e2e/stock.spec.ts`.
`/admin/product/update/bar-code` opens "Scan stock", "Nothing scanned yet". KF-01 twice: one row at 2, the box empty
and focused; `NOPE-404`: "Not a product" on its row, and its × takes it out.

**INV-13 · With Usa and Add chosen, the codes read are added in one tap**
Smoke: `e2e/stock.spec.ts`.
Usa, KF-01 twice, "Add to Usa": no question, "Added 2 units to Usa.", the list empties, the focus is back in Barcode,
and Usa holds 2 of KF-01.

**INV-14 · Removing asks first; more than the warehouse has is refused and keeps the list**
Smoke: `e2e/stock.spec.ts`.
Usa, Remove stock, KF-01 at 50: "Remove from Usa?" says "50 units of 1 product"; confirmed: "There is not enough stock
of KF-01: 2 available." and the list stays. At 1: "Removed 1 unit from Usa." and Usa keeps 1.

**INV-15 · Incoming products wait until "Approve all" puts them in stock**
Smoke: `e2e/stock.spec.ts`.
KF-02 ×4 moved to España: `/admin/product/incoming` opens Incoming; on España, KF-02 with 4. "Approve all (1)" ›
"Approve 1 product": "1 incoming product was approved.", "Nothing waiting", "Approve all (0)" disabled, and España
holds 4.

**INV-16 · A person without the inventory role is told so on the stock screens**
Smoke: `e2e/stock.spec.ts`.
As `invoices`: Incoming says "You do not have permission to do this.", and so does an upload sent from the upload
screen.

**INV-17 · The figures come from the list; the chips count it and narrow it**
Smoke: `e2e/products.spec.ts`.
`/admin/products?warehouse=1`: Products and Units are the rows and their quantities, Stock value in dollars; the chips
read "All N", "In stock N", "Out of stock N"; Out of stock hides KF-01 and "Clear filters" brings it back.

**INV-18 · Each row has one "⋯" menu, and a click on the row opens its form**
Smoke: `e2e/products.spec.ts`.
"Actions for KF-02" holds Edit and Download stock sheet (`Products.xls`); a click on the row opens its form.

**INV-19 · The selection bar moves or downloads what is ticked, and Move opens beside the list**
Smoke: `e2e/products.spec.ts`.
Two ticked: "2 selected"; Move to warehouse opens "From Colombia" with a quantity per product, the warehouse switch
still visible; Escape keeps the ticks, Clear empties them. KF-02 and KF-03 left at 1 each, Move to Usa: one request,
"Moved to Usa.", and Usa receives 1 of each as incoming.

**INV-20 · The warehouse is remembered, and the address can name it**
Smoke: `e2e/products.spec.ts`.
Usa chosen, `/admin/products` opens on Usa; `?warehouse=1` opens Colombia, which is then remembered.

**INV-21 · A saved new product offers what to do next**
Smoke: `e2e/products.spec.ts`.
`SMOKE-INV-21` saved (no yellow warning on the form): "Product saved" with "Scan stock" and "Upload a stock sheet";
the latter opens the upload screen.

**INV-22 · On a phone the list is cards and the form is one column**
Smoke: `e2e/products.spec.ts` (390 × 844, touch).
KF-01 is a card with its "⋯" and checkbox; ticking it shows "1 selected", and Move to warehouse opens across the
width. Neither the list nor the form scrolls sideways.

**INV-23 · The scan screen remembers the warehouse and the mode**
Smoke: `e2e/stock.spec.ts`.
As `inventory`: Colombia and Add stock first; España and Remove stock are kept after a reload, and "Remove from
España" is disabled with nothing read.

**INV-24 · Undo last scan takes back the last read**
Smoke: `e2e/stock.spec.ts`.
Disabled with nothing read. KF-01, KF-01, KF-02, Undo: KF-02 goes, KF-01 stays at 2, the focus back in Barcode;
Ctrl+Z: KF-01 at 1.

**INV-25 · The footer sums what will be sent, leaving out codes that are not products**
Smoke: `e2e/stock.spec.ts`.
KF-01, KF-02 twice and NOPE-25: "2 products · 3 units", "1 code that is not a product is left out.", "Add to
Colombia" enabled; "One more KF-01": "2 products · 4 units".

**INV-26 · On a plain-http address the camera says why, and typing still works**
Smoke: `e2e/stock.spec.ts`.
"The camera needs a secure address (https). Type the code instead.", no Start camera, and a typed KF-03 is listed.

**INV-27 · The note on what changed is shown until it is dismissed**
Smoke: `e2e/stock.spec.ts`.
The first visit shows "What changed…"; Dismiss hides it, also after a reload.

**INV-28 · The drop zone shows the chosen sheet, by file picker, drag and keyboard**
Smoke: `e2e/stock.spec.ts`.
A chosen template shows its name, "N KB · XLS" and "Remove products.xls". A dragged `.xlsx` outlines the zone while
over it, then shows its name and XLSX; a dragged `.pdf` says "notes.pdf is not an Excel sheet…" and is not kept. The
file field takes the keyboard's focus and Enter opens the file picker.

**INV-29 · Approve all says what it will do, and Cancel approves nothing**
Smoke: `e2e/stock.spec.ts`.
KF-03 ×1 incoming in España: "in España · 1 product · 1 unit"; Approve all asks "Approve 1 product, 1 unit, into
España's stock?"; Cancel leaves it waiting (then the case approves it).

**INV-30 · The warehouse screens on a phone**
Smoke: `e2e/stock.spec.ts` (390 × 844, touch).
Scan, Upload, Incoming and Warehouses do not scroll sideways, and with a code read "Add to Colombia" is on screen.

## 3. Warehouses (WH)

**WH-01 · Every warehouse has a card, and the old addresses land on them**
Smoke: `e2e/stock.spec.ts`.
`/admin/warehouse/` and `/admin/warehouse/edit/1` open `/admin/warehouses`: a card each for Colombia, Usa and España.

**WH-02 · A warehouse is renamed in place, and a blank name is refused**
Smoke: `e2e/stock.spec.ts` (it puts the name back).
A click on Usa's name opens a box; blank: "Type a name for the warehouse."; Miami + Enter: "Usa is now Miami." and the
card reads Miami.

**WH-03 · Any signed-in person can open the warehouses by address**
Smoke: `e2e/stock.spec.ts`.
As `invoices`, `/admin/warehouses` shows the cards (the API asks only for a signed-in user, as before).

**WH-04 · Rename from the card's menu, and Escape cancels**
Smoke: `e2e/stock.spec.ts`.
"Actions for España" › Rename focuses the name; Madrid + Escape: the card still reads España and nothing was saved.

## 4. Customers (CUS)

**CUS-01 · The list shows the customers, and the old address lands on it**
Smoke: `e2e/customers.spec.ts`.
`/admin/customer/` opens `/admin/customers`, "Customers", Create customer, the Email column and each row's "⋯".

**CUS-02 · A customer is created with a country, state and city that did not exist**
Smoke: `e2e/customers.spec.ts`.
Every field typed, `Create "…"` picked for a new country, state and city, Save: "The customer was created
successfully." and the search finds the new row.

**CUS-03 · Editing shows what was saved, and addresses are added and removed**
Smoke: `e2e/customers.spec.ts`.
Edit shows the fields and the three new place names; a new phone, "Add address" adds "Address 2" and its "Remove
address" takes it out; Save: "The customer was updated successfully." and the new phone finds the row.

**CUS-04 · Deleting asks first**
Smoke: `e2e/customers.spec.ts`.
"⋯" › Delete asks ("Their orders will be removed too"); Cancel keeps the row; Delete: "The customer was deleted." and
the row is gone.

**CUS-05 · The form names what is missing, and a customer that no longer exists says so**
Smoke: `e2e/customers.spec.ts`.
Save empty: "This value should not be blank."; `/admin/customers/999999/edit`: "This customer no longer exists." with
"Back to the customers".

**CUS-06 · A person without the Customers role is refused**
Smoke: `e2e/customers.spec.ts`.
As `inventory`: no Customers entry, "You do not have permission to do this.", the API answers 403.

**CUS-07 · The header counts the page, the search covers every customer, and a row opens the form**
Smoke: `e2e/customers.spec.ts`.
The subtitle reads "1–N of N"; "Search customers" finds Jose Perez by email; his "⋯" holds Edit and Delete only; a
click on the row opens Edit customer.

**CUS-08 · The form has Contact and Addresses sections, address cards, and Cancel leaves without saving**
Smoke: `e2e/customers.spec.ts`.
`/admin/customers/new`: Contact and Addresses; "Address 1" holds Country, State and City and has no Remove; Add address
adds "Address 2" with Remove; Cancel leaves without saving what was typed.

**CUS-09 · On a phone the list is cards and the form is one column**
Smoke: `e2e/customers.spec.ts` (390 × 844, touch).
Jose Perez is a card with his "⋯"; the list and the form do not scroll sideways; Save is on screen.

## 5. Orders (ORD)

Delete and Check now need `ROLE_MANAGE_ORDERS` (the admin has it); `smoke-orders` holds it with `ROLE_UPDATE_ORDERS`,
`smoke-orders-update` holds `ROLE_UPDATE_ORDERS` alone.

**ORD-01 · The list shows the first warehouse's orders, and the old address lands on it**
Smoke: `e2e/orders.spec.ts`.
`/admin/order/` opens `/admin/orders`: "Orders", Create order and Check now, the columns Order, Customer, Source,
Status, Created and Notes; W00001 shows Jose Perez with his email, Phone, and a Created status badge.

**ORD-02 · Another warehouse and a status narrow the list**
Smoke: `e2e/orders.spec.ts`.
The Delivered chip keeps W00006 and W00012 only; Usa: "This warehouse has no orders yet. Create one, or sync the
orders of the shops."

**ORD-03 · A status changes from its badge, after a question, and stays changed**
Smoke: `e2e/orders.spec.ts`.
W00001's badge › Processed › "Mark W00001 as Processed?" › Mark as Processed: "Order W00001 is now Processed.", still
Processed after a reload.

**ORD-04 · Choosing Sent opens the getting-ready screen instead**
Smoke: `e2e/orders.spec.ts`.
W00002's badge › Sent opens `/admin/orders/<id>/getting-ready` without a question.

**ORD-05 · The detail shows the order, its customer and its products**
Smoke: `e2e/orders.spec.ts`.
W00003's number opens "Order W00003": Jose Perez, Completed, KF-01 with 20; Close closes it; no console error.

**ORD-06 · Comments are added and removed from the detail**
Smoke: `e2e/orders.spec.ts`.
W00004's count (1) opens the detail on its comments; a note sent with Enter is added and the list counts 2; ⋯ ›
Remove › Remove: "The comment was removed." and the count is 1 again.

**ORD-07 · The order's documents download**
Smoke: `e2e/orders.spec.ts`.
W00001's "⋯": Order PDF and Remaining products PDF are PDFs, Excel sheet is `file-upload-template-W00001.xls` with the
order's products; each opens in a new tab.

**ORD-08 · Deleting an order asks first**
Smoke: `e2e/orders.spec.ts` (as `smoke-orders`).
W00005's "⋯" › Delete: "Delete order W00005?" with "Its products and comments are removed with it."; Cancel keeps it;
Delete order: "Order W00005 was deleted." and the row is gone.

**ORD-10 · A person without the orders roles is refused**
Smoke: `e2e/orders.spec.ts`.
As `inventory`: no Orders entry, "You do not have permission to do this.", the API answers 403.

**ORD-11 · The old order form and getting-ready addresses land on the new screens**
Smoke: `e2e/order-forms.spec.ts`.
`/admin/order/new` opens "New order"; `/admin/order/edit/<id>` opens "Edit order" with `W00002`;
`/admin/order/partial/getting-ready/<id>` opens "Getting ready · W00002".

**ORD-12 · The form saves only when complete, and the warehouse locks once a product is filled**
Smoke: `e2e/order-forms.spec.ts`.
Create order disabled, "8 things missing:"; with Colombia and KF-01 the warehouse can change; with a quantity it is
locked with "Remove the products to change the warehouse."

**ORD-13 · An order is placed for a new customer with two products**
Smoke: `e2e/order-forms.spec.ts` (KF-03: the other lane ships KF-01 and KF-02).
A new customer, Colombia, KF-03 × 3 and KF-02 × 1 ("Add product"), an order number, Phone, Credit card, Created:
"The order was created." and the order holds those lines, status Created.

**ORD-14 · Picking an existing customer fills the customer block**
Smoke: `e2e/order-forms.spec.ts`.
Search customer › Jose Perez fills first and last name, email and the address.

**ORD-15 · Editing an order shows what was saved and updates it**
Smoke: `e2e/order-forms.spec.ts`.
ORD-13's order: the customer, number and quantities are filled, the warehouse locked; KF-03 to 2, Update order: "The
order was updated." and the order holds 2.

**ORD-16 · Getting ready: a scan adds one, and what is not on the order or over its quantity is refused inline**
Smoke: `e2e/order-forms.spec.ts`.
The Barcode box has the focus; KF-03: "Shipped 0 of 2 · this shipment 1"; NOPE-404: "NOPE-404 is not on this order."
(no dialog, the focus stays); KF-03 again: "Complete"; once more: "Nothing more of KF-03 is left to ship."; "One less
KF-03" takes one away.

**ORD-17 · Partial shipments take the stock out, and a sent order takes no more**
Smoke: `e2e/order-forms.spec.ts`.
KF-03 twice, "Ship 2 products": "Shipment saved: order … is partial.", the order Partial; again: KF-03 "In stock" 2
less, "Shipped 2 of 2 · this shipment 0". KF-02, "Ship 1 product": still partial (only one shipment of the whole order
sends it), KF-02 "Shipped 1 of 1" with its + disabled. W00005 (Sent): Ship disabled, "This order was already sent: it
takes no more shipments."

**ORD-18 · An order that no longer exists says so, and a person without the order roles is refused**
Smoke: `e2e/order-forms.spec.ts`.
`/admin/orders/999999/edit` and `…/getting-ready`: "This order no longer exists."; as `inventory`, an order's edit
screen: "You do not have permission to do this." and the API 403.

**ORD-19 · With nothing waiting at the shops, Check now places nothing, and it needs the sync role**
Smoke: `e2e/orders-sync.spec.ts` (API).
The fake shop empty: `POST /api/v1/orders/sync` answers 202, imports 0, and the Fake shop's row has no error; as
`inventory` it answers 403.

**ORD-21 · Each status chip counts its orders and keeps only them**
Smoke: `e2e/orders.spec.ts`.
The Partial chip's count is the rows it keeps (W00004 among them, not W00001), and it is pressed. With "W0001" in the
search, All counts 3 and three rows show.

**ORD-22 · A date range that keeps nothing says so, and Show all clears every filter**
Smoke: `e2e/orders.spec.ts`.
Created chip and Created from a future day: "Nothing matches these filters."; Show all brings W00012 back, empties the
range and presses All.

**ORD-23 · A status change cancelled changes nothing**
Smoke: `e2e/orders.spec.ts`.
W00007's badge › Delivered asks ("Its stock does not change."); Cancel: still Created after a reload.

**ORD-24 · The detail is a slide-over with sections and the order's actions**
Smoke: `e2e/orders.spec.ts`.
A click on W00008's row opens it: sections Customer, Products, Comments; Edit and Getting ready link to their screens;
Documents lists Order PDF, Remaining products PDF and Excel sheet. The status changes from the panel: Escape on the
question closes only the question; "Mark as Completed" toasts, and the list behind shows Completed at once.

**ORD-25 · The row menu follows the roles**
Smoke: `e2e/orders.spec.ts` (as `smoke-orders-update`).
Create order but no Check now; a row's "⋯": Edit, Getting ready and the three documents, no Delete.

**ORD-26 · On a phone the orders are cards**
Smoke: `e2e/orders.spec.ts` (390 × 844, touch).
W00010 is a card without table headers, nothing scrolls sideways, and a tap on its title opens the detail 8 px from
each edge (374 px wide).

**ORD-28 · With the keyboard only, an order opens from its number and the focus comes back to it**
Smoke: `e2e/orders.spec.ts`.
Enter on W00011's number opens the detail with the focus inside it, and Tab keeps it there; Escape closes it and the
focus is back on the number. Enter on the status badge opens its menu on the first status, the arrows move, Escape
gives the focus back to the badge.

**ORD-29 · The action bar names what is missing; a name goes to its field, highlighted**
Smoke: `e2e/order-forms.spec.ts`.
First name typed: "7 things missing: last name, email, warehouse, a product with its quantity, source, payment method,
status"; "source" focuses Source and marks every missing field (not First name); a source chosen: "6 things missing".

**ORD-30 · The product lines are a table with headers, "Add product" under it, any row removed**
Smoke: `e2e/order-forms.spec.ts`.
Headers Product, Quantity, Remove; "Choose the warehouse first…"; Add product disabled until the last row is complete;
two rows, "Remove product 1" leaves KF-02 alone.

**ORD-31 · Getting ready starts neutral: progress in words, stock as text, nothing to ship yet**
Smoke: `e2e/order-forms.spec.ts`.
"Getting ready · W00001", Created; three products each "Shipped 0 of N · this shipment 0" and "In stock N", none
complete; Ship disabled with "Scan the products to ship."; Cancel goes to the orders.

**ORD-32 · The form and getting ready on a phone**
Smoke: `e2e/order-forms.spec.ts` (390 × 844, touch).
Neither scrolls sideways; on getting ready the Barcode box has the focus and the camera says it needs https.

**ORD-33 · The order form's two columns, and the required marks**
Smoke: `e2e/order-forms.spec.ts`.
At 1440 px Customer and Order side by side, tops aligned; at 1100 px one column. First name, Last name, Email,
Warehouse, Source, Payment method and Status carry a "*", Order number and Comment none, and both sections say "Fields
marked * are required."

**ORD-35 · Check now pulls every active connection, only what changed since its last pull, and a failing shop fails alone**
Smoke: `e2e/orders-sync.spec.ts` (API; its connections place orders in España).
Two processing orders at the fake shop; a second connection to it and one to no shop: 202, the first imports 2 (named
by its connection), the other fails with `pull_failed` in its health. Again, with an older and a newer order added:
only the newer is read.

**ORD-36 · A linked order's status is written back: Processed → processing, Sent → completed, the others nothing**
Smoke: `e2e/orders-sync.spec.ts` (API, the fake shop).
A Fake shop order marked Processed: the shop receives `processing`; shipped whole: `completed`; Created, Completed and
Partial write nothing; the outbox holds exactly those two.

**ORD-37 · A push that fails three times is failed in the outbox and the health, and Retry queues it again**
Smoke: `e2e/orders-sync.spec.ts` (API; Retry stands in for the 1- and 5-minute waits).
A connection to no shop: the status change is saved at once, the push fails with its error; at the third failure it is
`failed`, the health shows `failed_pushes: 1` and `push_failed`; Retry makes it pending and the worker tries a fourth
time.

**ORD-38 · The timeline shows who wrote each comment and when; a dateless one shows the order's date, marked approximate**
Smoke: `e2e/comments.spec.ts`.
W00003's comment by Sergio Barbosa, dated "≈ <the order's Created>" with "Approximate date (the order's): written
before comments had dates"; no console error.

**ORD-39 · Enter sends, Shift+Enter starts a line, and the box keeps the focus**
Smoke: `e2e/comments.spec.ts` (W00009).
Send is off while the box is empty or blank. Shift+Enter keeps two lines in the box; Enter adds the comment signed and
dated now, empties the box, keeps the focus, and the list counts 2.

**ORD-40 · A pinned comment is shown on top of the order and on its row; pinning another unpins it**
Smoke: `e2e/comments.spec.ts`.
W00006: Pin on a comment shows it in the "Pinned" card and in the row's Notes; pinning another replaces it; Unpin
hides the card and the row shows the count again.

**ORD-41 · A quick phrase adds a dated comment in one tap**
Smoke: `e2e/comments.spec.ts`.
An active phrase (made through the API) is a chip on W00007's detail; a tap adds it marked "Quick phrase" and dated;
the box stays empty.

**ORD-42 · On a shop's order, "Also send to the shop" sends the note to the shop**
Smoke: `e2e/comments.spec.ts` (the fake shop).
A Fake shop order offers "Also send to Fake shop as an order note"; ticked and sent, the comment says "Sent to the
shop" and the fake shop receives the note.

**ORD-43 · The shop's notes come in with Check now, marked with the shop, among the others, once**
Smoke: `e2e/comments.spec.ts` (the fake shop, API).
A shop note dated between two office comments, Check now twice: the note shows once, as "Shop · Fake shop", between
the two by date.

## 6. Invoices (INVC)

Signed in as `sales` (the admin is refused on invoices by design).

**INVC-01 · The list shows the invoices, and the old addresses land on the new screens**
Smoke: `e2e/invoices.spec.ts`.
`/admin/invoice/` opens "Invoices" with Create invoice; INV-0001 reads "Walk-in customer" and `$100.00`, its "⋯" opens
the PDF in a new tab; a search nothing matches says so and "Show all" brings it back; `/admin/invoice/new` opens the
form.

**INVC-02 · The detail opens in a slide-over with the lines and the PDF**
Smoke: `e2e/invoices.spec.ts`.
"⋯" › Detail: "Invoice INV-0001" with "Example product" and `$100.00`; Open PDF opens a PDF in a new tab; Close closes
it.

**INVC-03 · An invoice is created with a customer, a product and tax, and the list shows it**
Smoke: `e2e/invoices.spec.ts`.
The number is `INV-0002`; Jose Perez fills his email; KF-02 fills the description and $150; quantity 2 and 6 %:
`$300.00`, `$18.00`, `$318.00`; Create invoice opens the PDF, the list says "Invoice created." with the new row, and
its PDF answers.

**INVC-04 · Add all products puts every product of the warehouse on the invoice, and a line can be removed**
Smoke: `e2e/invoices.spec.ts`.
"Add all products from Colombia": KF-01, KF-02, KF-03 and `$450.00`; Remove line 3: `$250.00`; Add line adds an empty
one.

**INVC-05 · An invoice needs a line, and a code already used is refused**
Smoke: `e2e/invoices.spec.ts`.
Nothing typed: "Please add at least one invoice item."; a description-only line with `INV-0001`: "An invoice with this
code already exists." and the form stays.

**INVC-06 · The admin is refused on invoices**
Smoke: `e2e/invoices.spec.ts`.
The admin: no Invoices entry, "You do not have permission to do this.", and the API answers 403 (no role reaches the
invoice roles: they are given one by one).

**INVC-07 · The list is filtered by customer or number and by a date range**
Smoke: `e2e/invoices.spec.ts`.
"jose" keeps INV-0002, "walk-in" INV-0001; a From in the future or a To long ago: "Nothing matches these filters.";
Clear filters and Show all bring every row back.

**INVC-08 · A row opens the invoice in a slide-over beside the list**
Smoke: `e2e/invoices.spec.ts`.
A click on INV-0002's row: KF-02, "Sales tax 6%", `$318.00`, the list still behind; Escape closes it.

**INVC-09 · On a phone the invoice form and the list fit without scrolling sideways**
Smoke: `e2e/invoices.spec.ts` (390 × 844, touch).
"Add all products" gives three line cards with their fields and `$450.00`; the list shows INV-0001 with `$100.00`;
neither scrolls sideways.

**INVC-10 · The invoice form reads like the document**
Smoke: `e2e/invoices.spec.ts`.
At 1440 px Customer on the left and Invoice on the right, tops aligned; the Lines under both, headed Product,
Description, Qty, Unit price, Line total; Add line and "Add all products from Colombia"; the subtotal and total
follow; Tab goes description → quantity → unit price; Create invoice is the one primary button and Cancel goes back to
the list.

## 7. Users (USR)

**USR-01 · The list shows every account with its roles, and the old address lands on it**
Smoke: `e2e/users.spec.ts`.
`/admin/user/` opens "Users": the admin's row with the Admin chip, the inventory clerk's row, no `ROLE_ADMIN` text.

**USR-02 · A new user is created, appears in the list and signs in to what the role opens**
Smoke: `e2e/users.spec.ts`.
Name, email, username, password and Inventory: "The user was created." and the row with Inventory; signed in, the new
account sees Products and none of Orders, Customers, Users, Warehouses or Invoices.

**USR-03 · Editing without typing a password keeps the password**
Smoke: `e2e/users.spec.ts`.
The Password box is empty; a new name and Orders: "The user was updated.", the row shows both, and the old password
still signs in.

**USR-04 · The form names what is missing and what is wrong**
Smoke: `e2e/users.spec.ts`.
Save empty marks Name and Password; a bad email and a 3-character password: "This value is not a valid email
address." and "The password needs at least 6 characters."; nothing is saved.

**USR-05 · A user that no longer exists says so**
Smoke: `e2e/users.spec.ts`.
`/admin/users/999999/edit`: "This user no longer exists."; "Back to the users" goes back.

**USR-06 · A person without the Users role is refused**
Smoke: `e2e/users.spec.ts`.
As `inventory`: no Users entry, "You do not have permission to do this.", the API answers 403.

**USR-07 · The form groups the roles by what they open and describes each one**
Smoke: `e2e/users.spec.ts`.
Groups Warehouse, Sales, Invoices and Admin, nine roles, Inventory described, "Admin includes everything except
invoices.", no `ROLE_` text.

**USR-08 · The list filters by status and a row opens its form**
Smoke: `e2e/users.spec.ts`.
Inactive hides the admin, Active shows him, All resets; a click on his row opens Edit user.

**USR-09 · Saving toasts, and the action bar is in view**
Smoke: `e2e/users.spec.ts`.
On Edit, Save is on screen; Inventory unticked and saved: "The user was updated." and back on the list.

**USR-10 · A new password typed on Edit replaces the old one**
Smoke: `e2e/users.spec.ts`.
A new password saved: the old one is refused (401) and the new one signs in.

## 8. Emails (MAIL)

**MAIL-01 · An order placed by hand is emailed to the printer**
Smoke: `e2e/order-forms.spec.ts`.
ORD-13's order: "Order #<number> was created" to `printer@kf.local` (the dev `MAILER_PRINTER_ADDRESS`), cc
`sales@klassicfab.com`, from `KF Inventory <orders@kf.local>`, "A new order was created and attached to this email.",
with `order-<id>.pdf` attached.

**MAIL-02 · Editing an order sends no email**
Smoke: `e2e/order-forms.spec.ts`.
W00001 edited (comment, PayPal): once a later order's email has arrived through the same queue, no "Order #W00001 was
created" has.

**MAIL-03 · The order email takes its sender, printer and cc from Settings, the server's when empty**
Smoke: `e2e/settings.spec.ts`.
Settings › Email with a sender, a printer and a cc saved: a Fake shop order's email goes to that printer, from that
sender, cc that address. The printer emptied: the next one goes to `printer@kf.local` again.

## 9. WooCommerce webhook (HOOK)

Each shop posts its orders to its connection's own URL, `/webhooks/shops/{token}`, signed with
`X-WC-Webhook-Signature` = base64(HMAC-SHA256(raw body, the connection's secret)). The old single URL,
`/admin/order/1H39j0jpQPsWL958v9R4`, was removed (the user, 2026-10-06; `docs/pdr/prd-shops-settings.md`, Decision
24): it answers 410 and counts the hit.

**HOOK-01 · The old webhook URL answers 410 to everything and places nothing**
Smoke: `e2e/webhook.spec.ts`.
A sample order posted with a source the old import matched, and with the Fake shop's site, and a plain GET: 410
`{"status":false,"error":"webhook_moved"}`; no warehouse has the order, no email is sent for it.

**HOOK-02 · A hit on the old URL is counted and shown in Settings**
Smoke: `e2e/webhook.spec.ts`.
`legacy_hits` one higher and `legacy_last_hit_at` set; Settings › General: "N deliveries reached it since the deploy…";
Settings › Shop connections warns "The old webhook URL received N deliveries…".

**HOOK-03 · A signed delivery to a connection is placed in its warehouse, linked, named and printed**
Smoke: `e2e/webhook.spec.ts`.
To the Fake shop: `{"status":true}`, the order in Colombia named "Fake shop", billing and shipping addresses, the lines
by SKU; the connection's last webhook and import are set; the printer gets "Order #<id> was created". The same body
again: `{"status":true}` and still one order.

**HOOK-04 · A wrong signature is refused and kept without its body; an unknown token stores nothing**
Smoke: `e2e/webhook.spec.ts` (its own connection).
A wrong signature: 401 `{"status":false}`, one `bad_signature` row in the connection's failed deliveries with no body;
an unknown token: 404.

**HOOK-05 · An unknown SKU is kept in the inbox and placed by Retry once the product exists**
Smoke: `e2e/webhook.spec.ts` (its own connection, API).
200, no order; the inbox holds it as `unknown_product` naming the SKU; the product created, Retry: `placed`, with the
shop's order number.

## 10. Design system (DS)

**DS-01 · The shell at 1440 px**
Smoke: `e2e/design-system.spec.ts`.
The KF mark and "KF Inventory", the groups Warehouse, Sales and Admin, `Sergio Barbosa`; the first Tab focuses "Skip
to content" and Enter moves the focus to the page.

**DS-02 · The sidebar collapses to a rail with tooltips and stays so**
Smoke: `e2e/design-system.spec.ts`.
"Collapse the menu": a rail of icons named by their tooltips (Products, Upload a stock sheet, Scan, Orders…), the
current page's marked; still a rail after a reload; "Expand the menu" brings the names back.

**DS-03 · The phone layout**
Smoke: `e2e/design-system.spec.ts` (390 × 844, touch).
Products, Orders and Scan do not scroll sideways; no sidebar; the tab bar holds Products, Scan, Incoming; "Menu" opens
the drawer, and Orders in it navigates and closes it.

**DS-04 · Menus work with the keyboard, and the focus ring shows**
Smoke: `e2e/design-system.spec.ts`.
A row's "⋯" and the theme menu open with Enter on their first item; the arrows, Home and End move; Escape gives the
focus back to the button, which shows the 2 px ring, as does the next control Tab reaches.

**DS-05 · The tab title follows the page**
Smoke: `e2e/design-system.spec.ts`.
"<the page's title> · KF Inventory"; "Page not found · KF Inventory"; "Sign in · KF Inventory".

**DS-06 · The language switch keeps the page**
Smoke: `e2e/design-system.spec.ts`.
On Customers, Español: the menu and the page in Spanish ("Pedidos", "Clientes"), the same address and as many rows;
still Spanish after a reload; English back.

**DS-07 · Light, dark, or the system's, without a white flash**
Smoke: `e2e/design-system.spec.ts`.
Dark is applied and kept after a reload, already on the page when its body is first parsed (no white flash); System
follows the system's light and dark.

**DS-08 · Notifications**
Smoke: `e2e/design-system.spec.ts` (on `/admin/_kit`).
A success toast goes after 5 seconds; an error one stays until Dismiss.

**DS-13 · Signing in: show the password, Caps Lock, the error in place**
Smoke: `e2e/design-system.spec.ts`.
The eye shows the password; a key pressed with Caps Lock on shows "Caps Lock is on", and it goes when it is off;
"Sign in" with a field empty: "Type your username and password." and the focus on Username.

**DS-14 · The page not found is branded, with the way back**
Smoke: `e2e/design-system.spec.ts`.
"Page not found" and "Go to the product list", which opens it.

**DS-15 · Every filter control in the kit works**
Smoke: `e2e/design-system.spec.ts` (on `/admin/_kit`).
The text filter, the Status list with counts, the Created quick picks, the Total ranges, a chip removed, the pager's
Next ("76 – 100 of 1,240"); in the server-mode table a header sort and a status tick ask for other rows.

**DS-16 · The filter sheet on a phone**
Smoke: `e2e/design-system.spec.ts` (390 × 844, on `/admin/_kit`).
No filter row; "Filters · 0" opens a sheet that keeps the focus; Escape closes it changing nothing; Status › Created,
"Show 11 results": the chip and only Created rows, "Filters · 1".

## 11. Settings (SET)

Settings (`/admin/settings`) is the admin's: General, Email, Analytics, Shop connections, Quick phrases.

**SET-01 · Settings is the admin's only**
Smoke: `e2e/settings.spec.ts`.
The sidebar's Settings opens the five tabs, General with America/Bogota, where email leaves from and "The old webhook
URL"; as `inventory`: no entry, "Page not found", and the API 403.

**SET-02 · General says where email leaves from, and that the old webhook URL is retired**
Smoke: `e2e/settings.spec.ts`.
"The server's MAILER_DSN (no SMTP server in Settings)" with `(mailpit)`; the old URL "answers 410 and places nothing",
its hits since the deploy, and no switch.

**SET-03 · Email: the server is saved, the password field is blank afterwards**
Smoke: `e2e/settings.spec.ts`.
Mailpit as Host, Port, User, Password, Encryption None, Save: "Email settings saved.", the password blank with "A
password is saved"; the API says `has_password` and `source.dsn: settings` and never the password; a save with the
password blank keeps it.

**SET-04 · "Send test email" reaches Mailpit through the saved server**
Smoke: `e2e/settings.spec.ts`.
"Send to" holds the admin's email; Send: "Sent through mailpit" and "KF Inventory test email" arrives; again at once:
"Wait a few seconds before sending another test email."

**SET-05 · A wrong host answers the server's own error inline**
Smoke: `e2e/settings.spec.ts` (as `smoke-settings`: the test email is limited per person).
Host `nowhere.invalid`, Send: "The server refused it: …" in the panel, no success line; Mailpit is saved back.

**SET-06 · Analytics IDs load both scripts after navigation, never on the sign-in page**
Smoke: `e2e/settings.spec.ts` (the two outside hosts answered by the test).
`G-SMOKE123` and `smoke12345` saved: on Orders, the gtag and Clarity scripts once each; signed out, the sign-in page
asks for neither, nor for the public settings.

**SET-07 · Quick phrases: add, rename, reorder, deactivate**
Smoke: `e2e/settings.spec.ts`.
Two phrases added ("Phrase added."), the second renamed and moved up (the API keeps the order); switched off, "Smoke
first" stays listed but leaves what the comment box reads.

**SET-08 · A bad GA ID is refused in place**
Smoke: `e2e/settings.spec.ts`.
`UA-123456-1`: "A GA4 ID looks like G-ABC1234 …", no toast, nothing saved.

## 12. Shop connections (SHOP)

Settings › Shop connections (`/admin/settings/shops`): a connection per WooCommerce shop: its webhook, keys,
warehouse, what the app may write back, its health and its failed deliveries.

**SHOP-01 · A new connection shows its webhook URL and secret, each with Copy**
Smoke: `e2e/shops.spec.ts`.
Add connection: Test connection disabled until saved; saved: "Connection … created.", the address
`/admin/settings/shops/{id}`, the webhook URL (`/webhooks/shops/<64 hex>`) and the secret with Copy each, and Test
connection enabled; no console error.

**SHOP-02 · Test connection says why bad keys fail and names the store with good ones**
Smoke: `e2e/shops.spec.ts` (the fake shop).
Wrong keys: "The shop did not answer"; blank keys (the saved ones): "Connected to Fake shop · WooCommerce …".

**SHOP-03 · Editing with blank keys keeps the saved ones**
Smoke: `e2e/shops.spec.ts`.
"Keys are saved. Leave both blank to keep them."; renamed with Order status on: "Connection … saved." and the API still
says `has_keys`.

**SHOP-04 · A deactivated connection keeps what its shop sends**
Smoke: `e2e/shops.spec.ts` (UI + API).
⋯ › Deactivate: "… is inactive.", the card reads Inactive; a signed delivery answers 200 and waits with reason
`inactive`.

**SHOP-05 · Health lines and counters**
Smoke: `e2e/shops.spec.ts`.
After a refused signature, the Fake shop card's health reads Last failure, "Bad signature", and "N failed deliveries"
links to the inbox.

**SHOP-06 · The failed deliveries: filters, body, Retry, Discard**
Smoke: `e2e/shops.spec.ts`.
"Failed deliveries", "Status: Failed"; filtered by the shop order, the row reads "KF-SMOKE-MISSING × 2" and "Unknown
product"; its panel shows the body; Retry: "Still not placed…"; Discard: "Delivery discarded." and the row goes.

**SHOP-07 · The Orders warning line links to the right connection**
Smoke: `e2e/shops.spec.ts`.
Orders warns "Fake shop: N orders could not be placed"; "Fix in Settings" opens its failed deliveries.

**SHOP-08 · Check now answers per connection**
Smoke: `e2e/shops.spec.ts`.
Orders › Check now: "N orders imported from N shops, N skipped." (a toast that stays when a shop could not be read).

**SHOP-09 · The Source column names the shop; its filter lists the shops**
Smoke: `e2e/shops.spec.ts`.
A Fake shop order reads "Fake shop" in Source; Source › Fake shop shows the chip "Source: Fake shop" and that order.

## 13. Table filters (FLT)

Every list filters, sorts and pages on the server; the filters sit in the row under the headers (a sheet on a phone)
and live in the address. The orders cases keep to the fixtures' W000… orders, whose delivered and partial ones no case
changes.

**FLT-01 · Orders: the Order filter finds an order by its number on the server**
Smoke: `e2e/filters.spec.ts`.
`W00007` in "Filter by Order": the server is asked, one row, the chip "Order: W00007", `filter[code]=W00007` in the
address.

**FLT-02 · Orders: the Status list counts each status, ticks several, and the chip names them**
Smoke: `e2e/filters.spec.ts`.
Among W000…: Partial 2 and Delivered 2; both ticked: "Status · 2", the chip "Status: Partial, Delivered", four rows of
those statuses, and no status chip of the toolbar pressed.

**FLT-03 · Orders: Last 30 days fills the Created range, and the chip says it**
Smoke: `e2e/filters.spec.ts`.
On the two delivered W000… orders, Created › Last 30 days: "Created: …" on the button and a chip, `created_at` in the
address, both orders kept.

**FLT-04 · Products: a price and a quantity range narrow the stock on the server**
Smoke: `e2e/filters.spec.ts`.
Price › Over $500: none on the fixtures ("Nothing matches these filters.") with its chip; a typed Min and Quantity ›
Over 10: exactly the products at or over that price with more than 10, the chips, the range in the address.

**FLT-05 · Customers: 1,240 of them are paged on the server, and an email filter finds one on a late page**
Smoke: `e2e/filters.spec.ts`.
Filtered by `@flt.test`: "1 – 25 of 1,240", 25 rows; Next: "26 – 50 of 1,240", `page=2`; `flt-0007@flt.test` +
Enter: that one row, back on page 1.

**FLT-06 · Invoices: a total range and the payment method narrow the list**
Smoke: `e2e/filters.spec.ts`.
Total › $100 – $500 with its chip; Payment lists two methods; Credit card - Paypal adds its chip and keeps only such
invoices (none on the fixtures).

**FLT-07 · Users: the Roles list counts each role, and a tick keeps who has it**
Smoke: `e2e/filters.spec.ts`.
Nine roles by their names (no `ROLE_`), Inventory with its count; ticked: "Roles: Inventory" and as many rows, each
with the Inventory badge.

**FLT-08 · The address holds the filters: a reload and a pasted link restore them, Clear filters empties it**
Smoke: `e2e/filters.spec.ts`.
Delivered and `W0000`: both in the address and as many rows as the server holds; a reload and the pasted link show the
chips, the text and the rows again; Clear filters leaves no chip and no `filter` in the address.

**FLT-09 · A header sorts on the server and its arrow follows**
Smoke: `e2e/filters.spec.ts`.
Users › Email: `sort=email`, ascending; again: `sort=-email`, descending.

**FLT-10 · On a phone, the filters are a sheet: "Show N results" counts the draft and applies it**
Smoke: `e2e/filters.spec.ts` (390 × 844, touch).
No filter row; the sheet's Status › Delivered: "Show N results" counted on the server, 44 px tall; applied: the chip,
"Filters · 2", N cards.

**FLT-11 · The sheet's date quick picks and money ranges**
Smoke: `e2e/filters.spec.ts` (390 × 844, touch).
Invoices › Filters › Date: Today, Last 7 days, Last 30 days and This month at 44 px, date inputs; Last 30 days is
pressed and fills both. Total: the three ranges and a decimal Min; $100 – $500 counts its results; Clear filters
counts every invoice; Escape closes the sheet applying nothing.

## 14. Every screen (UI)

Each case opens its screens once per device and look (1440 px, and 390 px with touch; light and dark; English and
Spanish) and checks what "On every screen" says above.

**UI-01 · The sign-in page looks right**
Smoke: `e2e/screens.spec.ts`.
Signed out, `/admin/login`.

**UI-02 · The page not found looks right**
Smoke: `e2e/screens.spec.ts`.
`/admin/nothing-here`.

**UI-03 · The product list and the product form look right**
Smoke: `e2e/screens.spec.ts`.
Colombia's products, and Create product.

**UI-04 · Upload, scan, incoming and the warehouses look right**
Smoke: `e2e/screens.spec.ts`.
The four warehouse screens.

**UI-05 · The orders and an order's detail look right**
Smoke: `e2e/screens.spec.ts`.
The list, and W00001's slide-over with its timeline.

**UI-06 · The order form and getting ready look right**
Smoke: `e2e/screens.spec.ts`.
New order, and W00001's getting ready.

**UI-07 · The customers and the customer form look right**
Smoke: `e2e/screens.spec.ts`.
The list, and Create customer.

**UI-08 · The invoices, an invoice's detail and the invoice form look right**
Smoke: `e2e/screens.spec.ts` (as `sales`).
The list, INV-0001's slide-over, and Create invoice.

**UI-09 · The users and the user form look right**
Smoke: `e2e/screens.spec.ts`.
The list, and Create user.

**UI-10 · Every tab of Settings looks right**
Smoke: `e2e/screens.spec.ts`.
General, Email, Analytics, Shop connections, Quick phrases.

**UI-11 · A shop connection's form and its failed deliveries look right**
Smoke: `e2e/screens.spec.ts`.
The Fake shop's form, and its failed deliveries.
