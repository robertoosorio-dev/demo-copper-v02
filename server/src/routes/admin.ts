import { Router } from "express";
import { GCSStorageProvider } from "../storage/gcs.js";

export function makeAdminRouter(): Router {
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
  // Returns { folders: string[], files: string[] } — immediate children only
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
  // Write restricted to knowledge/ only — project_data is mutation-only via project store.
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
      res.json({ ok: true, path });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
