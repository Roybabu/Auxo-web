import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  base: './',
  // Sign-in and recovery tests hash passwords for real (slow on purpose), so give them room on slow or busy machines.
  test: { testTimeout: 30000, hookTimeout: 30000 },
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    manifest: { name: 'AUXO Genesis', short_name: 'AUXO', description: 'Offline business workspace', theme_color: '#EDF2EC', background_color: '#ffffff', display: 'standalone', start_url: '.', icons: [{src:'icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}] },
    workbox: { globPatterns: ['**/*.{js,css,html,svg}'], cleanupOutdatedCaches: true, skipWaiting: true, clientsClaim: true },
  })],
});
