import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import toIco from "to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "assets");
const websiteDir = path.join(__dirname, "..");
const logoSvg = fs.readFileSync(path.join(assetsDir, "logo-mark.svg"));

async function renderLogoPng(size) {
  const resvg = new Resvg(logoSvg, {
    fitTo: { mode: "width", value: size },
  });
  return resvg.render().asPng();
}

const sizes = [
  { name: "favicon-48.png", size: 48 },
  { name: "favicon-96.png", size: 96 },
  { name: "favicon-192.png", size: 192 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of sizes) {
  const png = await renderLogoPng(size);
  const outPath = path.join(assetsDir, name);
  await sharp(png).png().toFile(outPath);
  console.log(`Wrote ${outPath} (${size}x${size})`);
}

const icoSizes = [16, 32, 48];
const icoBuffers = await Promise.all(
  icoSizes.map(async (size) => {
    const png = await renderLogoPng(size);
    return sharp(png).png().toBuffer();
  }),
);
const faviconIcoPath = path.join(websiteDir, "favicon.ico");
fs.writeFileSync(faviconIcoPath, await toIco(icoBuffers));
console.log(`Wrote ${faviconIcoPath} (${icoSizes.join(", ")}px)`);
