import { z } from 'zod';
import { defaultMix, snapSpeed, type Mix, type PartInfo } from './mixer';
import { loadJson, saveJson } from './storage';

/** What we remember per song. The repeat section is deliberately NOT here. */
const savedSchema = z.object({
  mix: z.record(z.string(), z.object({ on: z.boolean(), gain: z.number() })).default({}),
  rate: z.number().default(1),
  myPart: z.string().nullable().default(null),
  louder: z.boolean().default(false),
});

export interface SongPrefs {
  mix: Mix;
  rate: number;
  myPart: string | null;
  louder: boolean;
}

const key = (songId: string) => `pb.song.${songId}`;

/** Read saved prefs, repairing anything that no longer matches the song's parts. */
export function loadPrefs(songId: string, parts: PartInfo[]): SongPrefs {
  const parsed = savedSchema.safeParse(loadJson(key(songId)) ?? {});
  const saved = parsed.success ? parsed.data : savedSchema.parse({});
  const mix = defaultMix(parts);
  for (const p of parts) {
    const s = saved.mix[p.id];
    if (s && Number.isFinite(s.gain)) {
      mix[p.id] = { on: s.on, gain: Math.min(2, Math.max(0, s.gain)) };
    }
  }
  const myPart = saved.myPart && parts.some((p) => p.id === saved.myPart) ? saved.myPart : null;
  return { mix, rate: snapSpeed(saved.rate), myPart, louder: saved.louder && myPart !== null };
}

export function savePrefs(songId: string, prefs: SongPrefs): void {
  saveJson(key(songId), prefs);
}
