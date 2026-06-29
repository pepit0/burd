import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

injectAppShellSeo();

console.log("Done. Preview with: npm run preview:website → http://localhost:4321/app/");

function injectAppShellSeo() {
  const indexPath = path.join(appDir, "index.html");
  if (!existsSync(indexPath)) {
    return;
  }

  let html = readFileSync(indexPath, "utf8");
  const seoHead = [
    '<title>Burd - Birding, together</title>',
    '<meta name="description" content="Burd is the social birding app to log sightings, identify bird calls, explore a field guide, and connect with birders near you." />',
    '<meta name="robots" content="noindex, nofollow" />',
    '<link rel="canonical" href="https://burdapp.com/" />',
    '<meta name="application-name" content="Burd" />',
    '<meta name="apple-mobile-web-app-title" content="Burd" />',
    '<link rel="manifest" href="/site.webmanifest" />',
    '<meta name="theme-color" content="#181e16" />',
    '<link rel="icon" href="/favicon.ico" sizes="48x48" />',
    '<link rel="icon" href="/assets/favicon-48.png" type="image/png" sizes="48x48" />',
    '<link rel="icon" href="/assets/favicon-192.png" type="image/png" sizes="192x192" />',
    '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" sizes="180x180" />',
  ].join("");

  html = html.replace(/<title[^>]*><\/title>/, "<title>Burd - Birding, together</title>");
  html = html.replace("<head>", `<head>${seoHead}`);

  writeFileSync(indexPath, html);
  console.log("Injected SEO meta into website/app/index.html");
}
