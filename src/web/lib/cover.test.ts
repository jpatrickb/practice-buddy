import { describe, expect, it } from 'vitest';
import { coverArt } from './cover';

describe('coverArt', () => {
  it('is deterministic', () => {
    expect(coverArt('Candlelight Carol')).toEqual(coverArt('Candlelight Carol'));
  });
  it('stays in the blue→violet family', () => {
    for (const t of ['A', 'Candlelight Carol', 'Example Duet', 'Ω', '']) {
      const c = coverArt(t);
      expect(c.h1).toBeGreaterThanOrEqual(222);
      expect(c.h1).toBeLessThan(258);
      expect(c.h2).toBeGreaterThanOrEqual(262);
      expect(c.h2).toBeLessThan(308);
    }
  });
  it('differs between songs', () => {
    expect(coverArt('Candlelight Carol')).not.toEqual(coverArt('Example Duet'));
  });
});
