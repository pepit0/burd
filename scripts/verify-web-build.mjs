import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "website", "app");
const expoJsDir = path.join(appDir, "_expo", "static", "js", "web");
const assetsDir = path.join(appDir, "assets");

function fail(message) {
  console.error(`Web build verification failed: ${message}`);
  process.exit(1);
}

if (!existsSync(path.join(appDir, "index.html"))) {
  fail("missing website/app/index.html");
}

if (!existsSync(expoJsDir)) {
  fail("missing website/app/_expo/static/js/web");
}

const entryFiles = readdirSync(expoJsDir).filter((name) => name.startsWith("entry-") && name.endsWith(".js"));
if (entryFiles.length === 0) {
  fail("missing website/app/_expo/static/js/web/entry-*.js");
}

const entryPath = path.join(expoJsDir, entryFiles[0]);
const entrySize = statSync(entryPath).size;
if (entrySize < 1_000_000) {
  fail(`entry bundle looks too small (${entrySize} bytes): ${entryPath}`);
}

if (!existsSync(assetsDir)) {
  fail("missing website/app/assets");
}

const indexHtml = path.join(appDir, "index.html");
if (statSync(indexHtml).size < 10_000) {
  fail("website/app/index.html looks incomplete");
}

console.log(`Web build verified: ${entryFiles[0]} (${entrySize} bytes), assets present.`);
