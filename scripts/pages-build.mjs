import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appOutputDir = path.join(root, "website", "app");
const nodeModulesDir = path.join(root, "node_modules");
const requiredPaths = [
  path.join(appOutputDir, "index.html"),
  path.join(appOutputDir, "_expo"),
  path.join(appOutputDir, "assets"),
];

if (!existsSync(nodeModulesDir)) {
  console.log("Installing root dependencies...");
  execSync("npm ci", { cwd: root, stdio: "inherit" });
} else {
  console.log("Using existing node_modules (skipping npm ci for local build).");
}

console.log("Building Expo web app into website/app/...");
execSync("npm run build:web-app", {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

execSync("node scripts/verify-web-build.mjs", {
  cwd: root,
  stdio: "inherit",
});

for (const requiredPath of requiredPaths) {
  if (!existsSync(requiredPath)) {
    throw new Error(`Web build is incomplete: missing ${requiredPath}`);
  }
}

console.log("Web build verified (HTML, JS bundles, and assets present).");
