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

The foundation includes React/TypeScript/Vite, desktop navigation, reusable form/table components, IndexedDB persistence, and generated PWA assets. First launch creates one local Super Admin with a password and a recovery code to write down; the admin can add, deactivate, grant access to, and reset passwords for employees. A signed-out admin can use the recovery code to replace the password and receive a new code. Roles and permission dependencies follow Android. Passwords and recovery codes use separate per-account salted PBKDF2-SHA256 hashes, and sessions are held in memory. Business service storage is permission-checked, including return and stock operations and an employee discount cap set by the admin. Super Admin can download a passphrase-encrypted web backup and inspect/restore one to replace all local business data and accounts. Products and inventory support product variants, category checks, barcode/SKU validation, standard and custom GST-rate assignment, optional 4/6/8-digit HSN codes, opening stock, manual stock changes, and movement history.

The initial POS slice supports product search and barcode entry, quantities, line and bill amount/percent discounts, GST-inclusive/exclusive calculations, garment/footwear slabs, CGST/SGST or IGST, rupee round-off, cash/UPI/card split payments, financial-year invoice numbers, invoice history/detail, and atomic local invoice/stock updates. Customers can be saved with a credit limit; credit sales and later account repayments update the customer balance and ledger. A customer account screen shows the running statement and accepts cash, UPI or card repayments. Item returns create numbered credit notes, restore stock, and calculate cumulative refunds from original invoice values. Refunds can be recorded as cash, UPI, card or customer-account credit; an original split credit sale settles its proportional account share first. Restaurant billing supports held table bills, resuming and discarding bills, item splitting to a held token bill and exact equal-payment splits.

Suppliers and purchasing support supplier records, draft and ordered purchase orders, editing drafts, partial/full or direct receiving, duplicate supplier-invoice checks, stock movements, cost-price updates, and recorded batch/expiry details. Purchases, goods receipts and suppliers are included in encrypted backup/restore. Reports now calculate all 13 listed report types, including date-range sales, item sales, collections, stock value/movements, purchases, wastage, expiry receipts, low stock, customer balances/aging, GST rate and HSN reports. GST reports include summary, B2B/B2C, rates, HSN and B2B document tables. Day-end reconciliation calculates sales, tender totals and cash difference, saves an immutable close once per date, and includes a closing history. Reports can be exported as CSV.

Invoice detail supports browser printing (including Save as PDF through the system print dialog) and an individual invoice CSV export. This does not connect directly to Bluetooth or configure thermal receipt printers. This is not ready for live transactions. Buyer GSTIN is not stored on web customer snapshots, so GST segmentation cannot identify B2B invoices and the B2B document table is unavailable. Expiry report quantities are receipt quantities because batch on-hand stock is not tracked through sales; wastage currently reflects damaged-stock movements only. Customer loyalty, the activity audit log, and browser-level offline acceptance remain incomplete. Earlier prototype invoices lack a saved round-off setting and are blocked from automated returns because their refund cannot be reliably calculated.

Premium styling, desktop packaging, cloud services and synchronization are deferred. No Android-specific APIs, biometric/PIN login, Bluetooth or installer logic is included.

## Separation

- `src/domain`: pure business rules and source-backed report inventory.
- `src/application`: services and storage contracts.
- `src/infrastructure`: browser IndexedDB implementation.
- `src/ui`: pages, navigation and reusable presentation components.

Money uses signed-64-bit-range bigint paise. Invoice monetary values are stored as decimal strings in IndexedDB. Each sale or return updates its invoices, stock, movements, customer balance and account ledger in one transaction. Access checks guard application storage calls; as with Android local storage, they do not protect against someone who directly controls browser data. Recovery-code replacement and password reset update the account in one IndexedDB transaction. Keep the recovery code safe; it is shown only when generated. Web backups use PBKDF2-SHA256 and AES-256-GCM in a web-specific `.auxowebbak` file; they are not interchangeable with Android `.auxobak` files. Restore validates the decrypted file and replaces all twelve local stores in one transaction, then signs out. Backup files are currently limited to 100 MB; scheduled backups and browser-level offline acceptance remain pending. No cloud synchronization or Android APIs are included.

## Provenance

Business reference: `Roybabu/Auxo`, `temp` at `c7a0d3604f52abd317540afd9df5a49fda9159d3`. Android is read-only. `main` is secondary comparison only; `main-backup` is excluded. See [phase plan](docs/PLAN.md).

Source-derived money and settings rules retain GPL-3.0-or-later licensing; see LICENSE. No code from the former Auxo-web implementation is included.
