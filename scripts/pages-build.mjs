import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("Installing root dependencies...");
execSync("npm ci", { cwd: root, stdio: "inherit" });

console.log("Building Expo web app into website/app/...");
execSync("npm run build:web-app", {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
