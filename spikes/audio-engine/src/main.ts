import { createEngine, type SpikeEngine, type StretcherKind } from './engines';
import type { PartSource } from './engine-api';
import { offlineDriftTest, offlineRateChangeTest } from './measure';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let eng: SpikeEngine | null = null;
let parts: PartSource[] = [];
let loopA: number | null = null, loopB: number | null = null;
const state = new Map<string, { on: boolean; vol: number }>();

const kind = () => $<HTMLSelectElement>('engine').value as StretcherKind;
const srOpt = () => ($<HTMLSelectElement>('sr').value ? +$<HTMLSelectElement>('sr').value : undefined);
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const heapMB = () => ((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0) / 1048576;

async function loadParts(p: PartSource[]) {
  eng?.dispose();
  parts = p;
  $('status').textContent = 'Loading…';
  eng = createEngine({ stretcher: kind(), sampleRate: srOpt() });
  eng.on('error', (e) => ($('status').textContent = 'Error: ' + (e as Error).message));
  eng.on('ended', () => ($('status').textContent = 'Ended'));
  const t0 = performance.now();
  await eng.load(p, (l, t) => ($('status').textContent = `Loading ${l}/${t}`));
  $('status').textContent = `Loaded ${p.length} parts in ${((performance.now() - t0) / 1000).toFixed(1)} s`;
  buildMixer();
  (window as unknown as { __eng: unknown }).__eng = eng;
}

function buildMixer() {
  const box = $('parts'); box.innerHTML = '';
  state.clear();
  parts.forEach((p) => {
    state.set(p.id, { on: true, vol: p.defaultGain });
    const row = document.createElement('div'); row.className = 'part';
    row.innerHTML = `<span>${p.id}</span><input type="range" min="0" max="2" step="0.05" value="${p.defaultGain}"><label><input type="checkbox" checked> on</label>`;
    const [sl, cb] = [row.querySelector('input[type=range]') as HTMLInputElement, row.querySelector('input[type=checkbox]') as HTMLInputElement];
    const apply = () => { const s = state.get(p.id)!; s.on = cb.checked; s.vol = +sl.value; eng!.setPartGain(p.id, s.on ? s.vol : 0); };
    sl.oninput = apply; cb.onchange = apply;
    box.append(row);
  });
}

const urlsFor = (names: string[], dir: string, ext: string): PartSource[] => names.map((n) => ({ id: n, url: `${dir}/${n}.${ext}`, defaultGain: 1 }));
$('fx').onclick = () => loadParts(urlsFor(['click', 'click2', 'sine220', 'sine330'], '/fixtures', 'm4a')).catch(console.error);
$('dev').onclick = () => loadParts(urlsFor(['organ', 'soprano', 'alto', 'tenor', 'baritone', 'bass'], '/audio', 'm4a')).catch(console.error);
function fromFiles(fl: FileList | File[]) {
  const files = [...fl].sort((a, b) => a.name.localeCompare(b.name));
  return loadParts(files.map((f) => ({ id: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f), defaultGain: 1 }))).catch(console.error);
}
$<HTMLInputElement>('files').onchange = (e) => fromFiles((e.target as HTMLInputElement).files!);
const drop = $('drop');
drop.ondragover = (e) => e.preventDefault();
drop.ondrop = (e) => { e.preventDefault(); void fromFiles(e.dataTransfer!.files); };

$('play').onclick = () => eng?.play();
$('pause').onclick = () => eng?.pause();
$('back').onclick = () => eng?.seek(eng.currentTime() - 10);
$('fwd').onclick = () => eng?.seek(eng.currentTime() + 10);
const seek = $<HTMLInputElement>('seek');
let dragging = false;
seek.onpointerdown = () => (dragging = true);
seek.onchange = () => { dragging = false; if (eng) eng.seek((+seek.value / 1000) * eng.duration); };
const rate = $<HTMLInputElement>('rate');
rate.oninput = () => { $('rateL').textContent = (+rate.value).toFixed(2) + 'x'; eng?.setRate(+rate.value); };
$('rateReset').onclick = () => { rate.value = '1'; rate.dispatchEvent(new Event('input')); };
const setLoop = () => {
  $('loopL').textContent = loopA != null && loopB != null ? `${fmt(loopA)} → ${fmt(loopB)}` : loopA != null ? `A ${fmt(loopA)}` : 'no loop';
  eng?.setLoop(loopA != null && loopB != null && loopB > loopA ? { start: loopA, end: loopB } : null);
};
$('la').onclick = () => { loopA = eng!.currentTime(); setLoop(); };
$('lb').onclick = () => { loopB = eng!.currentTime(); setLoop(); };
$('lc').onclick = () => { loopA = loopB = null; setLoop(); };

setInterval(() => {
  if (!eng) return;
  const t = eng.currentTime();
  $('time').textContent = `${fmt(t)} / ${fmt(eng.duration)}`;
  if (!dragging) seek.value = String(Math.round((t / (eng.duration || 1)) * 1000));
  const s = eng.stats as typeof eng.stats & { };
  const ac = (eng as unknown as { ctx: AudioContext }).ctx;
  const extra = eng as unknown as { underruns?: number; maxDriftMs?: number };
  $('diag').textContent = [
    `engine: ${kind()}   ctx.sampleRate: ${ac.sampleRate} Hz   state: ${ac.state}`,
    `fetch: ${s.fetchMs.toFixed(0)} ms   decode: ${s.decodeMs.toFixed(0)} ms`,
    `parts: ${s.parts}   lengths: ${[...new Set(s.lengths)].join(',')} samples${new Set(s.lengths).size > 1 ? '  ⚠ MISMATCH' : ''}`,
    `decoded audio held: ${(s.bufferBytes / 1048576).toFixed(0)} MB (Float32)   JS heap: ${heapMB().toFixed(0)} MB (Chromium only)`,
    `baseLatency: ${((ac.baseLatency ?? 0) * 1000).toFixed(0)} ms   outputLatency: ${((ac.outputLatency ?? 0) * 1000).toFixed(0)} ms`,
    extra.underruns != null ? `soundtouch underruns: ${extra.underruns}` : '',
    extra.maxDriftMs != null ? `media follower max drift seen: ${extra.maxDriftMs.toFixed(1)} ms` : '',
    `audioSession API: ${navigator.audioSession ? 'yes (type=' + navigator.audioSession.type + ')' : 'no (silent-audio fallback on iOS)'}`,
  ].filter(Boolean).join('\n');
}, 200);

const out = $('tout');
const log = (s: string) => (out.textContent += s + '\n');
$('tdrift').onclick = async () => {
  out.textContent = '';
  const want = ['click', 'click2'];
  const us = parts.filter((p) => want.includes(p.id)).map(({ id, url }) => ({ id, url }));
  if (us.length < 2) return log('Load the generated fixtures first.');
  for (const r of [0.5, 0.75, 1, 1.5]) log(JSON.stringify(await offlineDriftTest(kind(), us, r, { sampleRate: srOpt() })));
};
$('trate').onclick = async () => {
  out.textContent = '';
  const s = parts.find((p) => p.id === 'sine220');
  if (!s) return log('Load the generated fixtures first.');
  log(JSON.stringify(await offlineRateChangeTest(kind(), s.url, { sampleRate: srOpt() })));
};
Object.assign(window, { __spike: { offlineDriftTest, offlineRateChangeTest } });
