# AUXO Shared Backup Format

**Status:** Specification for review; no import/export implementation is authorized yet
**Format identifier:** `auxo-backup`
**Format version:** 1
**Shared model version:** 1
**Applies to:** AUXO Web and AUXO Android

This document defines one encrypted file that either app can create and the other can restore. Version 1 contains business data only. It never transfers login accounts, password hashes, recovery codes, sessions, local database keys, or device appearance/preferences. Imported audit actors are historical labels and never become local users.

## 1. Encrypted file container

The file is the fixed 74-byte header followed by one AES-GCM ciphertext. The 16-byte GCM authentication tag is appended to the ciphertext by both Web Crypto and `javax.crypto.Cipher` (`AES/GCM/NoPadding`). There is no ZIP, Tink stream, database file, or second encryption layer in this format.

All integer fields are unsigned big-endian. Text fields are ASCII, NUL-padded to their stated width. The complete header is AES-GCM additional authenticated data (AAD), so changing any header byte makes authentication fail.

| Offset | Size | Field | Version 1 value / meaning |
|---:|---:|---|---|
| 0 | 8 | Magic | ASCII `AUXOBKUP` |
| 8 | 2 | Format version | `1` |
| 10 | 20 | KDF name | ASCII `PBKDF2-HMAC-SHA256`, NUL-padded to 20 bytes |
| 30 | 12 | Cipher name | ASCII `AES-256-GCM`, then one NUL byte |
| 42 | 4 | PBKDF2 iterations | `600000` |
| 46 | 16 | Salt | Random, unique per backup |
| 62 | 12 | GCM nonce | Random, unique for the derived key |
| 74 | remaining | Ciphertext and tag | UTF-8 JSON ciphertext, followed by the 16-byte tag |

The KDF input is the passphrase encoded as UTF-8 after Unicode NFC normalization; do not trim or case-fold it. Derive exactly 256 bits with PBKDF2-HMAC-SHA256 and the header salt and iteration count. Use those 32 bytes directly as the AES-256-GCM key. The GCM tag is 128 bits. Nonce reuse with the same derived key is forbidden. Version 1 readers accept exactly the constants and lengths above and reject unsupported KDF/cipher names, iteration counts other than 600000, files shorter than 90 bytes, and plaintext larger than 256 MiB. Reject before parsing or writing anything if the header is invalid or authentication fails.

The maximum is on decrypted JSON bytes. Exporters must account for base64 expansion of photos before writing and fail with a clear size message when the limit would be exceeded. Readers must authenticate and validate the entire plaintext before showing the restore confirmation. No partially decrypted or partially imported content is usable.

### Platform crypto mapping

| Operation | Web | Android |
|---|---|---|
| NFC + UTF-8 passphrase bytes | `String.prototype.normalize('NFC')`, `TextEncoder` | `java.text.Normalizer` with `Form.NFC`, UTF-8 bytes |
| PBKDF2 | Web Crypto `deriveBits`, `PBKDF2`, `SHA-256`, 600000 iterations, 256 bits | `SecretKeyFactory` `PBKDF2WithHmacSHA256`, 600000 iterations, 256 bits |
| AES-GCM | Web Crypto `AES-GCM`, 128-bit tag, header as `additionalData` | `Cipher` `AES/GCM/NoPadding`, `GCMParameterSpec(128, nonce)`, header passed to `updateAAD` |
| Ciphertext bytes | Web Crypto result includes the tag at the end | `doFinal` result includes the tag at the end |

The passphrase is not stored in the file. The random salt and nonce are not secrets. Implementations must use a cryptographically secure random generator and must not reuse a nonce for a derived key.

## 2. Decrypted JSON payload

The authenticated plaintext is one UTF-8 JSON object. JSON property order is not significant for ordinary files. The conformance vector below uses the exact displayed byte sequence. Unknown properties and namespaced extension records must survive import/export unchanged.

