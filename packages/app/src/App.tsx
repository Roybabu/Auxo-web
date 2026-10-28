import { useEffect, useState } from "react";
import type { Business, Employee } from "@auxo/core";
import { initDatabase, saveNow } from "./db/sqlite.js";
import { getRepositories } from "./db/repositories.js";
import { getBusiness, getSession } from "./appState.js";
import SetupScreen from "./screens/SetupScreen.js";
import LoginScreen from "./screens/LoginScreen.js";
import HomeScreen from "./screens/HomeScreen.js";

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "setup"; businessAlreadyExists: boolean }
  | { kind: "login"; business: Business }
  | { kind: "home"; business: Business; employee: Employee };

export default function App() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  async function resolvePhase(): Promise<void> {
    const business = await getBusiness();
    if (!business) {
      setPhase({ kind: "setup", businessAlreadyExists: false });
      return;
    }
    const session = await getSession();
    if (session) {
      const employee = await getRepositories().employees.get(session.employeeId);
      if (employee && employee.active) {
        setPhase({ kind: "home", business, employee });
        return;
      }
    }
    setPhase({ kind: "login", business });
  }

  useEffect(() => {
    initDatabase()
      .then(resolvePhase)
      .catch((e: unknown) => {
        setPhase({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      });

    const flush = () => void saveNow();
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

  if (phase.kind === "loading") {
    return (
      <main className="centered-screen splash-screen">
        <span className="brand-mark brand-mark-lg splash-pulse" aria-hidden="true">
          A
        </span>
        <h1>Auxo</h1>
        <p className="tagline">Built to grow.</p>
        <p className="muted">Starting up…</p>
      </main>
    );
  }

  if (phase.kind === "error") {
    return (
      <main className="centered-screen splash-screen">
        <span className="brand-mark brand-mark-lg" aria-hidden="true">
          A
        </span>
        <h1>Auxo</h1>
        <p className="error">Something went wrong starting the local database: {phase.message}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Retry
        </button>
      </main>
    );
  }

  if (phase.kind === "setup") {
    return (
      <SetupScreen
        businessAlreadyExists={phase.businessAlreadyExists}
        onBusinessSetUp={(employee) => {
          void getBusiness().then((business) => {
            if (business) setPhase({ kind: "home", business, employee });
          });
        }}
        onRestored={resolvePhase}
        onBackToLogin={resolvePhase}
      />
    );
  }

  if (phase.kind === "login") {
    return (
      <LoginScreen
        businessName={phase.business.name}
        onLoggedIn={(employee) => setPhase({ kind: "home", business: phase.business, employee })}
        onWantsSetup={() => setPhase({ kind: "setup", businessAlreadyExists: true })}
      />
    );
  }

  return (
    <HomeScreen
      business={phase.business}
      currentEmployee={phase.employee}
      onSignedOut={resolvePhase}
      onRestored={resolvePhase}
    />
  );
}
