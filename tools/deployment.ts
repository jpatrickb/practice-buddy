import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

/**
 * The ONE place that says where this deployment lives (ADR-0012). A fork edits `deployment.json`
 * and nothing else. Read by: vite.config.ts (custom domain at build time), the choir CLI (link hosts),
 * and the hardcoding guard (scripts/check-hardcoding.ts).
 */
const url = z
  .string()
  .regex(
    /^https:\/\/[^/\s]+$/,
    'must look like https://name.example.workers.dev (no trailing slash)',
  )
  .or(z.literal(''));
const domain = z
  .string()
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i,
    'must be a bare hostname',
  )
  .or(z.literal(''));

export const deploymentSchema = z.object({
  prod: z.object({
    /** Custom domain for the production Worker (a domain on your Cloudflare account). "" = workers.dev only. */
    domain,
    /** Used for links when `domain` is empty: https://practice-buddy.<your-subdomain>.workers.dev */
    workersDevUrl: url,
  }),
  dev: z.object({
    /** https://practice-buddy-dev.<your-subdomain>.workers.dev (shown by the first dev deploy). */
    workersDevUrl: url,
  }),
});
export type Deployment = z.infer<typeof deploymentSchema>;

export function parseDeployment(text: string): Deployment {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('deployment.json is not valid JSON');
  }
  const r = deploymentSchema.safeParse(raw);
  if (!r.success)
    throw new Error(
      'deployment.json has problems:\n' +
        r.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'),
    );
  return r.data;
}

export const loadDeployment = (root: string): Deployment =>
  parseDeployment(readFileSync(join(root, 'deployment.json'), 'utf8'));

/** Base URL for links to the production site ('' if not configured yet). */
export const prodBaseUrl = (d: Deployment) =>
  d.prod.domain ? `https://${d.prod.domain}` : d.prod.workersDevUrl;
