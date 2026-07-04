import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "..", "assets");
const logoSvg = fs.readFileSync(path.join(assetsDir, "logo-mark.svg"));

async function renderLogoPng(size) {
  const resvg = new Resvg(logoSvg, {
    fitTo: { mode: "width", value: size },
  });
  return resvg.render().asPng();
}

const outputs = [
  { name: "icon.png", size: 1024 },
  { name: "adaptive-icon.png", size: 1024 },
  { name: "splash-icon.png", size: 200 },
];

for (const { name, size } of outputs) {
  const png = await renderLogoPng(size);
  const outPath = path.join(assetsDir, name);
  await sharp(png).png().toFile(outPath);
  console.log(`Wrote ${outPath} (${size}x${size})`);
}
