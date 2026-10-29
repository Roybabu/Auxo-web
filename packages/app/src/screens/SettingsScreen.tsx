import { useEffect, useState } from "react";
import {
  DEFAULT_LOYALTY_SETTINGS,
  validateLoyaltyProgramSettings,
  type Business,
  type LoyaltyProgramSettings,
  type PaymentMethod,
} from "@auxo/core";
import { setBusiness } from "../appState.js";
import {
  DEFAULT_RECEIPT_SETTINGS,
  getReceiptSettings,
  setReceiptSettings,
  type ReceiptSettings,
} from "../db/receiptSettings.js";
import { getTaxSettings, setTaxSettings, type TaxSettings } from "../db/taxSettings.js";
import {
  DEFAULT_PAYMENT_METHOD_SETTINGS,
  getPaymentMethodSettings,
  setPaymentMethodSettings,
} from "../db/paymentMethodSettings.js";
import { getLoyaltySettings, setLoyaltySettings } from "../db/loyaltySettings.js";
import BackupPanel from "./BackupPanel.js";
import AndroidImportPanel from "./AndroidImportPanel.js";

interface SettingsScreenProps {
  business: Business;
  onRestored: () => void | Promise<void>;
  onBusinessUpdated: () => void | Promise<void>;
}

export default function SettingsScreen({ business, onRestored, onBusinessUpdated }: SettingsScreenProps) {
  return (
    <div className="settings-screen">
      <section>
        <h2>Shop profile</h2>
        <BusinessProfileForm business={business} onUpdated={onBusinessUpdated} />
      </section>

      <section>
        <h2>Tax</h2>
        <TaxSettingsPanel />
      </section>

      <section>
        <h2>Receipt &amp; printer</h2>
        <ReceiptSettingsPanel />
      </section>

      <section>
        <h2>Payment methods</h2>
        <PaymentMethodsPanel />
      </section>

      <section>
        <h2>Loyalty program</h2>
        <LoyaltySettingsPanel />
      </section>

      <section>
        <h2>Backup &amp; restore</h2>
        <BackupPanel onRestored={onRestored} />
      </section>

      <section>
        <h2>Import from Android app</h2>
        <AndroidImportPanel />
      </section>

      <section>
        <h2>About Auxo</h2>
        <p className="muted">Auxo Web — offline-first retail POS. Built to grow.</p>
      </section>
    </div>
  );
}

