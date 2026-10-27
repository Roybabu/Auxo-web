import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Browser-first today; kept Tauri-friendly (relative base, no server-only
// assumptions) so a desktop shell can wrap this build later without changes.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Full manifest, icons, and offline precaching are filled in during
      // the PWA/offline step — this just reserves the plugin's place now.
      manifest: {
        name: "Auxo",
        short_name: "Auxo",
        description: "Auxo retail POS — offline-first.",
        theme_color: "#167D55",
        background_color: "#FFFFFF",
        display: "standalone",
        icons: [],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
      },
    }),
  ],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
