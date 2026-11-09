/**
 * Guard (ADR-0012): deployment-specific names must live in deployment.json (and in docs as examples),
 * nowhere else, so a fork needs no code edits. Run: `pnpm check:hardcoding` (also in CI).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDeployment, type Deployment } from './deployment';

/** Always forbidden outside the allowed places: the original owner's name (also matches the GitHub org). */
const BASE_NEEDLES = ['jpatrickb'];

const ALLOWED = [
  /^deployment\.json$/,
  /\.md$/, // docs and examples
  /^docs\//,
  /^spikes\//, // reference prototypes, not deployed
  /^pnpm-lock\.yaml$/,
  /^LICENSE$/,
  /^tools\/check-hardcoding(\.test)?\.ts$/, // this guard names the patterns it looks for
];

export const isAllowed = (path: string) => ALLOWED.some((re) => re.test(path));

export function needlesFor(d: Deployment): string[] {
  const hosts = [d.prod.domain, d.prod.workersDevUrl, d.dev.workersDevUrl]
    .map((v) => v.replace(/^https:\/\//, ''))
    .filter(Boolean);
  return [...new Set([...BASE_NEEDLES, ...hosts])];
}

export interface Hit {
  path: string;
  line: number;
  needle: string;
}

export function findHardcoding(
  files: { path: string; content: string }[],
  needles: string[],
): Hit[] {
  const hits: Hit[] = [];
  for (const f of files) {
    if (isAllowed(f.path) || f.content.includes('\0')) continue;
    f.content.split('\n').forEach((text, i) => {
      for (const needle of needles)
        if (text.toLowerCase().includes(needle.toLowerCase()))
          hits.push({ path: f.path, line: i + 1, needle });
    });
  }
  return hits;
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const needles = needlesFor(loadDeployment(root));
  const paths = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const files = paths.map((path) => ({ path, content: readFileSync(join(root, path), 'utf8') }));
  const hits = findHardcoding(files, needles);
  if (hits.length) {
    console.error('Deployment-specific names found outside deployment.json and docs:\n');
    for (const h of hits) console.error(`  ${h.path}:${h.line}  contains "${h.needle}"`);
    console.error(
      '\nMove the value into deployment.json (see docs/self-hosting.md and ADR-0012), or reference it from there.',
    );
    process.exit(1);
  }
  console.log(`check-hardcoding: ok (${files.length} files, ${needles.length} patterns)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
