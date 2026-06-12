import React, { useState } from "react";
import ReactDOM from "react-dom/client";

// Vite dev server proxies /api → http://localhost:3001
const API = "";

const EMPTY_VERSION = {
  id: "qa-test",
  name: "QA Test Project",
  version: 1,
  parentVersion: null,
  authoredBy: "system",
  createdAt: new Date().toISOString(),
  context: { contextFiles: [], exchanges: [] },
  plans: {
    data: { document: "", model: { entities: {}, connections: [] } },
    media: { document: "", model: { entities: {}, connections: [] } },
    creative: { document: "", model: null },
  },
};

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

type Phase =
  | { tag: "idle" }
  | { tag: "running"; label: string }
  | { tag: "tested"; run: RunResult; judge: JudgeResult }
  | { tag: "dryrun"; run: RunResult; judge: JudgeResult; proposed: ProposedFile[] }
  | { tag: "approving"; proposed: ProposedFile[] }
  | { tag: "approved" }
  | { tag: "error"; message: string };

async function fetchKBFiles(): Promise<Array<{ path: string; content: string }>> {
  const listRes = await fetch(`${API}/api/admin/list?prefix=knowledge/data-activation/`);
  if (!listRes.ok) throw new Error(`KB list failed: ${listRes.status}`);
  const { files } = await listRes.json();

  const results = await Promise.all(
    (files as string[])
      .filter((f: string) => f.endsWith(".md"))
      .map(async (name: string) => {
        const path = `knowledge/data-activation/${name}`;
        const res = await fetch(`${API}/api/admin/file?path=${encodeURIComponent(path)}`);
        if (!res.ok) return null;
        const { content } = await res.json();
        return { path, content };
      }),
  );
  return results.filter(Boolean) as Array<{ path: string; content: string }>;
}

async function runSubmit(
  prompt: string,
  kbOverride?: Array<{ path: string; content: string }>,
): Promise<RunResult> {
  const body: Record<string, unknown> = {
    message: prompt,
    version: EMPTY_VERSION,
    exchanges: [],
  };
  if (kbOverride) body.kbOverride = kbOverride;

  const res = await fetch(`${API}/api/debug/project/qa-test/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
  const data = await res.json();
  return {
    ops: data.ops ?? [],
    reasoning: data.rlogEntry?.reasoning ?? {},
    systemPromptLength: data.diagnostics?.systemPromptLength ?? 0,
  };
}

async function runPropose(
  prompt: string,
  expected: string,
  run: RunResult,
  kbFiles: Array<{ path: string; content: string }>,
): Promise<JudgeResult> {
  const res = await fetch(`${API}/api/admin/qa/propose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      expected,
      ops: run.ops,
      reasoning: run.reasoning,
      kbFiles,
    }),
  });
  if (!res.ok) throw new Error(`Propose failed: ${res.status}`);
  return res.json();
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: { maxWidth: 920, margin: "0 auto", padding: "32px 24px", fontFamily: "system-ui, sans-serif", fontSize: 14, color: "#1a1a1a" } as React.CSSProperties,
  h1: { margin: "0 0 4px", fontSize: 20, fontWeight: 700 } as React.CSSProperties,
  sub: { color: "#666", margin: "0 0 32px", lineHeight: 1.4 } as React.CSSProperties,
  label: { display: "block", fontWeight: 600, marginBottom: 4 } as React.CSSProperties,
  textarea: { width: "100%", boxSizing: "border-box" as const, fontFamily: "monospace", fontSize: 13, padding: 8, border: "1px solid #ccc", borderRadius: 4, resize: "vertical" as const },
  btn: (color: string, fg = "#fff"): React.CSSProperties => ({ background: color, color: fg, border: "none", borderRadius: 4, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }),
  btnGhost: { background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "8px 16px", cursor: "pointer", fontSize: 13 } as React.CSSProperties,
  badge: (pass: boolean): React.CSSProperties => ({
    background: pass ? "#e6f4ea" : "#fce8e6",
    color: pass ? "#137333" : "#c5221f",
    padding: "4px 12px", borderRadius: 99, fontWeight: 700, fontSize: 13, display: "inline-block",
  }),
  pre: { background: "#f8f8f8", padding: 12, borderRadius: 4, fontSize: 12, overflow: "auto" as const, maxHeight: 260, margin: 0 } as React.CSSProperties,
  diagBox: { background: "#fff8e1", border: "1px solid #f9a825", borderRadius: 6, padding: "12px 16px", marginBottom: 20 } as React.CSSProperties,
  row: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" as const } as React.CSSProperties,
  section: { marginBottom: 20 } as React.CSSProperties,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner({ label }: { label: string }) {
  return <div style={{ color: "#666", padding: "40px 0" }}>⏳ {label}</div>;
}

