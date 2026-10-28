import { useState } from "react";
import { attemptLogin, newSession, type Employee } from "@auxo/core";
import { getRepositories } from "../db/repositories.js";
import { setSession } from "../appState.js";

interface LoginScreenProps {
  businessName: string;
  onLoggedIn: (employee: Employee) => void;
  onWantsSetup: () => void;
}

export default function LoginScreen({ businessName, onLoggedIn, onWantsSetup }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const employees = await getRepositories().employees.list();
      const result = await attemptLogin(employees, username, password);
      if (!result.ok) {
        setError("Incorrect username or password.");
        return;
      }
      await setSession(newSession(result.employee.id));
      onLoggedIn(result.employee);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="centered-screen auth-screen">
      <div className="auth-brand">
        <span className="brand-mark brand-mark-lg" aria-hidden="true">
          A
        </span>
        <h1>Auxo</h1>
      </div>
      <p className="tagline">Built to grow.</p>
      <p className="muted">{businessName}</p>
      <form onSubmit={handleSubmit} className="auth-form">
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        </label>
        <label>
          Password
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <button type="button" className="link-button" onClick={onWantsSetup}>
        Set up your business
      </button>
    </main>
  );
}
