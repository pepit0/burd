import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "assets");
const logoSvg = fs.readFileSync(path.join(assetsDir, "logo-mark.svg"));

const WIDTH = 1200;
const HEIGHT = 630;
const BG = "#181e16";
const LOGO_SIZE = 168;
const TEXT_SIZE = 64;
const GAP = 28;

const logoResvg = new Resvg(logoSvg, {
  fitTo: { mode: "width", value: LOGO_SIZE },
});
const logoPng = logoResvg.render().asPng();
const logoMeta = await sharp(logoPng).metadata();

const textSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="96">
  <text
    x="160"
    y="72"
    text-anchor="middle"
    font-family="DM Sans, Segoe UI, Helvetica Neue, Arial, sans-serif"
    font-size="${TEXT_SIZE}"
    font-weight="500"
    fill="#ffffff"
  >Burd</text>
</svg>`);

const textResvg = new Resvg(textSvg, {
  fitTo: { mode: "width", value: 220 },
});
const textPng = textResvg.render().asPng();
const textMeta = await sharp(textPng).metadata();

const blockHeight = logoMeta.height + GAP + textMeta.height;
const logoTop = Math.round((HEIGHT - blockHeight) / 2);
const textTop = logoTop + logoMeta.height + GAP;
const logoLeft = Math.round((WIDTH - logoMeta.width) / 2);
const textLeft = Math.round((WIDTH - textMeta.width) / 2);

const outPath = path.join(assetsDir, "og-image.png");

await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: BG,
  },
})
  .composite([
    { input: logoPng, top: logoTop, left: logoLeft },
    { input: textPng, top: textTop, left: textLeft },
  ])
  .png()
  .toFile(outPath);

const outMeta = await sharp(outPath).metadata();
console.log(`Wrote ${outPath} (${outMeta.width}x${outMeta.height})`);
