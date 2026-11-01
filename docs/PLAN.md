# Genesis phase plan

## Source boundary

Only Android `temp` supplies business requirements. Existing Auxo-web implementation and the discarded prior attempt are excluded. This is an independently initialized Git branch, not a continuation of the old web tree.

Primary Android commit: c7a0d3604f52abd317540afd9df5a49fda9159d3.
Relevant foundation sources inspected (under app/src/main/java/com/auxo/pos):

- domain/model/Money.kt: nonnegative decimal input, maximum ten integer/two fraction digits, paise representation, overflow rejection.
- domain/billing/SettingsValidator.kt: required trimmed store name, 70-character name limit, 200-character address limit.
- domain/reports/ReportModel.kt: 13 report identifiers and period/current-position distinction.
- domain/model/Product.kt, StockUnit.kt and domain/validation/ProductFormValidator.kt: product/variant relationships, category-specific rules, stock units and validation.
- domain/model/Purchasing.kt, domain/purchasing/PurchaseForms.kt, PurchaseNumbers.kt, data/repository/RoomPurchasingRepository.kt and domain/contacts/ContactForms.kt: supplier rules, purchase order states, receipts, numbering, partial receiving, stock/cost updates and duplicate supplier invoice handling.

## Implemented phases

1. Foundation: app shell, routes, local storage, store identity settings, PWA build, and money primitives.
2. Products and inventory initial slice: category and variant validation, SKU/barcode checks, standard GST and apparel slab selection, opening stock, manual adjustments and movement history.
3. POS billing slice: cart, quantity controls, line and bill discounts, GST calculation, cash/UPI/card split payment validation, financial-year invoice numbering, invoice detail/history and atomic invoice/stock/movement persistence. Saved customer accounts, credit limits, on-account payments and sale ledger entries are also supported.
4. Customer accounts initial slice: cash/UPI/card repayments, due-balance validation, atomic balance/ledger updates, and a chronological running statement.
5. Returns initial slice: partial and full credit notes, original-invoice rounding and cumulative refund allocation, proportional account refunds, stock restoration, and customer-ledger entries in one transaction.
6. Product tax details: custom GST percentages from 0–100 with two decimal places, 4/6/8-digit HSN validation, and HSN/rate snapshots on sales and credit notes.
7. Local employee access: first-run Super Admin setup, salted PBKDF2 password sign-in, employee accounts and grants, activation and password reset, service storage authorization, and admin-configured employee discount limits.
8. Administrator recovery: 20-character recovery codes in groups of five, confirmation after generation, salted proof storage, and atomic password/code rotation when the signed-out administrator resets the password.
9. Manual web backup/restore: Super Admin exports passphrase-encrypted snapshots, inspects an encrypted file before restoring, and atomically replaces business and account stores. The web format is separate from Android's native database archive.
10. Restaurant billing: table-held bills, token allocation, stale bill indication, resume/discard without stock reservation, item split with proportional fixed discounts, and equal payment shares.
11. Suppliers and purchases: validated supplier records, draft/edit/order/cancel lifecycle, financial-year PO and GRN numbering, partial/full/direct receiving, duplicate supplier invoice prevention, atomic stock movements/cost updates, recorded batch/expiry fields, and purchase backup/restore.
12. Reports and day-end: 13 report builders, date filters, GST summary/rate/HSN/segment/document tables, CSV export, cash reconciliation, unique immutable daily closing and history.
13. Customer loyalty: Super Admin rules, points earned and redeemed in billing, proportional earned-point reversal on returns, customer points history, on-time account-payment bonus, and backup/restore.
14. Expiry batch stock: opening/received stock batches, earliest-expiry-first sales excluding expired stock, return-to-source batches, batch adjustments and expiry stock-on-hand report.

Sources used for the POS and account slice include `domain/billing/BillCalculator.kt`, `Cart.kt`, `Discount.kt`, `DiscountPolicy.kt`, `CartValidator.kt`, `Payments.kt`, `InvoiceNumbers.kt`, `domain/customers/Ledger.kt`, `domain/model/GstRate.kt`, `StockUnit.kt`, `billing/Identifiers.kt`, `billing/SettingsValidator.kt`, `domain/model/Customer.kt`, `domain/contacts/ContactForms.kt`, and `domain/usecase/BillingUseCases.kt`.

## Work sequence

1. Foundation: shell, routes, storage boundary, store identity settings and monetary primitives. No claims of complete business parity.
2. Product/variant model and validation, category rules, barcodes and stock operations, with Android source tests as acceptance cases.
3. POS billing: cart, tax, line/bill discounts, split payment, invoice detail and account-credit sale.
4. Complete billing: employee discount limits, custom GST rates and HSN; returns/refunds; login and service-level permissions; browser invoice print/PDF and CSV export.
5. Restaurant held/split bills and supplier purchase/receiving workflows.
6. Loyalty, remaining business data gaps, and full browser offline acceptance.
7. End-to-end offline/install/update acceptance, then the user's strict Concept 2 design reference.

Each phase must have source references, tests, explicit remaining gaps and a separate commit. Never infer feature completion from the existence of a route.

## Current limits

- PWA assets are generated; offline reload/install/update behavior requires browser acceptance testing. App updates must not interrupt unfinished bills.
- IndexedDB schema is version 11 and stores business settings, products, stock movements, invoices, customers and money ledger, local accounts, held bills, suppliers, purchase orders, goods receipts, day closings, loyalty rules and ledger, and expiry stock batches. Existing expiry-category on-hand quantities migrate into an unlabelled batch. Further stores must use explicit schema upgrades.
- No old-web data migration. The new database name is `auxo-genesis-v1`.
- Sessions are memory-only, so a reload requires password sign-in. The administrator recovery code is shown only when created or rotated and must be stored separately from the browser. Restoring replaces account passwords and recovery proof too: sign in with the credentials from that backup. Manual backups are limited to 100 MB; automatic scheduling, stock-count/custom-category/product-deletion workflows and browser acceptance testing remain incomplete. The activity log records matching events for the web workflows already implemented; mobile-only unlock events are excluded. The first person opening an existing prototype data store after this upgrade creates its local administrator. This is a development skeleton, not an operational POS.
- Origin/profile changes do not transfer local data. Encrypted backup/restore is implemented; automatic backup scheduling is not.
- GitHub CLI push is unavailable in this workspace; commits are published through the connected GitHub repository access and verified against the branch ref.
- POS supports line and bill discounts, account-credit sales with saved customers, standard/custom GST rates (plus the Android apparel/footwear slab), optional HSN, cash/UPI/card payments, loyalty redemption and returns/refunds. Customer accounts support repayments, statements and points history. Loyalty remains off by default and is managed by the Super Admin; the timed payment bonus is optional. Employee roles, permissions and discount limits are enforced through the authorized storage boundary. Admin recovery is supported with a one-time rotating code; invoice detail offers browser print/PDF and CSV export. Browser-level offline acceptance is pending. Restaurant and purchasing workflows are implemented with tests. Expiry-category batches are recorded on opening stock and receiving, decremented by earliest expiry during sales, restored to their source batch on returns, and supported in manual stock adjustments. The expiry report shows remaining quantities. Buyer GSTIN is validated and stored on customer and invoice snapshots; GST summaries separate B2B/B2C invoices and credit notes, and B2B documents include buyer and place-of-supply details. Wastage reporting includes damaged, expired and spoiled movements. Browser printing does not provide direct Bluetooth or thermal-printer configuration.
- Earlier prototype invoices do not store whether rupee round-off was enabled. Automated returns for those invoices are blocked rather than guessing a refund rule.
