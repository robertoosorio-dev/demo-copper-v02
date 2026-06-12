import { Router } from "express";
import { GCSStorageProvider } from "../storage/gcs.js";
import { routeLLM } from "../llm/router.js";
import { extractJSON } from "../llm/utils.js";

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

  // GET /api/admin/list?prefix=knowledge/
  router.get("/list", async (req, res) => {
    const prefix = (req.query.prefix as string) ?? "";
    try {
      const s = storage();
      const [folders, files] = await Promise.all([
        s.listFolders(prefix),
        s.list(prefix),
      ]);
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
    try {
      await storage().write(path, content);
      await reloadKB();
      res.json({ ok: true, path });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/admin/kb/reload — force KB reload (convenience endpoint)
  router.post("/kb/reload", async (_req, res) => {
    try {
      await reloadKB();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/admin/qa/propose
  // In:  { prompt, expected, ops, reasoning, kbFiles: [{path, content}] }
  // Out: { judgment: "pass"|"fail", diagnosis: string|null,
  //        proposedFiles: [{path, content, original}] }
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
