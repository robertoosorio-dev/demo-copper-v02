import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";

const API = "";

// ── Shared types ──────────────────────────────────────────────────────────────

interface VersionMeta {
  realId: string;
  label: string;
  description: string;
  by: "human" | "agent";
  at: string;
  superseded?: boolean;
}

interface ProposedFile {
  path: string;
  content: string;
  original: string;
}

interface RunResult {
  ops: unknown[];
  reasoning: Record<string, unknown>;
  systemPromptLength: number;
}

interface JudgeResult {
  judgment: "pass" | "fail";
  diagnosis: string | null;
  proposedFiles: ProposedFile[];
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: { maxWidth: 960, margin: "0 auto", padding: "0 24px 40px", fontFamily: "system-ui, sans-serif", fontSize: 14, color: "#1a1a1a" } as React.CSSProperties,
  nav: { display: "flex", alignItems: "center", gap: 0, borderBottom: "1px solid #e0e0e0", marginBottom: 28, padding: "16px 0 0" } as React.CSSProperties,
  navTitle: { fontWeight: 700, fontSize: 16, marginRight: 24, color: "#333" } as React.CSSProperties,
  navTab: (active: boolean): React.CSSProperties => ({
    padding: "8px 16px", cursor: "pointer", border: "none", background: "none",
    borderBottom: active ? "2px solid #1a73e8" : "2px solid transparent",
    color: active ? "#1a73e8" : "#666", fontWeight: active ? 600 : 400, fontSize: 14,
    marginBottom: -1,
  }),
  label: { display: "block", fontWeight: 600, marginBottom: 4 } as React.CSSProperties,
  textarea: { width: "100%", boxSizing: "border-box" as const, fontFamily: "monospace", fontSize: 13, padding: 8, border: "1px solid #ccc", borderRadius: 4, resize: "vertical" as const },
  input: { width: "100%", boxSizing: "border-box" as const, fontSize: 13, padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4 } as React.CSSProperties,
  btn: (color: string, fg = "#fff"): React.CSSProperties => ({ background: color, color: fg, border: "none", borderRadius: 4, padding: "7px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13 }),
  btnSm: (color: string, fg = "#fff"): React.CSSProperties => ({ background: color, color: fg, border: "none", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontWeight: 600, fontSize: 12 }),
  btnGhost: { background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "7px 14px", cursor: "pointer", fontSize: 13 } as React.CSSProperties,
  badge: (pass: boolean): React.CSSProperties => ({
    background: pass ? "#e6f4ea" : "#fce8e6",
    color: pass ? "#137333" : "#c5221f",
    padding: "3px 10px", borderRadius: 99, fontWeight: 700, fontSize: 12, display: "inline-block",
  }),
  pre: { background: "#f8f8f8", padding: 12, borderRadius: 4, fontSize: 12, overflow: "auto" as const, maxHeight: 300, margin: 0 } as React.CSSProperties,
  diagBox: { background: "#fff8e1", border: "1px solid #f9a825", borderRadius: 6, padding: "12px 16px", marginBottom: 16 } as React.CSSProperties,
  row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const } as React.CSSProperties,
  mb16: { marginBottom: 16 } as React.CSSProperties,
  mb24: { marginBottom: 24 } as React.CSSProperties,
  chip: (color: string, fg: string): React.CSSProperties => ({ background: color, color: fg, padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }),
};

// ── Shared API helpers ────────────────────────────────────────────────────────

const EMPTY_VERSION = {
  id: "qa-test", name: "QA Test Project", version: 1,
  parentVersion: null, authoredBy: "system",
  createdAt: new Date().toISOString(),
  context: { contextFiles: [], exchanges: [] },
  plans: {
    data: { document: "", model: { entities: {}, connections: [] } },
    media: { document: "", model: { entities: {}, connections: [] } },
    creative: { document: "", model: null },
  },
};

async function fetchKBFiles(): Promise<Array<{ path: string; content: string }>> {
  const listRes = await fetch(`${API}/api/admin/list?prefix=knowledge/data-activation/`);
  if (!listRes.ok) throw new Error(`KB list failed: ${listRes.status}`);
  const { files } = await listRes.json();
  const results = await Promise.all(
    (files as string[]).filter((f: string) => f.endsWith(".md")).map(async (name: string) => {
      const path = `knowledge/data-activation/${name}`;
      const res = await fetch(`${API}/api/admin/file?path=${encodeURIComponent(path)}`);
      if (!res.ok) return null;
      const { content } = await res.json();
      return { path, content };
    }),
  );
  return results.filter(Boolean) as Array<{ path: string; content: string }>;
}

async function runSubmit(prompt: string, kbOverride?: Array<{ path: string; content: string }>): Promise<RunResult> {
  const body: Record<string, unknown> = { message: prompt, version: EMPTY_VERSION, exchanges: [] };
  if (kbOverride) body.kbOverride = kbOverride;
  const res = await fetch(`${API}/api/debug/project/qa-test/submit`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
  const data = await res.json();
  return { ops: data.ops ?? [], reasoning: data.rlogEntry?.reasoning ?? {}, systemPromptLength: data.diagnostics?.systemPromptLength ?? 0 };
}

async function runPropose(prompt: string, expected: string, run: RunResult, kbFiles: Array<{ path: string; content: string }>): Promise<JudgeResult> {
  const res = await fetch(`${API}/api/admin/qa/propose`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, expected, ops: run.ops, reasoning: run.reasoning, kbFiles }),
  });
  if (!res.ok) throw new Error(`Propose failed: ${res.status}`);
  return res.json();
}

