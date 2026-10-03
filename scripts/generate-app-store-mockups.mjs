/**
 * Renders mockup assets from assets/app-store/mockups.html.
 *
 * Default: phone-framed PNGs in assets/app-store/mockups/
 * --screens: full-bleed UI screenshots (no bezel) in assets/app-store/screens/
 *
 * Usage:
 *   node scripts/generate-app-store-mockups.mjs
 *   node scripts/generate-app-store-mockups.mjs --screens
 */
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const HTML = path.join(ROOT, "assets", "app-store", "mockups.html");
const FRAMELESS = process.argv.includes("--screens");
const OUT_DIR = path.join(
  ROOT,
  "assets",
  "app-store",
  FRAMELESS ? "screens" : "mockups",
);

const MOCKUPS = [
  { id: "home-feed", file: "home-feed.png", label: "Home feed" },
  { id: "photo-id", file: "photo-id.png", label: "Photo ID (Live ID)" },
  { id: "sound-id", file: "sound-id.png", label: "Sound ID" },
  { id: "profile", file: "profile.png", label: "Profile" },
  { id: "profile-badges", file: "profile-badges.png", label: "Profile badges" },
  { id: "log-sighting", file: "log-sighting.png", label: "Log a sighting" },
  { id: "journal", file: "journal.png", label: "Journal" },
];

async function capture(page, selector, out) {
  const el = page.locator(selector);
  const box = await el.boundingBox();
  if (!box) {
    throw new Error(`Could not find ${selector}`);
  }
  await page.screenshot({
    path: out,
    type: "png",
    omitBackground: !FRAMELESS,
    clip: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    },
  });
}

async function main() {
  if (!fs.existsSync(HTML)) {
    throw new Error(`Missing ${HTML}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 3600, height: 1400 },
    deviceScaleFactor: FRAMELESS ? 3 : 2,
  });

  await page.goto(pathToFileURL(HTML).href, { waitUntil: "networkidle" });
  if (FRAMELESS) {
    await page.evaluate(() => document.body.classList.add("frameless"));
  }
  await page.waitForTimeout(FRAMELESS ? 2800 : 2000);

  for (const mockup of MOCKUPS) {
    const selector = FRAMELESS ? `#${mockup.id} .screen` : `#${mockup.id}`;
    const out = path.join(OUT_DIR, mockup.file);
    await capture(page, selector, out);
    console.log(`Wrote ${out} (${mockup.label})`);
  }

  await browser.close();
  console.log(
    `\nDone — ${MOCKUPS.length} ${FRAMELESS ? "full-bleed screens" : "phone mockups"} in ${OUT_DIR}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