function RunPanel({ run, judge }: { run: RunResult; judge: JudgeResult }) {
  return (
    <div style={s.section}>
      <details style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          Ops ({run.ops.length}) — sys prompt {run.systemPromptLength} chars
        </summary>
        <pre style={s.pre}>{JSON.stringify(run.ops, null, 2)}</pre>
      </details>
      <details>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Reasoning</summary>
        <pre style={s.pre}>{JSON.stringify(run.reasoning, null, 2)}</pre>
      </details>
      {judge.diagnosis && (
        <div style={{ ...s.diagBox, marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Diagnosis</div>
          <div style={{ lineHeight: 1.5 }}>{judge.diagnosis}</div>
        </div>
      )}
    </div>
  );
}

function FileDiff({ file }: { file: ProposedFile }) {
  return (
    <div style={{ marginBottom: 24 }}>
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

// ── Main App ──────────────────────────────────────────────────────────────────

function App() {
  const [phase, setPhase] = useState<Phase>({ tag: "idle" });
  const [prompt, setPrompt] = useState("");
  const [expected, setExpected] = useState("");

  function reset() {
    setPhase({ tag: "idle" });
  }

  async function handleRun() {
    setPhase({ tag: "running", label: "Running test and judging KB…" });
    try {
      const [run, kbFiles] = await Promise.all([
        runSubmit(prompt),
        fetchKBFiles(),
      ]);
      const judge = await runPropose(prompt, expected, run, kbFiles);
      setPhase({ tag: "tested", run, judge });
    } catch (err) {
      setPhase({ tag: "error", message: (err as Error).message });
    }
  }

  async function handleDryRun(proposed: ProposedFile[], prevRun: RunResult, prevJudge: JudgeResult) {
    setPhase({ tag: "running", label: "Dry-run with proposed KB…" });
    try {
      const kbOverride = proposed.map((f) => ({ path: f.path, content: f.content }));
      const run = await runSubmit(prompt, kbOverride);
      const judge = await runPropose(prompt, expected, run, proposed);
      setPhase({ tag: "dryrun", run, judge, proposed });
    } catch (err) {
      setPhase({ tag: "error", message: (err as Error).message });
    }
  }

  async function handleApprove(proposed: ProposedFile[]) {
    setPhase({ tag: "approving", proposed });
    try {
      for (const file of proposed) {
        const res = await fetch(`${API}/api/admin/file`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: file.path, content: file.content }),
        });
        if (!res.ok) throw new Error(`Write failed for ${file.path}: ${res.status}`);
      }
      setPhase({ tag: "approved" });
    } catch (err) {
      setPhase({ tag: "error", message: (err as Error).message });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <h1 style={s.h1}>CoPPER Admin — KB QA Agent</h1>
      <p style={s.sub}>
        Assert prompt behavior → auto-propose KB fix → dry-run → approve
        <br />
        <span style={{ fontSize: 12 }}>
          The agent proposes; you dispose. Nothing writes until you approve.
        </span>
      </p>

      {/* ── IDLE: input form ── */}
      {phase.tag === "idle" && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={s.label}>Test Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              style={s.textarea}
              placeholder="New project — add an Impression, activate by zip using a Products table, show recommendations"
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={s.label}>Expected Output (plain language)</label>
            <textarea
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              rows={3}
              style={{ ...s.textarea, fontFamily: "inherit" }}
              placeholder="Should produce: Impression entity, one Products table (sku/name/price/image), Filter or AlgoAI, Output entity"
            />
          </div>
          <button
            onClick={handleRun}
            disabled={!prompt.trim() || !expected.trim()}
            style={s.btn("#1a73e8")}
          >
            Run Test
          </button>
        </div>
      )}

      {/* ── LOADING ── */}
      {phase.tag === "running" && <Spinner label={phase.label} />}
      {phase.tag === "approving" && <Spinner label="Writing KB changes and reloading…" />}

      {/* ── TESTED: first run result ── */}
      {phase.tag === "tested" && (
        <div>
          <div style={{ ...s.row, marginBottom: 20 }}>
            <span style={s.badge(phase.judge.judgment === "pass")}>
              {phase.judge.judgment === "pass" ? "✅ PASS" : "❌ FAIL"}
            </span>
            <span style={{ color: "#666" }}>
              {phase.run.ops.length} ops produced
            </span>
            <button onClick={reset} style={{ ...s.btnGhost, marginLeft: "auto" }}>
              Reset
            </button>
          </div>

          <RunPanel run={phase.run} judge={phase.judge} />

          {phase.judge.judgment === "pass" && (
            <div style={{ color: "#137333", fontWeight: 600 }}>
              KB looks correct for this case. No changes needed.
            </div>
          )}

          {phase.judge.judgment === "fail" && phase.judge.proposedFiles.length > 0 && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Proposed Changes</div>
              {phase.judge.proposedFiles.map((f, i) => (
                <FileDiff key={i} file={f} />
              ))}
              <div style={s.row}>
                <button
                  onClick={() => handleDryRun(phase.judge.proposedFiles, phase.run, phase.judge)}
                  style={s.btn("#1a73e8")}
                >
                  🔁 Dry-Run Retest
                </button>
                <button
                  onClick={() => handleApprove(phase.judge.proposedFiles)}
                  style={s.btn("#137333")}
                >
                  ✅ Approve & Write KB
                </button>
                <button onClick={reset} style={s.btnGhost}>
                  Reject
                </button>
              </div>
            </>
          )}

          {phase.judge.judgment === "fail" && phase.judge.proposedFiles.length === 0 && (
            <div style={{ color: "#c5221f" }}>
              LLM flagged a failure but could not propose a fix. Review reasoning above.
              <div style={{ marginTop: 12 }}>
                <button onClick={reset} style={s.btnGhost}>Reset</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DRY RUN result ── */}
      {phase.tag === "dryrun" && (
        <div>
          <div style={{ ...s.row, marginBottom: 8 }}>
            <span style={{ fontSize: 12, background: "#e8f0fe", color: "#1a73e8", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>
              DRY RUN
            </span>
            <span style={s.badge(phase.judge.judgment === "pass")}>
              {phase.judge.judgment === "pass" ? "✅ PASS" : "❌ STILL FAILING"}
            </span>
            <span style={{ color: "#666" }}>{phase.run.ops.length} ops</span>
            <button onClick={reset} style={{ ...s.btnGhost, marginLeft: "auto" }}>Reset</button>
          </div>

          {phase.judge.judgment === "pass" && (
            <div style={{ color: "#137333", marginBottom: 20, fontWeight: 600 }}>
              Fix verified — proposed KB produces the correct output.
            </div>
          )}
          {phase.judge.judgment === "fail" && phase.judge.diagnosis && (
            <div style={{ ...s.diagBox, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Still failing</div>
              <div style={{ lineHeight: 1.5 }}>{phase.judge.diagnosis}</div>
            </div>
          )}

          <RunPanel run={phase.run} judge={phase.judge} />

          <div style={{ marginBottom: 16, fontWeight: 600 }}>Files to be approved:</div>
          {phase.proposed.map((f, i) => (
            <FileDiff key={i} file={f} />
          ))}

          <div style={s.row}>
            <button
              onClick={() => handleApprove(phase.proposed)}
              style={s.btn(phase.judge.judgment === "pass" ? "#137333" : "#e65100")}
            >
              {phase.judge.judgment === "pass" ? "✅ Approve & Write KB" : "⚠️ Approve Anyway"}
            </button>
            <button onClick={reset} style={s.btnGhost}>
              Reject
            </button>
          </div>
        </div>
      )}

      {/* ── APPROVED ── */}
      {phase.tag === "approved" && (
        <div>
          <div style={{ color: "#137333", fontWeight: 600, marginBottom: 8 }}>
            ✅ KB updated. Server reloaded in-memory — next submit uses new KB.
          </div>
          <button onClick={reset} style={s.btnGhost}>Run another test</button>
        </div>
      )}

      {/* ── ERROR ── */}
      {phase.tag === "error" && (
        <div>
          <div style={{ color: "#c5221f", marginBottom: 12, fontFamily: "monospace", fontSize: 13 }}>
            {phase.message}
          </div>
          <button onClick={reset} style={s.btnGhost}>Reset</button>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
