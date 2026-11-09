import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const LINK = '/c/dev-choir/dev-token-dev-token-dev-token-0';
const SHOTS = path.resolve('e2e-screenshots');

async function noHorizontalScroll(page: Page) {
  const extra = await page.evaluate(
    () =>
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
  );
  expect(extra).toBeLessThanOrEqual(0);
}

const snap = (page: Page, name: string, fullPage = true) =>
  page.screenshot({
    path: path.join(SHOTS, `${name}-${page.viewportSize()?.width}.png`),
    fullPage,
  });

const VIEWPORTS = [
  { name: 'phone 390×844', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  {
    name: 'desktop 1280×800',
    viewport: { width: 1280, height: 800 },
    hasTouch: false,
    isMobile: false,
  },
];

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({
      viewport: vp.viewport,
      hasTouch: vp.hasTouch,
      isMobile: vp.isMobile,
      deviceScaleFactor: 2,
    });

    test('without a link, a friendly screen explains what to do', async ({ page }) => {
      await page.goto('/');
      await expect(
        page.getByRole('heading', { name: 'Open the link your choir director sent you.' }),
      ).toBeVisible();
      await noHorizontalScroll(page);
      await snap(page, 'no-access');
    });

    test('redeem the link, open the song, and use the mixer', async ({ page }) => {
      // Redeem the link: the token leaves the address bar and we land on the choir home.
      await page.goto(LINK);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: 'Dev Choir' })).toBeVisible();
      await noHorizontalScroll(page);
      await snap(page, 'home');

      await page.getByRole('link', { name: /Fake Song/ }).click();
      await expect(page).toHaveURL(/\/songs\/fake-song$/);
      await expect(page.getByRole('heading', { name: /Fake Song/, level: 1 })).toBeVisible();
      const play = page.getByRole('button', { name: 'Play' });
      await expect(play).toBeVisible(); // visible once the audio has loaded
      await noHorizontalScroll(page);

      // Parts come from data; the seeded song has two voices and one accompaniment.
      const low = page.getByRole('switch', { name: 'Low voices', exact: true });
      const mid = page.getByRole('switch', { name: 'Middle voices', exact: true });
      const piano = page.getByRole('switch', { name: 'Piano', exact: true });
      await expect(low).toBeChecked();
      await expect(mid).toBeChecked();

      // Volume sliders rest at the real default (1.0 of 0..2, mid-slider).
      const lowVolume = page.getByRole('slider', { name: 'Low voices volume' });
      await expect(lowVolume).toHaveAttribute('aria-valuenow', '1');
      await expect(lowVolume).toHaveAttribute('aria-valuemax', '2');
      await snap(page, 'player');

      // The blurred backdrop is fixed to the viewport, so it never ends mid-page while scrolling.
      // (Full-page screenshots stitch fixed layers and show a false edge, so check a real viewport.)
      for (const [label, frac] of [
        ['top', 0],
        ['mid', 0.4],
        ['bottom', 1],
      ] as const) {
        await page.evaluate(
          (f) =>
            window.scrollTo(0, f * (document.documentElement.scrollHeight - window.innerHeight)),
          frac,
        );
        const box = await page.locator('.orbs').boundingBox();
        expect(box?.y).toBe(0);
        expect(box?.height).toBe(page.viewportSize()?.height);
        await snap(page, `player-scroll-${label}`, false);
      }
      await page.evaluate(() => window.scrollTo(0, 0));

      // Picking a part turns the other voices off; accompaniment stays on.
      await page.getByRole('button', { name: 'Low voices', exact: true }).click();
      await expect(low).toBeChecked();
      await expect(mid).not.toBeChecked();
      await expect(piano).toBeChecked();

      // The user can add another part back.
      await mid.click();
      await expect(mid).toBeChecked();
      await page.getByRole('button', { name: 'Low voices', exact: true }).click(); // un-pick
      await page.getByRole('button', { name: 'Low voices', exact: true }).click(); // pick again: mutes Middle
      await expect(mid).not.toBeChecked();

      // Accompaniment has its own switch, named from the data.
      await page.getByRole('switch', { name: 'Piano', exact: false }).first().click();
      await expect(piano).not.toBeChecked();

      // "Everyone, my part louder" is available once a part is picked.
      const louder = page.getByRole('switch', { name: /Everyone, my part louder/ });
      await expect(louder).toBeEnabled();

      // Speed: keyboard step from 1.0× down to 0.95×, then "Normal" resets.
      const speed = page.getByRole('slider', { name: 'Speed' });
      await speed.focus();
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      await expect(page.getByText('0.9×')).toBeVisible();
      await page.getByRole('button', { name: 'Normal' }).click();
      await expect(page.getByText('1.0×')).toBeVisible();
      await speed.focus();
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      await expect(page.getByText('0.9×')).toBeVisible();

      // Repeat section: set start and end while playing, see it, clear it.
      await play.click();
      await expect(page.getByLabel('Elapsed')).not.toHaveText('0:00'); // the real engine is running
      await page.waitForTimeout(700);
      await page.getByRole('button', { name: 'Start here' }).click();
      await page.waitForTimeout(700);
      await page.getByRole('button', { name: 'End here' }).click();
      await expect(page.getByTestId('loop-text')).toContainText('Repeating');
      await expect(page.getByTestId('loop-band')).toBeVisible();
      await snap(page, 'player-repeat');
      await page.getByRole('button', { name: 'Clear' }).click();
      await expect(page.getByTestId('loop-text')).toHaveCount(0);
      await page.getByRole('button', { name: 'Pause' }).click();
      await page.getByRole('button', { name: 'Start here' }).click(); // leave a repeat set; it must NOT persist

      // Reload: mix, speed and picked part are remembered; the repeat section is not.
      await page.reload();
      await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
      await expect(
        page.getByRole('switch', { name: 'Middle voices', exact: true }),
      ).not.toBeChecked();
      await expect(page.getByRole('switch', { name: 'Piano', exact: true })).not.toBeChecked();
      await expect(page.getByText('0.9×')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Low voices', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page.getByTestId('loop-text')).toHaveCount(0);

      // Reset mix restores every part and clears the picked part.
      await page.getByRole('button', { name: 'Reset mix' }).click();
      await expect(page.getByRole('switch', { name: 'Middle voices', exact: true })).toBeChecked();
      await expect(page.getByRole('switch', { name: 'Piano', exact: true })).toBeChecked();
      await expect(page.getByRole('button', { name: 'Low voices', exact: true })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      await expect(page.getByRole('button', { name: 'Reset mix' })).toBeDisabled();
      await noHorizontalScroll(page);
      await snap(page, 'player-after-reset');
    });

    test('an unknown song shows a friendly message', async ({ page }) => {
      await page.goto(LINK);
      await page.goto('/songs/does-not-exist');
      await expect(
        page.getByRole('heading', { name: 'We couldn’t find that song.' }),
      ).toBeVisible();
    });
  });
}
