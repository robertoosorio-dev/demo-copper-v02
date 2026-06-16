import { Router } from "express";
import { GCSStorageProvider } from "../storage/gcs.js";
import type { LibraryFile, LibraryData } from "@copper/contracts";

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  json: "application/json",
};

function mimeFor(ext: string): string {
  return MIME_MAP[ext.toLowerCase()] ?? "application/octet-stream";
}

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

  const metaPath = (id: string) => `project_data/${id}/library.json`;
  const contentPath = (id: string, fileId: string) => `project_data/${id}/library_content/${fileId}`;

  function parseLibraryData(raw: string): LibraryData {
    const parsed = JSON.parse(raw) as LibraryData | LibraryFile[];
    if (Array.isArray(parsed)) {
      // Legacy format: plain array — migrate
      return { files: parsed, folders: [] };
    }
    return { files: parsed.files ?? [], folders: parsed.folders ?? [] };
  }

  // GET /api/projects/:id/library
  r.get("/:id/library", async (req, res) => {
    try {
      let data: LibraryData = { files: [], folders: [] };
      try {
        const raw = await storage().read(metaPath(req.params.id));
        data = parseLibraryData(raw);
      } catch {
        // file doesn't exist yet → empty library
      }
      res.json(data);
    } catch (err) {
      console.error("[library] GET error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // PUT /api/projects/:id/library  { files: LibraryFile[], folders: string[] }
  r.put("/:id/library", async (req, res) => {
    try {
      const files = (req.body.files ?? []) as LibraryFile[];
      const folders = (req.body.folders ?? []) as string[];
      const data: LibraryData = { files, folders };
      await storage().write(metaPath(req.params.id), JSON.stringify(data, null, 2));
      res.json({ ok: true });
    } catch (err) {
      console.error("[library] PUT error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/projects/:id/library/upload
  // Body: { fileId: string, contentBase64: string, mimeType: string }
  r.post("/:id/library/upload", async (req, res) => {
    try {
      const { fileId, contentBase64, mimeType } = req.body as {
        fileId: string;
        contentBase64: string;
        mimeType: string;
      };
      if (!fileId || !contentBase64) {
        res.status(400).json({ error: "fileId and contentBase64 required" });
        return;
      }
      const buf = Buffer.from(contentBase64, "base64");
      const gcsPath = contentPath(req.params.id, fileId);
      await storage().writeBinary(gcsPath, buf, mimeType || "application/octet-stream");
      res.json({ ok: true, contentPath: gcsPath });
    } catch (err) {
      console.error("[library] upload error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/projects/:id/library/:fileId/content
  r.get("/:id/library/:fileId/content", async (req, res) => {
    try {
      const gcsPath = contentPath(req.params.id, req.params.fileId);
      const buf = await storage().readBinary(gcsPath);

      // Derive MIME from fileId extension (e.g. lib_xxx_report.pdf → pdf)
      const ext = req.params.fileId.split(".").pop() ?? "";
      res.setHeader("Content-Type", mimeFor(ext));
      res.setHeader("Content-Disposition", "inline");
      res.send(buf);
    } catch (err) {
      console.error("[library] content GET error:", err);
      res.status(404).json({ error: "Content not found" });
    }
  });

  return r;
}
