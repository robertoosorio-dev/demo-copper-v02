import React, { useRef, useState, useEffect } from "react";
import {
  IconMessage,
  IconChevronLeft,
  IconChevronRight,
  IconArrowUp,
  IconCloudUpload,
  IconPlus,
  IconX,
  IconFile,
  IconSparkles,
} from "@tabler/icons-react";
import { useStore } from "../../store.js";
import { extractBrand } from "../../api.js";
import type { ExtractedField } from "../../api.js";
import type { BrandSource } from "@copper/contracts";

const LLM_MODELS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-8",   label: "Claude Opus 4.8"   },
  { id: "gpt-5.5",           label: "GPT-5.5"           },
  { id: "gemini-2.5-pro",    label: "Gemini 2.5 Pro"    },
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  extractedCount?: number;
}

interface Attachment {
  id: string;
  name: string;
  file: File;
}

export default function BrandAgentPanel({
  brandId,
  onFieldsExtracted,
  onSourceAdded,
}: {
  brandId: string;
  onFieldsExtracted: (fields: Record<string, ExtractedField>) => void;
  onSourceAdded?: (source: BrandSource) => void;
}) {
  const agentOpen    = useStore((s) => s.agentOpen);
  const setAgentOpen = useStore((s) => s.setAgentOpen);
  const llmModel     = useStore((s) => s.llmModel);
  const setLlmModel  = useStore((s) => s.setLlmModel);

  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [input, setInput]             = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [thinking, setThinking]       = useState(false);
  const [dragOver, setDragOver]       = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, thinking]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  function addFiles(files: File[]) {
    setAttachments((prev) => [
      ...prev,
      ...files.map((f) => ({ id: `att_${Date.now()}_${f.name}`, name: f.name, file: f })),
    ]);
  }

  async function doSubmit() {
    const text = input.trim();
    if ((!text && attachments.length === 0) || thinking) return;

    const pendingFiles = [...attachments];
    setInput("");
    setAttachments([]);

    const userLabel = [
      text,
      ...pendingFiles.map((a) => `📎 ${a.name}`),
    ].filter(Boolean).join("\n");

    setMessages((prev) => [...prev, {
      id: `u_${Date.now()}`,
      role: "user",
      text: userLabel,
    }]);
    setThinking(true);

    try {
      // If multiple files, run them one by one; collect all fields
      const allFields: Record<string, ExtractedField> = {};
      let lastMessage = "";

      const filesToProcess = pendingFiles.length > 0 ? pendingFiles : [null];
      for (const att of filesToProcess) {
        const result = await extractBrand(brandId, {
          message: text,
          file: att?.file,
          llmModel,
        });
        Object.assign(allFields, result.fields);
        lastMessage = result.message;

        // Record the file as a source
        if (att && onSourceAdded) {
          onSourceAdded({
            id: att.id,
            name: att.name,
            type: "file",
            addedAt: new Date().toISOString(),
          });
        }
      }

      const count = Object.keys(allFields).length;
      setMessages((prev) => [...prev, {
        id: `a_${Date.now()}`,
        role: "assistant",
        text: lastMessage,
        extractedCount: count,
      }]);

      if (count > 0) {
        onFieldsExtracted(allFields);
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: `err_${Date.now()}`,
        role: "assistant",
        text: `Error: ${(err as Error).message}`,
      }]);
    } finally {
      setThinking(false);
    }
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────

  function handleDragEnter(e: React.DragEvent) { e.preventDefault(); setDragOver(true); }
  function handleDragLeave(e: React.DragEvent) {
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  }

  // ── Collapsed state ───────────────────────────────────────────────────────

  if (!agentOpen) {
    return (
      <div className="syn-agent collapsed" onClick={() => setAgentOpen(true)}>
        <div className="syn-agent-rail">
          <IconMessage size={18} color="#64748B" />
          <IconChevronLeft size={14} color="#94A3B8" />
          <span className="syn-agent-rail-label">Agent</span>
        </div>
      </div>
    );
  }

  const canSubmit = (!!input.trim() || attachments.length > 0) && !thinking;

  return (
    <div
      className="syn-agent"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ position: "relative" }}
    >
      {/* Drop overlay */}
      {dragOver && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#eff6ff",
            border: "2px dashed #2563EB",
            borderRadius: 8,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: "#2563EB",
          }}
        >
          <IconCloudUpload size={28} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Drop to extract brand fields</span>
          <span style={{ fontSize: 11, color: "#64748b" }}>PDF, DOCX, MD supported</span>
        </div>
      )}

      {/* Header */}
      <div className="syn-agent-header">
        <span className="syn-agent-title">Agent</span>
        <button
          className="syn-agent-collapse-btn"
          onClick={() => setAgentOpen(false)}
          title="Collapse agent panel"
        >
          <IconChevronRight size={16} />
        </button>
      </div>

      {/* Empty state hint */}
      {messages.length === 0 && !thinking && (
        <div
          style={{
            padding: "24px 16px",
            textAlign: "center",
            color: "#94a3b8",
            flex: 1,
          }}
        >
          <IconSparkles size={28} color="#9747FF" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
            Drop brand guidelines here
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            Upload a PDF, Word doc, or paste a URL and the agent will extract brand fields automatically.
          </div>
        </div>
      )}

      {/* Message thread */}
      {messages.length > 0 && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 12px 0",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                gap: 4,
              }}
            >
              <div
                style={{
                  maxWidth: "90%",
                  padding: "8px 12px",
                  borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  background: msg.role === "user" ? "#2563EB" : "#f1f5f9",
                  color: msg.role === "user" ? "#fff" : "#1e293b",
                  fontSize: 12,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.text}
              </div>
              {msg.extractedCount !== undefined && msg.extractedCount > 0 && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#9747FF",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    background: "#9747FF1a",
                    borderRadius: 4,
                  }}
                >
                  <IconSparkles size={10} />
                  {msg.extractedCount} field{msg.extractedCount !== 1 ? "s" : ""} extracted — review in the form
                </div>
              )}
            </div>
          ))}
          {thinking && (
            <div style={{ fontSize: 12, color: "#94a3b8", padding: "8px 0" }}>
              Analyzing…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Composer */}
      <div style={{ padding: "8px 10px 10px", borderTop: "1px solid #f1f5f9", flexShrink: 0 }}>
        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {attachments.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  background: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  borderRadius: 4,
                  padding: "3px 8px",
                  color: "#475569",
                }}
              >
                <IconFile size={11} />
                {a.name}
                <button
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#94a3b8", display: "flex" }}
                >
                  <IconX size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "8px 10px",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void doSubmit();
              }
            }}
            placeholder="Ask about brand guidelines or describe what to extract…"
            rows={1}
            disabled={thinking}
            style={{
              width: "100%",
              fontSize: 12,
              border: "none",
              background: "transparent",
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
              color: "#1e293b",
              display: "block",
              boxSizing: "border-box",
              marginBottom: 6,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#64748b",
                display: "flex",
                alignItems: "center",
                padding: 2,
                borderRadius: 4,
              }}
            >
              <IconPlus size={14} />
            </button>
            <select
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              style={{
                flex: 1,
                fontSize: 11,
                border: "none",
                background: "transparent",
                color: "#94a3b8",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {LLM_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <button
              onClick={() => void doSubmit()}
              disabled={!canSubmit}
              style={{
                background: canSubmit ? "#2563EB" : "#e2e8f0",
                border: "none",
                borderRadius: 6,
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: canSubmit ? "pointer" : "default",
                color: canSubmit ? "#fff" : "#94a3b8",
                flexShrink: 0,
              }}
            >
              <IconArrowUp size={14} />
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.md,.txt,.html"
          style={{ display: "none" }}
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
