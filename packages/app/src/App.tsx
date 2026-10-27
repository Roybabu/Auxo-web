import { useEffect, useState } from "react";
import { newEntityBase, type Category } from "@auxo/core";
import { initDatabase, saveNow } from "./db/sqlite.js";
import { getRepositories } from "./db/repositories.js";
import { getOrCreateDeviceId } from "./db/deviceId.js";
import { SqliteBackup } from "./db/backup.js";

type Status = "loading" | "ready" | "error";

/**
 * Temporary verification screen for the local-database step. Exercises
 * init, a write, and backup export/import end to end so the plumbing is
 * provably correct before any real screen (login, billing, etc.) is
 * built on top of it in later steps.
 */
export default function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    initDatabase()
      .then(async () => {
        setDeviceId(await getOrCreateDeviceId());
        await refreshCategories();
        setStatus("ready");
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      });

    const flush = () => {
      void saveNow();
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

  async function refreshCategories() {
    const repos = getRepositories();
    setCategories(await repos.categories.list());
  }

  async function addTestCategory() {
    const repos = getRepositories();
    const category: Category = { ...newEntityBase(), name: `Category ${categories.length + 1}`, enabled: false };
    await repos.categories.save(category);
    await refreshCategories();
  }

  async function exportBackup() {
    const backup = new SqliteBackup();
    const file = await backup.export();
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auxo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const backup = new SqliteBackup();
      await backup.import(JSON.parse(text));
      await refreshCategories();
    } catch (e: unknown) {
      alert(`Couldn't restore this backup: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      event.target.value = "";
    }
  }

  if (status === "loading") {
    return (
      <main className="shell-placeholder">
        <h1>Auxo</h1>
        <p className="muted">Starting up…</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="shell-placeholder">
        <h1>Auxo</h1>
        <p className="muted">Something went wrong starting the local database: {error}</p>
      </main>
    );
  }

  return (
    <main className="shell-placeholder">
      <h1>Auxo</h1>
      <p>Built to grow.</p>
      <p className="muted">Device ID: {deviceId}</p>
      <p className="muted">Categories in local database: {categories.length}</p>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button onClick={addTestCategory}>Add test category</button>
        <button onClick={exportBackup}>Export backup</button>
        <label style={{ cursor: "pointer" }}>
          Import backup
          <input type="file" accept="application/json" onChange={importBackup} style={{ display: "none" }} />
        </label>
      </div>
    </main>
  );
}
