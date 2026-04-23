import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __IS_BETA__: false,
    __TWITCH_ENABLED__: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: false,
  },
});
