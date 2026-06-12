import { Router } from "express";
import { GCSStorageProvider } from "../storage/gcs.js";
import { routeLLM } from "../llm/router.js";
import { extractJSON } from "../llm/utils.js";

// ── Version metadata ──────────────────────────────────────────────────────────

export interface VersionMeta {
  realId: string;         // zero-padded monotonic int, folder name in GCS — never reused
  label: string;          // user-visible: "1", "2", "5" — reassignable
  description: string;    // one-line summary (user-supplied or auto)
  by: "human" | "agent";
  at: string;             // ISO timestamp
  superseded?: boolean;   // true when label was reassigned to a newer version
}

// ── KB versioning helpers ─────────────────────────────────────────────────────

async function listVersionMetas(s: GCSStorageProvider): Promise<VersionMeta[]> {
  let folders: string[];
  try {
    folders = await s.listFolders("knowledge/versions/");
  } catch {
    return [];
  }
  const metas: VersionMeta[] = [];
  for (const realId of folders.sort()) {
    try {
      const raw = await s.read(`knowledge/versions/${realId}/meta.json`);
      metas.push(JSON.parse(raw) as VersionMeta);
    } catch { /* skip corrupt/missing meta */ }
  }
  return metas;
}

async function nextRealId(s: GCSStorageProvider): Promise<string> {
  let folders: string[];
  try {
    folders = await s.listFolders("knowledge/versions/");
  } catch {
    folders = [];
  }
  const max = folders.reduce((m, f) => Math.max(m, parseInt(f, 10) || 0), 0);
  return String(max + 1).padStart(4, "0");
}

// List working-copy KB subdirectories (everything under knowledge/ except versions/).
async function listWorkingSubdirs(s: GCSStorageProvider): Promise<string[]> {
  const folders = await s.listFolders("knowledge/");
  return folders.filter((f) => f !== "versions");
}

// Snapshot working copy → knowledge/versions/{realId}/
async function cutVersionSnapshot(
  s: GCSStorageProvider,
  realId: string,
  meta: VersionMeta,
): Promise<void> {
  const subDirs = await listWorkingSubdirs(s);
  for (const subDir of subDirs) {
    const files = await s.list(`knowledge/${subDir}/`);
    for (const file of files) {
      const content = await s.read(`knowledge/${subDir}/${file}`);
      await s.write(`knowledge/versions/${realId}/${subDir}/${file}`, content);
    }
  }
  await s.write(`knowledge/versions/${realId}/meta.json`, JSON.stringify(meta, null, 2));
}

// Restore versioned snapshot → working copy, then reload.
async function rollbackVersionSnapshot(
  s: GCSStorageProvider,
  realId: string,
  reloadKB: () => Promise<void>,
): Promise<void> {
  const subDirs = await s.listFolders(`knowledge/versions/${realId}/`);
  for (const subDir of subDirs) {
    const files = await s.list(`knowledge/versions/${realId}/${subDir}/`);
    for (const file of files) {
      const content = await s.read(`knowledge/versions/${realId}/${subDir}/${file}`);
      await s.write(`knowledge/${subDir}/${file}`, content);
    }
  }
  await reloadKB();
}

// List all file names inside a versioned snapshot (relative to the version root).
async function listVersionFiles(s: GCSStorageProvider, realId: string): Promise<string[]> {
  const subDirs = await s.listFolders(`knowledge/versions/${realId}/`);
  const result: string[] = [];
  for (const subDir of subDirs) {
    const files = await s.list(`knowledge/versions/${realId}/${subDir}/`);
    for (const file of files) result.push(`${subDir}/${file}`);
  }
  return result.sort();
}

// ── Router ────────────────────────────────────────────────────────────────────

