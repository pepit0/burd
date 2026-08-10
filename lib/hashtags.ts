const HASHTAG_PATTERN = /(?:^|\s)#([\w-]+)/g;

/** Lowercase tag without leading #. */
export function normalizeHashtagTag(tag: string): string {
  return tag.trim().replace(/^#+/, "").toLowerCase();
}

/** Parse unique normalized hashtags from caption / notes text. */
export function extractHashtags(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];

  const tags = new Set<string>();
  for (const match of text.matchAll(HASHTAG_PATTERN)) {
    const normalized = normalizeHashtagTag(match[1] ?? "");
    if (normalized) tags.add(normalized);
  }
  return [...tags];
}

/** Whether a search query matches any hashtag in the text (exact, prefix, or partial). */
export function matchesHashtagQuery(
  text: string | null | undefined,
  query: string,
): boolean {
  const q = normalizeHashtagTag(query);
  if (!q) return false;

  const tags = extractHashtags(text);
  if (tags.length === 0) return false;

  return tags.some((tag) => hashtagSimilarity(tag, q));
}

function hashtagSimilarity(tag: string, query: string): boolean {
  if (tag === query) return true;
  if (tag.startsWith(query) || query.startsWith(tag)) return true;
  if (tag.includes(query) || query.includes(tag)) return true;
  return false;
}

/** True when the user is likely searching for a hashtag. */
export function isHashtagFocusedQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("#")) return true;
  return extractHashtags(trimmed).length > 0;
}
