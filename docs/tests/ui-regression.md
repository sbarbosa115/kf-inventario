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

**On every screen, whatever the case says**, also check:

- The browser console has no errors, and nothing is a blank page.
- No text shows a raw translation key (`orders.title`).
- Tables and forms look like the rest of the app (`CLAUDE.md`): the shared table, its search box and pages.
- A success or error message appears after every save, and it belongs to *that* save.

---

## 1. Authentication and shell (AUTH, NAV)

**AUTH-01 · Signing in opens the product list**
Smoke: `e2e/auth.spec.ts`.
Open `/admin/login`, sign in as the admin. The product list opens and the top bar shows `sbarbosa115@gmail.com`.

**AUTH-02 · A wrong password is refused**
Smoke: `e2e/auth.spec.ts`.
Sign in as `sbarbosa115` with a wrong password: "Wrong username or password." and the page stays on the sign-in form.

**AUTH-03 · A page opened signed out comes back after signing in**
Smoke: `e2e/auth.spec.ts`.
Signed out, open `/admin/warehouses`: the sign-in page. Sign in: the Warehouses page opens.

**AUTH-04 · Logout ends the session**
Smoke: `e2e/auth.spec.ts`.
Top bar › your email › Logout: the sign-in page. Open `/admin/products` again: the sign-in page.

**AUTH-05 · A previous-version page opened signed out goes to the sign-in page**
Smoke: `e2e/auth.spec.ts`.
Signed out, open `/admin/product/` (a legacy page, until item 12 removes them): the React sign-in page.

**AUTH-06 · Remember me keeps you signed in after closing the browser**
Sign in with "Remember me" ticked, close every window of the browser, open `/admin/products`: still signed in.
Without it, the same steps end on the sign-in page.

**NAV-01 · The admin sees every section they had**
Smoke: `e2e/auth.spec.ts`.
Signed in as the admin: Products (Product List, Upload products, Barcode reader, Incoming products), Warehouses,
Orders, Customers, Users. No Invoices (the admin role does not include the invoice roles, as before).

**NAV-02 · The inventory clerk sees the products menu only**
Smoke: `e2e/auth.spec.ts`.
Signed in as `inventory`: Products and its four entries; no Warehouses, Orders, Invoices, Customers or Users.

**NAV-03 · An unknown address shows "Page not found"**
Smoke: `e2e/auth.spec.ts`.
Open `/admin/nothing-here` signed in: "Page not found" inside the app, with a link to the product list.

## 2. Products (INV)

<!-- Item 6 (products-ui) adds INV-01 – 08; item 7 (stock-ui) adds INV-09 – 16. -->

**INV-01 · The product list opens on the first warehouse, and the old address lands on it**
Smoke: `e2e/products.spec.ts`.
Signed in as the admin, open `/admin/product/` (the previous version's address): `/admin/products` opens, "View
products", the warehouse picker on Colombia, one row per product in stock there (checkbox, Code, Description, Title,
Quantity, Price as `100.00`, Warehouse, a green Edit button). The buttons Move to Warehouse and Update Selected Using
Excel are disabled until a row is ticked; Create Product is always there.

**INV-02 · Another warehouse reloads the list; the search narrows it**
Smoke: `e2e/products.spec.ts`.
Pick España: "This warehouse has no products in stock…"; back to Colombia: its rows again. Type `KF-02` in the search
box: only that row; type something no product has: "Nothing matches these filters." and "Show all" brings every row
back. Sorting by a column header and the pages (10 rows each) work as on the other lists.

