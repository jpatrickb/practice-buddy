import { describe, expect, it } from 'vitest';
import { findHardcoding, isAllowed, needlesFor } from './check-hardcoding';

const d = {
  prod: { domain: 'choir.example.org', workersDevUrl: '' },
  dev: { workersDevUrl: 'https://dev.example.workers.dev' },
};

describe('hardcoding guard', () => {
  it('collects the owner name and the configured hosts', () => {
    expect(needlesFor(d)).toEqual(['jpatrickb', 'choir.example.org', 'dev.example.workers.dev']);
  });
  it('flags code and workflows, with file and line', () => {
    const hits = findHardcoding(
      [
        { path: 'src/a.ts', content: 'ok\nconst u = "https://choir.example.org/x";' },
        { path: '.github/workflows/x.yml', content: 'repo: JPatrickB/practice-buddy' },
      ],
      needlesFor(d),
    );
    expect(hits.map((h) => `${h.path}:${h.line}:${h.needle}`)).toEqual([
      'src/a.ts:2:choir.example.org',
      '.github/workflows/x.yml:1:jpatrickb',
    ]);
  });
  it('allows deployment.json, markdown, docs and spikes; skips binaries', () => {
    for (const p of [
      'deployment.json',
      'README.md',
      'docs/deploy.md',
      'docs/adr/0010-domain.md',
      'spikes/ui/x.ts',
    ])
      expect(isAllowed(p), p).toBe(true);
    expect(isAllowed('src/worker/app.ts')).toBe(false);
    expect(findHardcoding([{ path: 'a.bin', content: 'jpatrickb\0' }], ['jpatrickb'])).toEqual([]);
  });
});
