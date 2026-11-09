import { UserError } from './errors';

export type EnvName = 'local' | 'dev' | 'prod';

export interface Target {
  name: EnvName;
  bucket: string;
  /** Talk to miniflare's local R2 (the one `pnpm dev` uses) instead of Cloudflare. */
  local: boolean;
  /** Where links point. */
  host: string;
}

export const TARGETS: Record<EnvName, Target> = {
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
    host: 'https://practice-buddy-dev.jpatrickbeal.workers.dev',
  },
  prod: {
    name: 'prod',
    bucket: 'practice-buddy-content',
    local: false,
    host: 'https://practice.jpatrickbeal.com',
  },
};

export function resolveTarget(name: string | undefined): Target {
  const n = name ?? 'dev';
  if (n === 'local' || n === 'dev' || n === 'prod') return TARGETS[n];
  throw new UserError(`Unknown --env "${n}". Use one of: local, dev, prod.`);
}
