import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // 'frontend' is this service's name on the docker-compose network — needed so
    // other containers (and Playwright-based screenshot checks) can reach it by
    // hostname; Vite's DNS-rebinding protection rejects unrecognized Host headers otherwise.
    allowedHosts: ['localhost', 'frontend'],
    // Native filesystem change events don't reliably cross the Windows-host ->
    // Docker bind-mount boundary, so chokidar's default watcher can silently miss
    // edits. Polling is slightly heavier but actually detects every change.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
});
