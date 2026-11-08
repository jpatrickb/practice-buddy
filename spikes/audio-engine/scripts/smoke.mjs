// Real-time smoke test of the three engines in the live page (headless Chromium, real AudioContext).
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ server: { port: 5198, host: '127.0.0.1' }, logLevel: 'error' }); await server.listen();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto('http://127.0.0.1:5198/');
for (const kind of ['signalsmith', 'soundtouch', 'media']) {
  const r = await page.evaluate(async (kind) => {
    const { createEngine } = await import('/src/engines/index.ts');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const e = createEngine({ stretcher: kind });
    await e.load(['click', 'click2', 'sine220'].map((n) => ({ id: n, url: `/fixtures/${n}.m4a`, defaultGain: 1 })));
    const o = {};
    e.play(); await sleep(1500); o.t1 = e.currentTime();
    e.setRate(0.5); await sleep(2000); o.t2 = e.currentTime(); // expect +~1.0
    e.seek(100); await sleep(500); o.seek = e.currentTime();
    e.setLoop({ start: 100, end: 101.5 }); await sleep(3500); o.loop = e.currentTime(); // should stay in [100,101.5]
    e.setLoop(null); e.setPartGain('click', 0); e.pause(); o.paused = e.playing;
    e.dispose(); return o;
  }, kind);
  console.log(kind, JSON.stringify(r));
}
await browser.close(); await server.close();
