# Auxo Web

Offline-first browser/PWA version of the Auxo retail POS. Reference for
branding and business rules: the Android app at `Roybabu/auxo` (branch
`Temp`).

## Decisions

- **Fully offline for now** — no server, no accounts, no cloud. Data stays
  in the browser.
- **Separate project** from the Android app. A server merge may come later.
- **Browser first.** Desktop apps (Windows/Mac/Linux) come later, likely
  via Tauri — the code is structured to make that possible without a
  rewrite.
- **Stack:** Vite + React + TypeScript, SQLite in the browser (WASM),
  installable PWA.

## Structure

```
packages/
  core/   @auxo/core — business rules & data model. Pure TypeScript,
          no browser APIs, thoroughly unit tested. Desktop and web both
          depend on this unchanged.
  app/    @auxo/app — the Vite/React PWA. UI, storage/printing adapters
          that implement @auxo/core's ports, routing.
```

### Why `core` is separate

Tax, discounts, invoice numbering, stock movements, and permissions are
business rules that must behave identically regardless of where they run
(browser today, Tauri desktop later, a server further out). Keeping them
in a dependency-free package with their own tests means that behavior is
pinned down independently of any UI framework or storage choice.

### Data model conventions

- **UUID IDs** everywhere — safe to generate offline on any device.
- **`createdAt`/`updatedAt` timestamps** on every record.
- **Soft deletes** (`deletedAt`) instead of removing rows, so deletions are
  just another timestamped fact.
- **Per-device ID embedded in invoice numbers** (`{deviceId}-{sequence}`),
  so numbers generated offline on different devices never collide.
- **Stock movements, not overwritten totals** — stock is the sum of an
  append-only ledger, which is auditable and mergeable later.

These choices exist to keep a future multi-device/server sync realistic
without redesigning the data model when that day comes.

## Build order

1. Repo skeleton, core package, data model *(done)*
2. Local database plus backup/restore
3. Shop setup and login with owner and employee roles
4. Products, variants, stock
5. Billing screen (discounts, tax, payments)
6. Customers, invoice history, printable invoices
7. Reports
8. PWA install and offline checks, then hosting

## Development

```bash
npm install
npm run test        # core package unit tests
npm run dev          # app dev server
npm run build        # core, then app
```
