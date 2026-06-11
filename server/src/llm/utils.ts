function stripJSONComments(json: string): string {
  // Remove // line comments that appear outside strings (LLMs sometimes emit these)
  let result = "";
  let inString = false;
  let escape = false;
  let i = 0;
  while (i < json.length) {
    const ch = json[i];
    if (escape) { result += ch; escape = false; i++; continue; }
    if (ch === "\\" && inString) { result += ch; escape = true; i++; continue; }
    if (ch === '"') { inString = !inString; result += ch; i++; continue; }
    if (!inString && ch === "/" && json[i + 1] === "/") {
      while (i < json.length && json[i] !== "\n") i++;
      continue;
    }
    result += ch;
    i++;
  }
  return result;
}

export function extractJSON(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON object in response");
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      const raw = text.slice(start, i + 1);
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return JSON.parse(stripJSONComments(raw)) as Record<string, unknown>;
      }
    }
  }
  throw new Error("Unmatched braces in LLM response");
}
