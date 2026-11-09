import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockEngine } from "./mockEngine";

/**
 * MockEngine reads time from the injected clock (`now`) and schedules its own
 * ticks with setInterval. We drive both together: move the clock forward, then
 * let fake timers fire the interval in small steps so every tick sees a
 * consistent clock value.
 */
describe("MockEngine", () => {
  let clock: number;
  const now = () => clock;

  // Advance the fake clock and fake timers together, in 50ms steps.
  function advance(ms: number) {
    const step = 50;
    let remaining = ms;
    while (remaining > 0) {
      const d = Math.min(step, remaining);
      clock += d;
      vi.advanceTimersByTime(d);
      remaining -= d;
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("playback position", () => {
    it("advances currentTime in real time at 1x", () => {
      const engine = new MockEngine(10, now);
      engine.play();
      advance(2000);
      expect(engine.currentTime()).toBeCloseTo(2, 5);
    });

    it("scales advancement by rate at 0.5x", () => {
      const engine = new MockEngine(10, now);
      engine.setRate(0.5);
      engine.play();
      advance(2000);
      expect(engine.currentTime()).toBeCloseTo(1, 5);
    });

    it("keeps position when rate changes mid-play", () => {
      const engine = new MockEngine(10, now);
      engine.play();
      advance(1000); // 1.0s at 1x
      engine.setRate(0.5);
      advance(2000); // 1.0s more at 0.5x
      expect(engine.currentTime()).toBeCloseTo(2, 5);
    });

    it("freezes time while paused", () => {
      const engine = new MockEngine(10, now);
      engine.play();
      advance(1000);
      engine.pause();
      expect(engine.playing).toBe(false);
      expect(engine.currentTime()).toBeCloseTo(1, 5);

      advance(2000);
      expect(engine.currentTime()).toBeCloseTo(1, 5);
      expect(engine.playing).toBe(false);
    });

    it("resumes from the paused position", () => {
      const engine = new MockEngine(10, now);
      engine.play();
      advance(1000);
      engine.pause();
      engine.play();
      advance(500);
      expect(engine.currentTime()).toBeCloseTo(1.5, 5);
    });
  });

  describe("seek", () => {
    it("clamps negative seeks to 0", () => {
      const engine = new MockEngine(10, now);
      engine.seek(-5);
      expect(engine.currentTime()).toBe(0);
    });

    it("clamps seeks past the end to duration", () => {
      const engine = new MockEngine(10, now);
      engine.seek(999);
      expect(engine.currentTime()).toBe(10);
    });

    it("moves to an in-range position exactly", () => {
      const engine = new MockEngine(10, now);
      engine.seek(4.25);
      expect(engine.currentTime()).toBe(4.25);
    });

    it("continues playback from the seeked position", () => {
      const engine = new MockEngine(10, now);
      engine.seek(3);
      engine.play();
      advance(1000);
      expect(engine.currentTime()).toBeCloseTo(4, 5);
    });
  });

  describe("A-B loop", () => {
    it("wraps back to loop start after passing loop end", () => {
      const engine = new MockEngine(10, now);
      engine.setLoop({ start: 2, end: 4 });
      engine.seek(3);
      engine.play();

      advance(1500); // 3.0 -> 4.5 would pass end at 4; wraps to 2 + 0.5
      expect(engine.currentTime()).toBeCloseTo(2.5, 5);
      expect(engine.playing).toBe(true);
    });

    it("keeps wrapping across multiple laps", () => {
      const engine = new MockEngine(10, now);
      engine.setLoop({ start: 2, end: 4 });
      engine.seek(2);
      engine.play();

      advance(5300); // 5.3s inside a 2s loop starting at 2 -> 2 + 1.3
      expect(engine.currentTime()).toBeCloseTo(3.3, 5);
    });

    it("stops looping after setLoop(null)", () => {
      const engine = new MockEngine(10, now);
      engine.setLoop({ start: 2, end: 4 });
      engine.seek(3);
      engine.play();
      engine.setLoop(null);

      advance(1500);
      expect(engine.currentTime()).toBeCloseTo(4.5, 5);
    });

    it("ignores a degenerate loop where end is not after start", () => {
      const engine = new MockEngine(10, now);
      engine.setLoop({ start: 4, end: 4 });
      engine.seek(3);
      engine.play();
      advance(1500);
      expect(engine.currentTime()).toBeCloseTo(4.5, 5);
    });
  });

  describe("ended", () => {
    it("emits 'ended' and stops playing when reaching duration", () => {
      const engine = new MockEngine(2, now);
      const ended = vi.fn();
      engine.on("ended", ended);
      engine.play();

      advance(2000);
      expect(ended).toHaveBeenCalledTimes(1);
      expect(engine.playing).toBe(false);
      expect(engine.currentTime()).toBe(2);
    });

    it("fires statechange before ended when the track finishes", () => {
      const engine = new MockEngine(2, now);
      const order: string[] = [];
      engine.on("statechange", () => order.push("statechange"));
      engine.on("ended", () => order.push("ended"));
      engine.play();
      order.length = 0; // ignore the statechange from play()

      advance(2000);
      expect(order).toEqual(["statechange", "ended"]);
    });

    it("restarts from 0 when play() is called after ending", () => {
      const engine = new MockEngine(2, now);
      engine.play();
      advance(2000);
      engine.play();
      expect(engine.playing).toBe(true);
      expect(engine.currentTime()).toBe(0);
    });
  });

  describe("statechange", () => {
    it("fires on play and pause", () => {
      const engine = new MockEngine(10, now);
      const cb = vi.fn();
      engine.on("statechange", cb);

      engine.play();
      expect(cb).toHaveBeenCalledTimes(1);

      engine.pause();
      expect(cb).toHaveBeenCalledTimes(2);
    });

    it("does not fire on redundant play or pause", () => {
      const engine = new MockEngine(10, now);
      const cb = vi.fn();
      engine.on("statechange", cb);

      engine.pause(); // already paused
      expect(cb).not.toHaveBeenCalled();

      engine.play();
      engine.play(); // already playing
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe("on() unsubscribe", () => {
    it("stops delivering statechange after unsubscribe", () => {
      const engine = new MockEngine(10, now);
      const cb = vi.fn();
      const unsub = engine.on("statechange", cb);

      unsub();
      engine.play();
      engine.pause();
      expect(cb).not.toHaveBeenCalled();
    });

    it("stops delivering ended after unsubscribe", () => {
      const engine = new MockEngine(1, now);
      const cb = vi.fn();
      const unsub = engine.on("ended", cb);
      unsub();

      engine.play();
      advance(1000);
      expect(cb).not.toHaveBeenCalled();
    });

    it("leaves other listeners on the same event subscribed", () => {
      const engine = new MockEngine(10, now);
      const a = vi.fn();
      const b = vi.fn();
      const unsubA = engine.on("statechange", a);
      engine.on("statechange", b);

      unsubA();
      engine.play();
      expect(a).not.toHaveBeenCalled();
      expect(b).toHaveBeenCalledTimes(1);
    });
  });

  describe("setPartGain", () => {
    it("stores in-range gains as given", () => {
      const engine = new MockEngine(10, now);
      engine.setPartGain("alto", 1.2);
      expect(engine.gains.get("alto")).toBe(1.2);
    });

    it("clamps gains above 2 to 2", () => {
      const engine = new MockEngine(10, now);
      engine.setPartGain("alto", 5);
      expect(engine.gains.get("alto")).toBe(2);
    });

    it("clamps negative gains to 0", () => {
      const engine = new MockEngine(10, now);
      engine.setPartGain("alto", -1);
      expect(engine.gains.get("alto")).toBe(0);
    });
  });

  describe("dispose", () => {
    it("clears all listeners so later events are not delivered", () => {
      const engine = new MockEngine(10, now);
      const statechange = vi.fn();
      const ended = vi.fn();
      engine.on("statechange", statechange);
      engine.on("ended", ended);

      engine.dispose();
      engine.play();
      engine.pause();
      expect(statechange).not.toHaveBeenCalled();
      expect(ended).not.toHaveBeenCalled();
    });

    it("stops the internal timer and playback", () => {
      const engine = new MockEngine(10, now);
      engine.play();
      advance(500);

      engine.dispose();
      expect(engine.playing).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
