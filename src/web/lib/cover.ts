/** Deterministic cover art parameters from a title: blue→violet family, no images. */
export interface CoverArt {
  h1: number;
  h2: number;
  angle: number;
  glyph: string;
}

function hash(s: string): number {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function coverArt(title: string): CoverArt {
  const h = hash(title);
  return {
    h1: 222 + (h % 36),
    h2: 262 + ((h >>> 3) % 46),
    angle: (h % 8) * 45 + 20,
    glyph: ['♪', '♫', '♬', '♩'][h % 4] ?? '♪',
  };
}
