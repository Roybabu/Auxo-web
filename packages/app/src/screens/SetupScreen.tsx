import { useState } from "react";
import { newBusiness, newOwnerEmployee, newSession, type Employee } from "@auxo/core";
import { getRepositories } from "../db/repositories.js";
import { setBusiness, setSession } from "../appState.js";
import BackupPanel from "./BackupPanel.js";

interface SetupScreenProps {
  /** Business already set up on a device with a business is explain-only, never a form. */
  businessAlreadyExists: boolean;
  onBusinessSetUp: (employee: Employee) => void;
  onRestored: () => void | Promise<void>;
  onBackToLogin: () => void;
}

export default function SetupScreen({
  businessAlreadyExists,
  onBusinessSetUp,
  onRestored,
  onBackToLogin,
}: SetupScreenProps) {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (businessAlreadyExists) {
    return (
      <main className="centered-screen">
        <h1>Auxo</h1>
        <p>A business is already set up on this device.</p>
        <p className="muted">
          Sign in with the owner or employee account instead. If this device should belong to a
          different shop, restore a backup from that shop to replace what's here.
        </p>
        <button type="button" onClick={onBackToLogin}>
          Back to sign in
        </button>
        <div className="divider">or</div>
        <BackupPanel onRestored={onRestored} />
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const business = newBusiness({ businessName, ownerName });
      const owner = await newOwnerEmployee({ ownerName, username, password });
      await setBusiness(business);
      await getRepositories().employees.save(owner);
      await setSession(newSession(owner.id));
      onBusinessSetUp(owner);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="centered-screen">
      <h1>Auxo</h1>
      <p className="tagline">Built to grow.</p>
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>Set up your business</h2>
        <label>
          Business name
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
        </label>
        <label>
          Owner name
          <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
        </label>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Setting up…" : "Set up business"}
        </button>
      </form>
      <div className="divider">or</div>
      <BackupPanel onRestored={onRestored} />
    </main>
  );
}
