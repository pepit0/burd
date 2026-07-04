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

async function writeOpaqueIcon(name, size) {
  const png = await renderLogoPng(size);
  const outPath = path.join(assetsDir, name);
  // iOS rejects app icons with transparency; the SVG's rounded rect leaves
  // transparent corners that show up blank on TestFlight/home screen.
  await sharp(png)
    .flatten({ background: BRAND_GREEN })
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
