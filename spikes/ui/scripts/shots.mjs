// Usage: pnpm dev (in another shell), then `pnpm shots`. Writes to ./screenshots (gitignored).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.env.BASE ?? "http://localhost:5173";
const out = path.resolve("screenshots");
mkdirSync(out, { recursive: true });
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
const browser = await chromium.launch();
const overflow = [];
for (const [sn, vp] of Object.entries(sizes)) {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, deviceScaleFactor: 2, hasTouch: sn === "phone" });
    const page = await ctx.newPage();
    const shot = async (name) => {
      await page.addStyleTag({ content: "nav[aria-label^='Design direction']{display:none!important}" });
      const f = path.join(out, `${name}-${sn}-${scheme}.png`);
      await page.screenshot({ path: f, fullPage: true });
      const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (o > 0) overflow.push(`${name}-${sn}-${scheme}: ${o}px`);
      console.log(f);
    };
    await page.goto(`${base}/#/`);
    await page.waitForSelector("h1");
    await shot("home");
    for (const song of ["candlelight-carol", "example-duet"]) {
      for (const d of ["a", "b", "c"]) {
        await page.goto(`${base}/?d=${d}#/song/${song}`);
        await page.reload();
        await page.waitForSelector("[aria-label='Play']:not([disabled])");
        await shot(`player-${song}-${d}`);
        if (d === "c") {
          await page.getByRole("button", { name: /Mix & repeat/ }).click();
          await page.waitForTimeout(500);
          await shot(`player-${song}-c-sheet`);
          await page.keyboard.press("Escape");
        }
      }
    }
    await ctx.close();
  }
}
await browser.close();
console.log(overflow.length ? "HORIZONTAL OVERFLOW:\n" + overflow.join("\n") : "No horizontal overflow.");
