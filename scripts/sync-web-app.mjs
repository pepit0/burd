import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const appDir = path.join(root, "website", "app");

function emptyDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    return;
  }
  for (const entry of readdirSync(dir)) {
    rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

console.log("Exporting Expo web app (baseUrl /app)...");
execSync("npx expo export --platform web", {
  cwd: root,
  stdio: "inherit",
});

if (!existsSync(distDir)) {
  throw new Error("Expected dist/ after expo export");
}

console.log("Copying dist/ → website/app/...");
emptyDir(appDir);
cpSync(distDir, appDir, { recursive: true });

const assetsDir = path.join(appDir, "assets");
const expoDir = path.join(appDir, "_expo");
if (!existsSync(assetsDir) || !existsSync(expoDir)) {
  throw new Error("Expo web export is missing assets/ or _expo/ in website/app/");
}

execSync("node scripts/verify-web-build.mjs", {
  cwd: root,
  stdio: "inherit",
});

console.log("Done. Preview with: npm run preview:website → http://localhost:4321/app/");
