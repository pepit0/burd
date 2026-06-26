/** Active @mention query immediately before the cursor, if any. */
export function getActiveMentionQuery(text: string, cursor: number): string | null {
  const before = text.slice(0, cursor);
  const match = before.match(/(?:^|\s)@(\w*)$/);
  return match ? match[1] : null;
}

/** Replace the in-progress @mention with a completed @username token. */
export function applyMention(
  text: string,
  selectionStart: number,
  username: string,
): { text: string; selection: number } {
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionStart);
  const match = before.match(/(?:^|\s)@(\w*)$/);
  if (!match) {
    return { text, selection: selectionStart };
  }

  const atIndex = before.lastIndexOf("@");
  const prefix = text.slice(0, atIndex);
  const insertion = `@${username} `;
  const newText = prefix + insertion + after;
  return { text: newText, selection: prefix.length + insertion.length };
}

const MENTION_PATTERN = /(@\w+)/g;

/** Split comment text into plain text and @mention tokens. */
export function splitMentionParts(body: string): { type: "text" | "mention"; value: string }[] {
  const parts: { type: "text" | "mention"; value: string }[] = [];
  let lastIndex = 0;

  for (const match of body.matchAll(MENTION_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: "text", value: body.slice(lastIndex, index) });
    }
    parts.push({ type: "mention", value: match[1].slice(1) });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < body.length) {
    parts.push({ type: "text", value: body.slice(lastIndex) });
  }

  return parts.length ? parts : [{ type: "text", value: body }];
}
