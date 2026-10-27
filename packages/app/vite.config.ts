import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { viteStaticCopy } from "vite-plugin-static-copy";

// Browser-first today; kept Tauri-friendly (relative base, no server-only
// assumptions) so a desktop shell can wrap this build later without changes.
export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      // Resolve straight to core's source so editing @auxo/core is
      // reflected immediately in dev, and app builds never depend on
      // having run `npm run build --workspace=@auxo/core` first.
      "@auxo/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
    },
  },
  plugins: [
    react(),
    // sql.js loads its .wasm binary at runtime via a plain fetch, so the
    // file has to exist as a static asset rather than being bundled by
    // Vite's JS pipeline.
    viteStaticCopy({
      targets: [
        {
          // sql.js resolves to different .wasm filenames depending on how
          // its JS glue code detects the environment (plain vs. "browser"
          // build) — copy both non-debug variants so whichever it picks
          // is served. (Debug variants excluded: larger, dev-only.)
          src: "../../node_modules/sql.js/dist/sql-wasm{,-browser}.wasm",
          dest: ".",
        },
      ],
    }),
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
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,wasm}"],
      },
    }),
  ],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
