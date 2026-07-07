import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @returns {{ width: number, height: number, hasAlpha: boolean }} */
function readPngInfo(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`${filePath} is not a valid PNG`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let hasAlpha = false;

  while (offset + 12 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;

    if (type === "IHDR" && len >= 13) {
      width = buf.readUInt32BE(dataStart);
      height = buf.readUInt32BE(dataStart + 4);
      const colorType = buf.readUInt8(dataStart + 9);
      // 4 = grayscale+alpha, 6 = RGBA
      if (colorType === 4 || colorType === 6) hasAlpha = true;
    } else if (type === "tRNS") {
      hasAlpha = true;
    }

    offset += 12 + len;
  }

  if (!width || !height) {
    throw new Error(`${filePath} is missing a PNG IHDR chunk`);
  }

  return { width, height, hasAlpha };
}

const required = [
  { rel: "assets/icon.png", size: 1024, opaque: true },
  { rel: "assets/adaptive-icon.png", size: 1024, opaque: false },
];

let failed = false;

for (const { rel, size, opaque } of required) {
  const filePath = path.join(root, rel);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: missing ${rel} (required for App Store / TestFlight builds)`);
    failed = true;
    continue;
  }

  try {
    const info = readPngInfo(filePath);
    if (info.width !== size || info.height !== size) {
      console.error(
        `ERROR: ${rel} must be ${size}x${size}, got ${info.width}x${info.height}`,
      );
      failed = true;
    }
    if (opaque && info.hasAlpha) {
      console.error(
        `ERROR: ${rel} must not have transparency (iOS shows a blank icon otherwise). Run: npm run generate:app-icons`,
      );
      failed = true;
    }
    if (!failed) {
      console.log(`OK ${rel} (${info.width}x${info.height}${opaque ? ", opaque" : ""})`);
    }
  } catch (error) {
    console.error(`ERROR: ${rel}: ${error instanceof Error ? error.message : error}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