```json
{
  "format": "auxo-backup",
  "version": 1,
  "sharedModelVersion": 1,
  "createdAt": 1793577600000,
  "source": { "platform": "web", "appVersion": "1.0.0" },
  "shopName": "Example Shop",
  "tables": {
    "settings": [], "categories": [], "subcategories": [],
    "products": [], "variants": [], "stockBatches": [], "stockMovements": [],
    "customers": [], "customerLedger": [], "invoices": [], "invoiceLines": [], "payments": [],
    "suppliers": [], "purchaseOrders": [], "purchaseOrderLines": [],
    "receipts": [], "receiptLines": [], "dayClosings": [],
    "loyaltySettings": [], "loyaltyLedger": [], "heldBills": [], "heldBillLines": [],
    "quotations": [], "quotationLines": [], "stockCounts": [], "stockCountLines": [],
    "auditLog": [], "numberSequences": [], "extensions": []
  },
  "photos": []
}
```

Every table key is required, even when its value is an empty array. `loyaltySettings` has zero or one row. `settings` has exactly one row for a configured shop. Every `id` and relationship ID in this payload is a stable lowercase or uppercase UUID string (`8-4-4-4-12` hexadecimal form); platform-local integer row IDs are not exported. Money is a base-10 integer-paise string, including zero and negative ledger amounts; JSON numbers and decimal rupees are forbidden for money. Instants are safe integer UTC epoch milliseconds. Business dates and expiry dates are `YYYY-MM-DD` calendar strings, not local timestamps. Quantities are integers in the stated stock unit's base scale: pieces for `UNIT`, grams for `GRAM`, millilitres for `MILLILITRE`; pack quantities use thousandths plus a unit code.

### Common scalar notation

| Type | Meaning |
|---|---|
| `UUID` | Stable UUID string; required unless marked optional/nullable |
| `string` | UTF-8 JSON string |
| `string?` | Required property that may be JSON `null` |
| `integer` | JSON integer, within the receiving app's safe range |
| `boolean` | JSON `true` or `false` |
| `paise` | Required string containing a signed whole-paise integer |
| `paise?` | Required property containing a whole-paise string or `null` |
| `instant` | Required integer UTC epoch milliseconds |
| `date?` | Required property containing `YYYY-MM-DD` or `null` |
| `object` | JSON object with the listed fields; unknown fields are retained in extensions |

In the tables below, fields are required unless explicitly marked **optional**. A nullable field is still required in the JSON object; `?` after its type means it may be `null`.

### Table contracts and app mappings

