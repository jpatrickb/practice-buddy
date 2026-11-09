import { prodBaseUrl, type Deployment } from '../deployment';
import { UserError } from './errors';

export type EnvName = 'local' | 'dev' | 'prod';

export interface Target {
  name: EnvName;
  bucket: string;
  /** Talk to miniflare's local R2 (the one `pnpm dev` uses) instead of Cloudflare. */
  local: boolean;
  /** Where links point ('' if deployment.json doesn't say yet). */
  host: string;
}

/** Buckets and the local host are fixed; the dev/prod hosts come from deployment.json (ADR-0012). */
export function targetsFor(d: Deployment): Record<EnvName, Target> {
  return {
    local: {
      name: 'local',
      bucket: 'practice-buddy-content',
      local: true,
      host: 'http://localhost:5173',
    },
    dev: {
      name: 'dev',
      bucket: 'practice-buddy-content-dev',
      local: false,
      host: d.dev.workersDevUrl,
    },
    prod: { name: 'prod', bucket: 'practice-buddy-content', local: false, host: prodBaseUrl(d) },
  };
}

export function resolveTarget(name: string | undefined, d: Deployment): Target {
  const n = name ?? 'dev';
  if (n === 'local' || n === 'dev' || n === 'prod') return targetsFor(d)[n];
  throw new UserError(`Unknown --env "${n}". Use one of: local, dev, prod.`);
}
