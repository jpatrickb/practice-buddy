import { describe, expect, it } from "vitest";
import {
  defaultMix, effectiveGains, isDefaultMix, MAX_GAIN, OTHERS_DUCK, pickPart, setAccompaniment, snapSpeed, formatTime,
  type PartInfo,
} from "./mixer";

const parts: PartInfo[] = [
  { id: "organ", kind: "accompaniment", defaultGain: 1 },
  { id: "s", kind: "voice", defaultGain: 1 },
  { id: "a", kind: "voice", defaultGain: 0.8 },
  { id: "b", kind: "voice", defaultGain: 1 },
];
const none = { myPart: null, louder: false };

describe("defaultMix / effectiveGains", () => {
  it("starts every part on at its manifest defaultGain", () => {
    expect(effectiveGains(defaultMix(parts), none)).toEqual({ organ: 1, s: 1, a: 0.8, b: 1 });
  });
  it("off parts are silent", () => {
    const m = defaultMix(parts);
    m.s.on = false;
    expect(effectiveGains(m, none).s).toBe(0);
  });
  it("clamps to 0..MAX_GAIN", () => {
    const m = defaultMix(parts);
    m.s.gain = 9;
    m.a.gain = -1;
    const g = effectiveGains(m, none);
    expect(g.s).toBe(MAX_GAIN);
    expect(g.a).toBe(0);
  });
  it("louder: picked part unchanged, others ducked, never above their own gain", () => {
    const g = effectiveGains(defaultMix(parts), { myPart: "a", louder: true });
    expect(g.a).toBe(0.8);
    expect(g.s).toBeCloseTo(OTHERS_DUCK);
    expect(g.organ).toBeCloseTo(OTHERS_DUCK);
  });
  it("louder without a picked part does nothing", () => {
    expect(effectiveGains(defaultMix(parts), { myPart: null, louder: true })).toEqual(effectiveGains(defaultMix(parts), none));
  });
  it("louder does not un-mute an off part", () => {
    const m = defaultMix(parts);
    m.a.on = false;
    expect(effectiveGains(m, { myPart: "a", louder: true }).a).toBe(0);
  });
  it("works for any number of parts", () => {
    const many: PartInfo[] = Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, kind: "voice", defaultGain: 1 }));
    expect(Object.keys(effectiveGains(defaultMix(many), none))).toHaveLength(11);
  });
});

describe("pickPart", () => {
  it("picked voice on, other voices off, accompaniment untouched", () => {
    const m = pickPart(parts, defaultMix(parts), "a");
    expect(m.a.on).toBe(true);
    expect(m.s.on).toBe(false);
    expect(m.b.on).toBe(false);
    expect(m.organ.on).toBe(true);
  });
  it("keeps accompaniment off if the user had turned it off", () => {
    let m = setAccompaniment(parts, defaultMix(parts), false);
    m = pickPart(parts, m, "s");
    expect(m.organ.on).toBe(false);
  });
  it("does not change volumes", () => {
    const m0 = defaultMix(parts);
    m0.b.gain = 1.4;
    expect(pickPart(parts, m0, "b").b.gain).toBe(1.4);
  });
  it("user can then add another voice", () => {
    const m = pickPart(parts, defaultMix(parts), "a");
    m.b.on = true;
    const g = effectiveGains(m, none);
    expect(g.a).toBe(0.8);
    expect(g.b).toBe(1);
    expect(g.s).toBe(0);
  });
  it("picking an accompaniment part hears only that part", () => {
    const m = pickPart(parts, defaultMix(parts), "organ");
    expect(Object.entries(m).filter(([, v]) => v.on).map(([k]) => k)).toEqual(["organ"]);
  });
  it("unknown id is a no-op", () => {
    const m = defaultMix(parts);
    expect(pickPart(parts, m, "zzz")).toBe(m);
  });
});

describe("setAccompaniment", () => {
  it("toggles only accompaniment parts", () => {
    const m = setAccompaniment(parts, defaultMix(parts), false);
    expect(m.organ.on).toBe(false);
    expect(m.s.on).toBe(true);
  });
});

describe("isDefaultMix", () => {
  it("true at start, false after any change", () => {
    const m = defaultMix(parts);
    expect(isDefaultMix(parts, m)).toBe(true);
    m.a.gain = 0.5;
    expect(isDefaultMix(parts, m)).toBe(false);
  });
});

describe("snapSpeed", () => {
  it("snaps near 1.0", () => {
    expect(snapSpeed(0.97)).toBe(1);
    expect(snapSpeed(1.03)).toBe(1);
  });
  it("keeps 0.05 steps elsewhere and clamps", () => {
    expect(snapSpeed(0.8)).toBe(0.8);
    expect(snapSpeed(0.62)).toBe(0.6);
    expect(snapSpeed(0.1)).toBe(0.5);
    expect(snapSpeed(9)).toBe(1.5);
  });
});

describe("formatTime", () => {
  it("formats m:ss", () => {
    expect(formatTime(213.3)).toBe("3:33");
    expect(formatTime(-4)).toBe("0:00");
  });
});