| Table / record | Required fields and types | Optional fields and types | Web mapping | Android mapping |
|---|---|---|---|---|
| `settings` (single row) | `id: string` (literal `shop`); `storeName: string`; `address: string`; `gstin: string`; `stateCode: string`; `gstRegistered: boolean`; `pricesIncludeTax: boolean`; `roundOff: boolean`; `invoicePrefix: string`; `creditNotePrefix: string`; `phone: string`; `fssai: string`; `upiId: string`; `upiPayeeName: string`; `receiptPaper: string`; `receiptFooter: string`; `receiptLanguage: string`; `receiptShowHsn: boolean`; `receiptShowTaxBreakdown: boolean`; `receiptShowCustomer: boolean`; `receiptShowSavings: boolean`; `receiptShowBarcode: boolean`; `receiptShowUpiQr: boolean`; `employeeDiscountLimitBp: integer`; `expiryWarningDays: integer`; `metalRatesPaise: object` keyed by metal, values `paise` | `storeLogoPhotoId: UUID?`; `tableCount: integer?`; `creditHoldDays: integer?`; `onTimeBonusPoints: integer?`; namespaced extensions | `ShopIdentity` plus `loyaltyRules` singleton; metal rates and Web-only values mapped directly | `StoreSettingsEntity`; `LoyaltySettingsEntity` maps to `loyaltySettings`; unsupported settings use `org.auxo.android` extensions |
| `categories` | `id: UUID`; `name: string?`; `profile: string`; `enabled: boolean`; `sortOrder: integer`; `builtIn: boolean` | extension fields | `ShopCategory` rows; profile is category enum | `ShopCategoryEntity`; allocate UUIDs for Room numeric IDs |
| `subcategories` | `id: UUID`; `categoryId: UUID`; `name: string`; `sortOrder: integer` | extension fields | `ShopCategory.subcategories[]` flattened and reassembled | `ShopSubcategoryEntity`; translate category FK |
| `products` | `id: UUID`; `name: string`; `category: string`; `brand: string?`; `createdAt: instant`; `updatedAt: instant`; `stockUnit: string`; `gstRateBasisPoints: integer?`; `apparelGst: boolean`; `available: boolean`; `tracksStock: boolean` | `categoryId: UUID?`; `subcategory: string?`; `description: string?`; `material: string?`; `dietType: string?`; `hsnCode: string?`; `preferredSupplierId: UUID?`; `photoId: UUID?`; `warrantyMonths: integer?`; `prescriptionRequired: boolean?`; `metal: string?`; `makingChargeBasisPoints: integer?`; extension fields | `Product` without nested `variants`; map optional values as null when absent | `ProductEntity`; `gstRule=APPAREL` maps `apparelGst=true`, otherwise fixed/null rate maps fixed rate; `photoFile` maps through photo ID; numeric FKs become UUIDs |
| `variants` | `id: UUID`; `productId: UUID`; `sku: string`; `barcode: string`; `size: string`; `colour: string`; `pricePaise: paise`; `mrpPaise: paise?`; `costPaise: paise?`; `stockQuantity: integer`; `lowStockThreshold: integer`; `reorderQuantity: integer` | `netQuantityMilli: integer?`; `netQuantityUnit: string?`; `photoId: UUID?`; extension fields | `Product.variants[]` flattened; `pricePaise` and stock values map directly | `ProductVariantEntity`; `price_minor` etc. are already paise; epoch-day expiry legacy fields are not exported here (see `stockBatches`) |
| `stockBatches` | `id: UUID`; `variantId: UUID`; `batchNumber: string?`; `expiryDate: date?`; `quantity: integer`; `receivedAt: instant`; `unitCostPaise: paise?` | extension fields | `StockBatch[]` | `StockBatchEntity`; epoch day converts to/from ISO calendar date |
| `stockMovements` | `id: UUID`; `variantId: UUID`; `quantityChange: integer`; `reason: string`; `note: string?`; `createdAt: instant` | `batchId: UUID?`; `invoiceId: UUID?`; `sourceInvoiceId: UUID?`; extension fields | `StockMovement[]` | `StockMovementEntity`; preserve source-invoice metadata in extension if no native column; translate all references |
| `customers` | `id: UUID`; `name: string`; `balancePaise: paise`; `createdAt: instant`; `updatedAt: instant` | `phone: string?`; `email: string?`; `gstin: string?`; `stateCode: string?`; `address: string?`; `notes: string?`; `creditLimitPaise: paise?`; `onHold: boolean?`; extension fields | `BillingCustomer` | `CustomerEntity`; export `updatedAt` as `createdAt` for legacy rows; keep a differing imported update instant in an extension; verify balance against ledger; `onHold` is an extension on Android |
| `customerLedger` | `id: UUID`; `customerId: UUID`; `type: string`; `amountPaise: paise`; `invoiceId: UUID?`; `invoiceNumber: string?`; `method: string?`; `reference: string?`; `createdAt: instant`; `note: string?` | extension fields | `CustomerLedgerEntry` | `LedgerEntryEntity`; Android points attached to ledger entries map to loyalty rows, not monetary amount; no account identity is imported |
| `invoices` | `id: UUID`; `number: string`; `type: string`; `createdAt: instant`; `seller: object`; `buyer: object?`; `customerId: UUID?`; `originalInvoiceId: UUID?`; `originalInvoiceNumber: string?`; `note: string?`; `returnReason: string?`; `placeOfSupply: string`; `gstRegistered: boolean`; `pricesIncludeTax: boolean`; `interState: boolean`; `subtotalPaise: paise`; `lineDiscountPaise: paise`; `billDiscountPaise: paise`; `discountPaise: paise`; `billDiscountReason: string?`; `loyaltyPointsRedeemed: integer`; `loyaltyDiscountPaise: paise`; `taxablePaise: paise`; `cgstPaise: paise`; `sgstPaise: paise`; `igstPaise: paise`; `roundOffPaise: paise`; `roundedToRupee: boolean`; `grandTotalPaise: paise`; `savingsPaise: paise` | extension fields | `InvoiceRecord`; nested lines and payments move to child arrays; seller/buyer snapshots are immutable | `InvoiceEntity`; translate local IDs; map `discountMinor` to compatible discount totals and use extensions for separate Web-only line/bill/loyalty discounts and return reason where absent |
| `invoiceLines` | `id: UUID`; `invoiceId: UUID`; `productId: UUID?`; `variantId: UUID?`; `originalLineId: UUID?`; `name: string`; `variantLabel: string`; `barcode: string`; `hsnCode: string?`; `customItem: boolean`; `quantity: integer`; `stockUnit: string`; `unitPricePaise: paise`; `mrpPaise: paise?`; `lineDiscountPaise: paise`; `billDiscountSharePaise: paise`; `discountPaise: paise`; `discountReason: string?`; `taxablePaise: paise`; `gstRateBasisPoints: integer`; `cgstPaise: paise`; `sgstPaise: paise`; `igstPaise: paise`; `totalPaise: paise`; `returnedQuantity: integer` | extension fields | `InvoiceLineSnapshot[]`, with original line IDs resolved from `originalLineIndex` | `InvoiceLineEntity`; `menuItemId` legacy data resolves to product/variant snapshot or is kept in Android namespace extension; all invoice/variant FKs translated |
| `payments` | `id: UUID`; `invoiceId: UUID`; `method: string`; `kind: string`; `amountPaise: paise`; `reference: string?`; `tenderedPaise: paise?`; `changePaise: paise?`; `createdAt: instant` | extension fields | Invoice nested `payments[]` flattened | `PaymentEntity`; translate invoice ID |
| `suppliers` | `id: UUID`; `name: string`; `active: boolean`; `createdAt: instant`; `updatedAt: instant` | `contactPerson: string?`; `phone: string?`; `email: string?`; `gstin: string?`; `stateCode: string?`; `address: string?`; `notes: string?`; extension fields | `Supplier[]`; Web currently has `createdAt` but no `updatedAt`, export same timestamp for both | `SupplierEntity`; translate IDs |
| `purchaseOrders` | `id: UUID`; `number: string`; `supplierId: UUID`; `status: string`; `createdAt: instant`; `updatedAt: instant`; `expectedDate: date?`; `note: string?` | extension fields | `PurchaseOrder[]` parent only | `PurchaseOrderEntity`; convert expected epoch day to ISO date |
| `purchaseOrderLines` | `id: UUID`; `orderId: UUID`; `variantId: UUID?`; `productName: string`; `variantLabel: string`; `stockUnit: string`; `quantityOrdered: integer`; `quantityReceived: integer`; `unitCostPaise: paise` | extension fields | Flatten each order's `lines[]` | `PurchaseOrderLineEntity`; translate IDs |
| `receipts` | `id: UUID`; `number: string`; `supplierId: UUID?`; `supplierName: string?`; `orderId: UUID?`; `orderNumber: string?`; `supplierInvoiceNumber: string?`; `receivedAt: instant`; `note: string?`; `totalPaise: paise`; `requestId: string` | extension fields | `PurchaseReceipt[]` parent only | `PurchaseReceiptEntity`; `requestId` remains business-operation provenance, not a local user/session key |
| `receiptLines` | `id: UUID`; `receiptId: UUID`; `variantId: UUID?`; `orderLineId: UUID?`; `productName: string`; `variantLabel: string`; `stockUnit: string`; `quantity: integer`; `unitCostPaise: paise`; `batchNumber: string?`; `expiryDate: date?`; `batchId: UUID?` | extension fields | Flatten each receipt's `lines[]`; create/link batch IDs consistently | `PurchaseReceiptLineEntity`; convert expiry epoch day and translate all relationships |
| `dayClosings` | `id: UUID`; `businessDate: date`; `bills: integer`; `returns: integer`; `netSalesPaise: paise`; `cashReceivedPaise: paise`; `cashRefundedPaise: paise`; `cashFromAccountsPaise: paise`; `upiNetPaise: paise`; `cardNetPaise: paise`; `onAccountNetPaise: paise`; `countedCashPaise: paise`; `note: string?`; `closedAt: instant`; `closedBy: string` | extension fields | `DayClosing` and `figures` flattened into columns | `DayClosingEntity`; map matching totals; preserve any Web-only figure in extensions |
| `loyaltySettings` (zero or one row) | `id: string` (literal `rules`); `enabled: boolean`; `spendPerPointPaise: paise`; `pointValuePaise: paise` | extension fields | `loyaltyRules` singleton | `LoyaltySettingsEntity`; local integer singleton ID remains local |
| `loyaltyLedger` | `id: UUID`; `customerId: UUID`; `type: string`; `points: integer`; `invoiceId: UUID?`; `sourceInvoiceId: UUID?`; `createdAt: instant`; `note: string?` | extension fields | `LoyaltyEntry[]` | Loyalty ledger rows if present; Android currently stores some points on customer ledger entries, so split/reconstruct using `points` and related invoice references |
| `heldBills` | `id: UUID`; `label: string`; `createdAt: instant`; `updatedAt: instant`; `itemCount: integer`; `totalPaise: paise`; `tableNumber: integer?`; `tokenNumber: integer?`; `discount: object`; `interState: boolean`; `customerId: string`; `buyerName: string?`; `buyerPhone: string?`; `buyerGstin: string?` | extension fields | Parent from `HeldBill[]`; lines flattened separately | `HeldBillEntity`; decode `payload` into parent fields and line records; preserve its unknown JSON keys via Android extension namespace |
| `heldBillLines` | `id: UUID`; `heldBillId: UUID`; `sortOrder: integer`; `snapshot: object` | extension fields | Ordered `HeldBill.lines[]` cart-line snapshots | Extract ordered line objects from `HeldBillEntity.payload`; unknown line fields retained |
| `quotations` | `id: UUID`; `number: string`; `createdAt: instant`; `validUntil: date`; `customerName: string`; `customerPhone: string`; `itemCount: integer`; `totalPaise: paise`; `status: string`; `convertedInvoiceId: UUID?` | `customerId: UUID?`; extension fields | `QuotationRecord` parent; map cart lines separately | `QuotationEntity`; `valid_until_day` converts to/from ISO date; decode/encode `payload`; translate invoice ID |
| `quotationLines` | `id: UUID`; `quotationId: UUID`; `sortOrder: integer`; `snapshot: object` | extension fields | Ordered `cart.lines[]` snapshots including custom items | Extract ordered line objects from quotation payload |
| `stockCounts` | `id: UUID`; `status: string`; `startedAt: instant`; `finishedAt: instant?`; `reason: string?`; `note: string?`; `adjustedCount: integer`; `matchedCount: integer` | extension fields | `StockCountRecord` parent | `StockCountEntity`; payload supplies count lines and matched count if available |
| `stockCountLines` | `id: UUID`; `stockCountId: UUID`; `variantId: UUID`; `expectedQuantity: integer`; `countedQuantity: integer` | extension fields | `StockCountRecord.lines[]`; stable line ID derived once and preserved | Extract count lines from `StockCountEntity.payload`; translate variant IDs |
| `auditLog` | `id: UUID`; `createdAt: instant`; `actorId: string?`; `actorName: string`; `actorRole: string?`; `action: string`; `entityType: string`; `entityId: string?`; `summary: string` | extension fields | `AuditRecord`; actor ID is opaque historical data | `AuditLogEntity`; numeric actor/entity IDs become opaque strings; imported actor data must never resolve to an account |
| `numberSequences` | `name: string`; `nextValue: integer` | extension fields | Export app sequence state where stored; otherwise derive the next unused sequence from existing document numbers during import | `NumberSequenceEntity`; copy sequence keys and values without importing app-local IDs |
| `extensions` | `namespace: string`; `ownerType: string`; `ownerId: string`; `key: string`; `value: any JSON value` | none | Preserve unknown platform fields in namespaced records | Preserve unknown platform fields in namespaced records |

