import { createHash, randomBytes } from 'node:crypto';
import { idSchema, type ChoirManifest } from '../../src/shared';
import { UserError } from './errors';

/** 128-bit random token, base64url (ADR-0006). */
export const generateToken = () => randomBytes(16).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const linkUrl = (host: string, choirId: string, token: string) =>
  `${host}/c/${choirId}/${token}`;

export function checkId(kind: 'choir' | 'song', id: string): string {
  if (!idSchema.safeParse(id).success)
    throw new UserError(
      `"${id}" is not a valid ${kind} id. Use lowercase letters, numbers and dashes (e.g. oak-hills-3rd).`,
    );
  return id;
}

export function newChoir(id: string, name: string): ChoirManifest {
  return { schemaVersion: 1, id: checkId('choir', id), name, songs: [], accessTokens: [] };
}

export function withSong(
  choir: ChoirManifest,
  songId: string,
): { choir: ChoirManifest; changed: boolean } {
  if (choir.songs.includes(songId)) return { choir, changed: false };
  return { choir: { ...choir, songs: [...choir.songs, songId] }, changed: true };
}

export function withoutSong(choir: ChoirManifest, songId: string): ChoirManifest {
  if (!choir.songs.includes(songId))
    throw new UserError(
      `Choir "${choir.id}" doesn't have the song "${songId}". It has: ${choir.songs.join(', ') || '(none)'}.`,
    );
  return { ...choir, songs: choir.songs.filter((s) => s !== songId) };
}

export function withToken(
  choir: ChoirManifest,
  sha256: string,
  label: string,
  date: string,
): ChoirManifest {
  if (choir.accessTokens.some((t) => t.label === label))
    throw new UserError(
      `Choir "${choir.id}" already has a link labelled "${label}". Pick another label with --label "...".`,
    );
  return { ...choir, accessTokens: [...choir.accessTokens, { sha256, label, createdAt: date }] };
}

export function withoutToken(choir: ChoirManifest, label: string): ChoirManifest {
  const keep = choir.accessTokens.filter((t) => t.label !== label);
  if (keep.length === choir.accessTokens.length)
    throw new UserError(
      `Choir "${choir.id}" has no link labelled "${label}". Its links: ${
        choir.accessTokens.map((t) => `"${t.label}"`).join(', ') || '(none)'
      }.`,
    );
  return { ...choir, accessTokens: keep };
}
