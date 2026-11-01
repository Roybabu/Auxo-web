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

## First phase

Implemented: React/TypeScript/Vite shell, desktop navigation with hash routes, IndexedDB store identity persistence, reusable input/table primitives, PWA build configuration and tested money parsing/validation foundations.

Only store name/address settings currently save business data. Other module routes are explicitly marked not implemented. Report catalog contains all 13 Android identifiers; report calculations are not implemented. No authentication or billing is provided yet. Do not use this foundation for live transactions.

Premium styling, desktop packaging, cloud services and synchronization are deferred. No Android-specific APIs, biometric/PIN login, Bluetooth or installer logic is included.

## Separation

- `src/domain`: pure business rules and source-backed report inventory.
- `src/application`: services and storage contracts.
- `src/infrastructure`: browser IndexedDB implementation.
- `src/ui`: pages, navigation and reusable presentation components.

Money uses signed-64-bit-range bigint paise. Future JSON serialization must use decimal strings, not floating-point conversion. No monetary records are persisted in this phase.

## Provenance

Business reference: `Roybabu/Auxo`, `temp` at `c7a0d3604f52abd317540afd9df5a49fda9159d3`. Android is read-only. `main` is secondary comparison only; `main-backup` is excluded. See [phase plan](docs/PLAN.md).

Source-derived money and settings rules retain GPL-3.0-or-later licensing; see LICENSE. No code from the former Auxo-web implementation is included.
