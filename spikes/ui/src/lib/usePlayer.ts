import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MockEngine } from "@/engine/mockEngine";
import type { PracticeEngine } from "@/engine/types";
import { sortedParts, type PartManifest, type SongManifest } from "@/data/songs";
import { defaultMix, effectiveGains, isDefaultMix, pickPart, setAccompaniment, snapSpeed, type PartMixState } from "./mixer";
import { load, save } from "./storage";

interface Saved {
  parts: Record<string, PartMixState>;
  rate: number;
  myPart: string | null;
  louder: boolean;
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
  louder: boolean;
  accompanimentLabel: string | null;
  accompanimentOn: boolean;
  toggle(): void;
  seek(sec: number): void;
  skip(delta: number): void;
  setRate(r: number): void;
  setLoopA(): void;
  setLoopB(): void;
  clearLoop(): void;
  setOn(id: string, on: boolean): void;
  setGain(id: string, g: number): void;
  chooseMyPart(id: string | null): void;
  setAccompanimentOn(on: boolean): void;
  setLouder(on: boolean): void;
  resetAll(): void;
  mixIsDefault: boolean;
}

const key = (id: string) => `pb.song.${id}`;

export function usePlayer(song: SongManifest): PlayerModel {
  const parts = useMemo(() => sortedParts(song), [song]);
  const ids = useMemo(() => parts.map((p) => p.id), [parts]);

  const initial = useMemo<Saved>(() => {
    const s = load<Partial<Saved>>(key(song.id), {});
    const base = defaultMix(parts);
    for (const id of ids) {
      const saved = s.parts?.[id];
      if (saved && typeof saved.gain === "number") base[id] = { on: saved.on !== false, gain: saved.gain };
    }
    const myPart = s.myPart && ids.includes(s.myPart) ? s.myPart : null;
    return { parts: base, rate: snapSpeed(s.rate ?? 1), myPart, louder: !!s.louder && !!myPart };
  }, [song.id, ids, parts]);

  const engineRef = useRef<PracticeEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRateState] = useState(initial.rate);
  const [mix, setMix] = useState(initial.parts);
  const [myPart, setMyPart] = useState(initial.myPart);
  const [louder, setLouderState] = useState(initial.louder);
  const [loop, setLoop] = useState<Loop>({ a: null, b: null });

  const gains = useMemo(() => effectiveGains(mix, { myPart, louder }), [mix, myPart, louder]);
  const accompaniment = useMemo(() => parts.filter((p) => p.kind === "accompaniment"), [parts]);
  const accompanimentLabel = accompaniment.length ? accompaniment.map((p) => p.label).join(" & ") : null;
  const accompanimentOn = accompaniment.some((p) => mix[p.id].on);

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
    save(key(song.id), { parts: mix, rate, myPart, louder } satisfies Saved);
  }, [song.id, mix, rate, myPart, louder]);

  const patch = useCallback(
    (id: string, p: Partial<PartMixState>) => setMix((m) => ({ ...m, [id]: { ...m[id], ...p } })),
    [],
  );

  const now = () => engineRef.current?.currentTime() ?? 0;
  const seek = (sec: number) => {
    engineRef.current?.seek(sec);
    setTime(engineRef.current?.currentTime() ?? sec);
  };

  const mixIsDefault = isDefaultMix(parts, mix) && myPart === null && !louder;

  return {
    song, parts, ready, playing, time, duration: song.durationSec, rate, loop, mix, gains, myPart, louder, accompanimentLabel, accompanimentOn, mixIsDefault,
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
    setGain: (id, gain) => patch(id, { gain }),
    chooseMyPart: (id) => {
      setMyPart(id);
      if (id === null) setLouderState(false);
      else setMix((m) => pickPart(parts, m, id));
    },
    setAccompanimentOn: (on) => setMix((m) => setAccompaniment(parts, m, on)),
    setLouder: (on) => setLouderState(on && myPart !== null),
    resetAll: () => { setMix(defaultMix(parts)); setMyPart(null); setLouderState(false); },
  };
}
