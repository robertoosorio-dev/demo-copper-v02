// @copper/kb — business knowledge + card contracts loader
// Read-only at runtime. Written only by admin tooling.
// KB content (markdown files) is loaded by the server at startup from GCS or local disk.

export interface KBFile {
  name: string;
  content: string;
}

export interface KBLoader {
  listFiles(): Promise<string[]>;
  readFile(name: string): Promise<string>;
}
