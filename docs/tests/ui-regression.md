# UI regression suite

What a real user does with the app, case by case, written as steps and what must happen. It is run in two parts:
the **smoke suite** (Playwright, `backend/e2e/`) runs the simple cases against the Docker stack, and when it is green
a person runs the rest in a browser, **in order**: later cases use the data earlier ones create.

A case with `Smoke:` under its title is run by the script named there and skipped by the manual run; with
`Smoke (part):` the script covers what the line says and the rest ("by hand: …") is run manually; with neither, the
whole case is manual.

Every new feature adds its cases here, in the section of the screen it lives on, in the same format. A case is
only worth adding if it would catch the feature breaking: name the button, the data and what you should see.
Case IDs are stable: a new case takes the next number in its section, and a removed case leaves a gap.

Each run is recorded as a new file in [`runs/`](runs/): the smoke suite's attempts and the result of every manual
case (`python3 ~/.claude/skills/symfony-react-app/scripts/new-run.py` creates it, `smoke.py` runs the smoke suite
and records it).

## Before you start

**Start from known data, not from whatever the last run left.** Everything runs in Docker; `backend/e2e/prepare.sh`
does all of this (and the smoke suite runs it first):

```bash
docker compose exec php php bin/console doctrine:database:drop --force
docker compose exec php php bin/console doctrine:database:create
docker compose exec php php bin/console doctrine:migrations:migrate -n
docker compose exec php php bin/console app:smoke:prepare --seed
```