**INV-03 · The selected products download as the stock spreadsheet**
Smoke (part): `e2e/products.spec.ts` ticks two rows and checks the download is `Products.xls`.
Tick KF-01 and KF-02 ("2 products selected"), Update Selected Using Excel: `Products.xls` downloads. By hand: open it:
the header row (Code, Title, Detail, Quantity, Price) and exactly the two products ticked, quantity and price 0 (the
previous version's download was empty whenever more than one row was ticked). "Select all" in the header ticks every
row of the page shown.

**INV-04 · Move to Warehouse moves the chosen quantities; they arrive as incoming**
Smoke (part): `e2e/products.spec.ts` moves 2 of KF-03 to Usa and checks both warehouses through the list and the API.
Tick KF-03, Move to Warehouse: a dialog lists the ticked products, each with a quantity from 1 to what Colombia holds
(starting at 1); a product with nothing left says "Product quantity is 0". Destination Warehouse offers every warehouse
but Colombia. Pick Usa and 2, Move: the dialog closes, "The products were moved to Usa. They arrive there as incoming
products.", the ticks are cleared and KF-03 shows 2 fewer. By hand: Incoming products, warehouse Usa: KF-03 with 2.
Ticking several products and leaving their quantities at 1 moves 1 of each (the previous version moved only the rows
whose quantity had been changed).

**INV-05 · A move the warehouse can no longer cover is refused, and nothing moves**
Open the product list in two tabs on Colombia. In the first, move all of KF-01's quantity to Usa. In the second (still
showing the old quantity), tick KF-01, Move to Warehouse, pick the old full quantity, Move: the dialog stays open with
"Only 0 of KF-01 are available." (or the quantity left), Move can be pressed again, and closing the dialog and
reloading shows the stock unchanged by that attempt. Close (top-right × or the Close button) never moves anything.

**INV-06 · A new product is created, and the form names what is missing**
Smoke: `e2e/products.spec.ts`.
Create Product: "Create product", the warning "This product won't be shown on the product list until you add quantities
using Excel.", Status Active. Save empty: Code and Title say "This value should not be blank."; Code `CODE` (or `·`)
and Title `PRODUCT` are refused ("This value should not be equal to …"), a negative price too; nothing is sent. Fill
Code `SMOKE-INV-06`, Title, Price `25.5`, Save: back on the list with "The product was created successfully." (the new
product is not in the list: it has no stock yet).

**INV-07 · A product is edited, from the list and from its old address**
Smoke: `e2e/products.spec.ts`.
Open `/admin/product/edit/<uuid>` of the product of INV-06: its form at `/admin/products/<uuid>/edit`, "Edit product",
filled in, no warning. Change the Title, Status Inactive, Save: "The product was updated successfully.". The Edit
button of a row opens that product's form; Cancel goes back without saving. `/admin/products/<unknown uuid>/edit` says
"This product no longer exists." with a link back to the products.

**INV-08 · A person without the inventory role is refused**
Smoke: `e2e/products.spec.ts`.
Signed in as `invoices`: no Products section in the sidebar; opening `/admin/products` says "You do not have
permission to do this."; `/api/v1/warehouses/1/stock` answers 403. Signed in as `inventory`: the list, the move and
the form all work (INV-02 – 07 run as that account).