function BusinessProfileForm({
  business,
  onUpdated,
}: {
  business: Business;
  onUpdated: () => void | Promise<void>;
}) {
  const [name, setName] = useState(business.name);
  const [ownerName, setOwnerName] = useState(business.ownerName);
  const [gstin, setGstin] = useState(business.gstin ?? "");
  const [fssaiNumber, setFssaiNumber] = useState(business.fssaiNumber ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (name.trim().length === 0 || ownerName.trim().length === 0) {
      setError("Business name and owner name are required.");
      return;
    }
    setSubmitting(true);
    try {
      await setBusiness({
        ...business,
        name: name.trim(),
        ownerName: ownerName.trim(),
        gstin: gstin.trim() || null,
        fssaiNumber: fssaiNumber.trim() || null,
      });
      await onUpdated();
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="add-product-form">
      <label>
        Business name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Owner name
        <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
      </label>
      <label>
        GSTIN (optional)
        <input value={gstin} onChange={(e) => setGstin(e.target.value)} />
      </label>
      <label>
        FSSAI number (optional)
        <input value={fssaiNumber} onChange={(e) => setFssaiNumber(e.target.value)} />
      </label>
      <p className="muted">Set up on {new Date(business.createdAt).toLocaleDateString()}</p>
      {error && <p className="error">{error}</p>}
      {saved && <p className="success">Saved.</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

function TaxSettingsPanel() {
  const [rate, setRate] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getTaxSettings().then((s) => {
      setRate(s.defaultTaxRatePercent != null ? String(s.defaultTaxRatePercent) : "");
      setLoading(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setSubmitting(true);
    try {
      const next: TaxSettings = { defaultTaxRatePercent: rate.trim() === "" ? null : Number(rate) };
      await setTaxSettings(next);
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="add-product-form">
      <label>
        Default tax rate % for new products (optional)
        <input type="number" min="0" max="100" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
      </label>
      <p className="muted">Prefills the tax rate field when adding a new product — doesn't change existing products.</p>
      {saved && <p className="success">Saved.</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function ReceiptSettingsPanel() {
  const [settings, setSettingsState] = useState<ReceiptSettings>(DEFAULT_RECEIPT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getReceiptSettings().then((s) => {
      setSettingsState(s);
      setLoading(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setSubmitting(true);
    try {
      await setReceiptSettings(settings);
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="add-product-form">
      <label>
        Paper width
        <select
          value={settings.paperWidthMm}
          onChange={(e) => setSettingsState({ ...settings, paperWidthMm: Number(e.target.value) as 58 | 80 })}
        >
          <option value={80}>80mm</option>
          <option value={58}>58mm</option>
        </select>
      </label>
      <label>
        Receipt footer text
        <input
          value={settings.footerText}
          onChange={(e) => setSettingsState({ ...settings, footerText: e.target.value })}
        />
      </label>
      {saved && <p className="success">Saved.</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

const ALL_PAYMENT_METHODS: PaymentMethod[] = ["cash", "card", "upi", "credit"];

function PaymentMethodsPanel() {
  const [enabled, setEnabled] = useState<Set<PaymentMethod>>(new Set(DEFAULT_PAYMENT_METHOD_SETTINGS.enabledMethods));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getPaymentMethodSettings().then((s) => {
      setEnabled(new Set(s.enabledMethods));
      setLoading(false);
    });
  }, []);

  function toggle(method: PaymentMethod) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(method)) next.delete(method);
      else next.add(method);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (enabled.size === 0) {
      setError("At least one payment method must stay enabled.");
      return;
    }
    setSubmitting(true);
    try {
      await setPaymentMethodSettings({ enabledMethods: Array.from(enabled) });
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="add-product-form">
      <p className="muted">Which methods show up as options when completing a sale in POS.</p>
      {ALL_PAYMENT_METHODS.map((method) => (
        <label key={method} className="checkbox-row">
          <input type="checkbox" checked={enabled.has(method)} onChange={() => toggle(method)} />
          {method === "upi" ? "UPI" : method.charAt(0).toUpperCase() + method.slice(1)}
        </label>
      ))}
      {error && <p className="error">{error}</p>}
      {saved && <p className="success">Saved.</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function LoyaltySettingsPanel() {
  const [settings, setSettingsState] = useState<LoyaltyProgramSettings>(DEFAULT_LOYALTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getLoyaltySettings().then((s) => {
      setSettingsState(s);
      setLoading(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      validateLoyaltyProgramSettings(settings);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    setSubmitting(true);
    try {
      await setLoyaltySettings(settings);
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="add-product-form">
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => setSettingsState({ ...settings, enabled: e.target.checked })}
        />
        Enable loyalty points
      </label>
      <label>
        Points earned per ₹1 spent
        <input
          type="number"
          min="0"
          step="0.001"
          value={settings.pointsPerRupeeSpent}
          onChange={(e) => setSettingsState({ ...settings, pointsPerRupeeSpent: Number(e.target.value) })}
        />
      </label>
      <label>
        Redemption value per point (₹)
        <input
          type="number"
          min="0"
          step="0.01"
          value={settings.redemptionValuePerPoint}
          onChange={(e) => setSettingsState({ ...settings, redemptionValuePerPoint: Number(e.target.value) })}
        />
      </label>
      <p className="muted">
        At these rates, a ₹{(1 / (settings.pointsPerRupeeSpent || 1)).toFixed(0)} sale earns 1 point worth ₹
        {settings.redemptionValuePerPoint.toFixed(2)}.
      </p>
      {error && <p className="error">{error}</p>}
      {saved && <p className="success">Saved.</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
