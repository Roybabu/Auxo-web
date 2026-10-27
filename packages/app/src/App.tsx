import { newId } from "@auxo/core";

/**
 * Placeholder root screen for the repo-skeleton step.
 * Real screens (login, shop setup, billing, etc.) replace this in
 * their respective build steps — this just proves the app package
 * can import and use @auxo/core end to end.
 */
export default function App() {
  return (
    <main className="shell-placeholder">
      <h1>Auxo</h1>
      <p>Built to grow.</p>
      <p className="muted">Web app skeleton is wired up. Core package sample id: {newId()}</p>
    </main>
  );
}
