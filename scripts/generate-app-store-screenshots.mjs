/**
 * Renders assets/app-store/panorama.html and exports 3 equal App Store panels
 * (1290×2796 each) from one continuous 3870×2796 image.
 *
 * Usage: node scripts/generate-app-store-screenshots.mjs
 */
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const HTML = path.join(ROOT, "assets", "app-store", "panorama.html");
const OUT_DIR = path.join(ROOT, "assets", "app-store");

const TOTAL_W = 3870;
const TOTAL_H = 2796;
const PANEL_W = 1290;

const OUTPUTS = [
  { file: "screenshot-1-home.png", label: "Home feed" },
  { file: "screenshot-2-field-guide.png", label: "Field guide" },
  { file: "screenshot-3-journal.png", label: "Journal" },
];

async function main() {
  if (!fs.existsSync(HTML)) {
    throw new Error(`Missing ${HTML}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: TOTAL_W, height: TOTAL_H },
    deviceScaleFactor: 1,
  });

  await page.goto(pathToFileURL(HTML).href, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const panoramaPath = path.join(OUT_DIR, "panorama-full.png");
  await page.screenshot({ path: panoramaPath, type: "png" });
  console.log(`Wrote ${panoramaPath}`);

  for (let i = 0; i < 3; i++) {
    const out = path.join(OUT_DIR, OUTPUTS[i].file);
    await page.screenshot({
      path: out,
      type: "png",
      clip: { x: i * PANEL_W, y: 0, width: PANEL_W, height: TOTAL_H },
    });
    console.log(`Wrote ${out} (${OUTPUTS[i].label})`);
  }

  await browser.close();
  console.log("\nDone — 3 panels are exact thirds of panorama-full.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
