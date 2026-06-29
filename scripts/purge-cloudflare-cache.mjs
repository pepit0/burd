import { execSync } from "node:child_process";

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  console.log("Skipping Cloudflare cache purge (CLOUDFLARE_API_TOKEN not set).");
  process.exit(0);
}

const zoneResponse = execSync(
  'curl -fsS "https://api.cloudflare.com/client/v4/zones?name=burdapp.com" ' +
    '-H "Authorization: Bearer ' +
    token +
    '"',
  { encoding: "utf8" },
);

const zoneId = JSON.parse(zoneResponse).result?.[0]?.id;
if (!zoneId) {
  console.log("Could not resolve zone id for burdapp.com; skipping purge.");
  process.exit(0);
}

execSync(
  `curl -fsS -X POST "https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache" ` +
    '-H "Authorization: Bearer ' +
    token +
    '" ' +
    '-H "Content-Type: application/json" ' +
    '--data "{\\"purge_everything\\":true}"',
  { stdio: "inherit" },
);

console.log("Purged Cloudflare cache for burdapp.com.");