`photos` is a separate top-level array, not a database table row and not embedded in a product object. Each entry has required `id: UUID`, `mimeType: string` (v1 supports `image/jpeg`), and `dataBase64: string` (standard RFC 4648 base64 of the original bytes). `settings.storeLogoPhotoId`, `products.photoId`, and `variants.photoId` refer to these IDs. Android file names and Web Blob object URLs are local implementation details and are never shared.

`seller` and `buyer` invoice objects are immutable JSON snapshots. `seller` requires `storeName`, `address`, `gstin`, `stateCode`, and `phone`; it may also contain `fssai`, `upiId`, `upiPayeeName`, `storeLogoPhotoId`, and `receipt` settings. `buyer` requires `name`, `phone`, `gstin`, each nullable; `stateCode` is optional and nullable. All money fields nested in snapshots remain paise strings.

## 3. Fields and features unsupported by one app

The format is the preservation boundary. A reader must preserve unknown fields and extension records even if its UI cannot use them. The reader must not silently drop unsupported values. If the destination cannot persist a value losslessly, it must stop the restore with a warning naming the unsupported field; it must not proceed with a partial import.

| Field / feature | Current support difference | Import behavior |
|---|---|---|
| Web customer `onHold`, optional email and richer credit fields | Web exposes customer hold/credit controls; Android may lack matching UI or storage for some of them | Store in `org.auxo.web` extensions on Android and hide from its UI. If extension persistence is not available, reject restore with warning. |
| Web separate line discount, bill discount share/reason, loyalty discount, return reason, source invoice movement link | Android records some totals/discount information differently and may not expose every source field | Keep exact values in `org.auxo.web` extensions; show native fields where supported. Never recalculate old invoice snapshots. Reject if the extension cannot be retained. |
| Android legacy restaurant menu item references and Android-only historical fields | Web may not have the original local entity/UI | Preserve in `org.auxo.android` extensions and hide from Web UI. Reject if not preservable. |
| Web restaurant table count, jewellery per-metal rates, credit hold days, on-time bonus configuration | May be absent from Android settings UI | Preserve in `org.auxo.web` settings extensions and hide. |
| Android display appearance/theme preferences | Device/UI configuration, not business data | Omit from shared backup; keep destination's local preference. |
| Local accounts, password/recovery material, sessions, encryption keys, applied-request IDs, auto-backup schedule/status | Local security/device state on both platforms | Never export or import. Keep destination values unchanged. |
| Unknown future JSON fields or extension namespaces | May not be understood by either current app | Preserve byte-equivalent JSON values and namespace; hide from UI. Reject the restore if lossless preservation is impossible. |