export function makeAdminRouter(reloadKB: () => Promise<void> = async () => {}): Router {
  const router = Router();
  let _storage: GCSStorageProvider | null = null;

  function storage(): GCSStorageProvider {
    if (!_storage) {
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) {
        throw new Error("GCS not configured — admin API unavailable in M1 mode");
      }
      _storage = new GCSStorageProvider();
    }
    return _storage;
  }

  // ── Working-copy file access (existing surface) ───────────────────────────

  // GET /api/admin/list?prefix=knowledge/
  router.get("/list", async (req, res) => {
    const prefix = (req.query.prefix as string) ?? "";
    try {
      const s = storage();
      const [folders, files] = await Promise.all([s.listFolders(prefix), s.list(prefix)]);
      res.json({ folders, files });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/admin/file?path=knowledge/data-activation/schema.md
  router.get("/file", async (req, res) => {
    const path = req.query.path as string;
    if (!path) return res.status(400).json({ error: "path required" });
    try {
      const content = await storage().read(path);
      res.json({ path, content });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // PUT /api/admin/file  { path, content }
  // Writes to knowledge/ only; reloads KB in-memory after write.
  router.put("/file", async (req, res) => {
    const { path, content } = req.body as { path?: string; content?: string };
    if (!path || content === undefined) {
      return res.status(400).json({ error: "path and content required" });
    }
    if (!path.startsWith("knowledge/")) {
      return res.status(403).json({ error: "Write access restricted to knowledge/ prefix" });
    }
    if (path.startsWith("knowledge/versions/")) {
      return res.status(403).json({ error: "Versioned snapshots are immutable — write to knowledge/ working copy instead" });
    }
    try {
      await storage().write(path, content);
      await reloadKB();
      res.json({ ok: true, path });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/admin/kb/reload
  router.post("/kb/reload", async (_req, res) => {
    try {
      await reloadKB();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ── KB versioning ─────────────────────────────────────────────────────────

  // GET /api/admin/kb/versions — list all version metas
  router.get("/kb/versions", async (_req, res) => {
    try {
      const metas = await listVersionMetas(storage());
      res.json({ versions: metas });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/admin/kb/cut — snapshot working copy into a new version
  // Body: { label: string, description: string, by?: "human"|"agent" }
  router.post("/kb/cut", async (req, res) => {
    const { label, description, by = "human" } = req.body as {
      label?: string;
      description?: string;
      by?: "human" | "agent";
    };
    if (!label?.trim() || !description?.trim()) {
      return res.status(400).json({ error: "label and description required" });
    }
    try {
      const s = storage();
      const realId = await nextRealId(s);

      // If a non-superseded version already carries this label, mark it superseded.
      const existing = await listVersionMetas(s);
      for (const m of existing) {
        if (m.label === label.trim() && !m.superseded) {
          m.superseded = true;
          await s.write(
            `knowledge/versions/${m.realId}/meta.json`,
            JSON.stringify(m, null, 2),
          );
        }
      }

      const meta: VersionMeta = {
        realId,
        label: label.trim(),
        description: description.trim(),
        by,
        at: new Date().toISOString(),
      };
      await cutVersionSnapshot(s, realId, meta);
      res.json({ ok: true, version: meta });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/admin/kb/versions/:realId/files — list files in a snapshot
  router.get("/kb/versions/:realId/files", async (req, res) => {
    try {
      const files = await listVersionFiles(storage(), req.params.realId);
      res.json({ files });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/admin/kb/versions/:realId/file?name=data-activation/patterns.md
  router.get("/kb/versions/:realId/file", async (req, res) => {
    const name = req.query.name as string;
    if (!name) return res.status(400).json({ error: "name required" });
    try {
      const content = await storage().read(`knowledge/versions/${req.params.realId}/${name}`);
      res.json({ name, content });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/admin/kb/versions/:realId/rollback — restore snapshot to working copy
  router.post("/kb/versions/:realId/rollback", async (req, res) => {
    try {
      await rollbackVersionSnapshot(storage(), req.params.realId, reloadKB);
      res.json({ ok: true, realId: req.params.realId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ── QA agent ──────────────────────────────────────────────────────────────

  // POST /api/admin/qa/propose
  // In:  { prompt, expected, ops, reasoning, kbFiles: [{path, content}] }
  // Out: { judgment, diagnosis, proposedFiles: [{path, content, original}] }
  router.post("/qa/propose", async (req, res) => {
    const { prompt, expected, ops, reasoning, kbFiles } = req.body as {
      prompt: string;
      expected: string;
      ops: unknown[];
      reasoning: unknown;
      kbFiles: Array<{ path: string; content: string }>;
    };
    if (!prompt || !expected) {
      return res.status(400).json({ error: "prompt and expected required" });
    }

    const llmModel = "claude-sonnet-4-6";

    const systemPrompt = `You are a KB quality engineer for the CoPPER AI planning assistant.

The assistant's behavior is driven by KB markdown files. When it produces wrong output, the KB contains text that taught it the wrong behavior. Your job: judge whether the actual output satisfies the expected output, and if not, diagnose the gap and propose the minimal KB fix.

RETURN ONLY VALID JSON — no prose outside the JSON object:
{
  "judgment": "pass" | "fail",
  "diagnosis": null | "which specific KB text caused the gap and why the proposed change fixes it",
  "proposedFiles": [
    {"path": "knowledge/data-activation/X.md", "content": "... FULL new file content ..."}
  ]
}

Rules:
- judgment "pass" if actual output clearly satisfies the expected output
- judgment "fail" if there is a clear behavioral gap (wrong entity types, missing entities, wrong fields, wrong activation pattern)
- If "fail": proposedFiles must include only files that need to change, with their FULL new content
- Keep changes minimal — do not rewrite sections that work
- If "pass": diagnosis must be null and proposedFiles must be []`;

    const userMessage = `TEST PROMPT:
${prompt}

EXPECTED OUTPUT:
${expected}

ACTUAL OPS:
${JSON.stringify(ops, null, 2)}

ACTUAL REASONING:
${JSON.stringify(reasoning, null, 2)}

CURRENT KB FILES:
${kbFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n")}`;

    try {
      const result = await routeLLM({ llmModel, systemPrompt, userMessage });
      const parsed = extractJSON(result.rawResponse) as {
        judgment?: string;
        diagnosis?: string | null;
        proposedFiles?: Array<{ path: string; content: string }>;
      };

      const judgment = (parsed.judgment === "pass" ? "pass" : "fail") as "pass" | "fail";
      const diagnosis = parsed.diagnosis ?? null;
      const proposedFiles = (parsed.proposedFiles ?? []).map((pf) => ({
        path: pf.path,
        content: pf.content,
        original: kbFiles.find((f) => f.path === pf.path)?.content ?? "",
      }));

      res.json({ judgment, diagnosis, proposedFiles });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
