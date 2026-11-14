import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { defineConfig } from 'electron-vite';
import { resolve } from 'node:path';

// Workspace packages ship TypeScript source, so bundle them instead of externalizing.
const workspace = ['@skyempire/shared', '@skyempire/sim', '@skyempire/data', '@skyempire/ui'];

export default defineConfig({
  main: {
    build: {
      externalizeDeps: { exclude: workspace },
      rollupOptions: { input: { index: resolve(import.meta.dirname, 'src/main/index.ts'), simWorker: resolve(import.meta.dirname, 'src/worker/simWorker.ts') } },
    },
  },
  preload: {
    build: { externalizeDeps: { exclude: workspace }, rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } } },
  },
  renderer: {
    plugins: [react(), tailwind()],
    root: resolve(import.meta.dirname, 'src/renderer'),
    // Minified: the unminified bundle was ~9 MB and slowed every start.
    build: { minify: true, rollupOptions: { input: resolve(import.meta.dirname, 'src/renderer/index.html') } },
  },
});
