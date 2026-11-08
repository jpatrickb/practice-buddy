import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MockEngine } from "@/engine/mockEngine";
import type { PracticeEngine } from "@/engine/types";
import { sortedParts, type PartManifest, type SongManifest } from "@/data/songs";
import { defaultPartState, effectiveGains, resetMix, snapSpeed, type PartMixState } from "./mixer";
import { load, save } from "./storage";

interface Saved {
  parts: Record<string, PartMixState>;
  rate: number;
  myPart: string | null;
  focusOn: boolean;
}

export interface Loop { a: number | null; b: number | null }

export interface PlayerModel {
  song: SongManifest;
  parts: PartManifest[];
  ready: boolean;
  playing: boolean;
  time: number;
  duration: number;
  rate: number;
  loop: Loop;
  mix: Record<string, PartMixState>;
  gains: Record<string, number>;
  myPart: string | null;
  focusOn: boolean;
  toggle(): void;
  seek(sec: number): void;
  skip(delta: number): void;
  setRate(r: number): void;
  setLoopA(): void;
  setLoopB(): void;
  clearLoop(): void;
  setOn(id: string, on: boolean): void;
  setVolume(id: string, v: number): void;
  setSolo(id: string, solo: boolean): void;
  chooseMyPart(id: string): void;
  setFocusOn(on: boolean): void;
  resetAll(): void;
  mixIsDefault: boolean;
}

const key = (id: string) => `pb.song.${id}`;

export function usePlayer(song: SongManifest): PlayerModel {
  const parts = useMemo(() => sortedParts(song), [song]);
  const ids = useMemo(() => parts.map((p) => p.id), [parts]);

  const initial = useMemo<Saved>(() => {
    const s = load<Partial<Saved>>(key(song.id), {});
    const base = resetMix(ids);
    for (const id of ids) if (s.parts?.[id]) base[id] = { ...defaultPartState(), ...s.parts[id] };
    const myPart = s.myPart && ids.includes(s.myPart) ? s.myPart : null;
    return { parts: base, rate: snapSpeed(s.rate ?? 1), myPart, focusOn: !!s.focusOn && !!myPart };
  }, [song.id, ids]);

  const engineRef = useRef<PracticeEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRateState] = useState(initial.rate);
  const [mix, setMix] = useState(initial.parts);
  const [myPart, setMyPart] = useState(initial.myPart);
  const [focusOn, setFocusOnState] = useState(initial.focusOn);
  const [loop, setLoop] = useState<Loop>({ a: null, b: null });

  const gains = useMemo(
    () =>
      effectiveGains({
        parts: mix,
        focusId: focusOn ? myPart : null,
        defaultGains: Object.fromEntries(parts.map((p) => [p.id, p.defaultGain])),
      }),
    [mix, focusOn, myPart, parts],
  );

  // engine lifecycle (one per song)
  useEffect(() => {
    const engine = new MockEngine(song.durationSec);
    engineRef.current = engine;
    setReady(false);
    setPlaying(false);
    setTime(0);
    setLoop({ a: null, b: null });
    const off = [
      engine.on("statechange", () => setPlaying(engine.playing)),
      engine.on("ended", () => setTime(0)),
    ];
    let live = true;
    engine
      .load(parts.map((p) => ({ id: p.id, url: p.file, defaultGain: p.defaultGain })))
      .then(() => live && setReady(true));
    const poll = setInterval(() => setTime(engine.currentTime()), 100);
    return () => {
      live = false;
      clearInterval(poll);
      off.forEach((f) => f());
      engine.dispose();
    };
  }, [song, parts]);

  // push rate / gains / loop into engine
  useEffect(() => { engineRef.current?.setRate(rate); }, [rate, song]);
  useEffect(() => {
    for (const [id, g] of Object.entries(gains)) engineRef.current?.setPartGain(id, g);
  }, [gains, song]);
  useEffect(() => {
    const ok = loop.a !== null && loop.b !== null;
    engineRef.current?.setLoop(ok ? { start: loop.a!, end: loop.b! } : null);
  }, [loop, song]);

  // persistence
  useEffect(() => {
    save(key(song.id), { parts: mix, rate, myPart, focusOn } satisfies Saved);
  }, [song.id, mix, rate, myPart, focusOn]);

  const patch = useCallback(
    (id: string, p: Partial<PartMixState>) => setMix((m) => ({ ...m, [id]: { ...m[id], ...p } })),
    [],
  );

  const now = () => engineRef.current?.currentTime() ?? 0;
  const seek = (sec: number) => {
    engineRef.current?.seek(sec);
    setTime(engineRef.current?.currentTime() ?? sec);
  };

  const mixIsDefault = ids.every((id) => {
    const p = mix[id];
    return p.on && !p.solo && p.volume === 1;
  }) && !focusOn;

  return {
    song, parts, ready, playing, time, duration: song.durationSec, rate, loop, mix, gains, myPart, focusOn, mixIsDefault,
    toggle: () => { const e = engineRef.current; if (e) e.playing ? e.pause() : e.play(); },
    seek,
    skip: (d) => seek(now() + d),
    setRate: (r) => setRateState(snapSpeed(r)),
    setLoopA: () => setLoop((l) => {
      const t = now();
      return l.b !== null && t >= l.b ? { a: l.b, b: t } : { ...l, a: t };
    }),
    setLoopB: () => setLoop((l) => {
      const t = now();
      return l.a !== null && t <= l.a ? { a: t, b: l.a } : { ...l, b: t };
    }),
    clearLoop: () => setLoop({ a: null, b: null }),
    setOn: (id, on) => patch(id, { on }),
    setVolume: (id, volume) => patch(id, { volume }),
    setSolo: (id, solo) => patch(id, { solo }),
    chooseMyPart: (id) => { setMyPart(id); setFocusOnState(true); },
    setFocusOn: (on) => setFocusOnState(on && myPart !== null),
    resetAll: () => { setMix(resetMix(ids)); setFocusOnState(false); },
  };
}
