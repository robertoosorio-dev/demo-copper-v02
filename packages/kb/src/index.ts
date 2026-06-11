// @copper/kb — business knowledge + card contracts loader
// Read-only at runtime. Written only by admin tooling.
// KB content (markdown files) is loaded by the server at startup from GCS or local disk.

export interface KBFile {
  name: string;
  content: string;
}

export interface KBLoader {
  // Returns relative file paths, e.g. "data-activation/schema.md"
  listFiles(): Promise<string[]>;
  readFile(name: string): Promise<string>;
}

// Load all markdown files via the given loader and return them as a single
// concatenated string, suitable for inclusion in a system prompt.
export async function loadAllKB(loader: KBLoader): Promise<string> {
  const files = (await loader.listFiles()).filter((f) => f.endsWith(".md")).sort();
  if (files.length === 0) return "";
  const parts: string[] = [];
  for (const name of files) {
    const content = await loader.readFile(name);
    parts.push(`## ${name}\n\n${content.trim()}`);
  }
  return parts.join("\n\n---\n\n");
}