Extensions must use reverse-domain namespaces (`org.auxo.web`, `org.auxo.android`, or a future owner namespace). Imported audit `actorId`, `actorName`, and `actorRole` are only historical event details. They must not create, match, activate, or authenticate a local account.

## 4. Import and restore rules

1. Read and validate the fixed header and file-size limit. Derive the key, authenticate/decrypt the complete ciphertext, and parse strict UTF-8 JSON.
2. Validate `format`, `version`, `sharedModelVersion`, all required table arrays, field types/ranges, UUID syntax and uniqueness, dates, paise strings, base64 photos, foreign-key relationships, and all extension values. Reject duplicate IDs/document numbers, dangling references, invalid photo references, unsupported required fields, or any non-lossless destination mapping.
3. Compute the shop name and record counts from the validated payload. Show those details to the user before any destructive operation. Counts include products, variants, customers, invoices, suppliers, purchase orders, receipts, stock movements, stock batches, day closings, loyalty entries, audit entries, and photos.
4. Preserve local accounts, passwords, recovery data, sessions, local database encryption keys, device preferences, and automatic-backup preferences. Do not merge or replace them from the backup. A backup never contains logins. If the receiving installation has no account after the restore, the app must ask the person to create a new Super Admin login before anything else. Staff accounts from the original shop are not restored and must be recreated.
5. Prepare a recoverable snapshot of the destination's current business data. Apply all shared business rows, photos, references, extensions, and shared number sequences in one database transaction or a platform transaction with an equivalent recoverable swap. Update the shared model version only as the final write.
6. Run integrity, foreign-key, uniqueness, count, and money/balance checks before commit. If any validation or write fails, roll back and leave the previous business data usable. Keep the destination account and local key state intact on success and failure.
7. Record the restore event only after a successful restore, using the receiving installation's current actor. Imported audit rows remain historical records and never grant access.

