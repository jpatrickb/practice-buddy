import { describe, expect, it } from "vitest";
import { effectiveGains, FOCUS_BOOST, FOCUS_DUCK, MAX_GAIN, resetMix, snapSpeed, formatTime } from "./mixer";

const ids = ["a", "b", "c"];
const base = () => ({ parts: resetMix(ids), focusId: null as string | null, defaultGains: { a: 1, b: 1, c: 0.8 } });

describe("effectiveGains", () => {
  it("uses default gain * volume with no focus/solo", () => {
    const m = base();
    m.parts.b.volume = 0.5;
    expect(effectiveGains(m)).toEqual({ a: 1, b: 0.5, c: 0.8 });
  });
  it("off parts are silent", () => {
    const m = base();
    m.parts.a.on = false;
    expect(effectiveGains(m).a).toBe(0);
  });
  it("solo silences everything else", () => {
    const m = base();
    m.parts.b.solo = true;
    expect(effectiveGains(m)).toEqual({ a: 0, b: 1, c: 0 });
  });
  it("multiple solos are all heard", () => {
    const m = base();
    m.parts.a.solo = m.parts.c.solo = true;
    const g = effectiveGains(m);
    expect(g.a).toBe(1);
    expect(g.b).toBe(0);
    expect(g.c).toBe(0.8);
  });
  it("a soloed part that is off does not silence the others", () => {
    const m = base();
    m.parts.a.solo = true;
    m.parts.a.on = false;
    expect(effectiveGains(m).b).toBe(1);
  });
  it("focus boosts chosen part and ducks the rest", () => {
    const m = base();
    m.focusId = "b";
    const g = effectiveGains(m);
    expect(g.b).toBe(FOCUS_BOOST);
    expect(g.a).toBe(FOCUS_DUCK);
    expect(g.c).toBeCloseTo(0.8 * FOCUS_DUCK);
  });
  it("focus never un-mutes an off part", () => {
    const m = base();
    m.focusId = "b";
    m.parts.b.on = false;
    expect(effectiveGains(m).b).toBe(0);
  });
  it("clamps to 0..MAX_GAIN", () => {
    const m = base();
    m.defaultGains.a = 5;
    m.focusId = "a";
    expect(effectiveGains(m).a).toBe(MAX_GAIN);
    m.parts.a.volume = -3;
    expect(effectiveGains(m).a).toBe(0);
  });
  it("works for any number of parts and unknown default gains", () => {
    const many = Array.from({ length: 11 }, (_, i) => `p${i}`);
    const g = effectiveGains({ parts: resetMix(many), focusId: null, defaultGains: {} });
    expect(Object.keys(g)).toHaveLength(11);
    expect(Object.values(g).every((v) => v === 1)).toBe(true);
  });
});

describe("snapSpeed", () => {
  it("snaps near 1.0", () => {
    expect(snapSpeed(0.97)).toBe(1);
    expect(snapSpeed(1.03)).toBe(1);
    expect(snapSpeed(1.0)).toBe(1);
  });
  it("keeps 0.05 steps elsewhere", () => {
    expect(snapSpeed(0.8)).toBe(0.8);
    expect(snapSpeed(1.2)).toBe(1.2);
    expect(snapSpeed(0.62)).toBe(0.6);
  });
  it("clamps", () => {
    expect(snapSpeed(0.1)).toBe(0.5);
    expect(snapSpeed(9)).toBe(1.5);
  });
});

describe("formatTime", () => {
  it("formats m:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(213.3)).toBe("3:33");
    expect(formatTime(-4)).toBe("0:00");
  });
});
