import { cloudflareTest } from '@cloudflare/vitest-plugin';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: './src/worker/index.ts',
      miniflare: {
        compatibilityDate: '2026-11-01',
        r2Buckets: ['CONTENT'],
        bindings: {
          COOKIE_SIGNING_KEY: 'test-signing-key-test-signing-key-0123456789',
          MANIFEST_TTL_SECONDS: '0',
        },
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src/web') } },
  test: { include: ['src/**/*.test.ts', 'test/**/*.test.ts'] },
});
