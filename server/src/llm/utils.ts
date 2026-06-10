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
    else if (ch === "}" && --depth === 0)
      return JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>;
  }
  throw new Error("Unmatched braces in LLM response");
}
