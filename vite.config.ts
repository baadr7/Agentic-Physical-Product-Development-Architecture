/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    // Proxy API calls to the backend (npm run server) so the frontend can use
    // same-origin /api paths in dev. Override the backend target via VITE/env if needed.
    proxy: {
      '/api': { target: process.env.VITE_API_TARGET ?? 'http://localhost:8787', changeOrigin: true },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
