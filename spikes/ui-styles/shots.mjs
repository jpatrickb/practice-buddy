// Usage: node shots.mjs  (needs playwright from ../ui/node_modules). Writes to ./screenshots (gitignored).
import { chromium } from "../ui/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const url = pathToFileURL(path.resolve("index.html")).href;
const out = path.resolve("screenshots");
mkdirSync(out, { recursive: true });
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
const browser = await chromium.launch();
const problems = [];
for (const [sn, vp] of Object.entries(sizes)) {
  for (const scheme of ["light", "dark"]) {
    for (const dir of ["studio", "now", "playlist"]) {
      if (dir === "studio" && scheme === "light") continue; // Studio is dark-only
      const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, deviceScaleFactor: 2, hasTouch: sn === "phone" });
      const page = await ctx.newPage();
      page.on("console", (m) => m.type() === "error" && !/fonts\.g/.test(m.text()) && problems.push(`console ${dir}: ${m.text()}`));
      page.on("pageerror", (e) => problems.push(`pageerror ${dir}: ${e.message}`));
      const shot = async (name, full = true) => {
        await page.waitForTimeout(450);
        const f = path.join(out, `${dir}-${name}-${sn}-${scheme}.png`);
        await page.screenshot({ path: f, fullPage: full });
        const o = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
        if (o > 0) problems.push(`overflow ${dir}-${name}-${sn}-${scheme}: ${o}px`);
        console.log(f);
      };
      await page.goto(url + `#${dir}`);
      await page.waitForSelector("h1");
      await shot("home");
      if (dir === "playlist") {
        await page.getByRole("button", { name: /Candlelight Carol/ }).first().click();
        await page.waitForTimeout(600);
        await page.getByRole("button", { name: "Collapse player" }).click();
        await shot("mini");
        await page.getByRole("button", { name: /Open player/ }).click();
      } else {
        await page.getByRole("button", { name: /Candlelight Carol/ }).first().click();
      }
      // exercise: pick Alto, start a loop, play a moment
      await page.getByRole("button", { name: "Alto", exact: true }).last().click();
      await page.getByRole("button", { name: "Play", exact: true }).last().click();
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: "Start here" }).last().click();
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: "End here" }).last().click();
      await shot("player", dir !== "playlist");
      if (dir !== "playlist") { await page.evaluate(() => window.scrollTo(0, 0)); await shot("player-top", false); }
      if (dir === "playlist") { // the sheet scrolls internally: capture its full height via a tall viewport
        await page.setViewportSize({ width: vp.width, height: sn === "phone" ? 2000 : 1500 });
        await shot("player-full", false);
      }
      await ctx.close();
    }
  }
}
await browser.close();
console.log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "No overflow, no console errors.");
