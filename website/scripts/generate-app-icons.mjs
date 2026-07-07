import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "..", "assets");
const logoSvg = fs.readFileSync(path.join(assetsDir, "logo-mark.svg"));

const BRAND_GREEN = "#5f9470";

async function renderLogoPng(size) {
  const resvg = new Resvg(logoSvg, {
    fitTo: { mode: "width", value: size },
  });
  return resvg.render().asPng();
}

/**
 * iOS rejects app icons with an alpha channel — TestFlight often shows a blank
 * white icon. Build on an explicit opaque green square (no flatten workaround).
 */
async function writeOpaqueIcon(name, size) {
  const logoSize = Math.round(size * 0.92);
  const logoPng = await renderLogoPng(logoSize);
  const outPath = path.join(assetsDir, name);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: BRAND_GREEN,
    },
  })
    .composite([{ input: logoPng, gravity: "center" }])
    .removeAlpha()
    .png()
    .toFile(outPath);

  console.log(`Wrote ${outPath} (${size}x${size}, opaque)`);
}

const outputs = [
  { name: "icon.png", size: 1024 },
  { name: "adaptive-icon.png", size: 1024 },
  { name: "splash-icon.png", size: 200 },
];

for (const { name, size } of outputs) {
  await writeOpaqueIcon(name, size);
}
