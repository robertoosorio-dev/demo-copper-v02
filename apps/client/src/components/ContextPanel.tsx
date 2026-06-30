import React, { useRef, useEffect, useState } from "react";
import { useStore } from "../store.js";
import type { ActivePlan } from "../store.js";
import ProposalCard from "./ProposalCard.js";
import { CardPlayer } from "./cards/CardPlayer.js";
import { getLibrary, putLibrary, uploadLibraryContent } from "../api.js";
import { useDocumentHandlers } from "../hooks/useDocumentHandlers.js";
import { useAgentChat } from "../hooks/useAgentChat.js";
import { IconMessage, IconArrowUp, IconCloudUpload, IconPlus, IconX, IconArrowsMaximize, IconArrowsMinimize, IconMinus } from "@tabler/icons-react";
import type { PanelFocus } from "../store.js";
import type { Exchange, LibraryFile, ContextFile } from "@copper/contracts";
import LibraryShelf from "./library/LibraryShelf.js";
import LibraryTakeover from "./library/LibraryTakeover.js";
import { classifyFile, parseContextFile } from "../lib/parseContextFile.js";
import MediaPlanImportModal from "./mediaPlan/MediaPlanImportModal.js";


const LLM_MODELS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-8",   label: "Claude Opus 4.8"   },
  { id: "gpt-5.5",           label: "GPT-5.5"           },
  { id: "gemini-2.5-pro",    label: "Gemini 2.5 Pro"    },
];

const PLAN_LABELS: Record<ActivePlan, string> = {
  data: "Data", media: "Media", creative: "Creative",
};

// ── Menu items (data-driven, context-filtered) ────────────────────────────────

interface MenuItemDef {
  id: string;
  getLabel: (plan: ActivePlan) => string;
  visible: (plan: ActivePlan) => boolean;
  accept: string;
  multiple: boolean;
  route: "wizard" | "library" | "plan";
}

