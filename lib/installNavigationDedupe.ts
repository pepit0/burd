import { router, type Href } from "expo-router";

const DEDUPE_MS = 800;
const FLAG = "__burdNavDedupe" as const;

let lastKey = "";
let lastAt = 0;

function hrefKey(href: Href): string {
  return typeof href === "string" ? href : JSON.stringify(href);
}

function shouldSkip(href: Href): boolean {
  const key = hrefKey(href);
  const now = Date.now();
  if (key === lastKey && now - lastAt < DEDUPE_MS) return true;
  lastKey = key;
  lastAt = now;
  return false;
}

/** Ignore repeat taps of the same destination while that screen is still opening. */
export function installNavigationDedupe(): void {
  const nav = router as typeof router & { [FLAG]?: boolean };
  if (nav[FLAG]) return;
  nav[FLAG] = true;

  const originalPush = router.push.bind(router);
  const originalNavigate = router.navigate.bind(router);

  router.push = ((href: Href, options?: object) => {
    if (shouldSkip(href)) return;
    return originalPush(href, options as never);
  }) as typeof router.push;

  router.navigate = ((href: Href, options?: object) => {
    if (shouldSkip(href)) return;
    return originalNavigate(href, options as never);
  }) as typeof router.navigate;
}
