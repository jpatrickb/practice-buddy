import { z } from 'zod';
import { idSchema } from '../shared';
import { signPayload, verifyPayload } from './crypto';

export const COOKIE_NAME = '__Host-pb_grants';
export const GRANT_TTL_SECONDS = 365 * 24 * 60 * 60;
/** Hex chars of sha256(token) stored in the cookie (64 bits: only used to find the token, not to authenticate). */
export const TOKEN_HASH_PREFIX_LEN = 16;
const MAX_GRANTS = 20;

export const grantSchema = z.object({
  choirId: idSchema,
  tokenHashPrefix: z.string().regex(new RegExp(`^[0-9a-f]{${TOKEN_HASH_PREFIX_LEN}}$`)),
  exp: z.number().int(),
});
export type Grant = z.infer<typeof grantSchema>;

const payloadSchema = z.object({ v: z.literal(1), grants: z.array(z.unknown()) });

export function parseCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** Verifies signature and returns unexpired, well-formed grants. Never throws. */
export async function readGrants(
  cookieHeader: string | null,
  secret: string,
  nowSec: number,
): Promise<Grant[]> {
  const raw = parseCookie(cookieHeader, COOKIE_NAME);
  if (!raw) return [];
  const json = await verifyPayload(raw, secret);
  if (!json) return [];
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(json));
    if (!parsed.success) return [];
    const out: Grant[] = [];
    for (const g of parsed.data.grants) {
      const r = grantSchema.safeParse(g);
      if (r.success && r.data.exp > nowSec) out.push(r.data);
    }
    return out;
  } catch {
    return [];
  }
}

/** Merge a new grant into existing ones (replacing the same choir), newest last, capped. */
export function mergeGrant(existing: Grant[], added: Grant): Grant[] {
  return [...existing.filter((g) => g.choirId !== added.choirId), added].slice(-MAX_GRANTS);
}

export async function buildSetCookie(grants: Grant[], secret: string): Promise<string> {
  const value = await signPayload(JSON.stringify({ v: 1, grants }), secret);
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${GRANT_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}
