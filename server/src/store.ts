// ProjectStore — thin adapter between routes and project-store package.
// For M1: uses the in-memory fixture as the only project.
// For M2: delegates to GCS-backed store (project-store package).

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import type { Version, ReasoningLogEntry } from "@copper/contracts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ProjectSummary {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
}

export interface VersionSummary {
  versionNum: number;
  parentVersion: number | null;
  authoredBy: "user" | "system";
  createdAt: string;
}

export interface ProjectStore {
  listProjects(): Promise<ProjectSummary[]>;
  loadLatestVersion(id: string): Promise<Version | null>;
  loadVersionAt(id: string, versionNum: number): Promise<Version | null>;
  listVersionSummaries(id: string): Promise<VersionSummary[]>;
  saveVersion(id: string, version: Version): Promise<Version>;
  listTransactionPasses(id: string, versionNum: number): Promise<string[]>;
  listReasoningEntries(id: string, versionNum: number, pass: string): Promise<ReasoningLogEntry[]>;
  appendReasoningEntry(id: string, versionNum: number, pass: string, entry: ReasoningLogEntry): Promise<void>;
}

// ── M1: In-memory fixture store ───────────────────────────────────────────────

function loadFixture(): Version {
  const fixturePath = path.resolve(__dirname, "../fixtures/lmh-v2.json");
  const raw = readFileSync(fixturePath, "utf8");
  return JSON.parse(raw) as Version;
}

export class FixtureStore implements ProjectStore {
  private projectId: string;
  // All versions in order: index 0 = v1 (the seed), last = latest
  private versions: Version[];
  // In-memory reasoning log: key = "id/versionNum/pass"
  private rlog = new Map<string, ReasoningLogEntry[]>();

  constructor() {
    const seed = loadFixture();
    this.projectId = seed.id;
    this.versions = [seed];
    console.log(`[store] ✅ Fixture loaded: ${seed.name} (v${seed.version})`);
  }

  private get latest(): Version {
    return this.versions[this.versions.length - 1];
  }

  async listProjects(): Promise<ProjectSummary[]> {
    return [
      {
        id: this.latest.id,
        name: this.latest.name,
        version: this.latest.version,
        updatedAt: this.latest.createdAt,
      },
    ];
  }

  async loadLatestVersion(id: string): Promise<Version | null> {
    if (id === this.projectId) return this.latest;
    return null;
  }

  async saveVersion(_id: string, version: Version): Promise<Version> {
    this.versions.push(version);
    return version;
  }

  async loadVersionAt(id: string, versionNum: number): Promise<Version | null> {
    if (id !== this.projectId) return null;
    return this.versions.find((v) => v.version === versionNum) ?? null;
  }

  async listVersionSummaries(id: string): Promise<VersionSummary[]> {
    if (id !== this.projectId) return [];
    return this.versions.map((v) => ({
      versionNum: v.version,
      parentVersion: v.parentVersion,
      authoredBy: v.authoredBy,
      createdAt: v.createdAt,
    }));
  }

  async listTransactionPasses(id: string, versionNum: number): Promise<string[]> {
    const prefix = `${id}/${versionNum}/`;
    const passes = new Set<string>();
    for (const key of this.rlog.keys()) {
      if (key.startsWith(prefix)) passes.add(key.slice(prefix.length));
    }
    return Array.from(passes);
  }

  async listReasoningEntries(id: string, versionNum: number, pass: string): Promise<ReasoningLogEntry[]> {
    return this.rlog.get(`${id}/${versionNum}/${pass}`) ?? [];
  }

  async appendReasoningEntry(id: string, versionNum: number, pass: string, entry: ReasoningLogEntry): Promise<void> {
    const key = `${id}/${versionNum}/${pass}`;
    const existing = this.rlog.get(key) ?? [];
    this.rlog.set(key, [...existing, entry]);
  }
}

// ── M2: GCS-backed store (activated when GCS credentials are present) ─────────
// Imported lazily so M1 starts without GCS configured.

export async function createStore(): Promise<ProjectStore> {
  const hasGCS =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON &&
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim().length > 10;

  if (hasGCS) {
    // Dynamically import the GCS store to avoid startup crash when credentials are absent
    const { GCSProjectStore } = await import("./gcsStore.js");
    const gcsStore = new GCSProjectStore();
    await gcsStore.validate();
    return gcsStore;
  }

  console.log("[store] No GCS credentials found — using in-memory fixture store (M1 mode)");
  return new FixtureStore();
}