**INV-09 · The upload screen links to the template and to every product**
Smoke: `e2e/stock.spec.ts`.
Signed in as the admin, open `/admin/product/upload` (the previous version's address): `/admin/products/upload` opens,
"Upload products", the description, Download template and Download All Products (each opens an `.xls`), a file box and a
Warehouse list.

**INV-10 · Upload names what is missing and refuses a file that is not a spreadsheet**
Smoke: `e2e/stock.spec.ts`.
Upload with nothing chosen: "Choose a spreadsheet to upload." and "Choose the warehouse the quantities go to."; nothing
is sent. Choose a `.txt` file and a warehouse: "The file is not an Excel spreadsheet (xls or xlsx)."

**INV-11 · A spreadsheet from the template is stored in the chosen warehouse**
Smoke (part): `e2e/stock.spec.ts` uploads the all-products sheet and checks the confirmation.
Download All Products, put quantities in the Quantity column of two rows and add one new row (code, title, detail,
quantity, price), choose a warehouse and Upload: "N products were stored." with a link to the Product List. By hand:
the product list of that warehouse shows the new product and the quantities added to the existing ones; a sheet with
the wrong columns says "The spreadsheet could not be read. Use the template and try again."

**INV-12 · The barcode reader adds a code on Enter, counts a repeated one and checks it exists**
Smoke: `e2e/stock.spec.ts`.
Open `/admin/product/update/bar-code`: `/admin/products/barcode` opens with "No products read yet." Type `KF-01` and
press Enter: the box empties and the row shows quantity 1; again: still one row, quantity 2. `NOPE-404` gets the red
cross ("The product does not exist"), `KF-01` the green check. The quantity box can be edited (0 or text turns it red
and disables Add/Remove products) and the bin removes the row.

**INV-13 · The codes read are confirmed and added to the chosen warehouse**
Smoke: `e2e/stock.spec.ts`.
With `KF-01` x2 read and Usa chosen, Add products opens "Confirm the products" naming Usa and the code and quantity;
Cancel changes nothing; Add quantity shows "The products were added to Usa." and empties the list. The Usa stock list
of the Products screen shows KF-01 with 2.

**INV-14 · Removing more than the warehouse has is refused and keeps the list**
Smoke: `e2e/stock.spec.ts`.
Read `KF-01`, choose Usa, set the quantity to 50, Remove products, Remove quantity: "There is not enough stock of
KF-01: 2 available." and the list is still there. With quantity 1 it shows "The products were removed from Usa." and
Usa keeps 1.

**INV-15 · Incoming products wait until "Approve all" puts them in stock**
Smoke: `e2e/stock.spec.ts` (the move is made through the API; the Products screen's move modal is item 6's).
After moving KF-02 x4 from Colombia to España, `/admin/product/incoming` opens `/admin/products/incoming`; pick España:
one row (code, description, 4, España). Approve all: "1 incoming product was approved.", the list says nothing is
waiting and Approve all is disabled. By hand: España's stock list shows KF-02 with 4 and Colombia's with 96.

**INV-16 · A person without the inventory role is told so**
Smoke: `e2e/stock.spec.ts`.
Signed in as `invoices`: no Products menu; `/admin/products/incoming` says "You do not have permission to do this.";
an upload submitted on `/admin/products/upload` says the same.

## 3. Warehouses (WH)

<!-- Item 7 (stock-ui) adds WH-01 – 03. -->

**WH-01 · The list shows every warehouse, and the old address lands on it**
Smoke: `e2e/stock.spec.ts`.
Signed in as the admin, open `/admin/warehouse/` (the previous version's address): `/admin/warehouses` opens, "View
warehouses", one row per warehouse (`#`, name, an Edit button); `/admin/warehouse/edit/1` lands on the same list. The
search box finds a row by name.

**WH-02 · A warehouse is renamed in a modal, and a blank name is refused**
Smoke: `e2e/stock.spec.ts` (it puts the name back).
Edit on a row opens "Edit warehouse" with its name. Clear it and Save: "This value should not be blank." under the
box, nothing is sent. Type a new name and Save: the modal closes, "Warehouse updated successfully" and the row shows the
new name. By hand: the new name appears in every warehouse list (Products, Orders, Upload).

**WH-03 · Any signed-in person can open the warehouses by address**
Smoke: `e2e/stock.spec.ts`.
Signed in as `invoices` (no Warehouses entry in the sidebar), `/admin/warehouses` still lists the warehouses, as the
previous version did (the API asks only for a signed-in user: a known gap).

## 4. Customers (CUS)

**CUS-01 · The list shows the customers, and the old address lands on it**
Smoke: `e2e/customers.spec.ts`.
Signed in as the admin, open `/admin/customer/` (the previous version's address): `/admin/customers` opens, "Customers",
a Create Customer button, one row per customer (name, email, phone, an edit and a delete button). The search box finds
a customer of the page by name, email or phone. By hand, with more than 100 customers: page links appear under the
table, "Page 2" shows the rest and the address says `?page=2`. `/admin/customer/new` lands on `/admin/customers/new`.

**CUS-02 · A customer is created with a country, state and city that did not exist**
Smoke: `e2e/customers.spec.ts`.
Create Customer › fill Name, Last Name, Email, Phone, Address, Zip Code; in Country type a new name and pick
`Create "…"`, then the same in State and City; Save: back on the list with "The customer was created successfully."
and the new row. By hand: choosing an existing country offers only its states, and an existing state only its cities;
changing the country empties State and City. A name already in the list is not offered as new.

**CUS-03 · Editing shows what was saved, and addresses are added and removed**
Smoke: `e2e/customers.spec.ts`.
Edit the customer of CUS-02: every field and the three place names are filled; change the phone, Add Address shows a
second address and its Remove Address takes it out (the first address has no remove button), Save: "The customer was
updated successfully." and the row shows the new phone. By hand: save an address with a new city under an existing
state, open it again: the city is in the City list of every other address of that state.

**CUS-04 · Deleting asks first**
Smoke: `e2e/customers.spec.ts`.
Delete Customer › "Are you sure to delete this Customer?": Cancel keeps the row; Delete removes it with "The customer
was deleted." By hand: the customer's orders no longer appear in the Orders list either.

**CUS-05 · The form names what is missing, and a customer that no longer exists says so**
Smoke: `e2e/customers.spec.ts`.
Create Customer, Save with everything empty: Name, Last Name, Email, Phone, Address and Zip Code say "This value should
not be blank."; nothing is sent. An email without `@` says so. `/admin/customers/999999/edit`: "This customer no longer
exists." with a link back to the customers.

**CUS-06 · A person without the Customers role is refused**
Smoke: `e2e/customers.spec.ts`.
Signed in as `inventory`: no Customers entry in the sidebar; `/admin/customers` says "You do not have permission to do
this."; `/api/v1/customers` answers 403.

## 5. Orders (ORD)

<!-- Item 9 (orders-ui) adds ORD-01 – 10; item 10 (order-forms-ui) adds ORD-11 – 18; item 13 (woocommerce-sync) adds
     ORD-19 – 20. -->

**ORD-11 · The old order form and getting-ready addresses land on the new screens**
Smoke: `e2e/order-forms.spec.ts`.
Signed in as the admin, open `/admin/order/new` (the previous version's address): `/admin/orders/new` opens, "Create a
new order". `/admin/order/edit/<id of W00002>` opens `/admin/orders/<id>/edit`, "Editing Order", Consecutive
`W00002`; `/admin/order/partial/getting-ready/<id>` opens `/admin/orders/<id>/getting-ready`, "Getting ready order
#W00002". By hand: the Edit and Getting ready buttons of the orders list open the same screens.

**ORD-12 · The form saves only when complete, and the warehouse locks once a product is filled**
Smoke: `e2e/order-forms.spec.ts`.
Create an order: the Create button is disabled and the hint under it names what is required (customer's first name,
last name and email, warehouse, a product with its quantity, source, payment method, status). Pick Warehouse
Colombia, Product 1 `KF-01 (KF-01)`: the warehouse can still change; type a quantity: the Warehouse select is locked
(empty the quantity: it unlocks). By hand: before a warehouse is picked the product select is disabled; changing the
warehouse offers only that warehouse's products (Usa has none in the fixtures: "This warehouse has no products in
stock").

**ORD-13 · An order is placed for a new customer with two products**
Smoke: `e2e/order-forms.spec.ts` (and MAIL-01 reads its email).
Type First Name, Last Name, Email, Phone, Address, Zip Code; Warehouse Colombia; Product 1 KF-01, quantity 3; the green
+ adds a second row: KF-02, quantity 1; Consecutive, Source Phone, Payment Method Credit Card, Status Created; Create:
back on the orders list. The order holds KF-01 × 3 and KF-02 × 1, status Created. By hand: the red × of a row takes it
out; the + appears only on the last row once it is filled; the new customer is in the Customers list with the address.

**ORD-14 · Picking an existing customer fills the customer block**
Smoke: `e2e/order-forms.spec.ts`.
Search Customer › type `Jose` › `Jose Perez [jose.perez@example.com] [+57 3002825566]`: First Name, Last Name, Email,
Phone and the address (with its country, state and city) are filled. By hand: change the phone, place the order: the
Customers list shows Jose Perez once, with the new phone (the order updates the customer it names, it does not copy
it). The × of the picker empties the customer block.

**ORD-15 · Editing an order shows what was saved and updates it**
Smoke: `e2e/order-forms.spec.ts`.
Edit the order of ORD-13: the customer, Consecutive, the two products with their quantities, source, payment method
and status are filled, and the warehouse is locked. Change KF-01 to 2, Update: back on the list; the order holds
KF-01 × 2. By hand: an order in status Partial, Sent or Delivered keeps its status in the Status select (the form
offers Created, Processed and Completed otherwise); a comment typed here shows in the order's detail.

**ORD-16 · Getting ready: a scan adds one, and what is not on the order or over its quantity is refused**
Smoke: `e2e/order-forms.spec.ts`.
Open Getting ready for the order of ORD-15: the Bar Code box has the focus. Type `KF-01` and Enter: its This Order
shows 1 and Product Order Quantity `2 / 1`. `NOPE-404` + Enter: "You are trying to add a product that is not on the
current order…", Continue adding. KF-01 again: `2 / ~`; once more: "You reached the limit of product allowed to add to
this order." The red − takes one away. By hand: with a barcode scanner the same happens; the rows are tinted red
(nothing added), yellow (some) and green (complete); a product whose warehouse stock is all in this shipment says
"There is no enough quantity of this product on inventory." (set a product's stock to 1 with the barcode reader's
remove first).

**ORD-17 · Partial shipments take the stock out, and a sent order takes no more**
Smoke: `e2e/order-forms.spec.ts`.
Scan KF-01 twice, Save Current: back on the orders list, the order is Partial. Getting ready again: KF-01's Inventory
button shows 2 less, Aggregate Partials 2 and `2 / ~`. Scan KF-02, Save Current; open it again: every row shows `~`
and its + is disabled. The fixtures' `W00005` (Sent): Save Current is disabled. By hand: an order whose whole content
is scanned in one go (and in stock) becomes Sent; Cancel goes back to the orders list without saving.

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

## 6. Invoices (INVC)

**INVC-01 · The list shows the invoices, and the old addresses land on the new screens**
Smoke: `e2e/invoices.spec.ts`.
Signed in as `invoices`, open `/admin/invoice/` (the previous version's address): `/admin/invoices` opens, "Invoices",
a Create invoice button, one row per invoice (`Invoice #`, customer as `First Last [email]` or "POS Client", total, date
as `05 Oct 2026`, an Invoice Detail button and a PDF button that opens in a new tab). The search box finds a row by
code, customer, total or date; a search that matches nothing says so and "Show all" brings the rows back.
`/admin/invoice/new` lands on `/admin/invoices/new`.

**INVC-02 · The detail opens in a dialog with the lines and the PDF link**
Smoke: `e2e/invoices.spec.ts`.
Invoice Detail on INV-0001: a dialog with the code, the customer (or "POS Client"), the date, a row per line (product
code, description, quantity, unit price, total), the total (with subtotal and tax when the invoice has tax) and View as
PDF; Close, the x and Escape close it. By hand: View as PDF opens the PDF in a new tab.

**INVC-03 · An invoice is created with a customer, a product and tax, its PDF opens and the list shows it**
Smoke (part): `e2e/invoices.spec.ts` creates the invoice and checks the list and that the PDF answers.
Create invoice: `Invoice #` already holds the next code (`INV-0002` after `INV-0001`); pick the customer in
`Customer` (their name, email, phone and address fill in); pick a product in `Product 1` (the description and the unit
price fill in); quantity 2, Sale Tax 6%: the subtotal, tax and total follow as you type; Create Invoice: the PDF opens
in a new tab and the list shows "The invoice was created successfully." and the new row. By hand: the PDF shows the
code, the customer, the lines and the 6% tax; with no customer picked and nothing typed, the invoice is a "POS Client";
typing a new customer (with a country, state and city that did not exist) creates it, and it is then in the Customers
list and in the customer picker.

**INVC-04 · Add all products puts every product of the warehouse on the invoice, and an item can be removed**
Smoke: `e2e/invoices.spec.ts`.
Warehouse Colombia › Add all products: one item per product of its stock (KF-01, KF-02, KF-03) with its price, the
total adds them up; a product already on the invoice is not added twice. Remove item takes one out and the total
follows; Add item adds an empty one. Changing the Warehouse changes the products offered, not the items already added.

**INVC-05 · An invoice needs an item, and a code already used is refused**
Smoke: `e2e/invoices.spec.ts`.
Create Invoice with nothing typed: "Please add at least one invoice item." and nothing is sent. A quantity of 0 or a
price with three decimals says what is wrong. An item with a description only (no product) is accepted. With the code
of an existing invoice (`INV-0001`): "An invoice with this code already exists." under `Invoice #`, no PDF opens and
the typed items stay.

**INVC-06 · The admin is refused on invoices**
Smoke: `e2e/invoices.spec.ts`.
Signed in as the admin: no Invoices entry in the sidebar; `/admin/invoices` says "You do not have permission to do
this."; `/api/v1/invoices` answers 403 (no role reaches the invoice roles; they are given one by one). A user with
only `ROLE_CAN_READ_INVOICES` sees the list and the detail but no Create invoice button.

## 7. Users (USR)

**USR-01 · The list shows every account with its roles, and the old address lands on it**
Smoke: `e2e/users.spec.ts`.
Signed in as the admin, open `/admin/user/` (the previous version's address): `/admin/users` opens, "View Users", one
row per account (`#`, name, email, one badge per role, an Edit button). The search box finds a row by name, username,
email or role; a search that matches nobody says so and "Show all" brings the rows back.

**USR-02 · A new user is created and appears in the list**
Smoke (part): `e2e/users.spec.ts` creates the user and checks the list.
Create User › fill Name, Email, Username, Password, tick `ROLE_MANAGE_INVENTORY`, Save: back on the list with "The
user was created successfully." and the new row. By hand: sign out and sign in as the new user: the Products menu only.
The form offers exactly nine roles (`ROLE_ADMIN`, `ROLE_MANAGE_INVENTORY`, `ROLE_MANAGE_ORDERS`, `ROLE_UPDATE_ORDERS`,
`ROLE_UPDATE_INVOICES`, `ROLE_CAN_READ_INVOICES`, `ROLE_CAN_CREATE_INVOICES`, `ROLE_MANAGE_USERS`,
`ROLE_MANAGE_WAREHOUSES`) and a Status of Enabled or Disabled.

**USR-03 · Editing without typing a password keeps the password**
Smoke (part): `e2e/users.spec.ts` edits, then signs in with the old password through the API.
Edit the user of USR-02: the Password box is empty and says "Leave blank to keep the current password."; change the
name, tick `ROLE_MANAGE_ORDERS`, Save: "The user was updated successfully." and the row shows both. By hand: sign in as
that user with the password of USR-02: it still works.

**USR-04 · The form names what is missing and what is wrong**
Smoke: `e2e/users.spec.ts`.
Create User, Save with everything empty: Name, Email, Username and Password are marked and say "This value should not
be blank."; nothing is sent. An email without `@` or a password of fewer than 6 characters says so under its field.

**USR-05 · A user that no longer exists says so**
Smoke: `e2e/users.spec.ts`.
Open `/admin/users/999999/edit`: "This user no longer exists." with a link back to the users.

**USR-06 · A person without the Users role is refused**
Smoke: `e2e/users.spec.ts`.
Signed in as `inventory`: no Users entry in the sidebar; opening `/admin/users` says "You do not have permission to do
this."; `/api/v1/users` answers 403. By hand, as the admin: change a user's password on Edit (type a new one, Save),
then sign in with the old one (refused) and the new one (works).


## 8. Emails (MAIL)

<!-- Item 10 (order-forms-ui) adds MAIL-01 – 02: the printer's email of a new order, read in Mailpit. -->

**MAIL-01 · An order placed by hand is emailed to the printer**
Smoke (part): `e2e/order-forms.spec.ts` finds the email of ORD-13 in Mailpit (to the printer, subject, body).
After ORD-13, Mailpit has, within a minute, "Order #<Consecutive> was created" to `printer@kf.local` (the dev stack's
`MAILER_PRINTER_ADDRESS`), body "A new order was created and attached to this email.". By hand: it is cc'd to
`sales@klassicfab.com`, from `KF Inventory <orders@kf.local>`, and its attachment `order-<id>.pdf` opens and lists the
order's customer and products.

**MAIL-02 · Editing an order sends no email**
Smoke: `e2e/order-forms.spec.ts`.
Edit `W00001`, change the comment and the payment method, Update: no new email reaches the printer.

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
https://usa.test` (warehouse 2) is placed in Usa and sends no email.

**HOOK-02 · An unknown shop is answered ok and nothing happens**
Smoke: `e2e/webhook.spec.ts`.
Post the sample order with `X-WC-Webhook-Source: https://unknown-shop.test` (and a new `id`). The answer is still
`{"status":true}`; no warehouse lists the order, no email arrives, and `docker compose logs php` shows
"Warehouse [https://unknown-shop.test] was not found".
