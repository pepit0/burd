const COLOR_CODE_MAP: Record<string, string> = {
  "0": "#000000",
  "1": "#0000AA",
  "2": "#00AA00",
  "3": "#00AAAA",
  "4": "#AA0000",
  "5": "#AA00AA",
  "6": "#FFAA00",
  "7": "#AAAAAA",
  "8": "#555555",
  "9": "#5555FF",
  a: "#55FF55",
  b: "#55FFFF",
  c: "#FF5555",
  d: "#FF55FF",
  e: "#FFFF55",
  f: "#FFFFFF",
};

export interface DisplayNameRun {
  text: string;
  color?: string;
}

export function parseDisplayNameRuns(input: string): DisplayNameRun[] {
  const runs: DisplayNameRun[] = [];
  let activeColor: string | undefined;
  let buffer = "";

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];
    if (ch === "&" && next) {
      const code = next.toLowerCase();
      const mapped = COLOR_CODE_MAP[code];
      if (mapped) {
        if (buffer.length > 0) {
          runs.push({ text: buffer, color: activeColor });
          buffer = "";
        }
        activeColor = mapped;
        i += 1;
        continue;
      }
    }
    buffer += ch;
  }

  if (buffer.length > 0) {
    runs.push({ text: buffer, color: activeColor });
  }

  return runs.length > 0 ? runs : [{ text: input }];
}

export function stripDisplayNameColorCodes(input: string): string {
  return input.replace(/&[0-9a-f]/gi, "");
}

