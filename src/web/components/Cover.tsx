import type { CSSProperties } from 'react';
import { coverArt } from '@/lib/cover';

/** Generated cover art (no images): a blue→violet gradient from the song title, plus a music glyph. */
export function Cover({
  title,
  size = '56px',
  showTitle = false,
  radius,
}: {
  title: string;
  size?: string;
  showTitle?: boolean;
  radius?: string;
}) {
  const art = coverArt(title);
  const style = {
    '--cs': size,
    '--ch1': art.h1,
    '--ch2': art.h2,
    '--ca': `${art.angle}deg`,
    ...(radius ? { '--cr': radius } : {}),
  } as CSSProperties;
  return (
    <div className="cover" style={style} aria-hidden>
      <span className="glyph">{art.glyph}</span>
      {showTitle && <span className="title">{title}</span>}
    </div>
  );
}
