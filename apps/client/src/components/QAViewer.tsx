import React, { useEffect, useState } from "react";
import { useStore } from "../store.js";
import { listVersions, listTransactionPasses, listReasoningEntries } from "../api.js";
import type { ReasoningLogEntry } from "@copper/contracts";

interface PassMeta {
  passId: string;
  entries: ReasoningLogEntry[];
}

interface VersionBlock {
  versionNum: number;
  authoredBy: "user" | "system";
  createdAt: string;
  passes: PassMeta[];
}

export default function QAViewer() {
  const version = useStore((s) => s.version);
  const [blocks, setBlocks] = useState<VersionBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ReasoningLogEntry | null>(null);

  function load(id: string) {
    setLoading(true);
    listVersions(id)
      .then(async (summaries) => {
        const result: VersionBlock[] = await Promise.all(
          [...summaries].reverse().map(async (vs) => {
            const passIds = await listTransactionPasses(id, vs.versionNum).catch(() => [] as string[]);
            const passes = await Promise.all(
              passIds.map(async (passId) => {
                const entries = await listReasoningEntries(id, vs.versionNum, passId).catch(() => [] as ReasoningLogEntry[]);
                return { passId, entries };
              }),
            );
            return { versionNum: vs.versionNum, authoredBy: vs.authoredBy, createdAt: vs.createdAt, passes };
          }),
        );
        setBlocks(result);
      })
      .catch(() => setBlocks([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!version?.id) return;
    load(version.id);
  }, [version?.id]);

  if (!version) {
    return (
      <div className="qa-empty">
        <div className="qa-empty-msg">No project loaded.</div>
      </div>
    );
  }

  const totalPasses = blocks.reduce((n, b) => n + b.passes.length, 0);

  return (
    <div className="qa-shell">
      <div className="qa-header">
        <span className="qa-title">Transaction Log</span>
        <span className="qa-version">{blocks.length} versions · {totalPasses} passes</span>
        {loading && <span className="qa-loading">loading…</span>}
        <button className="qa-refresh" onClick={() => load(version.id!)} disabled={loading}>↺</button>
      </div>

      <div className="qa-body">
        <div className="qa-sidebar">
          {!loading && blocks.every((b) => b.passes.length === 0) && (
            <div className="qa-no-passes">No transactions recorded yet.</div>
          )}
          {blocks.map((b) => (
            <div key={b.versionNum} className="qa-ver-block">
              <div className="qa-ver-hdr">
                <span className="qa-ver-num">v{b.versionNum}</span>
                <span className="qa-ver-author">{b.authoredBy}</span>
                <span className="qa-ver-date">{new Date(b.createdAt).toLocaleString()}</span>
              </div>
              {b.passes.length === 0 && (
                <div className="qa-no-passes qa-no-passes--indent">no transactions</div>
              )}
              {b.passes.map((p) => (
                <div key={p.passId} className="qa-pass-group">
                  <div className="qa-pass-hdr">
                    <span className="qa-pass-id">{p.passId}</span>
                    <span className="qa-pass-count">{p.entries.length} entries</span>
                  </div>
                  {p.entries.map((e, i) => (
                    <div
                      key={i}
                      className={`qa-entry-row${selected === e ? " sel" : ""}`}
                      onClick={() => setSelected(e)}
                    >
                      <span className="qa-entry-seq">#{e.seq}</span>
                      <span className="qa-entry-changes">{e.producedChanges.length} ops</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="qa-detail">
          {!selected ? (
            <div className="qa-detail-empty">Select an entry to inspect reasoning.</div>
          ) : (
            <EntryDetail entry={selected} />
          )}
        </div>
      </div>
    </div>
  );
}

function EntryDetail({ entry }: { entry: ReasoningLogEntry }) {
  const r = entry.reasoning;
  return (
    <div className="qa-ed">
      <div className="qa-ed-meta">
        <span className="qa-ed-from">v{entry.fromVersion}</span>
        <span className="qa-ed-arrow">→</span>
        <span className="qa-ed-to">v{entry.toVersion}</span>
        <span className="qa-ed-pass">{entry.pass}</span>
        <span className="qa-ed-seq">seq {entry.seq}</span>
      </div>

      <section className="qa-section">
        <h4>Problem</h4>
        <p>{r.problem}</p>
      </section>

      <section className="qa-section">
        <h4>Solution</h4>
        <p>{r.solution}</p>
      </section>

      <section className="qa-section">
        <h4>Justification</h4>
        <p>{r.justification}</p>
      </section>

      {r.alternativesConsidered.length > 0 && (
        <section className="qa-section">
          <h4>Alternatives Considered</h4>
          <ul className="qa-alts">
            {r.alternativesConsidered.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {entry.producedChanges.length > 0 && (
        <section className="qa-section">
          <h4>Produced Changes ({entry.producedChanges.length})</h4>
          <div className="qa-changes">
            {entry.producedChanges.map((changeId, i) => (
              <div key={i} className="qa-change-row">
                <span className="qa-change-state qa-cs-pending">change</span>
                <span className="qa-change-summary" style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{changeId}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {entry.contextSeen.chat && (
        <section className="qa-section">
          <h4>Context — Chat</h4>
          <div className="qa-ctx-chat">
            <div className="qa-ctx-user"><strong>User:</strong> {entry.contextSeen.chat.userMessage}</div>
            {entry.contextSeen.chat.history.length > 0 && (
              <ul className="qa-ctx">
                {entry.contextSeen.chat.history.map((h, i) => (
                  <li key={i}>
                    <strong>{h.role}:</strong>{" "}
                    {h.content.length > 200 ? h.content.slice(0, 200) + "…" : h.content}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
