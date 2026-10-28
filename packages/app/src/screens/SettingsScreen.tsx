import type { Business } from "@auxo/core";
import BackupPanel from "./BackupPanel.js";
import AndroidImportPanel from "./AndroidImportPanel.js";

interface SettingsScreenProps {
  business: Business;
  onRestored: () => void | Promise<void>;
}

export default function SettingsScreen({ business, onRestored }: SettingsScreenProps) {
  return (
    <div className="settings-screen">
      <section>
        <h2>Shop profile</h2>
        <dl className="settings-dl">
          <dt>Business name</dt>
          <dd>{business.name}</dd>
          <dt>Owner</dt>
          <dd>{business.ownerName}</dd>
          <dt>Set up on</dt>
          <dd>{new Date(business.createdAt).toLocaleDateString()}</dd>
        </dl>
        <p className="muted">Editing shop details isn't available yet.</p>
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
