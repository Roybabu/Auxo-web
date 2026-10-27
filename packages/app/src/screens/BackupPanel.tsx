import { SqliteBackup } from "../db/backup.js";

/**
 * Backup/restore is always reachable, never buried behind other setup —
 * browser storage can be wiped, so a shop needs to be able to get a copy
 * of its data out at any time.
 */
export default function BackupPanel({ onRestored }: { onRestored: () => void | Promise<void> }) {
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
      await onRestored();
    } catch (e: unknown) {
      alert(`Couldn't restore this backup: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="backup-panel">
      <button type="button" onClick={exportBackup}>
        Export backup
      </button>
      <label className="file-button">
        Restore from backup
        <input type="file" accept="application/json" onChange={importBackup} />
      </label>
    </div>
  );
}