// ── QA Agent view ─────────────────────────────────────────────────────────────

type QAPhase =
  | { tag: "idle" }
  | { tag: "running"; label: string }
  | { tag: "tested"; run: RunResult; judge: JudgeResult }
  | { tag: "dryrun"; run: RunResult; judge: JudgeResult; proposed: ProposedFile[] }
  | { tag: "approving"; proposed: ProposedFile[] }
  | { tag: "approved" }
  | { tag: "error"; message: string };

function RunPanel({ run, judge }: { run: RunResult; judge: JudgeResult }) {
  return (
    <div style={s.mb16}>
      <details style={{ marginBottom: 10 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Ops ({run.ops.length}) — sys prompt {run.systemPromptLength} chars</summary>
        <pre style={s.pre}>{JSON.stringify(run.ops, null, 2)}</pre>
      </details>
      <details>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Reasoning</summary>
        <pre style={s.pre}>{JSON.stringify(run.reasoning, null, 2)}</pre>
      </details>
      {judge.diagnosis && (
        <div style={{ ...s.diagBox, marginTop: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Diagnosis</div>
          <div style={{ lineHeight: 1.5 }}>{judge.diagnosis}</div>
        </div>
      )}
    </div>
  );
}

function FileDiff({ file }: { file: ProposedFile }) {
  return (
    <div style={s.mb24}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>📄 {file.path}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Current</div>
          <pre style={{ ...s.pre, background: "#fff5f5", border: "1px solid #fcc" }}>{file.original}</pre>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Proposed</div>
          <pre style={{ ...s.pre, background: "#f5fff5", border: "1px solid #cfc" }}>{file.content}</pre>
        </div>
      </div>
    </div>
  );
}

function QAView({ onSwitchToHistory }: { onSwitchToHistory: () => void }) {
  const [phase, setPhase] = useState<QAPhase>({ tag: "idle" });
  const [prompt, setPrompt] = useState("");
  const [expected, setExpected] = useState("");

  function reset() { setPhase({ tag: "idle" }); }

  async function handleRun() {
    setPhase({ tag: "running", label: "Running test and judging KB…" });
    try {
      const [run, kbFiles] = await Promise.all([runSubmit(prompt), fetchKBFiles()]);
      const judge = await runPropose(prompt, expected, run, kbFiles);
      setPhase({ tag: "tested", run, judge });
    } catch (err) { setPhase({ tag: "error", message: (err as Error).message }); }
  }

  async function handleDryRun(proposed: ProposedFile[]) {
    setPhase({ tag: "running", label: "Dry-run with proposed KB…" });
    try {
      const kbOverride = proposed.map((f) => ({ path: f.path, content: f.content }));
      const run = await runSubmit(prompt, kbOverride);
      const judge = await runPropose(prompt, expected, run, proposed);
      setPhase({ tag: "dryrun", run, judge, proposed });
    } catch (err) { setPhase({ tag: "error", message: (err as Error).message }); }
  }

  async function handleApprove(proposed: ProposedFile[]) {
    setPhase({ tag: "approving", proposed });
    try {
      for (const file of proposed) {
        const res = await fetch(`${API}/api/admin/file`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: file.path, content: file.content }),
        });
        if (!res.ok) throw new Error(`Write failed for ${file.path}: ${res.status}`);
      }
      setPhase({ tag: "approved" });
    } catch (err) { setPhase({ tag: "error", message: (err as Error).message }); }
  }

  return (
    <div>
      <p style={{ color: "#666", margin: "0 0 24px", lineHeight: 1.5 }}>
        Assert prompt behavior → auto-propose KB fix → dry-run → approve to working copy.<br />
        <span style={{ fontSize: 12 }}>Nothing writes until you approve. Then cut a version in <button onClick={onSwitchToHistory} style={{ background: "none", border: "none", color: "#1a73e8", cursor: "pointer", padding: 0, fontSize: 12, textDecoration: "underline" }}>KB History</button> when you're ready to snapshot.</span>
      </p>

      {phase.tag === "idle" && (
        <div>
          <div style={s.mb16}>
            <label style={s.label}>Test Prompt</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} style={s.textarea}
              placeholder="New project — add an Impression, activate by zip using a Products table, show recommendations" />
          </div>
          <div style={s.mb24}>
            <label style={s.label}>Expected Output (plain language)</label>
            <textarea value={expected} onChange={(e) => setExpected(e.target.value)} rows={3}
              style={{ ...s.textarea, fontFamily: "inherit" }}
              placeholder="Should produce: Impression entity, one Products table (sku/name/price/image), Filter or AlgoAI, Output entity" />
          </div>
          <button onClick={handleRun} disabled={!prompt.trim() || !expected.trim()} style={s.btn("#1a73e8")}>Run Test</button>
        </div>
      )}

      {(phase.tag === "running" || phase.tag === "approving") && (
        <div style={{ color: "#666", padding: "32px 0" }}>
          ⏳ {phase.tag === "running" ? phase.label : "Writing KB changes and reloading…"}
        </div>
      )}

      {phase.tag === "tested" && (
        <div>
          <div style={{ ...s.row, marginBottom: 20 }}>
            <span style={s.badge(phase.judge.judgment === "pass")}>{phase.judge.judgment === "pass" ? "✅ PASS" : "❌ FAIL"}</span>
            <span style={{ color: "#666" }}>{phase.run.ops.length} ops</span>
            <button onClick={reset} style={{ ...s.btnGhost, marginLeft: "auto" }}>Reset</button>
          </div>
          <RunPanel run={phase.run} judge={phase.judge} />
          {phase.judge.judgment === "pass" && <div style={{ color: "#137333", fontWeight: 600 }}>KB looks correct for this case.</div>}
          {phase.judge.judgment === "fail" && phase.judge.proposedFiles.length > 0 && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Proposed Changes</div>
              {phase.judge.proposedFiles.map((f, i) => <FileDiff key={i} file={f} />)}
              <div style={s.row}>
                <button onClick={() => handleDryRun(phase.judge.proposedFiles)} style={s.btn("#1a73e8")}>🔁 Dry-Run</button>
                <button onClick={() => handleApprove(phase.judge.proposedFiles)} style={s.btn("#137333")}>✅ Approve</button>
                <button onClick={reset} style={s.btnGhost}>Reject</button>
              </div>
            </>
          )}
          {phase.judge.judgment === "fail" && phase.judge.proposedFiles.length === 0 && (
            <div style={{ color: "#c5221f" }}>Failure flagged but no fix proposed. Review reasoning.<br /><button onClick={reset} style={{ ...s.btnGhost, marginTop: 12 }}>Reset</button></div>
          )}
        </div>
      )}

      {phase.tag === "dryrun" && (
        <div>
          <div style={{ ...s.row, marginBottom: 16 }}>
            <span style={s.chip("#e8f0fe", "#1a73e8")}>DRY RUN</span>
            <span style={s.badge(phase.judge.judgment === "pass")}>{phase.judge.judgment === "pass" ? "✅ PASS" : "❌ STILL FAILING"}</span>
            <span style={{ color: "#666" }}>{phase.run.ops.length} ops</span>
            <button onClick={reset} style={{ ...s.btnGhost, marginLeft: "auto" }}>Reset</button>
          </div>
          {phase.judge.judgment === "pass" && <div style={{ color: "#137333", fontWeight: 600, marginBottom: 16 }}>Fix verified — proposed KB produces correct output.</div>}
          {phase.judge.judgment === "fail" && phase.judge.diagnosis && <div style={{ ...s.diagBox }}><div style={{ fontWeight: 600, marginBottom: 4 }}>Still failing</div><div style={{ lineHeight: 1.5 }}>{phase.judge.diagnosis}</div></div>}
          <RunPanel run={phase.run} judge={phase.judge} />
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Files to be approved:</div>
          {phase.proposed.map((f, i) => <FileDiff key={i} file={f} />)}
          <div style={s.row}>
            <button onClick={() => handleApprove(phase.proposed)} style={s.btn(phase.judge.judgment === "pass" ? "#137333" : "#e65100")}>
              {phase.judge.judgment === "pass" ? "✅ Approve & Write KB" : "⚠️ Approve Anyway"}
            </button>
            <button onClick={reset} style={s.btnGhost}>Reject</button>
          </div>
        </div>
      )}

      {phase.tag === "approved" && (
        <div>
          <div style={{ color: "#137333", fontWeight: 600, marginBottom: 8 }}>✅ Working copy updated. Server KB reloaded.</div>
          <div style={{ ...s.row, gap: 12 }}>
            <button onClick={reset} style={s.btnGhost}>Run another test</button>
            <button onClick={onSwitchToHistory} style={s.btn("#1a73e8")}>→ Cut a Version</button>
          </div>
        </div>
      )}

      {phase.tag === "error" && (
        <div>
          <div style={{ color: "#c5221f", marginBottom: 12, fontFamily: "monospace", fontSize: 13 }}>{phase.message}</div>
          <button onClick={reset} style={s.btnGhost}>Reset</button>
        </div>
      )}
    </div>
  );
}

