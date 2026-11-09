// Usage: node scripts/measure.mjs <chromium|webkit|firefox> <test> [stretcher] [extra]
//  tests: probe | drift | rate | mem
// Starts vite itself. Fixtures must exist (pnpm fixtures). `mem` needs AUDIO_DIR (encoded real stems, outside repo).
import { chromium, webkit, firefox } from 'playwright';
import { createServer } from 'vite';

const [browserName = 'chromium', test = 'probe', stretcher = 'signalsmith', extra = ''] = process.argv.slice(2);
const server = await createServer({ server: { port: 5199, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await { chromium, webkit, firefox }[browserName].launch({
  args: browserName === 'chromium' ? ['--autoplay-policy=no-user-gesture-required'] : [],
});
const page = await (await browser.newContext()).newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto('http://127.0.0.1:5199/');
const run = (fn, arg) => page.evaluate(fn, arg);
try {
  if (test === 'probe') {
    const r = await run(async () => {
      const m = await import('/src/measure.ts');
      const out = [];
      for (const f of ['click.wav', 'click.m4a', 'click2.m4a']) out.push(await m.decodeProbe('/fixtures/' + f));
      return out;
    });
    console.log(browserName, JSON.stringify(r));
  } else if (test === 'drift') {
    const rates = (extra || '0.5,0.75,1,1.5').split(',').map(Number);
    for (const rate of rates) {
      const r = await run(async ([s, rate]) => {
        const m = await import('/src/measure.ts');
        return m.offlineDriftTest(s, [{ id: 'click', url: '/fixtures/click.m4a' }, { id: 'click2', url: '/fixtures/click2.m4a' }], rate);
      }, [stretcher, rate]);
      console.log(browserName, JSON.stringify(r));
    }
  } else if (test === 'rate') {
    const r = await run(async (s) => (await import('/src/measure.ts')).offlineRateChangeTest(s, '/fixtures/sine220.m4a'), stretcher);
    console.log(browserName, JSON.stringify(r));
  } else if (test === 'mem') {
    const sr = extra ? +extra : undefined;
    const cdp = browserName === 'chromium' ? await page.context().newCDPSession(page) : null;
    const r = await run(async ([s, sr]) => {
      const m = await import('/src/engines/index.ts');
      const names = ['organ', 'soprano', 'alto', 'tenor', 'baritone', 'bass'];
      const e = m.createEngine({ stretcher: s, sampleRate: sr });
      const t0 = performance.now();
      await e.load(names.map((n) => ({ id: n, url: `/audio/${n}.m4a`, defaultGain: 1 })));
      return { load: performance.now() - t0, stats: e.stats, rate: e.ctx.sampleRate, heap: performance.memory?.usedJSHeapSize / 1048576 };
    }, [stretcher, sr]);
    if (cdp) { await cdp.send('HeapProfiler.collectGarbage'); }
    const metrics = cdp ? Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value])) : null;
    console.log(browserName, JSON.stringify(r), metrics ? 'jsHeapMB=' + (metrics.JSHeapUsedSize / 1048576).toFixed(0) : '');
  }
} finally { await browser.close(); await server.close(); }
