import { useState } from "react";
import { importAndroidBackup, type ImportSummary } from "../androidImport/importAndroidBackup.js";

/**
 * Imports catalog/customer/invoice/stock data from a backup exported by the
 * Android Auxo app. Employee logins never come from this — the Android app
 * deliberately excludes accounts from its own backups, so everyone keeps
 * their existing web login; this only adds shop data.
 */
export default function AndroidImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleImport() {
    if (!file) return;
    setError(null);
    setSummary(null);
    setSubmitting(true);
    try {
      const result = await importAndroidBackup(file, passphrase.trim() || null, (step) => setStatus(step));
      setSummary(result);
      setFile(null);
      setPassphrase("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatus(null);
      setSubmitting(false);
    }
  }

  return (
    <div className="android-import-panel">
      <p className="muted">
        Bring over products, customers, invoice history, and stock from a backup exported by the Android
        Auxo app. This adds to what's already here — it doesn't touch employee logins.
      </p>
      <div className="inline-form">
        <input
          type="file"
          accept=".zip,.auxobak,application/zip"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
            setSummary(null);
          }}
        />
        <input
          type="password"
          placeholder="Passphrase (if the backup is locked)"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        <button type="button" onClick={() => void handleImport()} disabled={!file || submitting}>
          {submitting ? status ?? "Importing…" : "Import"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {summary && (
        <div className="import-summary">
          <p>
            Imported from {summary.shopName ? `"${summary.shopName}"` : "the Android app"}:
          </p>
          <ul>
            <li>{summary.categories} categories</li>
            <li>{summary.products} products, {summary.variants} variants</li>
            <li>{summary.customers} customers</li>
            <li>{summary.stockMovements} stock movements</li>
            <li>{summary.invoicesImported} invoices</li>
          </ul>
          {(summary.invoicesSkippedAsReturns > 0 || summary.invoicesSkippedNoLines > 0) && (
            <p className="muted">
              Skipped: {summary.invoicesSkippedAsReturns} return/credit-note invoices (not yet supported here)
              {summary.invoicesSkippedNoLines > 0 && `, ${summary.invoicesSkippedNoLines} invoice(s) with no line items`}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
