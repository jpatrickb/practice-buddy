const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string equality (length is not secret here: both are fixed-width hex). */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const keyCache = new Map<string, Promise<CryptoKey>>();
function hmacKey(secret: string): Promise<CryptoKey> {
  let k = keyCache.get(secret);
  if (!k) {
    k = crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
    keyCache.set(secret, k);
  }
  return k;
}

/** Returns `<base64url(payload)>.<base64url(hmac)>`. */
export async function signPayload(payload: string, secret: string): Promise<string> {
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload));
  return `${toBase64Url(enc.encode(payload))}.${toBase64Url(new Uint8Array(mac))}`;
}

/** Returns the payload if the signature verifies (constant-time via subtle.verify), else null. */
export async function verifyPayload(signed: string, secret: string): Promise<string | null> {
  const parts = signed.split('.');
  if (parts.length !== 2) return null;
  const [p, m] = parts as [string, string];
  const payload = fromBase64Url(p);
  const mac = fromBase64Url(m);
  if (!payload || !mac) return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), mac, payload);
  return ok ? dec.decode(payload) : null;
}
