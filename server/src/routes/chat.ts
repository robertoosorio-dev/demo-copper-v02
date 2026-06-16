import { Router } from "express";
import { GCSStorageProvider } from "../storage/gcs.js";
import type { ProjectStore } from "../store.js";
import type { Exchange, Intent, LibraryFile, ReasoningLogEntry, Version } from "@copper/contracts";
import type { LibraryContentBlock } from "../llm/router.js";
import { routeLLM } from "../llm/router.js";
import { buildSystemPrompt } from "../llm/systemPrompt.js";
import { applyOps } from "../llm/applyOps.js";
import { detectWizardIntent, getWizardShape } from "../wizardStandin.js";

// MIME types supported as Claude document blocks
const CLAUDE_DOC_MIMES: Record<string, string> = {
  pdf:  "application/pdf",
  md:   "text/markdown",
  txt:  "text/plain",
  csv:  "text/csv",
  json: "text/plain",
  html: "text/html",
};

let _storage: GCSStorageProvider | null = null;
function getStorage(): GCSStorageProvider | null {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) return null;
  if (!_storage) _storage = new GCSStorageProvider();
  return _storage;
}

async function loadLibraryContent(files: LibraryFile[]): Promise<{ blocks: LibraryContentBlock[]; metadataOnly: LibraryFile[] }> {
  const store = getStorage();
  const blocks: LibraryContentBlock[] = [];
  const metadataOnly: LibraryFile[] = [];

  for (const f of files) {
    const ext = (f.type || f.name.split(".").pop() || "").toLowerCase();
    const mime = CLAUDE_DOC_MIMES[ext];

    if (!f.contentPath || !store) {
      metadataOnly.push(f);
      continue;
    }

    if (!mime) {
      // Binary type not supported as a document block — metadata only
      metadataOnly.push(f);
      continue;
    }

    try {
      const buf = await store.readBinary(f.contentPath);
      blocks.push({ name: f.name, mimeType: mime, base64: buf.toString("base64") });
    } catch {
      metadataOnly.push(f);
    }
  }

  return { blocks, metadataOnly };
}

export function makeChatRouter(store: ProjectStore, getKB: () => string = () => ""): Router {
  const router = Router();

  // POST /api/projects/:id/chat
  router.post("/:id/chat", async (req, res) => {
    const {
      message,
      llmModel = "claude-sonnet-4-6",
      exchanges = [],
      version: clientVersion,
      libraryContext = [],
    } = req.body as {
      message: string;
      llmModel?: string;
      exchanges?: Exchange[];
      version?: Version;
      libraryContext?: LibraryFile[];
    };

    if (!message?.trim()) return res.status(400).json({ error: "message required" });

    // Stand-in engine seam: return a wizard shape when intent is detected.
    // Replace this block with real LLM-driven wizard generation in M3.
    if (detectWizardIntent(message)) {
      const assistantExchange: Exchange = {
        id: `ex_a_${Date.now()}`,
        role: "assistant",
        text: "Let me walk you through this — here's the setup wizard.",
        status: "success",
        startedAt: new Date().toISOString(),
        responseTimeMs: 0,
        llmModel,
        planType: null,
      };
      return res.json({ exchange: assistantExchange, version: null, wizard: getWizardShape() });
    }

    const projectId = req.params.id;
    const version = clientVersion ?? await store.loadLatestVersion(projectId);
    if (!version) return res.status(404).json({ error: "Project not found" });

    // Load file content from GCS — supported types as document blocks, rest as metadata
    const { blocks: libraryContent, metadataOnly } = libraryContext.length
      ? await loadLibraryContent(libraryContext)
      : { blocks: [], metadataOnly: [] };

    // Metadata-only mention in system prompt (names of files whose content goes in blocks, plus unsupported binaries)
    const libMeta = [
      ...libraryContent.map((b) => `${b.name} [content attached]`),
      ...metadataOnly.map((f) => `${f.name} [binary — content not extractable as text]`),
    ];
    const librarySection = libMeta.length
      ? libMeta.map((l) => `- ${l}`).join("\n")
      : "";

    const systemPrompt = buildSystemPrompt(version, getKB(), librarySection);

    // Build user message with recent conversation context
    const historyLines = exchanges.slice(-6).map((e) =>
      `${e.role === "user" ? "User" : "Assistant"}: ${e.text}`,
    );
    const userMessage = historyLines.length
      ? `Previous conversation:\n${historyLines.join("\n")}\n\nNew request: ${message}`
      : message;

    let llmReply: string;
    let ops: Intent[];
    let reasoning: ReasoningLogEntry["reasoning"];
    let llmCard: { cardType: string; props: Record<string, unknown> } | null = null;
    const startedAt = new Date().toISOString();

    try {
      const result = await routeLLM({ llmModel, systemPrompt, userMessage, libraryContent });

      llmReply = result.reply ?? result.summary ?? "Done.";
      ops = ((result.ops ?? []) as Intent[]).filter(
        (o) => o && typeof o === "object" && "op" in o,
      );
      reasoning = result.reasoning ?? {
        problem: message,
        solution: llmReply,
        justification: "LLM did not provide structured reasoning.",
        alternativesConsidered: [],
      };
      llmCard = result.card ?? null;
    } catch (err) {
      console.error("[chat] LLM call failed:", (err as Error).message);
      return res.status(500).json({ error: `LLM error: ${(err as Error).message}` });
    }

    // Apply ops and produce a provisional new version (NOT saved — user must explicitly save).
    let newVersion = version;
    let versioned = false;
    if (ops.length > 0) {
      newVersion = applyOps(version, ops);
      newVersion = {
        ...newVersion,
        version: version.version + 1,
        parentVersion: version.version,
        authoredBy: "system",
        createdAt: new Date().toISOString(),
      };
      versioned = true;
    }

    // Journal reasoning entry
    const passId = `pass_${Date.now().toString(36)}`;
    const rlogEntry: ReasoningLogEntry = {
      id: `rlog_0000`,
      fromVersion: version.version,
      toVersion: newVersion.version,
      pass: passId,
      seq: 0,
      reasoning,
      producedChanges: [],
      contextSeen: {
        chat: {
          userMessage: message,
          history: exchanges.slice(-6).map((e) => ({ role: e.role, content: e.text })),
        },
        ...(libraryContext.length > 0 ? {
          libraryFiles: libraryContext.map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            asDocBlock: libraryContent.some((b) => b.name === f.name),
          })),
        } : {}),
      },
    };
    await store.appendReasoningEntry(projectId, newVersion.version, passId, rlogEntry);

    const responseTimeMs = Date.now() - new Date(startedAt).getTime();
    const exchange: Exchange = {
      id: `ex_a_${Date.now()}`,
      role: "assistant",
      text: llmReply,
      status: "success",
      startedAt,
      responseTimeMs,
      llmModel,
      planType: null,
      ...(llmCard ? { card: llmCard } : {}),
    };

    if (libraryContext.length > 0) {
      console.log(`[chat] library: ${libraryContent.length} doc blocks + ${metadataOnly.length} metadata-only`);
    }
    console.log(
      `[chat] ✅ ${projectId} v${version.version}→v${newVersion.version} | ops:${ops.length} versioned:${versioned}`,
    );

    res.json({ exchange, version: versioned ? newVersion : null });
  });

  return router;
}