const MENU_ITEM_DEFS: MenuItemDef[] = [
  {
    id: "add-table",
    getLabel: () => "Add Table to Data-Model",
    visible: (p) => p === "data",
    accept: ".csv,.json,.xlsx,.xls",
    multiple: false,
    route: "wizard",
  },
  {
    id: "upload-plan",
    getLabel: (p) => `Upload a ${PLAN_LABELS[p]} Plan`,
    visible: () => true,
    accept: "*",
    multiple: false,
    route: "plan",
  },
  {
    id: "add-library",
    getLabel: () => "Add File(s) to Library",
    visible: () => true,
    accept: "*",
    multiple: true,
    route: "library",
  },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface Attachment {
  id: string;
  name: string;
  file?: File; // present for files dropped on chat; uploaded to library on submit
}


// ── Component ─────────────────────────────────────────────────────────────────

export default function ContextPanel({ style }: { style?: React.CSSProperties }) {
  const version            = useStore((s) => s.version);
  const rawExchanges       = useStore((s) => s.version?.context.exchanges) ?? [];
  const contextFiles       = useStore((s) => s.version?.context.contextFiles) ?? [];
  const activePlan         = useStore((s) => s.activePlan);
  const isLoading          = useStore((s) => s.isLoading);
  const llmModel           = useStore((s) => s.llmModel);
  const setLlmModel        = useStore((s) => s.setLlmModel);
  const setLoading         = useStore((s) => s.setLoading);
  const libraryFiles       = useStore((s) => s.libraryFiles);
  const libraryFolders     = useStore((s) => s.libraryFolders);
  const libraryOpen        = useStore((s) => s.libraryOpen);
  const setLibraryData     = useStore((s) => s.setLibraryData);
  const setLibraryOpen     = useStore((s) => s.setLibraryOpen);
  const addLibraryFile     = useStore((s) => s.addLibraryFile);
  const updateLibraryFile  = useStore((s) => s.updateLibraryFile);
  const panelFocus         = useStore((s) => s.panelFocus as PanelFocus);
  const setPanelFocus      = useStore((s) => s.setPanelFocus);

  const WELCOME_EXCHANGE: Exchange = {
    id: "welcome",
    role: "assistant",
    text: "Welcome! Let's build your campaign together.\n\nDrop any files you have — a campaign brief, media plan, product catalog, or audience list — and I'll analyze them and fill in the relevant sections automatically.\n\nOr just tell me about the campaign and we'll walk through it step by step.",
    status: "success",
    startedAt: new Date().toISOString(),
  };

  const exchanges = rawExchanges.length === 0 ? [WELCOME_EXCHANGE] : rawExchanges;

  const { launchWizard } = useDocumentHandlers();
  const { submit: agentSubmit } = useAgentChat();

  // Load library whenever the project changes
  useEffect(() => {
    if (!version?.id) return;
    getLibrary(version.id)
      .then((data) => setLibraryData(data))
      .catch(() => { /* no library yet is fine */ });
  }, [version?.id]);

  const [input, setInput]             = useState("");
  const [thinking, setThinking]       = useState(false);
  const [dragOver, setDragOver]       = useState(false);
  const [plusOpen, setPlusOpen]       = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Media plan import modal
  const [importModal, setImportModal] = useState<{ fileName: string; parsed: ContextFile } | null>(null);

  // Try to open the media plan import modal for Excel files; falls back to plain attachment
  async function tryOpenImportModal(file: File): Promise<boolean> {
    if (classifyFile(file.name) !== "spreadsheet") return false;
    try {
      const parsed = await parseContextFile(file);
      if (parsed.sheets && parsed.sheets.length > 0) {
        setImportModal({ fileName: file.name, parsed });
        return true;
      }
    } catch { /* fall through */ }
    return false;
  }

  const textareaRef        = useRef<HTMLTextAreaElement>(null);
  const fileInputRef       = useRef<HTMLInputElement>(null);
  const pendingFileHandler = useRef<((files: File[]) => void) | null>(null);
  const composerRef        = useRef<HTMLDivElement>(null);
  const bottomRef          = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [exchanges.length, thinking]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Close [+] menu on outside click
  useEffect(() => {
    if (!plusOpen) return;
    const h = (e: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        setPlusOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [plusOpen]);

  // ── Shared destination handlers ───────────────────────────────────────────

  // Library takeover "Add" button → immediately add to library + upload content
  function handleAddFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const cls = classifyFile(file.name);
    if (cls === "spreadsheet") {
      setLibraryOpen(false);
      void tryOpenImportModal(file).then((opened) => {
        if (!opened) launchWizard(file);
      });
      return;
    }
    if (cls === "table") {
      setLibraryOpen(false);
      void launchWizard(file);
      return;
    }
    const libFile: LibraryFile = {
      id: `lib_${Date.now()}_${file.name}`,
      name: file.name,
      type: ext,
      tier: "local",
      folderPath: "",
      updatedAt: new Date().toISOString(),
      size: file.size,
      selectedForContext: true,
    };
    addLibraryFile(libFile);
    const merged = [...libraryFiles, libFile];
    if (version?.id) {
      void putLibrary(version.id, { files: merged, folders: libraryFolders });
      void uploadLibraryContent(version.id, libFile.id, file).then(({ contentPath }) => {
        updateLibraryFile(libFile.id, { contentPath });
        void putLibrary(version.id!, {
          files: merged.map((f) => f.id === libFile.id ? { ...f, contentPath } : f),
          folders: libraryFolders,
        });
      });
    }
  }

  // ── File picker (for [+] menu) ────────────────────────────────────────────

  function pickFile(accept: string, multiple: boolean, handler: (files: File[]) => void) {
    const el = fileInputRef.current;
    if (!el) return;
    el.accept = accept;
    el.multiple = multiple;
    el.value = "";
    pendingFileHandler.current = handler;
    el.click();
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0 && pendingFileHandler.current) {
      pendingFileHandler.current(files);
    }
    pendingFileHandler.current = null;
  }

  // ── [+] Menu activation ───────────────────────────────────────────────────

  function activateMenuItem(def: MenuItemDef) {
    setPlusOpen(false);
    pickFile(def.accept, def.multiple, (files) => {
      if (def.route === "wizard") {
        if (files[0]) void launchWizard(files[0]);
      } else {
        // library and plan both park to Library (plan stub = same destination)
        setAttachments((prev) => [...prev, ...files.map((f) => ({ id: `lib_${Date.now()}_${f.name}`, name: f.name, file: f }))]);
      }
    });
  }

  const visibleItems = MENU_ITEM_DEFS.filter((d) => d.visible(activePlan));

  // ── Chat submit ───────────────────────────────────────────────────────────

  async function doSubmit() {
    const text = input.trim();
    const pendingAttachments = [...attachments];
    if ((!text && pendingAttachments.length === 0) || isLoading || thinking || !version) return;
    setInput("");
    setAttachments([]);
    setThinking(true);
    try {
      await agentSubmit(
        text,
        pendingAttachments
          .filter((a) => !!a.file)
          .map((a) => ({ id: a.id, name: a.name, file: a.file! })),
      );
    } finally {
      setThinking(false);
    }
  }

  // ── Drop handlers ────────────────────────────────────────────────────────

  function handleDragEnter(e: React.DragEvent) { e.preventDefault(); setDragOver(true); }
  function handleDragLeave(e: React.DragEvent) {
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const nonSpreadsheets: File[] = [];
    const spreadsheets: File[] = [];
    for (const f of files) {
      if (classifyFile(f.name) === "spreadsheet") spreadsheets.push(f);
      else nonSpreadsheets.push(f);
    }

    // Non-spreadsheet files → regular attachment flow
    if (nonSpreadsheets.length > 0) {
      setAttachments((prev) => [
        ...prev,
        ...nonSpreadsheets.map((f) => ({ id: `lib_${Date.now()}_${f.name}`, name: f.name, file: f })),
      ]);
    }

    // Spreadsheet → try import modal (first one only; unusual to drop multiple xlsx)
    if (spreadsheets.length > 0) {
      void tryOpenImportModal(spreadsheets[0]).then((opened) => {
        if (!opened) {
          // Fallback: treat as regular attachment
          setAttachments((prev) => [
            ...prev,
            ...spreadsheets.map((f) => ({ id: `lib_${Date.now()}_${f.name}`, name: f.name, file: f })),
          ]);
        }
      });
    }
  }

  const canSubmit = (!!input.trim() || attachments.length > 0) && !isLoading && !thinking && !!version;

  async function handleImportAnalyze(message: string) {
    setThinking(true);
    try {
      await agentSubmit(message, []);
    } finally {
      setThinking(false);
    }
  }

  return (
    <>
      {importModal && (
        <MediaPlanImportModal
          fileName={importModal.fileName}
          parsed={importModal.parsed}
          onClose={() => setImportModal(null)}
          onAnalyze={(msg) => void handleImportAnalyze(msg)}
        />
      )}
    <div
      className={`context-panel${dragOver ? " context-panel--drag" : ""}`}
      style={style}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {dragOver && (
        <div className="drop-overlay">
          <IconCloudUpload size={28} />
          <span className="drop-overlay-label">Drop to analyze</span>
          <span className="drop-overlay-sub">Agent will identify the file and help you use it</span>
        </div>
      )}

      {/* Library mode: full takeover of the context column */}
      {libraryOpen ? (
        <LibraryTakeover onAddFile={handleAddFile} />
      ) : (
        <>
          {/* Library shelf — pinned above conversation */}
          <LibraryShelf />

          {/* Header */}
          <div className="cp-header">
            <IconMessage size={13} style={{ color: "var(--blue-txt)", flexShrink: 0 }} />
            <span>Context</span>
            {contextFiles.length > 0 && (
              <span className="cp-file-count">
                {contextFiles.length} file{contextFiles.length !== 1 ? "s" : ""}
              </span>
            )}
            <div className="panel-max-btns">
              {panelFocus === "context" ? (
                <button className="panel-max-btn panel-max-btn--active" onClick={() => setPanelFocus("none")} title="Restore">
                  <IconArrowsMinimize size={13} />
                </button>
              ) : (
                <>
                  <button className="panel-max-btn" onClick={() => setPanelFocus("context-min")} title="Minimize">
                    <IconMinus size={11} />
                  </button>
                  <button className="panel-max-btn" onClick={() => setPanelFocus("context")} title="Maximize">
                    <IconArrowsMaximize size={11} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Persistent context files */}
          {contextFiles.length > 0 && (
            <div className="cp-files">
              {contextFiles.map((f) => (
                <div key={f.name} className="cp-file-chip">{f.name}</div>
              ))}
            </div>
          )}

          {/* Exchange thread */}
          <div className="cp-exchanges">
            {exchanges.map((ex) => (
              <ExchangeBubble key={ex.id} exchange={ex} />
            ))}
            {thinking && (
              <div className="exchange exchange--assistant">
                <div className="ex-assistant-msg">
                  <div className="ex-text cp-thinking">Thinking…</div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="cp-composer-wrap">
            <div className="cp-composer" ref={composerRef}>
              {plusOpen && (
                <div className="cp-plus-menu">
                  {visibleItems.map((def) => (
                    <button
                      key={def.id}
                      className="cp-plus-menu-item"
                      onClick={() => activateMenuItem(def)}
                    >
                      {def.getLabel(activePlan)}
                    </button>
                  ))}
                </div>
              )}
              {attachments.length > 0 && (
                <div className="cp-attachments">
                  {attachments.map((a) => (
                    <div key={a.id} className="cp-attach-chip">
                      <span className="cp-attach-name">{a.name}</span>
                      <button
                        className="cp-attach-remove"
                        onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                      >
                        <IconX size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                className="cp-textarea-grow"
                placeholder={`Message ${PLAN_LABELS[activePlan]} plan…`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void doSubmit();
                  }
                }}
                disabled={isLoading || thinking || !version}
                rows={1}
              />
              <div className="cp-composer-toolbar">
                <button
                  className="cp-plus-btn"
                  type="button"
                  title="Add file or table"
                  onClick={() => setPlusOpen((v) => !v)}
                >
                  <IconPlus size={13} />
                </button>
                <select
                  className="sel cp-model-sel"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                >
                  {LLM_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <button
                  className="cp-send-btn-new"
                  type="button"
                  title="Send"
                  disabled={!canSubmit}
                  onClick={() => void doSubmit()}
                >
                  <IconArrowUp size={14} />
                </button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              onChange={handleFileInputChange}
            />
          </div>
        </>
      )}
    </div>
    </>
  );
}

function ExchangeBubble({ exchange }: { exchange: Exchange }) {
  const isUser = exchange.role === "user";
  return (
    <div className={`exchange exchange--${exchange.role}`}>
      {isUser ? (
        <div className="ex-user-msg">
          {exchange.attachmentNames && exchange.attachmentNames.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
              {exchange.attachmentNames.map((name) => (
                <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", background: "rgba(37,99,235,0.1)", borderRadius: 4, fontSize: 11, color: "#2563EB", fontWeight: 500 }}>
                  📎 {name}
                </span>
              ))}
            </div>
          )}
          {exchange.text}
        </div>
      ) : (
        <div className="ex-assistant-msg">
          <div className="ex-text">{exchange.text}</div>
          {exchange.card && <CardPlayer card={exchange.card} />}
          {exchange.proposal && <ProposalCard proposal={exchange.proposal} />}
          {exchange.llmModel && (
            <div className="ex-meta">{exchange.llmModel} · {exchange.responseTimeMs}ms</div>
          )}
        </div>
      )}
    </div>
  );
}
