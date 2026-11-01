# Genesis phase plan

## Source boundary

Only Android `temp` supplies business requirements. Existing Auxo-web implementation and the discarded prior attempt are excluded. This is an independently initialized Git branch, not a continuation of the old web tree.

Primary Android commit: c7a0d3604f52abd317540afd9df5a49fda9159d3.
Relevant sources inspected in this phase (under app/src/main/java/com/auxo/pos):

- domain/model/Money.kt: nonnegative decimal input, maximum ten integer/two fraction digits, paise representation, overflow rejection.
- domain/billing/SettingsValidator.kt: required trimmed store name, 70-character name limit, 200-character address limit.
- domain/reports/ReportModel.kt: 13 report identifiers and period/current-position distinction.
- domain/model/Product.kt, StockUnit.kt and domain/validation/ProductFormValidator.kt: product/variant relationships, category-specific rules, stock units and validation require a separate implementation phase; no simplified product creator was introduced.

## Work sequence

1. Foundation: shell, routes, storage boundary, store identity settings and monetary primitives. No claims of complete business parity.
2. Product/variant model and validation, category rules, barcodes and stock operations, with Android source tests as acceptance cases.
3. Billing calculator and validators, GST, discounts, payments, atomic invoice/stock updates, login and service-level permissions before operational use.
4. Restaurant/held/split bills; customer ledger, statements, loyalty; suppliers and partial stock receiving.
5. All 13 reports, GST exports, day-end closing, backups/restoration, receipts and exports.
6. End-to-end offline/install/update acceptance, then the user's strict Concept 2 design reference.

Each phase must have source references, tests, explicit remaining gaps and a separate commit. Never infer feature completion from the existence of a route.

## First-phase limits

- PWA assets are generated; offline reload/install/update behavior requires browser acceptance testing. App updates must not interrupt unfinished bills when billing is added.
- IndexedDB schema v1 currently stores only shop identity. More tables and relationships must be introduced through explicit schema upgrades.
- No old-web data migration. The new database name is `auxo-genesis-v1`.
- No authentication yet. This is a development skeleton, not an operational POS.
- Origin/profile changes do not transfer local data. Backup/restore is not yet implemented.
- GitHub integration currently rejects writes with HTTP 403. The branch exists locally until repository write access is available.