- `docker compose ps`: every service is up, and `docker compose logs node` says the last build compiled.
- Open the mail catcher (Mailpit, `http://localhost:8025` or the stack's `MAILPIT_PORT`) next to the app: cases that
  send email end with "an email arrives".
- Use one browser profile for the run and nothing else on the app's origin in it: tabs share one session.
- Have ready: the stock spreadsheet template (downloaded from the Products screen) for the upload cases, and a
  keyboard to type barcodes (a scanner types a code and Enter).

**Accounts.** Dev only (the fixtures, `src/DataFixtures/UserFixtures.php`), never reuse these passwords.

| Role | Sign in with | Lands on |
|---|---|---|
| Admin (`ROLE_ADMIN`: inventory, warehouses, orders, customers, users) | `sbarbosa115` / `123456` | `/admin/products` |
| Inventory clerk (`ROLE_MANAGE_INVENTORY`) | `inventory` / `123456` | `/admin/products` |
| Invoice clerk (the invoice roles + customers) | `invoices` / `123456` | `/admin/products` |
| Sales clerk (the invoice roles + customers + inventory: invoices with products) | `sales` / `123456` | `/admin/products` |

**On every screen, whatever the case says**, also check:

- The browser console has no errors, and nothing is a blank page.
- No text shows a raw translation key (`orders.title`).
- Tables and forms look like the rest of the app (`CLAUDE.md`): built from the kit, light and dark both readable.
- At 390 px (a phone): no sideways scroll of the page, lists as cards, the tab bar at the bottom.
- A success or error message appears after every save, and it belongs to *that* save.

---

## 1. Authentication and shell (AUTH, NAV)

**AUTH-01 · Signing in opens the product list**
Smoke: `e2e/auth.spec.ts`.
Open `/admin/login`, sign in as the admin ("Sign in"). The product list opens and the top bar shows the name `Sergio Barbosa`.

**AUTH-02 · A wrong password is refused**
Smoke: `e2e/auth.spec.ts`.
Sign in as `sbarbosa115` with a wrong password: "Wrong username or password." and the page stays on the sign-in form.

**AUTH-03 · A page opened signed out comes back after signing in**
Smoke: `e2e/auth.spec.ts`.
Signed out, open `/admin/warehouses`: the sign-in page. Sign in: the Warehouses page opens.

**AUTH-04 · Sign out ends the session**
Smoke: `e2e/auth.spec.ts`.
Top bar › your name › Sign out: the sign-in page. Open `/admin/products` again: the sign-in page.

**AUTH-05 · A legacy 301 bookmark redirects to the React app and sign-in**
Smoke: `e2e/auth.spec.ts`.
Signed out, open `/admin/product/` (a legacy 301 redirect): the app redirects to `/admin/products` and then to the sign-in page.

**AUTH-06 · Remember me keeps you signed in after closing the browser**
Sign in with "Remember me" ticked, close every window of the browser, open `/admin/products`: still signed in.
Without it, the same steps end on the sign-in page.

**NAV-01 · The admin sees every section they had**
Smoke: `e2e/auth.spec.ts`.
Signed in as the admin: Warehouse (Products, Upload a stock sheet, Scan, Incoming, Warehouses), Sales (Orders,
Customers), Admin (Users). No Invoices (the admin role does not include the invoice roles, as before).

**NAV-02 · The inventory clerk sees the warehouse entries only**
Smoke: `e2e/auth.spec.ts`.
Signed in as `inventory`: Products, Upload a stock sheet, Scan and Incoming; no Warehouses, Orders, Invoices, Customers
or Users.

**NAV-03 · An unknown address shows "Page not found"**
Smoke: `e2e/auth.spec.ts`.
Open `/admin/nothing-here` signed in: "Page not found" inside the app, with a link to the product list.

**AUTH-07 · The sign-in page in Spanish**
Smoke: `e2e/design-system.spec.ts`.
On `/admin/login`, under the form, choose ES: "Iniciar sesión", "Usuario", "Contraseña". Reload: still Spanish. A new
browser whose language is Spanish (es-CO) opens the sign-in page in Spanish the first time.

**AUTH-08 · The name in the top bar, Sign out in its menu**
Smoke: `e2e/design-system.spec.ts`.
Signed in as the admin: the top bar shows `Sergio Barbosa` (not the email). Open it: the username `sbarbosa115`, the
email and "Sign out".

**NAV-04 · The rail shows icons with tooltips**
At 1440 px, "Collapse the menu" at the bottom of the sidebar: a narrow rail of icons; hovering each shows its name
(Products, Upload a stock sheet, Scan, …); the current page's icon is marked. "Expand the menu" brings the names back.

**NAV-05 · The tab bar of the inventory clerk**
Smoke: `e2e/design-system.spec.ts`.
At 390 px as `inventory`: the bottom tab bar shows Products, Scan, Incoming and More; More opens the whole menu.

**NAV-06 · The scan shortcut only for the inventory roles**
Smoke: `e2e/design-system.spec.ts`.
As `inventory`, the top bar has "Open the reader" (a barcode icon) leading to `/admin/products/barcode`. As
`invoices`, it is not there.

## 2. Products (INV)

<!-- Item 6 (products-ui) adds INV-01 – 08; item 7 (stock-ui) adds INV-09 – 16. -->

**INV-01 · The product list opens on the first warehouse, and the old address lands on it**
Smoke: `e2e/products.spec.ts`.
Signed in as the admin, open `/admin/product/` (the previous version's address): `/admin/products` opens, "Products",
the warehouse switch on Colombia, one row per product in stock there (checkbox, Code in monospace, Title, Detail
truncated, Quantity, Price as `$100.00`, a "⋯" menu; no Warehouse column). Move to warehouse and Download stock sheet
appear only in the selection bar once a row is ticked; "Create product" is always the one primary button.

**INV-02 · Another warehouse reloads the list; the search narrows it**
Smoke: `e2e/products.spec.ts`.
Pick España in the warehouse switch: "This warehouse has no products in stock…"; back to Colombia: its rows again.
Type `KF-02` in the search box: only that row; type something no product has: "Nothing matches these filters." and "Show all" brings every row
back. Sorting by a column header and the pages (10 rows each) work as on the other lists.

**INV-03 · The selected products download as the stock spreadsheet**
Smoke (part): `e2e/products.spec.ts` ticks two rows and checks the download is `Products.xls`.
Tick KF-01 and KF-02 (the selection bar says "2 selected"), Download stock sheet: `Products.xls` downloads. By hand: open it:
the header row (Code, Title, Detail, Quantity, Price) and exactly the two products ticked, quantity and price 0 (the
previous version's download was empty whenever more than one row was ticked). "Select all" in the header ticks every
row of the page shown.

**INV-04 · Move to Warehouse moves the chosen quantities; they arrive as incoming**
Smoke (part): `e2e/products.spec.ts` moves 2 of KF-03 to Usa and checks both warehouses through the list and the API.
Tick KF-03, Move to warehouse: a centred panel (the list dimmed behind it) lists the ticked products, each with a quantity
from 1 to what Colombia holds (starting at 1); a product with nothing left says "Product quantity is 0". Destination
warehouse offers every warehouse but Colombia. Pick Usa and 2, Move: the panel closes, a toast says "Moved to Usa. The
products arrive there as incoming.", the ticks are cleared and KF-03 shows 2 fewer. By hand: Incoming products, warehouse Usa: KF-03 with 2.
Ticking several products and leaving their quantities at 1 moves 1 of each (the previous version moved only the rows
whose quantity had been changed).

**INV-05 · A move the warehouse can no longer cover is refused, and nothing moves**
Open the product list in two tabs on Colombia. In the first, move all of KF-01's quantity to Usa. In the second (still
showing the old quantity), tick KF-01, Move to Warehouse, pick the old full quantity, Move: the dialog stays open with
"Only 0 of KF-01 are available." (or the quantity left), Move can be pressed again, and closing the dialog and
reloading shows the stock unchanged by that attempt. Cancel and the × never move anything, and neither is red.

**INV-06 · A new product is created, and the form names what is missing**
Smoke: `e2e/products.spec.ts`.
Create product: "Create product", one "Product" section (Code, Title, Detail, Price with a "$", the Active switch last,
on), no yellow warning, an action bar with Save and Cancel. Save empty: Code and Title say "This value should not be blank."; Code `CODE` (or `·`)
and Title `PRODUCT` are refused ("This value should not be equal to …"), a negative price too; nothing is sent. Fill
Code `SMOKE-INV-06`, Title, Price `25.5`, Save: back on the list with a toast "Product saved" (the new
product is not in the list: it has no stock yet; INV-21 covers the toast's links).

**INV-07 · A product is edited, from the list and from its old address**
Smoke: `e2e/products.spec.ts`.
Open `/admin/product/edit/<uuid>` of the product of INV-06: its form at `/admin/products/<uuid>/edit`, "Edit product",
filled in. Change the Title, switch Active off, Save: the toast "Product saved" (no next-step links on an edit). A
row's "⋯" menu → Edit opens that product's form; Cancel goes back without saving. `/admin/products/<unknown uuid>/edit` says
"This product no longer exists." with a link back to the products.

**INV-08 · A person without the inventory role is refused**
Smoke: `e2e/products.spec.ts`.
Signed in as `invoices`: no Products entry in the sidebar; opening `/admin/products` says "You do not have
permission to do this."; `/api/v1/warehouses/1/stock` answers 403. Signed in as `inventory`: the list, the move and
the form all work (INV-02 – 07 run as that account).

### Product list and form, redesigned (item 1)

**INV-17 · The figures come from the list; the chips count it and narrow it**
Smoke: `e2e/products.spec.ts`.
Open `/admin/products?warehouse=1`: the strip shows Products (the rows in the list), Units (their quantities added) and
Stock value (quantity × price added, as dollars). The chips read "All N", "In stock N", "Out of stock N" with the
counts of the list. Out of stock: only rows at 0 (or "Nothing matches these filters." with Show all when none);
the figures do not change; "Clear filters" is there while a chip or a search is on and brings every row back.

**INV-18 · Each row has one "⋯" menu, and a click on the row opens its form**
Smoke: `e2e/products.spec.ts`.
"Actions for KF-02" opens a menu with Edit and Download stock sheet only (arrow keys move, Escape closes). Download
stock sheet downloads `Products.xls` with that one product. Clicking the row (not the checkbox or the menu) opens
`/admin/products/<uuid>/edit`.

**INV-19 · The selection bar moves or downloads what is ticked, and Move opens beside the list**
Smoke (part): `e2e/products.spec.ts` ticks two rows, opens the panel, closes it with Escape and clears the selection.
Tick two rows: a sticky bar "2 selected · Move to warehouse · Download stock sheet · Clear". Move to warehouse opens a
slide-over "Move to warehouse" ("From Colombia", the destination, a quantity per product, Cancel and Move); the list
and the warehouse switch stay visible behind it; Escape or Cancel closes it with the ticks kept. By hand: Move with two
products at quantity 1 each posts one move (INV-04 checks the result); on a failure the panel stays open with the
reason (INV-05).

**INV-20 · The warehouse is remembered, and the address can name it**
Smoke: `e2e/products.spec.ts`.
Pick Usa, open `/admin/products` again: Usa is chosen. Open `/admin/products?warehouse=1`: Colombia, and `/admin/products`
now opens on Colombia. By hand: the link in the upload result (item 2) to a warehouse's products opens the list on that warehouse.

**INV-21 · A saved new product offers what to do next**
Smoke: `e2e/products.spec.ts`.
Create product `SMOKE-INV-21`, Save: the list shows the toast "Product saved" with "Scan stock" and a second toast with
"Upload a stock sheet"; the form had no yellow warning. "Upload a stock sheet" opens the upload screen; "Scan stock"
opens the scan screen. By hand: the toasts go away after 5 seconds, and saving an edit shows only "Product saved".

**INV-22 · On a phone the list is cards and the form is one column**
Smoke (part): `e2e/products.spec.ts` at 390 × 844 checks that neither screen scrolls sideways.
By hand, at 390 px and 360 px, light and dark: each product is a card (title, then Code, Quantity and Price) with its
"⋯" and a checkbox; the toolbar wraps (warehouse switch, search, chips); the figures stack; ticking a card shows the
selection bar and Move to warehouse opens the panel over the full width; the product form is one column with its action
bar above the tab bar; every target is at least 44 px; no raw translation key anywhere; Spanish reads naturally
("Trasladar a bodega", "Descargar hoja de existencias").

**INV-09 · The upload screen shows its three steps and links to the template and to every product**
Smoke: `e2e/stock.spec.ts`.
Signed in as the admin, open `/admin/product/upload` (the previous version's address): `/admin/products/upload` opens,
"Upload a stock sheet", three numbered steps: 1 Download the template (Download the template, Download every product:
each opens an `.xls`), 2 Fill in the quantities, 3 Choose the warehouse and the file (the warehouse switch, the drop
zone "Drop the stock sheet here, or choose a file", Upload).

**INV-10 · Upload names what is missing and refuses a file that is not a spreadsheet in place**
Smoke: `e2e/stock.spec.ts`.
Upload with no file: "Choose the stock sheet to upload." under the drop zone; nothing is sent. Choose (or drop) a `.txt`
file: "notes.txt is not an Excel sheet. Choose an .xls or .xlsx file." at once, the file is not kept, and Upload still
sends nothing.

**INV-11 · A spreadsheet from the template is stored in the chosen warehouse**
Smoke (part): `e2e/stock.spec.ts` uploads the all-products sheet into España and checks the summary and its link.
Download every product, put quantities in the Quantity column of two rows and add one new row (code, title, detail,
quantity, price), choose a warehouse and Upload: a summary card "N rows stored in <warehouse>" with "Open the products
of <warehouse>" (`/admin/products?warehouse=<id>`). By hand: that link opens the product list on that warehouse, with
the new product and the quantities added to the existing ones; a sheet with the wrong columns says "The spreadsheet
could not be read. Use the template and try again."

**INV-12 · The scan screen lists a code on Enter, counts a repeated one and says when one is not a product**
Smoke: `e2e/stock.spec.ts`.
Open `/admin/product/update/bar-code`: `/admin/products/barcode` opens, "Scan stock", with "Nothing scanned yet." Type
`KF-01` in Barcode and press Enter: the box empties and keeps the focus, the row shows the code, the product's title
and quantity 1; again: still one row, quantity 2. `NOPE-404` shows "Not a product" in red on its row. The quantity box
can be edited (0 or text turns it red, says "Every quantity must be a whole number of 1 or more." in the footer and
disables the main button), − and + step it, and × (Remove NOPE-404) takes the row out.

**INV-13 · With Usa and Add chosen, the codes read are added in one tap**
Smoke: `e2e/stock.spec.ts`.
Choose Usa and Add stock, read `KF-01` twice, press "Add to Usa": no question, "Added 2 units to Usa." appears, the
list empties and the focus is back in Barcode. The Usa stock list of the Products screen shows KF-01 with 2.

**INV-14 · Removing asks first; more than the warehouse has is refused and keeps the list**
Smoke: `e2e/stock.spec.ts`.
Choose Usa and Remove stock (the mode turns red, and so does "Remove from Usa"), read `KF-01`, set the quantity to 50,
Remove from Usa: "Remove from Usa?" says "50 units of 1 product will be taken out of Usa's stock."; Cancel changes
nothing. "Remove 50 units": "There is not enough stock of KF-01: 2 available." under the box, the list is still there.
With quantity 1 it shows "Removed 1 unit from Usa." and Usa keeps 1.

**INV-15 · Incoming products wait until "Approve all" puts them in stock**
Smoke: `e2e/stock.spec.ts` (the move is made through the API; the Products screen's move panel is item 1's).
After moving KF-02 x4 from Colombia to España, `/admin/product/incoming` opens `/admin/products/incoming`; pick España:
one row (code, product, 4). "Approve all (1)", then "Approve 1 product" in the question: "1 incoming product was
approved.", the rows fade, "Nothing waiting" and "Approve all (0)" disabled. By hand: España's stock list shows KF-02
with 4 and Colombia's with 96.

**INV-16 · A person without the inventory role is told so**
Smoke: `e2e/stock.spec.ts`.
Signed in as `invoices`: no Products menu; `/admin/products/incoming` says "You do not have permission to do this.";
an upload submitted on `/admin/products/upload` says the same.

### Upload, scan and incoming, redesigned (item 2)

<!-- Item 2 (warehouse-ops-ui) adds INV-23 – 30 here, and updates the texts of INV-09 – 16. -->

**INV-23 · The scan screen remembers the warehouse and the mode**
Smoke: `e2e/stock.spec.ts`.
Signed in as `inventory`, open Scan: Colombia and Add stock are chosen (nothing remembered yet). Choose España and
Remove stock, reload: still España and Remove stock, and the main button reads "Remove from España" (disabled with
nothing scanned). Upload and Incoming open on España too (the warehouse is remembered per browser).

**INV-24 · Undo last scan takes back the last read**
Smoke: `e2e/stock.spec.ts`.
Read `KF-01`, `KF-01`, `KF-02`: the last code read is on top and flashes. "Undo last scan": KF-02 goes, KF-01 stays at 2,
the focus is back in Barcode. Ctrl+Z (⌘Z on a Mac) takes back one more: KF-01 at 1. With nothing read, Undo last scan
is disabled.

**INV-25 · The footer sums what will be sent, leaving out codes that are not products**
Smoke: `e2e/stock.spec.ts`.
Read `KF-01`, `KF-02` twice and `NOPE-25`: the footer says "2 products · 3 units" and "1 code that is not a product is
left out."; "Add to Colombia" stays enabled. "One more KF-01": "2 products · 4 units". By hand: the footer stays at the
bottom of the screen while the list scrolls (above the tab bar on a phone).

**INV-26 · The camera on the scan screen**
Smoke (part): `e2e/stock.spec.ts` checks that on a plain-http address the screen says "The camera needs a secure address
(https). Type the code instead.", offers no Start camera, and typing still works. The camera itself is covered by
`CameraScanner.test.tsx` and `ScanStock.test.tsx` with a fake detector (DS-10/11: no real-phone run, the user's
decision).
By hand, on `http://localhost:<HTTP_PORT>` with a webcam (optional): Start camera, hold a printed Code 128 label of
`KF-01`: a tone, the row KF-01 appears with its title; held still it counts once; the sound button in the header turns
the tone off (and it stays off after a reload).

**INV-27 · The note on what changed is shown until it is dismissed**
Smoke: `e2e/stock.spec.ts`.
The first time Scan opens in a browser: "What changed: the warehouse and Add or Remove are chosen first and remembered…"
above the steps. × (Dismiss): it goes, and stays gone after a reload.

**INV-28 · The drop zone shows the chosen sheet**
Smoke (part): `e2e/stock.spec.ts` chooses the template and checks its name, "N KB · XLS" and the ×.
By hand: drag an `.xlsx` from the computer onto the zone: it is outlined while over it, then shows the name, size and
XLSX; drag a `.pdf`: "<name> is not an Excel sheet. Choose an .xls or .xlsx file." and nothing is kept; the zone works
with the keyboard (Tab focuses it with the ring, Enter or Space opens the file picker).

**INV-29 · Approve all says what it will do, and Cancel approves nothing**
Smoke: `e2e/stock.spec.ts` (it moves KF-03 x1 to España and approves it at the end).
With KF-03 x1 incoming in España, `/admin/products/incoming?warehouse=3`: under the title "in España · 1 product · 1
unit". "Approve all (1)": "Approve everything incoming?" asks "Approve 1 product, 1 unit, into España's stock?"; Cancel
closes it and the row is still waiting.

**INV-30 · The warehouse screens on a phone**
Smoke (part): `e2e/stock.spec.ts` checks at 390 px that Scan, Upload, Incoming and Warehouses do not scroll sideways and
that "Add to Colombia" is on screen with a code read.
By hand at 390 px, light and dark: on Scan the warehouse and mode come first as large controls, the camera fills the
width, the typed box under it, the rows wrap without cutting the code, every button is at least 44 px; Incoming's rows
are cards; the upload steps and the warehouse cards stack.

## 3. Warehouses (WH)

<!-- Item 7 (stock-ui) adds WH-01 – 03. -->

**WH-01 · Every warehouse has a card, and the old address lands on them**
Smoke: `e2e/stock.spec.ts`.
Signed in as the admin, open `/admin/warehouse/` (the previous version's address): `/admin/warehouses` opens,
"Warehouses", one card per warehouse (its name, the shop addresses); `/admin/warehouse/edit/1` lands on the same page.

**WH-02 · A warehouse is renamed in place, and a blank name is refused**
Smoke: `e2e/stock.spec.ts` (it puts the name back).
A click on Usa's name turns it into a box with the name, "Enter saves, Escape cancels." under it. Clear it and Save:
"Type a name for the warehouse." under the box, nothing is sent. Type Miami and press Enter: the box closes, "Usa is now
Miami." and the card's title is Miami. By hand: the new name appears in every warehouse switch (Products, Scan, Upload,
Incoming, Orders).

**WH-03 · Any signed-in person can open the warehouses by address**
Smoke: `e2e/stock.spec.ts`.
Signed in as `invoices` (no Warehouses entry in the menu), `/admin/warehouses` still shows the warehouses, as the
previous version did (the API asks only for a signed-in user: a known gap).

### Warehouse cards (item 2)

<!-- Item 2 (warehouse-ops-ui) adds WH-04 – 05 here, and updates the texts of WH-01 – 03. -->

**WH-04 · Rename from the card's menu, and Escape cancels**
Smoke: `e2e/stock.spec.ts`.
"Actions for España" (⋯) › Rename: the name becomes a box with the focus in it. Type Madrid and press Escape: the card
reads España again, the focus is back on the name, and nothing was saved (a reload still shows España).

**WH-05 · Each card shows where its shop orders come from**
Smoke: `e2e/stock.spec.ts`.
Each card lists, under "Shop orders arrive from", the shop addresses in monospace (Colombia `https://colombia.test`,
España `https://espana.test`); a warehouse with none says "No shop sends its orders here." By hand at 390 px: the cards
stack one per row, long addresses wrap inside the card.

## 4. Customers (CUS)

**CUS-01 · The list shows the customers, and the old address lands on it**
Smoke: `e2e/customers.spec.ts`.
Signed in as the admin, open `/admin/customer/` (the previous version's address): `/admin/customers` opens, "Customers",
a "Create customer" button, one row per customer (name, email, phone, city of the first address, one "⋯" menu with Edit
and Delete). The "Search this page" box finds a customer of the page by name, email, phone or city. By hand, with more
than 100 customers: a compact pager (Previous · "Page 2 of 13" · Next) appears under the table, the header says
"101–200 of 1,240" and the address says `?page=2`. `/admin/customer/new` lands on `/admin/customers/new`.

**CUS-02 · A customer is created with a country, state and city that did not exist**
Smoke: `e2e/customers.spec.ts`.
Create customer › fill Name, Last Name, Email, Phone, Address, Zip Code; in Country type a new name and pick
`Create "…"`, then the same in State and City; Save: back on the list with "The customer was created successfully."
and the new row. By hand: choosing an existing country offers only its states, and an existing state only its cities;
changing the country empties State and City. A name already in the list is not offered as new.

**CUS-03 · Editing shows what was saved, and addresses are added and removed**
Smoke: `e2e/customers.spec.ts`.
Edit the customer of CUS-02 (the row's "⋯" › Edit): every field and the three place names are filled; change the phone,
"Add address" shows a second address card and its "Remove address" takes it out (the first address has no remove
button), Save: the toast "The customer was updated successfully." and the row shows the new phone. By hand: save an address with a new city under an existing
state, open it again: the city is in the City list of every other address of that state.

**CUS-04 · Deleting asks first**
Smoke: `e2e/customers.spec.ts`.
Row "⋯" › Delete › "Delete <name>? Their orders will be removed too.": Cancel keeps the row; Delete removes it with the
toast "The customer was deleted." By hand: the customer's orders no longer appear in the Orders list either.

**CUS-05 · The form names what is missing, and a customer that no longer exists says so**
Smoke: `e2e/customers.spec.ts`.
Create customer, Save with everything empty: Name, Last Name, Email, Phone, Address and Zip Code say "This value should
not be blank."; nothing is sent. An email without `@` says so. `/admin/customers/999999/edit`: "This customer no longer
exists." with a link back to the customers.

**CUS-06 · A person without the Customers role is refused**
Smoke: `e2e/customers.spec.ts`.
Signed in as `inventory`: no Customers entry in the sidebar; `/admin/customers` says "You do not have permission to do
this."; `/api/v1/customers` answers 403.

### Customers, redesigned (item 5)

**CUS-07 · The header counts the page, the search covers every customer, and a row opens the form**
Smoke: `e2e/customers.spec.ts`.
Open Customers: the header's subtitle reads "1–N of N" (the range of the page, the total of the API). The search box is
named "Search customers" and searches every customer on the server (name, email, phone, city), not only the loaded page;
typing a customer's email leaves its row. The row's "⋯" menu has Edit and Delete and nothing else (Delete in the danger
colour); no other button on the row. Clicking the row (not a control) opens Edit customer. By hand: a search that finds
nothing says "Nothing matches these filters." with "Show all"; the sort headers (Name, Email, Phone, City) sort every
customer, not only the page.

**CUS-08 · The form has Contact and Addresses sections, address cards, and Cancel leaves without saving**
Smoke: `e2e/customers.spec.ts`.
`/admin/customers/new`: sections "Contact" (name, last name, email, phone) and "Addresses"; each address is a card
titled "Address 1" (with "· Billing" or "· Shipping" when the address has a type: only addresses that came from a
shop order do); the card holds Address and Zip Code, then Country, State and City in one row (one column on a
phone). "Add address" (secondary) sits under the cards and adds a card; every card but the first has a ghost "Remove
address". Save and Cancel are in a bar fixed at the bottom of the screen; Cancel is not red and leaves without
saving (typed text is gone). By hand: the three selects look like the other inputs, in both themes and with the
keyboard (arrows choose, Enter picks, a typed name offers Create "…").

**CUS-09 · On a phone the list is cards and the form is one column**
Smoke: `e2e/customers.spec.ts` (390 × 844, touch).
Customers: each customer is a card (name as its title, then email, phone and city, the "⋯" button at its corner),
nothing scrolls sideways; the pager, when there is one, fits the width. The form: one column, the address card's
fields stacked, the Save bar above the tab bar and not covering the last field.

**CUS-10 · Spanish and dark, by hand**
By hand, no smoke. Switch to ES: the list, the form and the address cards read in Spanish ("Clientes", "Crear
cliente", "Buscar en esta página", "1–100 de 1.240", "Dirección 1 · Facturación", "Agregar dirección", "Quitar
dirección"); no raw key, no cut-off label. Switch to dark: card borders, the address cards, the three selects (control,
menu, options, focus ring) and the row menu are readable. Saving and deleting show a toast in the chosen language.

## 5. Orders (ORD)

<!-- Item 9 (orders-ui) adds ORD-01 – 10; item 10 (order-forms-ui) adds ORD-11 – 18; item 13 (woocommerce-sync) adds
     ORD-19 – 20. -->

Twelve fixture orders (W00001 – W00012) are on the first warehouse, Colombia: W00001 – W00006 by phone with the
statuses Created … Delivered, W00007 – W00012 from the web likewise, each with one comment and three products. Delete
and Sync Orders need `ROLE_MANAGE_ORDERS`, which the admin reaches through the role hierarchy; ORD-08 and ORD-09 sign
in as a user who holds it without being admin (the smoke spec creates `smoke-orders` / `123456` with
`ROLE_MANAGE_ORDERS` and `ROLE_UPDATE_ORDERS`; by hand, give those two roles to the user of USR-02).

**ORD-01 · The list shows the first warehouse's orders, and the old address lands on it**
Smoke: `e2e/orders.spec.ts`.
Signed in as the admin, open `/admin/order/` (the previous version's address): `/admin/orders` opens, "Orders" with
Create order (primary) and Sync shop orders beside it; a toolbar with the warehouses (Colombia chosen, or the one last
chosen in this browser), the status chips "All 12 · Created 2 · Processed 2 · …", a search box "Order number or
customer" and Created from / Created to; one row per order (newest first, twenty a page): the order number (mono,
first), "Jose Perez" with his email under it, Phone or Web with an icon, the status as a badge with a ▾, the date and
time (`Oct 5, 2026, 6:38 PM`), the comments count and a "⋯" button. The search finds an order by its number or
customer. The sidebar's Orders entry opens the same list.

**ORD-02 · Another warehouse and a status narrow the list**
Smoke: `e2e/orders.spec.ts`.
Press the Delivered chip: only W00006 and W00012 remain. Press All, then the warehouse Usa: "This warehouse has no
orders yet. Create one, or sync the orders of the shops." Reload: Usa is still chosen (remembered); choose Colombia
again.

**ORD-03 · A status changes from its badge, after a question, and stays changed**
Smoke: `e2e/orders.spec.ts`.
W00001's status badge ("Status of order W00001") opens a menu of the six statuses, Created checked. Choose Processed:
"Mark W00001 as Processed?" says "The order moves from Created to Processed. Its stock does not change."; Mark as
Processed: the toast "Order W00001 is now Processed." and the badge says Processed after a reload. By hand: the
order's stock in the Products list has not changed.

**ORD-04 · Choosing Sent opens the getting-ready screen instead**
Smoke: `e2e/orders.spec.ts`.
In W00002's status menu choose Sent: no question, the order's getting-ready screen opens
(`/admin/orders/<id>/getting-ready`); back on the list, W00002 is still Processed (sending takes stock out, so only that
screen does it). Getting ready in the row's "⋯" opens the same screen.

**ORD-05 · The detail shows the order, its customer and its products**
Smoke: `e2e/orders.spec.ts`.
Press W00003 (the order number): a centred panel "Order W00003" opens over the dimmed list: the
status badge (Completed), Source Phone, Warehouse Colombia, the creation date and time; then the sections Customer (Jose
Perez, his email, phone and first address on one line), Products (KF-01, KF-02 and KF-03 with 20 ordered each) and
Comments. The ×, Escape and a click on the dimmed list close it. By hand: a customer without an address shows "No
address on file."; a webhook order without a customer says "No customer".

**ORD-06 · Comments are added, edited and removed from the detail**
Smoke: `e2e/orders.spec.ts`.
W00004's comments count (1) opens its detail with the Comments section in view: "Comment for W00004" in a box with its
save and remove buttons. Add a comment adds an empty box with the cursor in it; type "Smoke comment" and its save
button: the toast "The comments were saved." and the list's count says 2 at once. Reopen, remove the second comment:
the count says 1. By hand: saving an empty new box says "Write the comment, or remove it." under it and sends
nothing; edit the first comment, save, reopen: the new text is there.

**ORD-07 · The order's documents download**
Smoke (part): `e2e/orders.spec.ts` checks that Order PDF, Remaining products PDF and Excel sheet in W00001's "⋯" answer a
PDF, a PDF and an Excel file, each opening in a new tab.
By hand: Order PDF shows the order's products and customer; Excel sheet downloads `file-upload-template-W00001.xls`
with the order's products; Remaining products PDF lists what is left to ship. The detail's Documents menu has the same
three.

**ORD-08 · Deleting an order asks first**
Smoke: `e2e/orders.spec.ts`.
As the user holding `ROLE_MANAGE_ORDERS`: each row's "⋯" ends with Delete, in red. On W00005: "Delete order W00005?"
with "Its products and comments are removed with it. This cannot be undone."; Cancel (not red) keeps it; Delete order:
the toast "Order W00005 was deleted." and the row is gone. By hand: W00005's old detail address
(`/api/v1/orders/<id>`) answers 404.

**ORD-09 · Sync shop orders says what it did**
Smoke (part): `e2e/orders.spec.ts` checks that the button, for the user holding `ROLE_MANAGE_ORDERS`, answers with a
message (imported/skipped, or why it could not).
By hand, with the shops' credentials in `backend/.env.local` (item 13): the button says "Syncing shop orders…" with a
spinner while it runs and cannot be pressed twice; then the toast "N orders imported, M skipped." and the new orders
are in the list; a second press imports 0. With a wrong key: an error toast that stays, "The shops could not be
reached, so no order was imported. Try again in a moment."

**ORD-10 · A person without the orders roles is refused**
Smoke: `e2e/orders.spec.ts`.
Signed in as `inventory`: no Orders entry in the sidebar; `/admin/orders` says "You do not have permission to do
this."; `/api/v1/orders?warehouse_id=1` answers 403.

### Orders list and detail, redesigned (item 3)

**ORD-21 · Each status chip counts its orders and keeps only them**
Smoke: `e2e/orders.spec.ts`.
On Colombia, the Partial chip's count is the number of rows it leaves (W00004 and W00010 among them) and it shows
pressed. By hand: type "W0001" in the search: the chips count only what the search keeps (All 3 …), and so with a
date range.

**ORD-22 · A date range that keeps nothing says so, and Show all clears every filter**
Smoke: `e2e/orders.spec.ts`.
Press Created and set Created from to a future day: "Nothing matches these filters." with Show all; Show all brings
every order back, empties the dates and the search and presses All. By hand: Created from and Created to on the
fixtures' day keep every order (both days included, Bogotá time); Clear filters in the toolbar does the same as Show
all.

**ORD-23 · A status change cancelled changes nothing**
Smoke: `e2e/orders.spec.ts`.
W00007's badge › Delivered: the question; Cancel (or Escape): nothing posted, W00007 still Created after a reload. By
hand: choosing the status an order already has does nothing; the menu works with the arrow keys and Escape.

**ORD-24 · The detail is a slide-over with sections and the order's actions**
Smoke: `e2e/orders.spec.ts`.
A click anywhere on W00008's row (not on its buttons) opens "Order W00008": sections Customer, Products, Comments (no
tabs); Edit and Getting ready open their screens; Documents lists Order PDF, Remaining products PDF, Excel sheet.
Escape closes the menu, Escape again the panel. By hand: the status badge in the panel changes the status as in
ORD-03, and the list behind shows the new status at once; Escape on that question closes only the question.

**ORD-25 · The row menu follows the roles**
Smoke: `e2e/orders.spec.ts` (creates `smoke-orders-update` with `ROLE_UPDATE_ORDERS` alone).
That user sees Create order, no Sync shop orders, and in a row's "⋯" Edit, Getting ready and the three documents but
no Delete. By hand: an account that only reads orders sees the status as a plain badge (no ▾) and no Edit, in the
list and in the detail.

**ORD-26 · On a phone the orders are cards**
Smoke (part): `e2e/orders.spec.ts` at 390 px: W00010 is a card, nothing scrolls sideways, a tap on the card opens the
detail across the whole width.
By hand at 390 px: each card is titled "W00010 · Jose Perez" with Source, Status, Created and Comments as labelled
lines and the "⋯" at its top right; the status badge still opens its menu; Sync shop orders is behind More next to
Create order; toasts sit above the tab bar.

**ORD-27 · The orders screens in Spanish, light and dark**
Choose ES: "Pedidos", "Crear pedido", "Sincronizar pedidos de las tiendas", the chips Todos · Creado · Procesado ·
Completado · Parcial · Enviado · Entregado, "Número de pedido o cliente", dates as `5 de oct de 2026, 6:38 p. m.`; the
detail "Pedido W00004" with Cliente, Productos, Comentarios; the row menu Editar, Alistamiento, PDF del pedido, …,
Eliminar. No raw key, nothing unreadable in dark (badges, menu, panel, question).

**ORD-28 · Keyboard only**
With Tab and the arrow keys only: reach the chips, the search, the dates and a row's order number (Enter opens the
detail, the focus moves into it and stays there, Escape closes it and the focus returns to the number); open a status
menu with Enter, move with the arrows, Escape returns to the badge; the "⋯" menu likewise. The focus ring is visible on
each.

**ORD-11 · The old order form and getting-ready addresses land on the new screens**
Smoke: `e2e/order-forms.spec.ts`.
Signed in as the admin, open `/admin/order/new` (the previous version's address): `/admin/orders/new` opens, "New
order". `/admin/order/edit/<id of W00002>` opens `/admin/orders/<id>/edit`, "Edit order", Order number `W00002`;
`/admin/order/partial/getting-ready/<id>` opens `/admin/orders/<id>/getting-ready`, "Getting ready · W00002". By hand:
Edit and Getting ready in the orders list's row menu and in the order detail open the same screens; "Back" in the
header returns to the orders.

**ORD-12 · The form saves only when complete, and the warehouse locks once a product is filled**
Smoke: `e2e/order-forms.spec.ts`.
New order: Create order is disabled and the action bar says "8 things missing: first name, last name, email,
warehouse, a product with its quantity, source, payment method, status". Pick Warehouse Colombia, Product 1 `KF-01
(KF-01)`: the warehouse can still change; type a quantity: the Warehouse select is locked and "Remove the products to
change the warehouse." shows under it (empty the quantity: it unlocks, the note goes). By hand: before a warehouse is
picked the product select is disabled and "Choose the warehouse first: its products are offered here." shows under
the table; changing the warehouse offers only that warehouse's products (Usa has none in the fixtures: "This
warehouse has no products in stock").

**ORD-13 · An order is placed for a new customer with two products**
Smoke: `e2e/order-forms.spec.ts` (and MAIL-01 reads its email).
Type First name, Last name, Email, Phone, Address, Zip Code; Warehouse Colombia; Product 1 KF-01, quantity 3; "Add
product" under the table adds a second row: KF-02, quantity 1; Order number, Source Phone, Payment method Credit card,
Status Created; Create order: back on the orders list with the toast "The order was created.". The order holds KF-01 ×
3 and KF-02 × 1, status Created. By hand: the × of a row takes it out (the last row has none); "Add product" stays
disabled while the last row is empty; the new customer is in the Customers list with the address.

**ORD-14 · Picking an existing customer fills the customer block**
Smoke: `e2e/order-forms.spec.ts`.
Search customer › type `Jose` › `Jose Perez [jose.perez@example.com] [+57 3002825566]`: First name, Last name, Email,
Phone and the address (with its country, state and city) are filled. By hand: change the phone, place the order: the
Customers list shows Jose Perez once, with the new phone (the order updates the customer it names, it does not copy
it). The × of the picker empties the customer block.

**ORD-15 · Editing an order shows what was saved and updates it**
Smoke: `e2e/order-forms.spec.ts`.
Edit the order of ORD-13: the customer, Order number, the two products with their quantities, source, payment method
and status are filled, and the warehouse is locked with its note. Change KF-01 to 2, Update order: back on the list,
toast "The order was updated."; the order holds KF-01 × 2. By hand: an order in status Partial, Sent or Delivered
keeps its status in the Status select (the form offers Created, Processed and Completed otherwise); a comment typed
here shows in the order's detail.

**ORD-16 · Getting ready: a scan adds one, and what is not on the order or over its quantity is refused inline**
Smoke: `e2e/order-forms.spec.ts`.
Open Getting ready for the order of ORD-15: the Barcode box has the focus. Type `KF-01` and Enter: KF-01's row says
"Shipped 0 of 2 · this shipment 1" and its stepper shows 1. `NOPE-404` + Enter: "NOPE-404 is not on this order." under
the box, no dialog, the focus stays in the box. KF-01 again: the refusal goes, the row turns accent with "Complete";
once more: "Nothing more of KF-01 is left to ship.", the focus still in the box. "One less KF-01" (−) takes one away.
By hand: with a keyboard-wedge scanner the same happens without touching the screen; each accepted read flashes its
row; a product whose warehouse stock is all in this shipment says "The warehouse holds no more KF-01." (set a
product's stock to 1 with the Scan screen's Remove first).

**ORD-17 · Partial shipments take the stock out, and a sent order takes no more**
Smoke: `e2e/order-forms.spec.ts`.
Scan KF-01 twice: the button reads "Ship 2 products"; press it: back on the orders list, toast "Shipment saved: order
<number> is partial.", the order is Partial. Getting ready again: KF-01's "In stock" is 2 less, "Shipped 2 of 2 · this
shipment 0" with the "Shipped" badge. Scan KF-02, "Ship 1 product": toast "… is partial." again (only a shipment of the whole order at once sends it, as
before the redesign); open it again: KF-02 says
"Shipped 1 of 1" and its + is disabled. The fixtures' `W00005` (Sent): Ship is disabled and the bar says "This order
was already sent: it takes no more shipments." By hand: Cancel goes back to the orders list without saving.

**ORD-18 · An order that no longer exists says so, and a person without the order roles is refused**
Smoke: `e2e/order-forms.spec.ts`.
`/admin/orders/999999/edit` and `/admin/orders/999999/getting-ready`: "This order no longer exists." with a link back
to the orders. Signed in as `inventory`, `/admin/orders/<id>/edit`: "You do not have permission to do this.";
`/api/v1/orders/<id>` answers 403.

**ORD-19 · Sync Orders without shop keys places nothing, and needs the sync role**
Smoke (part): `e2e/orders-sync.spec.ts` posts to `/api/v1/orders/sync` as the admin (202 `{"imported":0,"skipped":0}`,
no new order) and as `inventory` (403).
The stack's `backend/.env` leaves `WOO_COMMERCE_URL`, `_API_KEY` and `_API_SECRET` empty. By hand: as the admin, Orders ›
Sync Orders (the button of ORD-01 – 10): a message says no order was imported, and the list is unchanged.

**ORD-20 · Sync Orders pulls a shop's waiting orders once, into the warehouse of that shop**
Needs a WooCommerce test shop with at least one `processing` order of the last 30 days whose line SKUs are products
here (e.g. `KF-01`), and read-only REST keys (WooCommerce › Settings › Advanced › REST API). In `backend/.env.local`
set `WOO_COMMERCE_URL=<the shop's address>`, `WOO_COMMERCE_API_KEY=ck_…`, `WOO_COMMERCE_API_SECRET=cs_…`; Warehouses ›
edit Colombia (warehouse 1) so its URLs hold that same address. As the admin, Orders › warehouse Colombia › Sync
Orders: a message says how many were imported; each new order's code is the shop's order number, source Web, status
Created, its customer with a billing and a shipping address, its lines by SKU; within a minute Mailpit has "Order
#<number> was created" for each (warehouse 1 prints). Press Sync Orders again: nothing is imported, the same number are
skipped, no order appears twice. Delete one of the imported orders and sync again: it does not come back. Change
`WOO_COMMERCE_API_SECRET` to a wrong value and sync: an error says the shop could not be read (502
`order_sync_failed`), and `docker compose logs php` (or `var/log/dev.log`) names the shop's answer. Put the right keys
back and empty `backend/.env.local` when done.

### Order form and getting ready, redesigned (item 4)

<!-- Item 4 (order-forms-ui) adds ORD-29 – 34 here, and updates the texts of ORD-11 – 18 and MAIL-01 – 02. -->

**ORD-29 · The action bar names what is missing; a name goes to its field, highlighted**
Smoke: `e2e/order-forms.spec.ts`.
New order, type First name only: the bar says "7 things missing: last name, email, warehouse, a product with its
quantity, source, payment method, status" (each name a link-style button). Click "source": the Source select has the
focus, and every missing field (Last name, Email, Warehouse, Source, Payment method, Status) is outlined in danger with
"Required." under it, while First name is not; "Add at least one product with its quantity." shows under the table.
Choose a source: its outline goes and the bar says "6 things missing". By hand: "a product with its quantity" focuses
the Warehouse while none is chosen, then Product 1 (or its quantity when the product is picked); filling the last one
empties the bar and enables Create order.

**ORD-30 · The product lines are a table with headers, "Add product" under it, any row removed**
Smoke: `e2e/order-forms.spec.ts`.
New order: the Products table has the headers Product, Quantity and (for screen readers) Remove; "Add product" is
disabled until the last row has a product and a quantity. Colombia, KF-01 × 2, Add product, KF-02: three rows (header
+ two); "Remove product 1": KF-02 stays alone, and the single row has no ×. By hand: at 1440 px the quantity column is
narrow and right-aligned, the × a 44 px target; the product menu opens over the rows below, not cut by the table.

**ORD-31 · Getting ready starts neutral: progress in words, stock as text, nothing to ship yet**
Smoke: `e2e/order-forms.spec.ts`.
Getting ready for W00001: the header "Getting ready · W00001" with the Created badge and Back; three product cards,
each "Shipped 0 of N · this shipment 0" over a progress bar and "In stock N" in muted text (not a button); no row is
red. Ship is disabled with "Scan the products to ship." in the bar; Cancel (ghost, never red) goes to the orders. By
hand: a product whose stock is below what is left shows a warning edge and "Short of stock"; the bar fills dark olive
for what was shipped and light olive for this shipment; a completed row is olive with "Complete".

**ORD-32 · The form and getting ready on a phone (390 px)**
Smoke (part): `e2e/order-forms.spec.ts` checks that neither screen scrolls sideways and that the Barcode box has the
focus with "Start camera" shown.
By hand at 390 × 844: the form is one column (Customer, then Order), the product table fits (product, a narrow
quantity, the ×), the action bar sits above the tab bar with the missing list over full-width Cancel / Create order.
Getting ready: "Start camera" and the camera's explanation on top, the Barcode box under it, each product card wraps
(code and title, then progress, then the − n + stepper with 48 px buttons), the Ship bar above the tab bar and not
covering the last card.

**ORD-33 · The order form's two columns, and the required marks**
By hand, no smoke. At 1440 px (≥ 1280) the form shows Customer and Order side by side, their tops aligned and the
action bar across both; at 1100 px it is one column. Each required field's label ends with a red "*" and the sections
say "Fields marked * are required."; Order number and Comment are optional. A server refusal (e.g. stop the database
and save) shows above both columns, not inside one.

**ORD-34 · Spanish, dark, and keyboard only**
By hand, no smoke. Choose ES: "Nuevo pedido", "Cliente", "Pedido", "Número de pedido", "Agregar producto", "Faltan 8
datos: nombre, …", "Crear pedido"; Getting ready: "Alistamiento · W00001", "Enviado 0 de N · este envío 0",
"Existencias N", "Enviar 2 productos", the refusals in Spanish. No raw key; in dark the progress bar, the badges, the
refusal and the outlined fields are readable. Keyboard only: Tab reaches each missing-field name in the bar and Enter
moves to the field; on Getting ready the − / + of each card and Ship are reachable, the focus ring visible on each.

### Shop sync and write-back (shops-settings item 5b)

<!-- shops-settings item 5b (shops-sync-api) adds ORD-35 – 37 here, smoke in e2e/orders-sync.spec.ts (the fake shop):
     "Check now" over every active connection, the order status written back, a failed push and its Retry. -->

The dev stack's fake shop (`/_fake-shop`) answers the seeded "Fake shop" connection (Colombia, prints its orders, both
capabilities on). Its state is read and set with `curl -s localhost:<port>/_fake-shop/_state` (GET: its orders, notes
and every write the app made; `-X PUT -d '{"orders":[…],"notes":{}}'`: its orders; `-X DELETE`: empty). The pushes
leave through the `shops` queue: the stack's `worker` sends them within a second or two.

**ORD-35 · Check now pulls every active connection, only what changed since its last pull, and a failing shop fails alone**
Smoke: `e2e/orders-sync.spec.ts` (through the API).
Put two `processing` orders in the fake shop with `date_modified_gmt` two and one hours ago and lines `KF-01`/`KF-02`.
In Settings › Shop connections add a second connection whose site URL is `http://nginx/_fake-shop-gone` (no shop
there). As the admin, Orders › Check now: a toast per connection — "Fake shop" imported 2, the other could not be
read — and the two orders are in Colombia with the shop's name in Source (`POST /api/v1/orders/sync` answers 202
`{imported: 2, failed: 1, connections: […]}`); the broken connection's card shows the failure (`pull_failed`).
Press Check now again: nothing is imported (the cursor is the newest modification seen). Add a third order modified
now: only that one is imported; one modified before the cursor is not read. Turn every connection off but the broken
one: Check now answers 502 "No shop could be read (…)". Put the connections back; delete the broken one.
By hand on a server: `bin/console app:shops:pull --if-due -v` reads only the connections pulled 15 minutes ago or
more (run it twice: the second run reads nothing), and deletes the failed deliveries older than 90 days.

**ORD-36 · A linked order's status is written back: Processed → processing, Sent → completed, the others nothing**
Smoke: `e2e/orders-sync.spec.ts` (through the API).
Post a signed order to the Fake shop's webhook (HOOK-03). Mark it Processed: within seconds the fake shop's `writes`
hold `{"call":"status","value":"processing"}` for that order. Ship the whole order in Getting ready (Sent):
`completed` is written. Mark it Delivered: nothing more (the shop already has `completed`). Created, Completed and
Partial write nothing, and `GET /api/v1/shops/{id}/outbox?status=sent` lists exactly the two rows. An order typed by
hand, or one from a connection whose "Order status" switch is off or that is inactive, writes nothing.

**ORD-37 · A push that fails three times is failed in the outbox and the health, and Retry queues it again**
Smoke: `e2e/orders-sync.spec.ts` (through the API; Retry stands in for the 1- and 5-minute waits).
Create a connection to `http://nginx/_fake-shop-gone` with "Order status" on, post a signed order to its webhook and
mark the order Processed: the change is saved at once; `GET /api/v1/shops/{id}/outbox?status=pending` shows the row
with `attempts: 1` and the error. Wait 1 minute (or Retry), then 5 (or Retry): at the third failure the row is
`failed` (`?status=failed`), the connection's health has `failed_pushes: 1` and `last_failure_code: push_failed`
(the card's "1 failed update"). Retry answers `pending` and the worker tries once more (`attempts: 4`, failed again).
With a shop whose keys cannot write (401) the health says `keys_read_only` at the first failure.

### Comment timeline (shops-settings item 8)

<!-- shops-settings item 8 (comments-ui) adds ORD-38 – 44 here, smoke in e2e/comments.spec.ts: the timeline (author,
     date, the dateless W00003 comment marked approximate), Enter sends, pin, quick phrases, also send to the shop, shop
     notes, and ORD-44 by hand (390 px, dark, Spanish). -->

## 6. Invoices (INVC)

**INVC-01 · The list shows the invoices, and the old addresses land on the new screens**
Smoke: `e2e/invoices.spec.ts`.
Signed in as `sales`, open `/admin/invoice/` (the previous version's address): `/admin/invoices` opens, "Invoices" with
the count under it ("2 invoices"), a Create invoice button, one row per invoice (`Invoice` in mono, the customer's name
with the email under it or "Walk-in customer", the total as money (`$100.00`), the date (`Oct 5, 2026`)) and a ⋯ menu
with Detail and Open PDF (the PDF opens in a new tab). The toolbar has a search by customer or number, From and To
dates and, once one is used, Clear filters; a filter that matches nothing says so and "Show all" brings the rows back.
`/admin/invoice/new` lands on `/admin/invoices/new`.

**INVC-02 · The detail opens in a slide-over with the lines and the PDF link**
Smoke: `e2e/invoices.spec.ts`.
Detail in the ⋯ menu of INV-0001 (or a click on the row): a slide-over "Invoice INV-0001" with the customer (or
"Walk-in customer"), the date, a row per line (code, description, qty, unit price, line total, as money), the
totals block (subtotal and sales tax when the invoice has tax, then the total larger) and Open PDF; Close, the x and
Escape close it. By hand: Open PDF opens the PDF in a new tab.

**INVC-03 · An invoice is created with a customer, a product and tax, its PDF opens and the list shows it**
Smoke (part): `e2e/invoices.spec.ts` creates the invoice and checks the list and that the PDF answers.
Signed in as `sales`, Create invoice: `Invoice number` already holds the next code (`INV-0002` after `INV-0001`); pick
the customer in `Customer` (their name, email, phone and address fill in); pick a product in `Product 1` (the
description and the unit price fill in); quantity 2, Sales tax 6%: the line total, the subtotal, the tax and the total
follow as you type, as money; Create invoice: the PDF opens in a new tab and the list shows "Invoice created." and the
new row. By hand: the PDF shows the code, the customer, the lines and the 6% tax; with no customer picked and nothing
typed, the invoice is a "Walk-in customer"; typing a new customer (with a country, state and city that did not exist)
creates it, and it is then in the Customers list and in the customer picker.

**INVC-04 · Add all products puts every product of the warehouse on the invoice, and a line can be removed**
Smoke: `e2e/invoices.spec.ts`.
"Add all products from Colombia": one line per product of its stock (KF-01, KF-02, KF-03) with its price, the total adds
them up; a product already on the invoice is not added twice. Remove line takes one out and the total follows; Add line
adds an empty one. Changing the Warehouse changes the products offered (and the name on the button), not the lines
already added.

**INVC-05 · An invoice needs a line, and a code already used is refused**
Smoke: `e2e/invoices.spec.ts`.
Create invoice with nothing typed: "Please add at least one invoice item." and nothing is sent. A quantity of 0 or a
price with three decimals says what is wrong. A line with a description only (no product) is accepted. With the code
of an existing invoice (`INV-0001`): "An invoice with this code already exists." under `Invoice number`, no PDF opens and
the typed lines stay.

**INVC-06 · The admin is refused on invoices**
Smoke: `e2e/invoices.spec.ts`.
Signed in as the admin: no Invoices entry in the sidebar; `/admin/invoices` says "You do not have permission to do
this."; `/api/v1/invoices` answers 403 (no role reaches the invoice roles; they are given one by one). A user with
only `ROLE_CAN_READ_INVOICES` sees the list and the detail but no Create invoice button.

### Invoices, redesigned (item 6)

**INVC-07 · The list is filtered by customer or number and by a date range**
Smoke: `e2e/invoices.spec.ts`.
In the search "jose" keeps INV-0002 and hides INV-0001; "walk-in" does the opposite (the invoice without a customer).
From a date in the future, or To a date long ago, leaves nothing: "Nothing matches these filters." with Show all. Clear
filters (it appears with the first filter) empties the search and both dates and brings every row back. By hand: a range
that includes today keeps today's invoices; From later than To is not possible (each date limits the other).

**INVC-08 · A row opens the invoice in a slide-over beside the list**
Smoke: `e2e/invoices.spec.ts`.
Click on INV-0002's row (not on its ⋯): "Invoice INV-0002" opens centred over the list with KF-02, "Sales tax 6%" and
`$318.00`, the list still visible behind; Escape closes it and the focus is back on the list. By hand: at 1440 it is 720
px wide, at 390 the whole width; Tab stays inside it; an invoice deleted meanwhile says "This invoice no longer exists."

**INVC-09 · On a phone the invoice form and the list fit without scrolling sideways**
Smoke: `e2e/invoices.spec.ts` (viewport 390 × 844).
Create invoice, "Add all products from Colombia": three lines, each a card with its fields labelled (Product,
Description, Qty, Unit price, Line total), the total `$450.00` in view, and the page is not wider than the screen. The
list at 390 shows INV-0001 as a card with `$100.00`, also without a sideways scroll.

**INVC-10 · The invoice form reads like the document**
Manual (not automated).
At 1440: Customer on the left (pick, name, email, phone, address cards), Invoice on the right (number, payment method,
Sales tax, comments); under both, the lines as a table with the headers Product, Description, Qty, Unit price, Line
total, and a remove button per line; "Add line" and "Add all products from <warehouse>" under it; the totals block
right-aligned under the lines (Subtotal, Sales tax 6%, Total larger), all as money; the action bar sticks to the bottom
with Cancel (ghost, never red) and Create invoice (the only primary). The product menu opens over the next line, not
clipped. The line totals line up with the inputs' text. The keyboard reaches every field, line by line, in order.

**INVC-11 · Spanish and the dark theme on both invoice screens**
Manual (not automated).
With ES chosen: the list ("Facturas", "Cliente de mostrador", Desde / Hasta, "Abrir PDF"), the slide-over ("Factura
INV-0001", "Total de la línea", "Impuesto de ventas 6 %") and the form ("Número de factura", "Método de pago",
"Agregar línea", "Agregar todos los productos de Colombia", "Crear factura"); money as `US$ 1.060,00`, dates as `5 de
oct de 2026`; no raw key. In the dark theme: the totals block, the table header and the slide-over keep their
contrast; the negative or empty states stay readable.

## 7. Users (USR)

**USR-01 · The list shows every account with its roles, and the old address lands on it**
Smoke: `e2e/users.spec.ts`.
Signed in as the admin, open `/admin/user/` (the previous version's address): `/admin/users` opens, "Users" with the
count under it ("4 users"), one row per account (name, username, email, one chip per role by its plain name, Active or
Inactive). No `ROLE_…` text anywhere. The search box finds a row by name, username, email or a role's plain name; a
search that matches nobody says so and "Show all" brings the rows back.

**USR-02 · A new user is created and appears in the list**
Smoke (part): `e2e/users.spec.ts` creates the user and checks the list.
Create user › fill Name, Email, Username, Password, tick Inventory, Save: back on the list with the toast "The user
was created." and the new row with an Inventory chip. By hand: sign out and sign in as the new user: the Products menu
only. The form offers exactly nine roles (Admin, Inventory, Orders, Orders: update, Invoices: update, Invoices: read,
Invoices: create, Users, Warehouses: the same nine as before) and a Status of Active or Inactive.

**USR-03 · Editing without typing a password keeps the password**
Smoke (part): `e2e/users.spec.ts` edits, then signs in with the old password through the API.
Edit the user of USR-02 (the row's "⋯" menu › Edit, or a click on the row): the Password box is empty and says "Leave
blank to keep the current password."; change the name, tick Orders, Save: the toast "The user was updated." and the row
shows both. By hand: sign in as
that user with the password of USR-02: it still works.

**USR-04 · The form names what is missing and what is wrong**
Smoke: `e2e/users.spec.ts`.
Create user, Save with everything empty: Name, Email, Username and Password are marked and say "This value should not
be blank."; nothing is sent. An email without `@` or a password of fewer than 6 characters says so under its field.

**USR-05 · A user that no longer exists says so**
Smoke: `e2e/users.spec.ts`.
Open `/admin/users/999999/edit`: "This user no longer exists." with a link back to the users.

**USR-06 · A person without the Users role is refused**
Smoke: `e2e/users.spec.ts`.
Signed in as `inventory`: no Users entry in the sidebar; opening `/admin/users` says "You do not have permission to do
this."; `/api/v1/users` answers 403. By hand, as the admin: change a user's password on Edit (type a new one, Save),
then sign in with the old one (refused) and the new one (works).


### Users, redesigned (item 7)

<!-- Item 7 (users-ui) adds USR-07 – 09 here, and updates the texts of USR-01 – 06. -->

**USR-07 · The form groups the roles by what they open and describes each one**
Smoke: `e2e/users.spec.ts`.
Create user: under Roles, four groups (Warehouse: Inventory, Warehouses · Sales: Orders, Orders: update · Invoices:
Invoices: update, read, create · Admin: Admin, Users), each role with a one-line description of what it opens. Under
Admin: "Admin includes everything except invoices." No `ROLE_…` constant anywhere. With the language on ES the names,
descriptions and the note are Spanish. By hand, read each description against what that role really reaches (sign in as
a user with only that role): none promises more than it gives.

**USR-08 · The list filters by status and a row opens its form**
Smoke: `e2e/users.spec.ts`.
The chips All / Active / Inactive carry the number of users each keeps; Active hides an inactive user and Inactive hides
an active one; "Clear filters" appears with a filter on and brings everyone back. A click on a row (not on its "⋯")
opens Edit; the "⋯" menu has Edit only. Sorting by Name, Username, Email and Status works. Create an inactive user and
check its row says "Inactive" in words.

**USR-09 · Saving toasts, and the form is usable on a phone and in dark**
Smoke (part): `e2e/users.spec.ts` saves an edit and sees the toast and the Save button in view.
By hand at 390 px, light and dark: the list is cards (name, username, email, roles, status), no sideways scroll; the
form is one column, each role row has a 44 px touch target, the Save / Cancel bar stays above the tab bar while the role
list scrolls, and the password's show/hide button and Caps Lock hint work. A failed save (stop the stack's `php`
service) shows the red message in the form and keeps what was typed.

## 8. Emails (MAIL)

<!-- Item 10 (order-forms-ui) adds MAIL-01 – 02: the printer's email of a new order, read in Mailpit. -->

**MAIL-01 · An order placed by hand is emailed to the printer**
Smoke (part): `e2e/order-forms.spec.ts` finds the email of ORD-13 in Mailpit (to the printer, subject, body).
After ORD-13, Mailpit has, within a minute, "Order #<Order number> was created" to `printer@kf.local` (the dev stack's
`MAILER_PRINTER_ADDRESS`), body "A new order was created and attached to this email.". By hand: it is cc'd to
`sales@klassicfab.com`, from `KF Inventory <orders@kf.local>`, and its attachment `order-<id>.pdf` opens and lists the
order's customer and products.

**MAIL-02 · Editing an order sends no email**
Smoke: `e2e/order-forms.spec.ts`.
Edit `W00001`, change the comment and the payment method (PayPal), Update order: no new email reaches the printer.

### Settings › Email (shops-settings items 3 and 7)

<!-- shops-settings item 3 (settings-api) adds MAIL-03 – 04 here (API, OrderEmailTest and a spy transport): the order
     email takes the sender, printer and cc from Settings, the env when empty; a queued email goes through the SMTP
     server saved in Settings. -->

**MAIL-03 · The order email takes its sender, printer and cc from Settings, the env when empty**
API (no browser): `tests/Functional/Ordering/OrderEmailTest.php` (`testTheSettingsSenderPrinterAndCcWinOverTheEnv`,
`testAnEmptySettingFallsBackToTheEnv`) and `tests/Functional/Settings/EmailSettingsApiTest.php` (each value's `source`).
With Settings › Email empty, the order email is from `MAILER_FROM_*` to `MAILER_PRINTER_ADDRESS`, cc
`sales@klassicfab.com`; with a sender, printer and cc saved there, it uses those; clearing a field brings that field's env
value back (`source` says `env` again).

**MAIL-04 · A queued email goes through the SMTP server saved in Settings**
API (no browser): `tests/Functional/Settings/SettingsMailTransportTest.php` (a spy transport stands in for the server)
and `tests/Functional/Settings/TestEmailApiTest.php`. After an SMTP server is saved in Settings › Email, the next order
email the `mail` queue sends goes through it, without restarting the worker; clearing the server sends through
`MAILER_DSN` again. "Send test email" goes through the same server at once and answers its host (202), the server's
own refusal (502 `smtp_failed`, `detail.reason`), or 429 when asked again within 10 s. By hand on the dev stack (the
browser side is SET-04/05, item 4's): save Mailpit (`mailpit`, port 1025, encryption none) as the server, place an
order, and the email reaches Mailpit; save a host that does not exist and "Send test email" shows the connection
error.

## 9. WooCommerce webhook (HOOK)

The shops post each new order to `/admin/order/1H39j0jpQPsWL958v9R4` (public, never moved). To run a case by hand,
post a sample order with curl (the fixtures' warehouse 1, Colombia, receives `https://colombia.test`):

```bash
curl -s -X POST http://localhost:8080/admin/order/1H39j0jpQPsWL958v9R4 \
  -H 'Content-Type: application/json' -H 'X-WC-Webhook-Source: https://colombia.test' \
  -d '{"id": 5501, "billing": {"first_name": "Hook", "last_name": "Buyer", "email": "hook.buyer@example.com",
       "phone": "555-0199", "address_1": "1 Billing St", "postcode": "33101", "city": "Miami", "state": "FL",
       "country": "US"}, "shipping": {"address_1": "2 Shipping Ave", "postcode": "10001", "city": "New York",
       "state": "NY", "country": "US"}, "line_items": [{"sku": "KF-01", "quantity": 2}, {"sku": "KF-02", "quantity": 1}]}'
```

**HOOK-01 · A shop order lands in its warehouse and the printer gets it**
Smoke: `e2e/webhook.spec.ts`.
Post the sample order above. The answer is `{"status":true}`. Orders › warehouse Colombia: order `5501` is there,
source Web, status Created, customer Hook Buyer with two addresses (billing Miami, shipping New York) and the lines
KF-01 × 2, KF-02 × 1. Within a minute Mailpit has "Order #5501 was created" to the printer address, cc
`sales@klassicfab.com`, with `order-<id>.pdf` attached. The same order posted with `X-WC-Webhook-Source:
https://usa.test` (warehouse 2) is placed in Usa and sends no email. Posting it **again** to `https://colombia.test`
still answers `{"status":true}` but places nothing and sends no second email (the order code is already in that
warehouse, deleted orders included, as for "Sync Orders"); `docker compose logs php` shows "WooCommerce order [5501]
from [https://colombia.test] is already in warehouse 1: not placed again."

**HOOK-02 · An unknown shop is answered ok and nothing happens**
Smoke: `e2e/webhook.spec.ts`.
Post the sample order with `X-WC-Webhook-Source: https://unknown-shop.test` (and a new `id`). The answer is still
`{"status":true}`; no warehouse lists the order, no email arrives, and `docker compose logs php` shows
"Warehouse [https://unknown-shop.test] was not found".

### Per-connection webhooks and the legacy switch (shops-settings item 5a)

Each connection has its own URL, `/webhooks/shops/{token}`, and every delivery must carry
`X-WC-Webhook-Signature` = base64(HMAC-SHA256(raw body, the connection's secret)). The fixtures' "Fake shop"
connection (warehouse Colombia, prints its orders) has the token and secret in `src/DataFixtures/ShopFixtures.php`. To
post a signed sample order by hand (save the body first: the signature is over the exact bytes):

```bash
TOKEN=fakeshop0000000000000000000000000000000000000000000000000000001
SECRET=fake-shop-webhook-secret
BODY='{"id": 7501, "status": "processing", "customer_note": "Gift wrap, please",
  "billing": {"first_name": "Hook", "last_name": "Buyer", "email": "hook.buyer@example.com", "phone": "555-0199",
  "address_1": "1 Billing St", "postcode": "33101", "city": "Miami", "state": "FL", "country": "US"},
  "shipping": {"address_1": "2 Shipping Ave", "postcode": "10001", "city": "New York", "state": "NY", "country": "US"},
  "line_items": [{"sku": "KF-01", "quantity": 2}, {"sku": "KF-02", "quantity": 1}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)
curl -s -X POST "http://localhost:8080/webhooks/shops/$TOKEN" -H 'Content-Type: application/json' \
  -H "X-WC-Webhook-Signature: $SIG" --data-raw "$BODY"
```

**HOOK-03 · A signed delivery to a connection is placed in its warehouse, linked and named**
Smoke: `e2e/webhook.spec.ts`.
Post the signed sample above. The answer is `{"status":true}`. Orders › Colombia: order `7501` is there, its Source
names the shop ("Fake shop") in the list and in the detail (`shop` in `GET /api/v1/orders/{id}`), and its comments
hold "Gift wrap, please" as a shop note (no author). Mailpit has "Order #7501 was created" to the printer (the
connection prints its orders); edit the connection with "email the printer" off (`PUT /api/v1/shops/{id}`) and a new
order id sends no email. `GET /api/v1/shops`: the connection's `health.last_webhook_at` and `last_import_at` are now.
Posting the same body again answers `{"status":true}`, places nothing and sends no email.

**HOOK-04 · A wrong signature is refused, kept without its body and shown in health**
Smoke: `e2e/webhook.spec.ts`.
Post the sample with `X-WC-Webhook-Signature: d3Jvbmc=` (or none): 401 `{"status":false}`, nothing is placed.
`GET /api/v1/shops/{id}/deliveries?status=failed` lists a `bad_signature` row whose detail has `payload: null`; the
connection's `health.last_failure_code` is `bad_signature` (Settings › Shop connections shows it in danger). A post to
`/webhooks/shops/abab…` (an unknown token) answers 404 `{"status":false}` and adds no row. A body over 1 MB answers 413.

**HOOK-05 · An unknown SKU is kept in the inbox and placed by Retry once the product exists**
Smoke: `e2e/webhook.spec.ts` (API).
Post a signed order with `"id": 7502` whose line has `"sku": "KF-99"`: 200 `{"status":true}`, no order. The inbox
(`…/deliveries?status=failed`) has it with `reason_code` `unknown_product`, reason "Unknown product KF-99", the
customer and lines in `summary`, and the body in the detail. Create product `KF-99`, then
`POST /api/v1/shops/{id}/deliveries/{dId}/retry`: `status` `placed`, `order.code` `7502`, and the order is in
Colombia, linked to the shop. Discard (`…/discard`) on another failed row sets `discarded` and the health's
`failed_deliveries` drops by one.

**HOOK-06 · The legacy URL during the cutover: on as before, off 410 and counted**
Smoke: `e2e/webhook.spec.ts` (the API part); the Orders warning is SHOP-07's (item 6).
With Settings › General's switch on, HOOK-01 still passes and every post to the old URL adds one to
`GET /api/v1/settings/webhooks`'s `legacy_hits_since`; an order the old URL cannot place (an unknown shop, an unknown
SKU) is kept in the inbox as kind `legacy`, and a shop whose address is a connection's site URL is imported through
that connection (its warehouse, its printer switch, linked). Turn the switch off (`PUT /api/v1/settings/webhooks`
`{"legacy_enabled": false}`): the counter starts from 0, the HOOK-01 post answers 410
`{"status":false,"error":"webhook_moved"}`, places nothing, and the counter and `legacy_last_hit_at` move. Turn it
back on afterwards.

## 10. Design system (DS)

The redesign's shell, kit, themes and languages (`docs/pdr/prd-redesign.md`, `docs/design/README.md`). Run at 1440 px
and at 390 px (a phone, or the browser's device mode), in light and dark.

**DS-01 · The shell at 1440 px**
Smoke: `e2e/design-system.spec.ts`.
Signed in as the admin at 1440 px: the KF mark and "KF Inventory" at the top of the sidebar, the groups Warehouse, Sales
and Admin, the name `Sergio Barbosa` in the top bar. Press Tab once from the top of the page: "Skip to content" appears
and is focused; Enter moves the focus to the page.

**DS-02 · The sidebar collapses to a rail and stays so**
Smoke: `e2e/design-system.spec.ts`.
"Collapse the menu": the rail. Reload: still the rail. "Expand the menu": the full sidebar again.

**DS-03 · The phone layout**
Smoke (part): `e2e/design-system.spec.ts` opens the drawer, reads the tab bar and checks that Products, Orders and Scan
do not scroll sideways at 390 px; by hand: every screen looks right at 390 px (no cut text, 44 px targets, the
action bar above the tab bar).
At 390 px: no sidebar; "Menu" opens the whole menu as a drawer from the left (Escape or × closes it); the tab bar at the
bottom shows the role's first entries and More.

**DS-04 · A visible focus everywhere**
Smoke (part): `e2e/design-system.spec.ts` opens a row's "⋯" and the theme menu with Enter and checks that the first
item takes the focus, the arrows, Home and End move it, and Escape closes the menu with the focus back on its button;
by hand: the ring itself, everywhere.
With the keyboard only (Tab, Shift+Tab, arrows), go through the shell, a list and a form in both themes: every button,
link, input, chip, row menu and menu item shows the 2 px accent ring when focused; nothing is reached without it.

**DS-05 · The tab title follows the page**
Smoke: `e2e/design-system.spec.ts`.
Open Orders, then a product, then a missing address: the browser tab reads "<the page's title> · KF Inventory"
("Page not found · KF Inventory"); the sign-in page "Sign in · KF Inventory".

**DS-06 · The language switch keeps the page**
Smoke: `e2e/design-system.spec.ts`.
On Orders, choose ES in the top bar: the menu and the page are in Spanish (Pedidos, Clientes…), the address and the
rows of the table are the same. Reload: still Spanish. Choose EN: back to English.

**DS-07 · Light, dark, or the system's**
Smoke (part): `e2e/design-system.spec.ts` checks the theme chosen, kept after a reload, and System following the
system's setting; by hand: no white flash when the page reloads in dark, and every screen readable in both.
Top bar › theme › Dark: the app turns dark. Reload: dark from the first frame. Theme › System: the app follows the
computer's light/dark setting, and changes when it changes.

**DS-08 · Notifications**
Smoke: `e2e/design-system.spec.ts` (on `/admin/_kit`).
A success notification appears at the bottom right (bottom centre on a phone) and goes after 5 seconds; an error one
stays until its × is pressed. A screen reader announces both.

**DS-09 · No raw key in Spanish, light and dark**
After every screen item is merged: every screen in Spanish, light and dark, at 1440 and 390 px: no `orders.title`-like
key, no English left in the shell or the kit, nothing unreadable.

**DS-10 · The camera is asked for only after the tap**
Covered by `CameraScanner.test.tsx` with a fake detector (no real-phone run, the user's decision): the permission is
asked only after "Start camera"; refused, the scanner says how to allow it and the typed input stays; on an address that
is not https it says the camera needs a secure address.

**DS-11 · A camera read lands once, with a tone and a vibration**
Covered by `CameraScanner.test.tsx` with a fake detector (no real-phone run, the user's decision): a code read calls
the screen once, with a vibration and a tone; the same label held still is counted once; the camera stays open.

**DS-12 · Lighthouse accessibility**
Chrome DevTools › Lighthouse › Accessibility on every screen, light and dark: 95 or more.

**DS-13 · Signing in: show the password, Caps Lock, the error in place**
Smoke (part): `e2e/design-system.spec.ts` shows the password and checks the inline error; by hand: with Caps Lock
on, "Caps Lock is on" appears under the password.
On the sign-in page, the eye button shows the password and hides it again; "Sign in" with an empty field says
"Type your username and password." above the button, and a wrong password "Wrong username or password." in the same
place.

**DS-14 · The page not found is branded, with the way back**
Smoke: `e2e/design-system.spec.ts`.
Signed in, open `/admin/nothing-here`: the KF mark, "Page not found", and "Go to the product list", which opens it.

**DS-15 · Every filter control in the kit, light and dark, 44 px on a phone**
Smoke (part): `e2e/design-system.spec.ts` checks on `/admin/_kit` › Table filters that each control is there and works
(the Status dropdown's checkbox list with counts, the Created quick picks, the Total quick ranges, a chip removed, the
pager's Next) and, in the server-mode table, that a header sort and a status tick ask for new rows; by hand: the look.
On `/admin/_kit`, section "Table filters": "Filter by Order" (a text input), "Status · 1" (a button: a checkbox list
with each status's count and Clear), "Created" (Today, Last 7 days, Last 30 days, This month, From and To), "Total:
$100 – $500" (Under $100, $100 – $500, Over $500, Min, Max), "Quantity" (0, 1 – 10, Over 10), "Filters · 4", the
chips "Status: Created ×", "Total: … ×" with Clear filters, the pager "51 – 75 of 1,240" with Rows per page; under it a
table of 64 sample orders with a filter row under its header and "1 – 10 of 64". By hand in light and dark at 1440 px:
every control, panel and chip is readable, the active ones in the accent's soft colour, the focus ring visible; at
390 px every control, checkbox row and chip is at least 44 px tall and nothing scrolls sideways.

**DS-16 · The filter sheet on a phone**
Smoke: `e2e/design-system.spec.ts` (390 px, on `/admin/_kit`).
At 390 px the kit's table has no filter row; "Filters · 0" opens a sheet from the bottom ("Filters", a drag handle,
Sort, one section per column). Tab and Shift+Tab stay inside it; Escape closes it and nothing changes. Open it again,
open Status, tick Created: the footer says "Show N results" with N counted for that choice; press it: the sheet
closes, the table shows only Created orders and the chip "Status: Created" is above it.

## 11. Settings (SET)

Settings (`/admin/settings`, `docs/pdr/prd-shops-settings.md`): for `ROLE_ADMIN` only; tabs General, Email, Analytics,
Shop connections, Quick phrases.

**SET-01 · Settings is the admin's only**
Smoke: `e2e/settings.spec.ts`.
Signed in as the admin: the sidebar's Admin group has Settings (a sliders icon); it opens `/admin/settings`, "Settings"
with the five tabs, General current: the time zone, "Email leaves from" (the server's MAILER_DSN, `mailpit`, on the dev
stack) and "The old webhook URL" with On and "Turn off the old webhook URL". Signed in as `inventory`: no Settings entry,
and `/admin/settings` shows "Page not found"; `/api/v1/settings/email` answers 403.

**SET-02 · General says where email leaves from, and the legacy switch**
Smoke: `e2e/settings.spec.ts`.
Settings › General on a stack with no SMTP server saved: "Email leaves from" reads "The server's MAILER_DSN (no SMTP
server in Settings)" with the env host (`mailpit`); "The old webhook URL" shows On and "Turn off the old webhook URL".

**SET-03 · Email: the server is saved, the password field is blank afterwards**
Smoke: `e2e/settings.spec.ts`.
Settings › Email: under "SMTP server" the muted line says the server's `MAILER_DSN` is used (with its host). Fill Host
`mailpit`, Port `1025`, User, Password, Encryption None, Save: toast "Email settings saved."; the Password field is blank
again and the line under it says "A password is saved"; `GET /api/v1/settings/email` answers `has_password: true`, the
host, `source.dsn: settings` and never the password. After a reload, change only the user and Save with the password
blank: it stays saved. Sender address, printer address and cc each say where they come from ("From Settings", "From
the server's environment", "Not set"). A bad address or a port out of 1 – 65535 is refused under its field without a
request. Changing the Host with the password blank shows "The host changed: a blank password saves none."

**SET-04 · "Send test email" reaches Mailpit through the saved server**
Smoke: `e2e/settings.spec.ts`.
With Mailpit saved as the server (SET-03): "Send test email" opens a centred panel with "Send to" prefilled with the
admin's email; Send shows "Sent through mailpit" inside the panel, and "KF Inventory test email" is in Mailpit
(`http://localhost:8025`) within seconds. Sending again at once shows "Wait a few seconds before sending another test
email." (one test email every 10 s).

**SET-05 · A wrong host answers the server's own error inline**
Smoke: `e2e/settings.spec.ts`.
Save Host `nowhere.invalid`, Port 25, then "Send test email" and Send: a red alert inside the panel reads "The server
refused it: …" with the SMTP library's message (a connection error); no green line. The panel stays open and Send can be
tried again. (The test goes through what is saved: the saving itself does not contact the server.)

**SET-06 · Analytics IDs load both scripts after navigation, never on the sign-in page**
Smoke: `e2e/settings.spec.ts` (the two external hosts are answered by route interception).
Settings › Analytics: GA4 `G-SMOKE123`, Clarity `smoke12345`, Save: toast "Analytics settings saved. They load on the
next page you open." Open Orders from the menu: `<head>` holds `googletagmanager.com/gtag/js?id=G-SMOKE123` and
`clarity.ms/tag/smoke12345`, once each. Signed out, `/admin/login` requests neither `/settings/public` nor either host.
By hand: with a real GA4 property, Realtime shows one `page_view` per page opened, without a user id.

**SET-07 · Quick phrases: add, rename, reorder, deactivate**
Smoke: `e2e/settings.spec.ts`.
Settings › Quick phrases: type "Smoke first" and Enter (toast "Phrase added."), then "Smoke second"; pencil on the
second, rename to "Smoke renamed", Enter; the up arrow on it moves it above the first (the arrows at the ends are
disabled; each is 44 px on a phone); the switch on "Smoke first" turns it off: it stays listed struck through, and
`GET /api/v1/settings/quick-phrases` (what the comment box reads) no longer holds it while `?all=1` does. The preview
under the list shows the active phrases in order. The bin asks "Delete this phrase?" and removes it only on "Delete
phrase". By hand once item 8 is merged: the order comment box's phrase bar shows the active phrases in this order.

**SET-08 · A bad GA ID is refused in place**
Smoke: `e2e/settings.spec.ts`.
Settings › Analytics: `UA-123456-1` in the GA4 field and Save: "A GA4 ID looks like G-ABC1234 …" under the field, no
toast, nothing saved. The same for a Clarity ID with a space or capitals. Empty fields save and turn that tool off.


## 12. Shop connections (SHOP)

Settings › Shop connections (`/admin/settings/shops`): one connection per WooCommerce shop, its webhook, keys,
warehouse, what the app may write back, its health and its failed-deliveries inbox. The dev stack seeds "Fake shop"
(Colombia, prints orders, both capabilities).

<!-- shops-settings item 6 (shops-ui) adds SHOP-01 – 10 here, smoke in e2e/shops.spec.ts: create a connection (webhook
     URL and secret with Copy), Test connection with bad and good keys, blank keys kept on edit, deactivate, health and
     counters, the failed-deliveries table (filters, body, Retry, Discard), the Orders warning line, Check now per
     connection, the source filter and column naming the shops; SHOP-10 by hand (Spanish, 390 px). -->

## 13. Table filters (FLT)

Every list (products, orders, customers, invoices, users) is filtered, sorted and paged on the server; the filters
live in the column headers (a bottom sheet on a phone) and in the address.

Every list keeps its query in the address (`?q=&sort=&filter[…]&page=`): the cases below read it there too. The text
filters apply 300 ms after the last key (at once on Enter); every tick, quick pick and range applies at once.

**FLT-01 · Orders: the Order filter finds an order by its number on the server**
Smoke: `e2e/filters.spec.ts`.
Signed in as the admin, Orders (Colombia): type `W00007` in "Filter by Order" (the row under the headers). Only W00007
is left, the chip "Order: W00007" is above the table and the address holds `filter[code]=W00007`. The list asked the
server (not the page it had): the filter finds an order whatever page it was on.

**FLT-02 · Orders: the Status list counts each status, ticks several, and the chip names them**
Smoke: `e2e/filters.spec.ts`.
Open "Status" in the filter row: a checkbox per status with how many orders hold it (over the other filters). Tick
Created and Processed: the button reads "Status · 2", the chip "Status: Created, Processed", and the rows are only those
two statuses, as many as the two counts. No status chip of the toolbar is pressed (not even All): two statuses are not
one chip.

**FLT-03 · Orders: Last 30 days fills the Created range, and the chip says it**
Smoke: `e2e/filters.spec.ts`.
Open "Created" in the filter row: Today, Last 7 days, Last 30 days, This month, From and To. Last 30 days: the button
and a chip read "Created: <30 days ago> – <today>" (Bogotá days, both included), the address holds `filter[created_at]`,
and every fixture order (created when the stack was prepared) is still there.

**FLT-04 · Products: a price and a quantity range narrow the stock on the server**
Smoke: `e2e/filters.spec.ts`.
Signed in as `inventory`, Products (Colombia): Price › "Over $500" keeps only the products over $500 (on the fixtures:
none, "Nothing matches these filters." under the headers, which stay); type a Min price and press Enter, then
Quantity › "Over 10": the rows are the products at or over that price with more than 10 units, the chips "Price: From
…" and "Quantity: Over 10" are above the table. The figures above (Products, Units, Stock value) do not change: they
are the warehouse's.

**FLT-05 · Customers: 1,240 of them are paged on the server, and an email filter finds one on a late page**
Smoke: `e2e/filters.spec.ts` (it creates 1,240 customers `flt-0001@flt.test` … `flt-1240@flt.test` through the API
once per stack, about a minute).
Customers filtered by `@flt.test`: the pager says "1 – 25 of 1,240" with Rows per page (25, 50, 100); Next shows
"26 – 50 of 1,240" and `page=2` in the address. Type `flt-0007@flt.test` in "Filter by Email" and press Enter: the one
customer (near the end of the list, newest first) is the only row, back on page 1.

**FLT-06 · Invoices: a total range and the payment method narrow the list**
Smoke: `e2e/filters.spec.ts`.
Signed in as `sales`, Invoices: Total › "$100 – $500" keeps the invoices in that range (INV-0001, $100.00, on the
fixtures) with the chip "Total: $100 – $500"; Payment lists "Credit - counted" and "Credit card - Paypal" with their
counts; ticking Credit card - Paypal adds the chip "Payment: Credit card - Paypal" and keeps only such invoices (on the
fixtures none: INV-0001 has no payment method). The toolbar's "Walk-in" list keeps the walk-in invoices
(`filter[walk_in][]=yes`).

**FLT-07 · Users: the Roles list counts each role, and a tick keeps who has it**
Smoke: `e2e/filters.spec.ts`.
Signed in as the admin, Users: Roles lists the nine assignable roles by their plain names (never `ROLE_…`), each with
how many users hold it; tick Inventory: the chip "Roles: Inventory", and every row left has the Inventory badge, as
many as its count.

**FLT-08 · The address holds the filters: a reload and a pasted link restore them, Clear filters empties it**
Smoke: `e2e/filters.spec.ts`.
Orders: tick Status › Created and type `W0000` in "Filter by Order" (Enter). The address holds both; reload: the chips
"Status: Created" and "Order: W0000" and the text in the filter are back with the same rows. Paste the address in
another tab: the same. Clear filters: no chip is left and the address has no `filter[…]`.

**FLT-09 · A header sorts on the server and its arrow follows**
Smoke: `e2e/filters.spec.ts`.
Users: click the Email header: the list is asked `sort=email`, the address holds it, the arrow points up
(`aria-sort="ascending"`); click again: `sort=-email`, the arrow points down.

**FLT-10 · On a phone, the filters are a sheet: "Show N results" counts the draft and applies it**
Smoke: `e2e/filters.spec.ts` (390 × 844).
Orders at 390 px: no filter row is rendered; the toolbar has "Filters · 0". It opens a sheet from the bottom
("Filters", a drag handle, Sort, a section per filterable column). Open Status, tick Created: the footer button says
"Show N results", N the created orders counted on the server for that draft (one row asked), at least 44 px tall.
Press it: the sheet closes, the chip "Status: Created" is above the cards, the button reads "Filters · 1", and the
cards are the N created orders.

**FLT-11 · The sheet's date quick picks and money ranges**
By hand, 390 × 844, light and dark.
Invoices at 390 px › Filters: the Date section has Today, Last 7 days, Last 30 days and This month as 44 px chips and
two date inputs (the phone's own picker); a quick pick fills both and its chip is pressed; Total has Under $100,
$100 – $500, Over $500 and Min / Max (a decimal keyboard). "Show N results" follows each change after a short pause;
Clear empties the draft (the button then counts every invoice); the close button and Escape leave without applying.
Products: Quantity's quick ranges are 0, 1 – 10 and Over 10; Stock (In stock / Out of stock) is a section of the sheet
too. Nothing scrolls sideways; the sheet's body scrolls under its sticky footer.

**FLT-12 · Every filter and chip in Spanish**
By hand, 1440 and 390, `kf.locale` = es.
On each of the five lists: "Filtrar por <columna>" in the text filters, the lists' buttons ("Estado · 2"), Hoy /
Últimos 7 días / Últimos 30 días / Este mes, Desde / Hasta, Mín. / Máx., Menos de $100 / Más de $500, the chips
("Estado: Creado, Procesado ×"), Quitar filtros, the pager ("1 – 25 de 1.240", Filas por página), the phone's
"Filtros · N", Ordenar and "Mostrar N resultados"; the new labels País (Customers), Pago and Mostrador (Invoices),
"Solo fijados" (Orders › Comments) and "Buscar clientes". No English string and no raw key is left.

