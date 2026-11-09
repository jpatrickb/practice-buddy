import { expect, test } from '@playwright/test';

// Dev-only choir link created by `pnpm seed` (local, never valid in production).
const LINK = '/c/dev-choir/dev-token-dev-token-dev-token-0';

test('engine plays the seeded fake song: position, rate, seek, loop, end', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(LINK); // redeems the link: sets the grant cookie
  await page.goto('/e2e/harness/audio.html');
  await page.waitForFunction(() => !!window.harness);

  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const h = window.harness;
    const loaded = await h.load('fake-song');
    const e = h.engine!;
    const o: Record<string, number | boolean> = { duration: loaded.duration };
    o.progressDone = loaded.progress.at(-1)![0] === loaded.progress.at(-1)![1];

    e.setPartGain('low', 0); // must not throw / glitch
    e.setPartGain('low', 1.5);

    e.play();
    await wait(1500);
    o.playing = e.playing;
    o.t1 = e.currentTime(); // ~1.4

    e.setRate(0.5);
    const a = e.currentTime();
    await wait(2000);
    o.slowAdvance = e.currentTime() - a; // ~1.0 at half speed

    e.setRate(1.5);
    const b = e.currentTime();
    await wait(1000);
    o.fastAdvance = e.currentTime() - b; // ~1.5
    e.setRate(1);

    e.seek(10);
    await wait(600);
    o.afterSeek = e.currentTime(); // ~10.5

    e.setLoop({ start: 12, end: 13 });
    e.seek(12.2);
    await wait(2500); // would reach 14.7 without the loop
    o.inLoop = e.currentTime();
    e.setLoop(null);

    e.pause();
    const p = e.currentTime();
    await wait(500);
    o.pausedHolds = e.currentTime() === p && !e.playing;

    e.seek(18.5);
    e.setRate(1.5);
    h.events.length = 0;
    e.play();
    await wait(2500);
    o.ended = h.events.includes('ended');
    o.errorEvents = h.events.filter((x) => x === 'error').length;
    e.dispose();
    return o;
  });

  expect(result.duration).toBeCloseTo(20, 0);
  expect(result.progressDone).toBe(true);
  expect(result.playing).toBe(true);
  expect(result.t1).toBeGreaterThan(1.0);
  expect(result.t1).toBeLessThan(1.8);
  expect(result.slowAdvance).toBeGreaterThan(0.8);
  expect(result.slowAdvance).toBeLessThan(1.2);
  expect(result.fastAdvance).toBeGreaterThan(1.2);
  expect(result.fastAdvance).toBeLessThan(1.8);
  expect(result.afterSeek).toBeGreaterThan(10);
  expect(result.afterSeek).toBeLessThan(11.2);
  expect(result.inLoop as number).toBeGreaterThanOrEqual(12);
  expect(result.inLoop as number).toBeLessThanOrEqual(13);
  expect(result.pausedHolds).toBe(true);
  expect(result.ended).toBe(true);
  expect(result.errorEvents).toBe(0);
  expect(errors).toEqual([]);
});
