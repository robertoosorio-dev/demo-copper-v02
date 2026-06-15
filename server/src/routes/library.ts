import { Router } from "express";
import { GCSStorageProvider } from "../storage/gcs.js";
import type { LibraryFile } from "@copper/contracts";

export function makeLibraryRouter(): Router {
  const r = Router();

  let _storage: GCSStorageProvider | null = null;
  function storage(): GCSStorageProvider {
    if (!_storage) {
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) {
        throw new Error("GCS not configured — library API unavailable");
      }
      _storage = new GCSStorageProvider();
    }
    return _storage;
  }

  const libPath = (id: string) => `project_data/${id}/library.json`;

  // GET /api/projects/:id/library
  r.get("/:id/library", async (req, res) => {
    try {
      let files: LibraryFile[] = [];
      try {
        const raw = await storage().read(libPath(req.params.id));
        files = JSON.parse(raw) as LibraryFile[];
      } catch {
        // file doesn't exist yet → empty library
      }
      res.json({ files });
    } catch (err) {
      console.error("[library] GET error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // PUT /api/projects/:id/library  { files: LibraryFile[] }
  r.put("/:id/library", async (req, res) => {
    try {
      const files = (req.body.files ?? []) as LibraryFile[];
      await storage().write(libPath(req.params.id), JSON.stringify(files, null, 2));
      res.json({ ok: true });
    } catch (err) {
      console.error("[library] PUT error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  return r;
}
