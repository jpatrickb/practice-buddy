import { describe, expect, it } from 'vitest';
import { downmixToMono, fitToLength, targetSamples } from './length';
import { clampRate, Timeline } from './timeline';

describe('Timeline', () => {
  it('advances at the playback rate', () => {
    const tl = new Timeline(100);
    tl.start(10, 5);
    expect(tl.positionAt(5)).toBe(10);
    expect(tl.positionAt(7)).toBe(12);
    tl.setRate(0.5, 7);
    expect(tl.positionAt(9)).toBeCloseTo(13);
  });

  it('holds position before the scheduled start', () => {
    const tl = new Timeline(100);
    tl.start(10, 5);
    expect(tl.positionAt(4)).toBe(10);
  });

  it('keeps position continuous across rate changes', () => {
    const tl = new Timeline(100);
    tl.start(0, 0);
    expect(tl.setRate(1.5, 4)).toBeCloseTo(4);
    expect(tl.setRate(0.5, 6)).toBeCloseTo(7);
    expect(tl.positionAt(8)).toBeCloseTo(8);
  });

  it('clamps the rate to 0.5..1.5', () => {
    expect(clampRate(0.1)).toBe(0.5);
    expect(clampRate(9)).toBe(1.5);
    expect(clampRate(NaN)).toBe(1);
  });

  it('pause freezes and play resumes from the same place', () => {
    const tl = new Timeline(100);
    tl.start(0, 0);
    tl.pause(3);
    expect(tl.positionAt(50)).toBe(3);
    tl.start(3, 50);
    expect(tl.positionAt(52)).toBe(5);
  });

  it('wraps inside a loop', () => {
    const tl = new Timeline(100);
    tl.start(8, 0);
    tl.setLoop({ start: 10, end: 14 }, 0);
    expect(tl.positionAt(1)).toBe(9);
    expect(tl.positionAt(3)).toBe(11); // 8+3=11 inside
    expect(tl.positionAt(7)).toBe(11); // 8+7=15 -> wraps to 11
  });

  it('wraps with rate changes', () => {
    const tl = new Timeline(100);
    tl.start(10, 0);
    tl.setLoop({ start: 10, end: 14 }, 0);
    tl.setRate(0.5, 0);
    expect(tl.positionAt(6)).toBeCloseTo(13);
    expect(tl.positionAt(10)).toBeCloseTo(11); // 15 -> 11
  });

  it('jumps to the loop start if the playhead is already past the loop end', () => {
    const tl = new Timeline(100);
    tl.start(50, 0);
    const r = tl.setLoop({ start: 10, end: 20 }, 0);
    expect(r).toEqual({ pos: 10, jumped: true });
  });

  it('ignores an empty or inverted loop and clamps it to the song', () => {
    const tl = new Timeline(30);
    tl.setLoop({ start: 10, end: 10 }, 0);
    expect(tl.loop).toBeNull();
    tl.setLoop({ start: -5, end: 99 }, 0);
    expect(tl.loop).toEqual({ start: 0, end: 30 });
    tl.setLoop(null, 0);
    expect(tl.loop).toBeNull();
  });

  it('clamps at the duration and reports the end', () => {
    const tl = new Timeline(10);
    tl.start(8, 0);
    expect(tl.positionAt(5)).toBe(10);
    expect(tl.hasEnded(5)).toBe(true);
    tl.setLoop({ start: 2, end: 6 }, 0);
    expect(tl.hasEnded(100)).toBe(false);
  });

  it('seek clamps to the song', () => {
    const tl = new Timeline(10);
    tl.seek(99, 0);
    expect(tl.positionAt(0)).toBe(10);
    tl.seek(-3, 0);
    expect(tl.positionAt(0)).toBe(0);
  });
});

describe('song length', () => {
  it('prefers durationSamples at the master rate, scaled to the context rate', () => {
    expect(
      targetSamples({ durationSamples: 9404805, sampleRate: 44100, durationSec: 1 }, 24000),
    ).toBe(Math.round((9404805 / 44100) * 24000));
  });
  it('falls back to durationSec, then null', () => {
    expect(targetSamples({ durationSec: 20 }, 24000)).toBe(480000);
    expect(targetSamples({}, 24000)).toBeNull();
    expect(targetSamples(undefined, 24000)).toBeNull();
  });
  it('trims decoder tail padding and zero-pads short files without shifting the start', () => {
    const src = Float32Array.from([1, 2, 3, 4, 5]);
    expect([...fitToLength(src, 3)]).toEqual([1, 2, 3]);
    expect([...fitToLength(src, 7)]).toEqual([1, 2, 3, 4, 5, 0, 0]);
  });

  it('downmixes stereo to (L+R)/2 and keeps mono as a copy', () => {
    const l = Float32Array.from([1, 0, -1]);
    const r = Float32Array.from([0, 1, -1]);
    expect([...downmixToMono([l, r])]).toEqual([0.5, 0.5, -1]);
    const mono = downmixToMono([l]);
    expect([...mono]).toEqual([1, 0, -1]);
    expect(mono).not.toBe(l);
  });

  it('downmixes 3+ channels by averaging', () => {
    const c = (v: number) => Float32Array.from([v, v]);
    expect([...downmixToMono([c(3), c(0), c(0)])]).toEqual([1, 1]);
    expect(downmixToMono([]).length).toBe(0);
  });
});
