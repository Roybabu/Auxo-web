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
3. POS initial slice: cart, quantity controls, bill-level discounts, GST calculation, cash/UPI/card split payment validation, financial-year invoice numbering, invoice history and atomic invoice/stock/movement persistence.

Sources used for the POS slice include `domain/billing/BillCalculator.kt`, `Cart.kt`, `Discount.kt`, `DiscountPolicy.kt`, `CartValidator.kt`, `Payments.kt`, `InvoiceNumbers.kt`, `domain/model/GstRate.kt`, `StockUnit.kt`, `billing/Identifiers.kt`, and `billing/SettingsValidator.kt`.

## Work sequence

1. Foundation: shell, routes, storage boundary, store identity settings and monetary primitives. No claims of complete business parity.
2. Product/variant model and validation, category rules, barcodes and stock operations, with Android source tests as acceptance cases.
4. Complete billing: line-level discounts and limits, customer association/credit, HSN and custom GST rates, invoice details, returns/refunds and receipt generation; add login and service-level permissions before operational use.
5. Restaurant/held/split bills; customer ledger, statements, loyalty; suppliers and partial stock receiving.
6. All 13 reports, GST exports, day-end closing, backups/restoration, receipts and exports.
7. End-to-end offline/install/update acceptance, then the user's strict Concept 2 design reference.

Each phase must have source references, tests, explicit remaining gaps and a separate commit. Never infer feature completion from the existence of a route.

## Current limits

- PWA assets are generated; offline reload/install/update behavior requires browser acceptance testing. App updates must not interrupt unfinished bills when billing is added.
- IndexedDB schema is version 3 and stores shop settings, products, stock movements and invoices. Further stores must use explicit schema upgrades.
- No old-web data migration. The new database name is `auxo-genesis-v1`.
- No authentication yet. This is a development skeleton, not an operational POS.
- Origin/profile changes do not transfer local data. Backup/restore is not yet implemented.
- GitHub CLI push is unavailable in this workspace; commits are published through the connected GitHub repository access and verified against the branch ref.
- POS currently uses bill-level discounts only, standard GST rates (plus the Android apparel/footwear slab), and cash/UPI/card payments. Customer credit, line discounts, custom GST, invoice print/export, and browser-level offline acceptance are pending.