The summary shown before confirmation is decrypted but not yet applied. A wrong passphrase, authentication failure, unsupported version, or malformed table must never erase destination data.

## 5. Test vector

This deterministic vector checks header parsing, key derivation, header AAD, AES-GCM tag handling, UTF-8, and payload parsing. The payload uses an empty data set and one minimal settings row. It is test-only; production exporters must use random salts/nonces.

- Passphrase: `AUXO test`
- Normalized UTF-8 passphrase bytes (hex): `4155584f2074657374`
- Iterations: `600000`
- Salt (hex): `000102030405060708090a0b0c0d0e0f`
- Nonce (hex): `101112131415161718191a1b`
- Exact decrypted UTF-8 content (shown on one line; this exact byte sequence is encrypted):

```json
{"format":"auxo-backup","version":1,"sharedModelVersion":1,"createdAt":0,"source":{"platform":"web","appVersion":"test"},"shopName":"A","tables":{"settings":[{"id":"shop","storeName":"A","address":"","gstin":"","stateCode":"","gstRegistered":false,"pricesIncludeTax":true,"roundOff":true,"invoicePrefix":"INV","creditNotePrefix":"CN","phone":"","fssai":"","upiId":"","upiPayeeName":"","receiptPaper":"THERMAL_80","receiptFooter":"Thank you for shopping with us!","receiptLanguage":"en","receiptShowHsn":true,"receiptShowTaxBreakdown":true,"receiptShowCustomer":true,"receiptShowSavings":true,"receiptShowBarcode":true,"receiptShowUpiQr":true,"employeeDiscountLimitBp":0,"expiryWarningDays":30,"metalRatesPaise":{}}],"categories":[],"subcategories":[],"products":[],"variants":[],"stockBatches":[],"stockMovements":[],"customers":[],"customerLedger":[],"invoices":[],"invoiceLines":[],"payments":[],"suppliers":[],"purchaseOrders":[],"purchaseOrderLines":[],"receipts":[],"receiptLines":[],"dayClosings":[],"loyaltySettings":[],"loyaltyLedger":[],"heldBills":[],"heldBillLines":[],"quotations":[],"quotationLines":[],"stockCounts":[],"stockCountLines":[],"auditLog":[],"numberSequences":[],"extensions":[]},"photos":[]}
```

