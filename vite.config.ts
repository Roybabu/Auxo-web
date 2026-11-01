import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  base: './',
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    manifest: { name: 'AUXO Genesis', short_name: 'AUXO', description: 'Offline business workspace', theme_color: '#f4f5f7', background_color: '#ffffff', display: 'standalone', start_url: '.', icons: [{src:'icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}] },
    workbox: { globPatterns: ['**/*.{js,css,html,svg}'], cleanupOutdatedCaches: true },
  })],
});
