import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    // The polyfill calls fetch, and Chrome supports module preload natively.
    modulePreload: { polyfill: false },
    rolldownOptions: {
      input: {
        panel: 'panel.html',
        compare: 'compare.html',
        background: 'src/background.ts',
      },
      output: {
        // The manifest names the service worker, so its file name must be stable.
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
      },
    },
  },
  test: { globals: true },
});
