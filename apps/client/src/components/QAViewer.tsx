import React, { useEffect, useState } from "react";
import { useStore } from "../store.js";
import { listTransactionPasses, listReasoningEntries } from "../api.js";
import type { ReasoningLogEntry } from "@copper/contracts";

interface PassMeta {
  passId: string;
  entryCount: number;
  entries: ReasoningLogEntry[];
}

export default function QAViewer() {
  const version = useStore((s) => s.version);
  const [passes, setPasses] = useState<PassMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ReasoningLogEntry | null>(null);

  useEffect(() => {
    if (!version?.id) return;
    setLoading(true);
    listTransactionPasses(version.id, version.version)
      .then(async (passIds: string[]) => {
        const all = await Promise.all(
          passIds.map(async (passId: string) => {
            const entries = await listReasoningEntries(version.id!, version.version, passId);
            return { passId, entryCount: entries.length, entries };
          }),
        );
        setPasses(all);
      })
      .catch(() => setPasses([]))
      .finally(() => setLoading(false));
  }, [version?.id, version?.version]);

  if (!version) {
    return (
      <div className="qa-empty">
        <div className="qa-empty-msg">No project loaded.</div>
      </div>
    );
  }

  return (
    <div className="qa-shell">
      <div className="qa-header">
        <span className="qa-title">Transaction Log</span>
        <span className="qa-version">v{version.version}</span>
        {loading && <span className="qa-loading">loading…</span>}
      </div>

      <div className="qa-body">
        <div className="qa-sidebar">
          {passes.length === 0 && !loading && (
            <div className="qa-no-passes">No transactions yet for this version.</div>
          )}
          {passes.map((p) => (
            <div key={p.passId} className="qa-pass-group">
              <div className="qa-pass-hdr">
                <span className="qa-pass-id">{p.passId}</span>
                <span className="qa-pass-count">{p.entryCount} entries</span>
              </div>
              {p.entries.map((e, i) => (
                <div
                  key={i}
                  className={`qa-entry-row${selected === e ? " sel" : ""}`}
                  onClick={() => setSelected(e)}
                >
                  <span className="qa-entry-pass">{e.pass}</span>
                  <span className="qa-entry-seq">#{e.seq}</span>
                  <span className="qa-entry-changes">{e.producedChanges.length} changes</span>
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

      {entry.contextSeen.length > 0 && (
        <section className="qa-section">
          <h4>Context Seen</h4>
          <ul className="qa-ctx">
            {entry.contextSeen.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