// ── KB History view ───────────────────────────────────────────────────────────

interface VersionTree {
  active: VersionMeta;
  branches: VersionMeta[];  // superseded versions with the same label
}

function buildTree(metas: VersionMeta[]): VersionTree[] {
  const supersededByLabel: Record<string, VersionMeta[]> = {};
  const active: VersionMeta[] = [];
  for (const m of metas) {
    if (m.superseded) {
      (supersededByLabel[m.label] ??= []).push(m);
    } else {
      active.push(m);
    }
  }
  active.sort((a, b) => b.realId.localeCompare(a.realId));
  return active.map((a) => ({
    active: a,
    branches: (supersededByLabel[a.label] ?? []).sort((x, y) => y.realId.localeCompare(x.realId)),
  }));
}

interface InspectTarget {
  label: string;   // display label e.g. "Working copy" or "v3"
  realId: string | null;  // null = working copy
}

function FileInspector({ target }: { target: InspectTarget }) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setFiles([]); setSelected(""); setContent(""); setErr(null);
    if (!target.realId) {
      // Working copy — list data-activation files
      fetch(`${API}/api/admin/list?prefix=knowledge/data-activation/`)
        .then((r) => r.json())
        .then((d) => setFiles((d.files as string[]).filter((f: string) => f.endsWith(".md")).map((f: string) => `data-activation/${f}`)))
        .catch((e) => setErr(e.message));
    } else {
      fetch(`${API}/api/admin/kb/versions/${target.realId}/files`)
        .then((r) => r.json())
        .then((d) => setFiles(d.files as string[]))
        .catch((e) => setErr(e.message));
    }
  }, [target.realId]);

  useEffect(() => {
    if (!selected) { setContent(""); return; }
    setLoading(true); setContent("");
    const url = target.realId
      ? `${API}/api/admin/kb/versions/${target.realId}/file?name=${encodeURIComponent(selected)}`
      : `${API}/api/admin/file?path=${encodeURIComponent(`knowledge/${selected}`)}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => { setContent(d.content ?? ""); setLoading(false); })
      .catch((e) => { setErr(e.message); setLoading(false); });
  }, [selected, target.realId]);

  return (
    <div style={{ background: "#f9f9f9", border: "1px solid #e0e0e0", borderRadius: 6, padding: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 10, color: "#555" }}>
        📂 {target.label}
      </div>
      {err && <div style={{ color: "#c5221f", fontSize: 12 }}>{err}</div>}
      {files.length > 0 && (
        <select value={selected} onChange={(e) => setSelected(e.target.value)}
          style={{ width: "100%", marginBottom: 10, padding: "5px 8px", fontSize: 13, border: "1px solid #ccc", borderRadius: 4 }}>
          <option value="">— select file —</option>
          {files.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      )}
      {loading && <div style={{ color: "#666", fontSize: 12 }}>Loading…</div>}
      {content && <pre style={{ ...s.pre, maxHeight: 420 }}>{content}</pre>}
    </div>
  );
}

function VersionRow({
  meta, onRollback, onInspect, isBranch = false,
}: {
  meta: VersionMeta;
  onRollback: (m: VersionMeta) => void;
  onInspect: (m: VersionMeta) => void;
  isBranch?: boolean;
}) {
  const date = new Date(meta.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
      background: isBranch ? "#fafafa" : "#fff",
      border: "1px solid #e8e8e8", borderRadius: 4, marginBottom: 4,
      opacity: isBranch ? 0.75 : 1,
    }}>
      <span style={{ fontWeight: 700, minWidth: 32, color: isBranch ? "#999" : "#1a1a1a" }}>
        {isBranch ? `↳` : `v${meta.label}`}
      </span>
      <span style={{ flex: 1, color: "#333" }}>{meta.description}</span>
      <span style={s.chip(meta.by === "agent" ? "#e8f0fe" : "#e6f4ea", meta.by === "agent" ? "#1a73e8" : "#137333")}>{meta.by}</span>
      <span style={{ color: "#999", fontSize: 12, minWidth: 80, textAlign: "right" }}>{date}</span>
      <button onClick={() => onInspect(meta)} style={s.btnSm("#f1f3f4", "#333")}>Inspect</button>
      <button onClick={() => onRollback(meta)} style={s.btnSm("#e65100")}>Rollback</button>
    </div>
  );
}

function HistoryView() {
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cutting, setCutting] = useState(false);
  const [cutLabel, setCutLabel] = useState("");
  const [cutDesc, setCutDesc] = useState("");
  const [cutBy, setCutBy] = useState<"human" | "agent">("human");
  const [cutting2, setCutting2] = useState(false);
  const [rollbackMsg, setRollbackMsg] = useState<string | null>(null);
  const [inspect, setInspect] = useState<InspectTarget>({ label: "Working copy", realId: null });

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`${API}/api/admin/kb/versions`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const { versions: v } = await res.json();
      setVersions(v);
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCut() {
    if (!cutLabel.trim() || !cutDesc.trim()) return;
    setCutting2(true);
    try {
      const res = await fetch(`${API}/api/admin/kb/cut`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: cutLabel.trim(), description: cutDesc.trim(), by: cutBy }),
      });
      if (!res.ok) throw new Error(`Cut failed: ${res.status}`);
      setCutLabel(""); setCutDesc(""); setCutBy("human"); setCutting(false);
      await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setCutting2(false); }
  }

  async function handleRollback(meta: VersionMeta) {
    setRollbackMsg(null);
    if (!confirm(`Roll back to v${meta.label} "${meta.description}"? Working copy will be overwritten and KB reloaded.`)) return;
    try {
      const res = await fetch(`${API}/api/admin/kb/versions/${meta.realId}/rollback`, { method: "POST" });
      if (!res.ok) throw new Error(`Rollback failed: ${res.status}`);
      setRollbackMsg(`✅ Rolled back to v${meta.label} — working copy restored and KB reloaded.`);
    } catch (e) { setErr((e as Error).message); }
  }

  const tree = buildTree(versions);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>
      {/* Left: version tree */}
      <div>
        <div style={{ ...s.row, marginBottom: 16 }}>
          <span style={{ fontWeight: 600 }}>KB Versions</span>
          <button onClick={() => setCutting(!cutting)} style={s.btn("#1a73e8")} >
            {cutting ? "Cancel" : "✂️ Cut Version"}
          </button>
          <button onClick={load} style={s.btnGhost}>↻</button>
        </div>

        {cutting && (
          <div style={{ background: "#f0f7ff", border: "1px solid #cce0ff", borderRadius: 6, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Snapshot working copy</div>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ ...s.label, fontSize: 12 }}>Label</label>
                <input value={cutLabel} onChange={(e) => setCutLabel(e.target.value)}
                  style={s.input} placeholder="5" />
              </div>
              <div>
                <label style={{ ...s.label, fontSize: 12 }}>Description</label>
                <input value={cutDesc} onChange={(e) => setCutDesc(e.target.value)}
                  style={s.input} placeholder="Fixed zip-lookup pattern in Filter" />
              </div>
            </div>
            <div style={{ ...s.row, marginBottom: 12 }}>
              <label style={{ fontSize: 13 }}>By:</label>
              {(["human", "agent"] as const).map((v) => (
                <label key={v} style={{ fontSize: 13, cursor: "pointer" }}>
                  <input type="radio" value={v} checked={cutBy === v} onChange={() => setCutBy(v)} style={{ marginRight: 4 }} />{v}
                </label>
              ))}
            </div>
            <button onClick={handleCut} disabled={!cutLabel.trim() || !cutDesc.trim() || cutting2}
              style={s.btn("#137333")}>
              {cutting2 ? "Snapshotting…" : "Cut Version"}
            </button>
          </div>
        )}

        {rollbackMsg && <div style={{ background: "#e6f4ea", border: "1px solid #cce8d4", borderRadius: 4, padding: "8px 12px", marginBottom: 12, fontSize: 13 }}>{rollbackMsg}</div>}
        {err && <div style={{ color: "#c5221f", marginBottom: 12, fontSize: 13 }}>{err}</div>}

        {/* Working copy row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#f0f7ff", border: "1px solid #cce0ff", borderRadius: 4, marginBottom: 8 }}>
          <span style={{ fontWeight: 700, minWidth: 32, color: "#1a73e8" }}>live</span>
          <span style={{ flex: 1, color: "#333" }}>Working copy</span>
          <span style={s.chip("#e8f0fe", "#1a73e8")}>editable</span>
          <button onClick={() => setInspect({ label: "Working copy", realId: null })} style={s.btnSm("#f1f3f4", "#333")}>Inspect</button>
        </div>

        {loading && <div style={{ color: "#666", padding: "16px 0" }}>Loading versions…</div>}

        {/* Version tree */}
        {tree.map(({ active, branches }) => (
          <div key={active.realId}>
            <VersionRow
              meta={active}
              onRollback={handleRollback}
              onInspect={(m) => setInspect({ label: `v${m.label} "${m.description}"`, realId: m.realId })}
            />
            {branches.length > 0 && (
              <details style={{ marginLeft: 28, marginBottom: 4 }}>
                <summary style={{ cursor: "pointer", fontSize: 12, color: "#999", padding: "2px 0" }}>
                  Unused Branch {active.label} ({branches.length})
                </summary>
                <div style={{ marginTop: 4 }}>
                  {branches.map((b) => (
                    <VersionRow key={b.realId} meta={b} isBranch
                      onRollback={handleRollback}
                      onInspect={(m) => setInspect({ label: `Unused Branch ${m.label} (${m.realId})`, realId: m.realId })}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}

        {!loading && versions.length === 0 && (
          <div style={{ color: "#999", fontSize: 13, padding: "16px 0" }}>No versions cut yet. Use "Cut Version" to snapshot the working copy.</div>
        )}
      </div>

      {/* Right: file inspector */}
      <div style={{ position: "sticky", top: 24 }}>
        <FileInspector target={inspect} />
      </div>
    </div>
  );
}

// ── App shell ─────────────────────────────────────────────────────────────────

type Tab = "qa" | "history";

function App() {
  const [tab, setTab] = useState<Tab>("qa");

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <span style={s.navTitle}>CoPPER Admin</span>
        <button style={s.navTab(tab === "qa")} onClick={() => setTab("qa")}>QA Agent</button>
        <button style={s.navTab(tab === "history")} onClick={() => setTab("history")}>KB History</button>
      </nav>
      {tab === "qa" && <QAView onSwitchToHistory={() => setTab("history")} />}
      {tab === "history" && <HistoryView />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
