import { describe, expect, it } from 'vitest';
import { partColors } from './partColors';

describe('partColors', () => {
  it('assigns voice colors by order and keeps accompaniment neutral', () => {
    const c = partColors([
      { id: 'b', kind: 'voice', order: 2 },
      { id: 'organ', kind: 'accompaniment', order: 0 },
      { id: 'a', kind: 'voice', order: 1 },
    ]);
    expect(c.organ).toBe('var(--accompaniment)');
    expect(c.a).toBe('var(--part-0)');
    expect(c.b).toBe('var(--part-1)');
  });
  it('wraps after eight voices', () => {
    const parts = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, kind: 'voice', order: i }));
    expect(partColors(parts).p8).toBe('var(--part-0)');
  });
});
