export type LinkPart = { type: "text"; value: string } | { type: "link"; value: string };

/** Matches http(s):// and www. URLs in plain text. */
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s]+/gi;

function trimTrailingUrlPunctuation(value: string): string {
  return value.replace(/[),.;:!?]+$/g, "");
}

export function normalizeLinkUrl(raw: string): string {
  const trimmed = trimTrailingUrlPunctuation(raw.trim());
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return `https://${trimmed}`;
}

export function splitLinkParts(text: string): LinkPart[] {
  const parts: LinkPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, index) });
    }

    const raw = match[0];
    const link = trimTrailingUrlPunctuation(raw);
    parts.push({ type: "link", value: link });

    const trailing = raw.slice(link.length);
    if (trailing) {
      parts.push({ type: "text", value: trailing });
    }

    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts.length ? parts : [{ type: "text", value: text }];
}
