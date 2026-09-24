import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Prevent Vite from walking up into parent PostCSS configs outside this repo.
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