- Expected 74-byte header (hex):

```text
4155584f424b5550000150424b4446322d484d41432d53484132353600004145532d3235362d47434d00000927c0000102030405060708090a0b0c0d0e0f101112131415161718191a1b
```

- Expected ciphertext followed by the 16-byte GCM tag (standard base64):

```text
v2QGyjtGPdiMvXuzjdzNAu0WNoJd6Po3Ns9JztzRiTqOz45zQd017wyHgwWcUI6Fw7QEAMwG+YxGicA5+U4dfiD2b1xR5AO7EbrbWAxNq3aldJ3+x2S6LoFEYRndViMn63td1fkrS4VeFpqcQOMMu/AF51eK4M8Fr8dle5gXFUNUBbhsM8Jb5mGTBhjI0DWXMgacgGfAoq0eCHwPm10O6q1eVglH4OBeN3NCbkAuh02CvmrpjLq42Dplpzjk9hSSPrv2aJmwGOR6DEOiy44RglP8o9vUTVrc4edev2O07BwiE5PUtBzmtFrRhSt5iYS5YsgeYYu3hKDwhikk1CdiXnsxpO/ETIzb3uGLr0FUG11sNCIsqttd6ca9YGW7rMLpD1WiGpHW2dEsJJOApSvdMv3FkyDjMNrL24vZiPKlNLK+3KYDDwITRsVMA2FnyA8gWwqC40hXYub4lBQQehDpK1gDl5K2eDQYK6tm99DJRNEiipTcmrj/9XWbGFnCDv1HReoq5aIDmucSWaFWMdlK8q7z+SHISUqyhaUkn3Vtm2EI5+d83OS1rS3lLkIw7ifjDON/PYcdhN/lRSRRXQ2RPJ/ffpISmb07MZw4J62l4Se/YFJr4z3BoVKQZW/O/jTaII1XTa6ulD3gyre8ngLb7h3vFf9oXqnloaEYA2/h40GN2gymzFD+AlJHhiIRdXDuf4TJTAmQ6/Jj3UIS/o4U4HOJPUHanqhazXfW3f+f6zPFKjIHUXV+Lc74klqr6U+mw0XHgTn97/4e8lyHlUaKmcrWlghRFW6JYLSG4skKB8MVsV+dgY1bjEe/stT/pWuutDIP7w/pLVswhyd0hBqSuOwev0ptqtHNXGzskfTz2DJKQWjbC+CY1oynFuGP8DRXGDqCSPlFFaVIhGQKmv9ndgxCIxyg716iG1618sEnjp21uJA5tV6Bvgnb7cFIBtG6i5/4dau4+veUF4F3a8XG9gbhhbU7/kimb2WZ3w7buMA0StIeLqt+XWf/vp7w0ltIscWSksBDkOnhCw5Cnf8MmqIs7kK4BOU5HhEAs+8LQsy/EkDiRfPU5RGkCOcdX2CGckA+34vZY5feR6yby+nmkxUSlJVxNLTqsvWm/8VYfVx6B4d9NdhXNhfg8s4Nw2ABJrI20FxgTCIEMAz/VFlDzjGXOL4sdWyTHu+oEL2qElGY5zEmPaZ88P0oilH+thuGTD7HS9p7sM3gsMgSVcd0rQs48oHIKS7ERyjQXbs/+XcMMSk2HV/skGseDXLCB9Dm7bBteqi1MOr+eYQ8E1PxbLvRLGqkOoJKVsreCPlNfxbJI2lpbtjav7yoxGLXFJuZld1bJ9h6LOOKLgW6M4vTdRWh1ZQ1QSde3AM2ZJS4lf7FR4JQ2LBw81NUaVih/UAl7Bg/Hq6Dg0viuDkR5/Uhsy2AgXvkksB7xxZn3UT2vL/nJpnZxft984ZXkf/v03jYAOtKYU2efrLrw4ntwAh1pOKZMd65rtmIb4U57+tyDJ+kXTFeME20lt5B/caIlLGPkbe0Pavu8igcsZJCua8zHpV68jfSxZd6k21QPuD2X2w4Rd1lAnXLSw+4n/70lqEycZWyGrGvslufAVdNTktSWlpBofOoQ1O/Yb0zVcK0F00WsQ==
```

The ciphertext was generated with Web Crypto using the passphrase, salt, nonce, iterations, and header AAD above. Android's JCA implementation must derive the same key, authenticate this header, produce the same ciphertext bytes, and decrypt to the exact JSON byte sequence shown. The decrypted bytes must equal the JSON text shown above exactly, byte for byte. Check this before parsing or reserializing anything.

## 6. Compatibility and rollout

The existing Android `AUXOENC1` zip (`auxo.db`, `database.key`, `manifest.properties`, `appearance.properties`, and `photos/`) is a legacy format that real users depend on. Android must keep reading it as an import-only path, then write only `auxo-backup` v1. The Web `AUXOWEB1` format is not used by any installed app or saved file, so it has no reader in this version and its code is removed when the new format is built. Legacy Android database keys, accounts, and appearance preferences must not be copied into the shared payload. Android migration work must preserve its Room database and translate local integer IDs and all references to stable UUIDs without resetting existing data.

## Repository constraint

The owner has authorised changes to the Android repository (`Roybabu/Auxo`, branch `temp`) for this format. Commits are local only: nothing is pushed to any repository until the owner explicitly says so.
