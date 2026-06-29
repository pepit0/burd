import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

const fontStylesheet =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <title>Burd - Birding, together</title>
        <base href="/app/" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={fontStylesheet} />
        <meta name="robots" content="noindex, nofollow" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  var resetKey = "burd-app-static-v3";
  if (localStorage.getItem(resetKey) !== "1") {
    localStorage.setItem(resetKey, "1");
    if ("caches" in window) {
      caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) { return caches.delete(key); }));
      });
    }
  }

  var reloadKey = "burd-app-script-reload";
  window.addEventListener("error", function (event) {
    var target = event.target;
    if (!target || target.tagName !== "SCRIPT") return;
    var src = target.src || "";
    if (src.indexOf("/app/_expo/static/js/web/entry-") === -1) return;
    if (sessionStorage.getItem(reloadKey)) return;
    sessionStorage.setItem(reloadKey, "1");
    location.replace(location.pathname + "?_cb=" + Date.now());
  }, true);
})();
`,
          }}
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
