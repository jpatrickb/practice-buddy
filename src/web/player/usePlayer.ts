import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SongManifest } from '../../shared';
import { createEngine, type PracticeEngine } from '../engine';
import {
  effectiveGains,
  isAccompaniment,
  isDefaultMix,
  pickPart,
  setAccompaniment,
  defaultMix,
  snapSpeed,
  type Mix,
} from '../lib/mixer';
import { loadPrefs, savePrefs } from '../lib/saved';

export interface Loop {
  a: number | null;
  b: number | null;
}

export type LoadState =
  { status: 'loading'; loaded: number; total: number } | { status: 'ready' } | { status: 'error' };

export function usePlayer(song: SongManifest) {
  const parts = useMemo(() => [...song.parts].sort((a, b) => a.order - b.order), [song]);
  const [initial] = useState(() => loadPrefs(song.id, parts));
  const engineRef = useRef<PracticeEngine | null>(null);

  const [load, setLoad] = useState<LoadState>({
    status: 'loading',
    loaded: 0,
    total: parts.length,
  });
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRateState] = useState(initial.rate);
  const [mix, setMix] = useState<Mix>(initial.mix);
  const [myPart, setMyPart] = useState(initial.myPart);
  const [louder, setLouder] = useState(initial.louder);
  const [loop, setLoop] = useState<Loop>({ a: null, b: null });

  const gains = useMemo(() => effectiveGains(mix, { myPart, louder }), [mix, myPart, louder]);
  const accompaniment = useMemo(() => parts.filter(isAccompaniment), [parts]);

  // One engine per mounted player. A retry remounts this component (see the page), so no resets here.
  useEffect(() => {
    const engine = createEngine({ durationSec: song.durationSec });
    engineRef.current = engine;
    const off = [
      engine.on('statechange', () => setPlaying(engine.playing)),
      engine.on('ended', () => setTime(0)),
      engine.on('error', () => setLoad({ status: 'error' })),
    ];
    let live = true;
    engine
      .load(
        parts.map((p) => ({ id: p.id, url: `/${p.file}`, defaultGain: p.defaultGain })),
        (loaded, total) => live && setLoad({ status: 'loading', loaded, total }),
      )
      .then(
        () => live && setLoad({ status: 'ready' }),
        () => live && setLoad({ status: 'error' }),
      );
    const poll = setInterval(() => setTime(engine.currentTime()), 100);
    return () => {
      live = false;
      clearInterval(poll);
      off.forEach((f) => f());
      engine.dispose();
      engineRef.current = null;
    };
  }, [song, parts]);

  const ready = load.status === 'ready';
  useEffect(() => {
    if (ready) engineRef.current?.setRate(rate);
  }, [rate, ready]);
  useEffect(() => {
    if (!ready) return;
    for (const [id, g] of Object.entries(gains)) engineRef.current?.setPartGain(id, g);
  }, [gains, ready]);
  useEffect(() => {
    if (!ready) return;
    const both = loop.a !== null && loop.b !== null;
    engineRef.current?.setLoop(both ? { start: loop.a!, end: loop.b! } : null);
  }, [loop, ready]);

  useEffect(() => {
    savePrefs(song.id, { mix, rate, myPart, louder });
  }, [song.id, mix, rate, myPart, louder]);

  const now = () => engineRef.current?.currentTime() ?? 0;
  const seek = useCallback((sec: number) => {
    const e = engineRef.current;
    if (!e) return;
    e.seek(sec);
    setTime(e.currentTime());
  }, []);

  return {
    parts,
    load,
    ready,
    playing,
    time,
    duration: song.durationSec,
    rate,
    loop,
    mix,
    gains,
    myPart,
    louder,
    accompaniment,
    accompanimentOn: accompaniment.some((p) => mix[p.id]?.on),
    mixIsDefault: isDefaultMix(parts, mix) && myPart === null && !louder,
    toggle() {
      const e = engineRef.current;
      if (!e) return;
      if (e.playing) e.pause();
      else e.play();
    },
    seek,
    skip: (delta: number) => seek(now() + delta),
    setRate: (r: number) => setRateState(snapSpeed(r)),
    setLoopA: () =>
      setLoop((l) => {
        const t = now();
        return l.b !== null && t >= l.b ? { a: l.b, b: t } : { ...l, a: t };
      }),
    setLoopB: () =>
      setLoop((l) => {
        const t = now();
        return l.a !== null && t <= l.a ? { a: t, b: l.a } : { ...l, b: t };
      }),
    clearLoop: () => setLoop({ a: null, b: null }),
    setOn: (id: string, on: boolean) =>
      setMix((m) => ({ ...m, [id]: { gain: m[id]?.gain ?? 1, on } })),
    setGain: (id: string, gain: number) =>
      setMix((m) => ({ ...m, [id]: { on: m[id]?.on ?? true, gain } })),
    choosePart: (id: string | null) => {
      setMyPart(id);
      if (id === null) setLouder(false);
      else setMix((m) => pickPart(parts, m, id));
    },
    setAccompanimentOn: (on: boolean) => setMix((m) => setAccompaniment(parts, m, on)),
    setLouderOn: (on: boolean) => setLouder(on && myPart !== null),
    resetMix: () => {
      setMix(defaultMix(parts));
      setMyPart(null);
      setLouder(false);
    },
  };
}

export type PlayerModel = ReturnType<typeof usePlayer>;
