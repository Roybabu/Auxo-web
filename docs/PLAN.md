# Genesis phase plan

## Source boundary

Only Android `temp` supplies business requirements. Existing Auxo-web implementation and the discarded prior attempt are excluded. This is an independently initialized Git branch, not a continuation of the old web tree.

Primary Android commit: c7a0d3604f52abd317540afd9df5a49fda9159d3.
Relevant foundation sources inspected (under app/src/main/java/com/auxo/pos):

- domain/model/Money.kt: nonnegative decimal input, maximum ten integer/two fraction digits, paise representation, overflow rejection.
- domain/billing/SettingsValidator.kt: required trimmed store name, 70-character name limit, 200-character address limit.
- domain/reports/ReportModel.kt: 13 report identifiers and period/current-position distinction.
- domain/model/Product.kt, StockUnit.kt and domain/validation/ProductFormValidator.kt: product/variant relationships, category-specific rules, stock units and validation.

## Implemented phases

1. Foundation: app shell, routes, local storage, store identity settings, PWA build, and money primitives.
2. Products and inventory initial slice: category and variant validation, SKU/barcode checks, standard GST and apparel slab selection, opening stock, manual adjustments and movement history.
3. POS billing slice: cart, quantity controls, line and bill discounts, GST calculation, cash/UPI/card split payment validation, financial-year invoice numbering, invoice detail/history and atomic invoice/stock/movement persistence. Saved customer accounts, credit limits, on-account payments and sale ledger entries are also supported.

Sources used for the POS and account slice include `domain/billing/BillCalculator.kt`, `Cart.kt`, `Discount.kt`, `DiscountPolicy.kt`, `CartValidator.kt`, `Payments.kt`, `InvoiceNumbers.kt`, `domain/model/GstRate.kt`, `StockUnit.kt`, `billing/Identifiers.kt`, `billing/SettingsValidator.kt`, `domain/model/Customer.kt`, `domain/contacts/ContactForms.kt`, and `domain/usecase/BillingUseCases.kt`.

## Work sequence

1. Foundation: shell, routes, storage boundary, store identity settings and monetary primitives. No claims of complete business parity.
2. Product/variant model and validation, category rules, barcodes and stock operations, with Android source tests as acceptance cases.
3. POS billing: cart, tax, line/bill discounts, split payment, invoice detail and account-credit sale.
4. Complete billing: enforce employee discount limits, custom GST rates and HSN; add account payments/statements, returns/refunds and receipt generation; add login and service-level permissions before operational use.
5. Restaurant/held/split bills; loyalty; suppliers and partial stock receiving.
6. All 13 reports, GST exports, day-end closing, backups/restoration, receipts and exports.
7. End-to-end offline/install/update acceptance, then the user's strict Concept 2 design reference.

Each phase must have source references, tests, explicit remaining gaps and a separate commit. Never infer feature completion from the existence of a route.

## Current limits

- PWA assets are generated; offline reload/install/update behavior requires browser acceptance testing. App updates must not interrupt unfinished bills.
- IndexedDB schema is version 5 and stores shop settings, products, stock movements, invoices, customers and customer account ledger entries. Further stores must use explicit schema upgrades.
- No old-web data migration. The new database name is `auxo-genesis-v1`.
- No authentication yet. This is a development skeleton, not an operational POS.
- Origin/profile changes do not transfer local data. Backup/restore is not yet implemented.
- GitHub CLI push is unavailable in this workspace; commits are published through the connected GitHub repository access and verified against the branch ref.
- POS supports line and bill discounts, account-credit sales with saved customers, standard GST rates (plus the Android apparel/footwear slab), and cash/UPI/card payments. Account payments/statements, employee discount limits, custom GST, HSN, returns/refunds, invoice print/export, and browser-level offline acceptance are pending.
