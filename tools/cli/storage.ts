import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Target } from './env';
import { UserError } from './errors';

const run = promisify(execFile);

/** Minimal object store. The real one is R2 via wrangler; tests use MemoryStorage. */
export interface Storage {
  /** Returns null if the key does not exist. */
  get(key: string): Promise<Buffer | null>;
  put(key: string, body: Buffer | { file: string }, contentType: string): Promise<void>;
  /** Deleting a key that does not exist is not an error. */
  delete(key: string): Promise<void>;
}

export class MemoryStorage implements Storage {
  readonly objects = new Map<string, Buffer>();
  readonly puts: string[] = [];
  readonly deletes: string[] = [];
  /** Tests: make deleting these keys fail (simulates a crash midway). */
  failDeleteOf = new Set<string>();
  async get(key: string) {
    return this.objects.get(key) ?? null;
  }
  async put(key: string, body: Buffer | { file: string }) {
    this.objects.set(key, Buffer.isBuffer(body) ? body : await readFile(body.file));
    this.puts.push(key);
  }
  async delete(key: string) {
    if (this.failDeleteOf.has(key)) throw new Error(`simulated failure deleting ${key}`);
    this.objects.delete(key);
    this.deletes.push(key);
  }
}

const NOT_FOUND = /does not exist|not found|NoSuchKey|10007/i;
const NOT_LOGGED_IN = /not authenticated|not logged in|authentication error|10000|API token|login/i;

export class WranglerStorage implements Storage {
  constructor(
    private readonly target: Target,
    private readonly repoRoot: string,
  ) {}

  private async wrangler(args: string[]): Promise<void> {
    try {
      await run('pnpm', ['exec', 'wrangler', 'r2', 'object', ...args], {
        cwd: this.repoRoot,
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (e) {
      const err = e as { stderr?: string; stdout?: string; message: string };
      const text = `${err.stderr ?? ''}\n${err.stdout ?? ''}\n${err.message}`;
      if (NOT_FOUND.test(text)) throw new NotFound();
      if (!this.target.local && NOT_LOGGED_IN.test(text))
        throw new UserError(
          'Not logged in to Cloudflare. Run this once, then try again:\n  pnpm exec wrangler login',
        );
      if (/more than one account/i.test(text))
        throw new UserError(
          'Your Cloudflare login has more than one account. Run again with your account id:\n  CLOUDFLARE_ACCOUNT_ID=<id> pnpm choir ...',
        );
      throw new UserError(`wrangler failed:\n${text.trim().split('\n').slice(-8).join('\n')}`);
    }
  }

  private flag() {
    return this.target.local ? '--local' : '--remote';
  }

  async get(key: string): Promise<Buffer | null> {
    const dir = await mkdtemp(join(tmpdir(), 'choir-get-'));
    const file = join(dir, 'object');
    try {
      await this.wrangler(['get', `${this.target.bucket}/${key}`, '--file', file, this.flag()]);
      return await readFile(file);
    } catch (e) {
      if (e instanceof NotFound) return null;
      // wrangler may create no file when the key is absent but exit 0
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.wrangler(['delete', `${this.target.bucket}/${key}`, this.flag()]);
    } catch (e) {
      if (e instanceof NotFound) return;
      throw e;
    }
  }

  async put(key: string, body: Buffer | { file: string }, contentType: string): Promise<void> {
    let dir: string | undefined;
    let file: string;
    if (Buffer.isBuffer(body)) {
      dir = await mkdtemp(join(tmpdir(), 'choir-put-'));
      file = join(dir, 'object');
      await writeFile(file, body);
    } else file = body.file;
    try {
      await this.wrangler([
        'put',
        `${this.target.bucket}/${key}`,
        '--file',
        file,
        '--content-type',
        contentType,
        this.flag(),
      ]);
    } catch (e) {
      if (e instanceof NotFound) throw new UserError(`Upload of ${key} failed: bucket not found.`);
      throw e;
    } finally {
      if (dir) await rm(dir, { recursive: true, force: true });
    }
  }
}

class NotFound extends Error {}
