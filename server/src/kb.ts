// KB loader — loads business knowledge markdown from GCS (M2) or local TEMP/knowledge (M1).
// Called once at server startup; result is passed into buildSystemPrompt.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { KBLoader } from "@copper/kb";
import { loadAllKB } from "@copper/kb";
import { GCSStorageProvider } from "./storage/gcs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── GCS loader ────────────────────────────────────────────────────────────────
class GCSKBLoader implements KBLoader {
  constructor(private readonly storage: GCSStorageProvider) {}

  async listFiles(): Promise<string[]> {
    const subDirs = await this.storage.listFolders("knowledge");
    const files: string[] = [];
    for (const dir of subDirs) {
      const items = await this.storage.list(`knowledge/${dir}`);
      for (const item of items) {
        if (item.endsWith(".md")) files.push(`${dir}/${item}`);
      }
    }
    return files;
  }

  async readFile(name: string): Promise<string> {
    return this.storage.read(`knowledge/${name}`);
  }
}

// ── Local disk loader (M1 fallback) ──────────────────────────────────────────
class LocalKBLoader implements KBLoader {
  private root: string;

  constructor() {
    // server/dist/../../../TEMP/knowledge (works for both src and dist)
    this.root = path.resolve(__dirname, "../../TEMP/knowledge");
  }

  async listFiles(): Promise<string[]> {
    if (!fs.existsSync(this.root)) return [];
    const files: string[] = [];
    for (const dir of fs.readdirSync(this.root)) {
      const dirPath = path.join(this.root, dir);
      if (!fs.statSync(dirPath).isDirectory()) continue;
      for (const file of fs.readdirSync(dirPath)) {
        if (file.endsWith(".md")) files.push(`${dir}/${file}`);
      }
    }
    return files;
  }

  async readFile(name: string): Promise<string> {
    return fs.readFileSync(path.join(this.root, name), "utf8");
  }
}

// ── Public factory ────────────────────────────────────────────────────────────
export async function loadKB(): Promise<string> {
  const hasGCS =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON &&
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim().length > 10;

  if (hasGCS) {
    try {
      const storage = new GCSStorageProvider();
      const loader = new GCSKBLoader(storage);
      const content = await loadAllKB(loader);
      const fileCount = (content.match(/^## /gm) ?? []).length;
      console.log(`[kb] ✅ Loaded ${fileCount} KB files from GCS`);
      return content;
    } catch (err) {
      console.warn(`[kb] ⚠️  GCS KB load failed (${(err as Error).message}), falling back to local`);
    }
  }

  const loader = new LocalKBLoader();
  const content = await loadAllKB(loader);
  const fileCount = (content.match(/^## /gm) ?? []).length;
  console.log(`[kb] ✅ Loaded ${fileCount} KB files from local disk`);
  return content;
}
