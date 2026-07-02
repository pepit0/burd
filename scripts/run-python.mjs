import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/run-python.mjs <script.py> [args...]");
  process.exit(1);
}

function findPython() {
  const venvPaths = [
    join(root, "server", ".venv", "Scripts", "python.exe"),
    join(root, "server", ".venv", "bin", "python"),
  ];
  for (const path of venvPaths) {
    if (existsSync(path)) return path;
  }
  return process.platform === "win32" ? "python" : "python3";
}

const python = findPython();
const script = join(root, args[0]);
const result = spawnSync(python, [script, ...args.slice(1)], {
  stdio: "inherit",
  cwd: root,
});

process.exit(result.status ?? 1);
