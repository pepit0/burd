/**
 * Renders a 3-panel 6.9" App Store set from store-screens.html.
 * Panels 1–2 are one continuous 3D hero; panel 3 is Log Every Sighting.
 *
 * Usage: node scripts/generate-app-store-framed.mjs
 */
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const HTML = path.join(ROOT, "assets", "app-store", "store-screens.html");
const OUT_DIR = path.join(ROOT, "assets", "app-store", "iphone-6.9");

const PANEL_W = 440;
const PANEL_H = 956;
const FILES = [
  "01-identify-live-id.png",
  "02-sound-id.png",
  "03-log-every-sighting.png",
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    deviceScaleFactor: 3,
  });

  await page.goto(pathToFileURL(HTML).href, { waitUntil: "networkidle" });
  await page.waitForFunction(() =>
    [...document.images].every((img) => img.complete && img.naturalWidth > 0),
  );
  await page.waitForTimeout(500);

  const el = page.locator("#panorama");
  const box = await el.boundingBox();
  if (!box) throw new Error("Missing #panorama");

  const full = path.join(OUT_DIR, "panorama-3.png");
  await page.screenshot({
    path: full,
    type: "png",
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
  });
  console.log("Wrote", full);

  for (let i = 0; i < FILES.length; i++) {
    const out = path.join(OUT_DIR, FILES[i]);
    await page.screenshot({
      path: out,
      type: "png",
      clip: {
        x: box.x + i * PANEL_W,
        y: box.y,
        width: PANEL_W,
        height: PANEL_H,
      },
    });
    console.log("Wrote", out);
  }

  await browser.close();
  console.log(`\nDone — ${FILES.length} screenshots at 1320×2868 in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
