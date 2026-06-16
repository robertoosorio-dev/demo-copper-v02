import { Router } from "express";
import { GCSStorageProvider } from "../storage/gcs.js";
import type { ProjectStore } from "../store.js";
import type { Exchange, Intent, LibraryFile, ReasoningLogEntry, Version } from "@copper/contracts";
import { routeLLM } from "../llm/router.js";
import { buildSystemPrompt } from "../llm/systemPrompt.js";
import { applyOps } from "../llm/applyOps.js";
import { detectWizardIntent, getWizardShape } from "../wizardStandin.js";

const TEXT_TYPES = new Set(["md", "txt", "csv", "json"]);
const FILE_CONTENT_LIMIT = 4000;

let _storage: GCSStorageProvider | null = null;
function getStorage(): GCSStorageProvider | null {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) return null;
  if (!_storage) _storage = new GCSStorageProvider();
  return _storage;
}

async function buildLibrarySection(files: LibraryFile[]): Promise<string> {
  if (files.length === 0) return "";
  const store = getStorage();
  const parts: string[] = [];

  for (const f of files) {
    const ext = (f.type || f.name.split(".").pop() || "").toLowerCase();
    const meta = `**${f.name}** (${ext.toUpperCase()}, ${f.tier})`;

    if (!f.contentPath || !TEXT_TYPES.has(ext) || !store) {
      parts.push(`${meta}\n_Content not available as text — metadata only._`);
      continue;
    }

    try {
      const buf = await store.readBinary(f.contentPath);
      let text = buf.toString("utf-8");
      if (text.length > FILE_CONTENT_LIMIT) {
        text = text.slice(0, FILE_CONTENT_LIMIT) + "\n… [truncated]";
      }
      parts.push(`${meta}\n\`\`\`\n${text}\n\`\`\``);
    } catch {
      parts.push(`${meta}\n_Content could not be read._`);
    }
  }

  return parts.join("\n\n");
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

    const librarySection = await buildLibrarySection(libraryContext);
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
      const result = await routeLLM({ llmModel, systemPrompt, userMessage });

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
          libraryFiles: libraryContext.map((f) => ({ id: f.id, name: f.name, type: f.type, hasContent: !!f.contentPath })),
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
      console.log(`[chat] library ctx: ${libraryContext.map((f) => f.name).join(", ")}`);
    }
    console.log(
      `[chat] ✅ ${projectId} v${version.version}→v${newVersion.version} | ops:${ops.length} versioned:${versioned}`,
    );

    res.json({ exchange, version: versioned ? newVersion : null });
  });

  return router;
}
