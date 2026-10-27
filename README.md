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
2. Local database plus backup/restore *(done)*
3. Shop setup and login with owner and employee roles *(done)*
4. Products, variants, stock *(done)*
5. Billing screen (discounts, tax, payments) *(done)*
6. Customers, invoice history, printable invoices *(done)*
7. Reports *(done)*
8. PWA install and offline checks, then hosting *(done)*

## Development

```bash
npm install
npm run test        # core package unit tests
npm run dev          # app dev server
npm run build        # core, then app
```

## PWA / offline

The built app is a standard installable PWA:

- `packages/app/vite.config.ts` configures `vite-plugin-pwa` with a full
  manifest (name, icons at 192/512, a maskable 512 icon, theme color) and
  precaches every built asset — JS, CSS, HTML, and the SQLite WASM binary
  — so the app keeps working with no network at all once it's been opened
  once.
- Icons live as SVG sources in `packages/app/icon-source/` and are
  rasterized to `packages/app/public/icons/`; regenerate them with
  `sharp` if the source SVGs change (see git history for the one-off
  script used to generate them).
- There is no backend and no outbound network call anywhere in the app —
  data lives entirely in the browser's IndexedDB, so "offline" isn't a
  degraded mode, it's the normal mode.
- Verified end to end: after a first (online) load, the app was taken
  fully offline and reloaded — it booted, and normal operations (adding
  inventory, etc.) worked identically.

## Hosting

The app is a static site (no server component), so any static host works.
`.github/workflows/deploy.yml` builds `@auxo/core` then `@auxo/app` and
deploys `packages/app/dist` to GitHub Pages automatically on every push to
`main` (or manually via the Actions tab's "Run workflow" button). To use a
different static host (Netlify, Vercel, S3, a shop's own web server, etc.)
instead, just upload the contents of `packages/app/dist` after running
`npm run build` — the app's `base: "./"` setting means it works from any
subpath, not just a domain root.
