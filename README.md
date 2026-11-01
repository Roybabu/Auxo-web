# AUXO Genesis

Fresh, independent web project on `genesis/fresh-start`. This branch begins with a new root commit and does not inherit or reuse the existing Auxo-web application's files, code, architecture, data or migrations.

## Run

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

## Implemented slices

The foundation includes React/TypeScript/Vite, desktop navigation, reusable form/table components, IndexedDB persistence, and generated PWA assets. Products and inventory support product variants, category checks, barcode/SKU validation, GST-rate assignment, opening stock, manual stock changes, and movement history.

The initial POS slice supports product search and barcode entry, quantities, line and bill amount/percent discounts, GST-inclusive/exclusive calculations, garment/footwear slabs, CGST/SGST or IGST, rupee round-off, cash/UPI/card split payments, financial-year invoice numbers, invoice history/detail, and atomic local invoice/stock updates. Customers can be saved with a credit limit; credit sales and later account repayments update the customer balance and ledger. A customer account screen shows the running statement and accepts cash, UPI or card repayments. Item returns create numbered credit notes, restore stock, and calculate cumulative refunds from original invoice values. Refunds can be recorded as cash, UPI, card or customer-account credit; an original split credit sale settles its proportional account share first.

This is not ready for live transactions. Employee discount permissions, custom GST rates, held and split restaurant bills, invoice print/export, and browser-level offline acceptance remain incomplete. Earlier prototype invoices lack a saved round-off setting and are blocked from automated returns because their refund cannot be reliably calculated. Other module routes are marked not implemented; the 13 report identifiers are listed but report calculations are not available.

Premium styling, desktop packaging, cloud services and synchronization are deferred. No Android-specific APIs, biometric/PIN login, Bluetooth or installer logic is included.

## Separation

- `src/domain`: pure business rules and source-backed report inventory.
- `src/application`: services and storage contracts.
- `src/infrastructure`: browser IndexedDB implementation.
- `src/ui`: pages, navigation and reusable presentation components.

Money uses signed-64-bit-range bigint paise. Invoice monetary values are stored as decimal strings in IndexedDB. Each sale or return updates its invoices, stock, movements, customer balance and account ledger in one transaction. No cloud synchronization or Android APIs are included.

## Provenance

Business reference: `Roybabu/Auxo`, `temp` at `c7a0d3604f52abd317540afd9df5a49fda9159d3`. Android is read-only. `main` is secondary comparison only; `main-backup` is excluded. See [phase plan](docs/PLAN.md).

Source-derived money and settings rules retain GPL-3.0-or-later licensing; see LICENSE. No code from the former Auxo-web implementation is included.
