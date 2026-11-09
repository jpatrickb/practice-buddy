import { idSchema, type ChoirManifest } from '../shared';
import { timingSafeEqualStr } from './crypto';
import type { Env } from './env';
import { readGrants, TOKEN_HASH_PREFIX_LEN } from './grants';
import { loadChoir } from './manifests';

/** True if `hash` matches any active token (checks all tokens: no early exit). */
export function matchActiveToken(choir: ChoirManifest, hashHex: string): boolean {
  let ok = false;
  for (const t of choir.accessTokens) {
    if (timingSafeEqualStr(t.sha256, hashHex)) ok = true;
  }
  return ok;
}

/** Choirs for which the request holds a validly signed, unexpired grant whose token is still active. */
export async function grantedChoirs(
  env: Env,
  cookieHeader: string | null,
): Promise<ChoirManifest[]> {
  const grants = await readGrants(
    cookieHeader,
    env.COOKIE_SIGNING_KEY,
    Math.floor(Date.now() / 1000),
  );
  const seen = new Set<string>();
  const choirs: ChoirManifest[] = [];
  for (const g of grants) {
    if (seen.has(g.choirId) || !idSchema.safeParse(g.choirId).success) continue;
    const choir = await loadChoir(env, g.choirId);
    if (!choir || choir.id !== g.choirId) continue;
    let active = false;
    for (const t of choir.accessTokens) {
      // prefix compare on the hash; not secret, but keep it constant-time anyway
      if (timingSafeEqualStr(t.sha256.slice(0, TOKEN_HASH_PREFIX_LEN), g.tokenHashPrefix))
        active = true;
    }
    if (active) {
      seen.add(g.choirId);
      choirs.push(choir);
    }
  }
  return choirs;
}
