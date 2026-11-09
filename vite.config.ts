import path from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { loadDeployment } from './tools/deployment';

// Where this deployment lives is configured in deployment.json (ADR-0012), not in wrangler.jsonc.
const { prod } = loadDeployment(import.meta.dirname);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare({
      // Production builds only. The customizer runs AFTER wrangler env resolution, so without this check a
      // CLOUDFLARE_ENV=dev build would also claim the production domain.
      config: () =>
        prod.domain && !process.env.CLOUDFLARE_ENV
          ? { routes: [{ pattern: prod.domain, custom_domain: true }] }
          : {},
    }),
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src/web') } },
});
