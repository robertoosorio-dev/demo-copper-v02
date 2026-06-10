import React, { useEffect, useState } from "react";
import { useStore } from "../store.js";
import { listVersions, getVersionDiff } from "../api.js";
import type { VersionSummary, VersionDiff, EntityChangeSummary } from "../api.js";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function changeCount(diff: VersionDiff): number {
  return diff.entityChanges.length + diff.connectionsAdded + diff.connectionsRemoved;
}

export default function HistoryPanel() {
  const version = useStore((s) => s.version);
  const [summaries, setSummaries] = useState<VersionSummary[]>([]);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState<number | null>(null);
  const [diff, setDiff]           = useState<VersionDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  useEffect(() => {
    if (!version?.id) return;
    setLoading(true);
    listVersions(version.id)
      .then((list) => {
        setSummaries(list);
        if (list.length > 0) selectVersion(version.id!, list[0].versionNum);
      })
      .catch(() => setSummaries([]))
      .finally(() => setLoading(false));
  }, [version?.id]);

  function selectVersion(projectId: string, versionNum: number) {
    setSelected(versionNum);
    setDiff(null);
    setDiffLoading(true);
    getVersionDiff(projectId, versionNum)
      .then(setDiff)
      .catch(() => setDiff(null))
      .finally(() => setDiffLoading(false));
  }

  if (!version) {
    return (
      <div className="history-empty">
        <div className="history-empty-msg">No project loaded.</div>
      </div>
    );
  }

  return (
    <div className="history-shell">
      <div className="history-header">
        <span className="history-title">Version History</span>
        <span className="history-badge">{summaries.length} version{summaries.length !== 1 ? "s" : ""}</span>
        {loading && <span className="history-loading">loading…</span>}
      </div>

      <div className="history-body">
        <div className="history-sidebar">
          {summaries.length === 0 && !loading && (
            <div className="history-no-versions">No versions found.</div>
          )}
          {summaries.map((s) => (
            <div
              key={s.versionNum}
              className={`history-ver-row${selected === s.versionNum ? " sel" : ""}`}
              onClick={() => selectVersion(version.id!, s.versionNum)}
            >
              <div className="hvr-top">
                <span className="hvr-num">v{s.versionNum}</span>
                {s.parentVersion == null && (
                  <span className="hvr-badge hvr-badge--initial">initial</span>
                )}
                <span className="hvr-author">{s.authoredBy}</span>
              </div>
              <div className="hvr-date">{formatDate(s.createdAt)}</div>
            </div>
          ))}
        </div>

        <div className="history-detail">
          {diffLoading && (
            <div className="history-detail-loading">Computing diff…</div>
          )}
          {!diffLoading && !diff && selected != null && (
            <div className="history-detail-empty">Failed to load diff.</div>
          )}
          {!diffLoading && !diff && selected == null && (
            <div className="history-detail-empty">Select a version to see changes.</div>
          )}
          {diff && <DiffDetail diff={diff} />}
        </div>
      </div>
    </div>
  );
}

function DiffDetail({ diff }: { diff: VersionDiff }) {
  const dataChanges  = diff.entityChanges.filter((c) => c.plan === "data");
  const mediaChanges = diff.entityChanges.filter((c) => c.plan === "media");
  const total = changeCount(diff);

  return (
    <div className="diff-detail">
      <div className="diff-meta">
        <span className="diff-ver-range">
          {diff.isInitial ? (
            <span className="diff-initial-label">Initial version</span>
          ) : (
            <>
              <span className="diff-ver">v{diff.fromVersion}</span>
              <span className="diff-arrow">→</span>
              <span className="diff-ver">v{diff.toVersion}</span>
            </>
          )}
        </span>
        <span className="diff-summary-chip">
          {total === 0 ? "no changes" : `${total} change${total !== 1 ? "s" : ""}`}
        </span>
      </div>

      {total === 0 && (
        <div className="diff-no-changes">
          No structural changes in this version.
        </div>
      )}

      {dataChanges.length > 0 && (
        <PlanSection label="Data Plan" changes={dataChanges} />
      )}

      {mediaChanges.length > 0 && (
        <PlanSection label="Media Plan" changes={mediaChanges} />
      )}

      {(diff.connectionsAdded > 0 || diff.connectionsRemoved > 0) && (
        <div className="diff-section">
          <div className="diff-section-hdr">Connections</div>
          {diff.connectionsAdded > 0 && (
            <div className="diff-conn-row diff-conn--added">
              +{diff.connectionsAdded} connection{diff.connectionsAdded !== 1 ? "s" : ""} added
            </div>
          )}
          {diff.connectionsRemoved > 0 && (
            <div className="diff-conn-row diff-conn--removed">
              -{diff.connectionsRemoved} connection{diff.connectionsRemoved !== 1 ? "s" : ""} removed
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlanSection({ label, changes }: { label: string; changes: EntityChangeSummary[] }) {
  const added    = changes.filter((c) => c.kind === "added");
  const removed  = changes.filter((c) => c.kind === "removed");
  const modified = changes.filter((c) => c.kind === "modified");

  return (
    <div className="diff-section">
      <div className="diff-section-hdr">{label}</div>
      {added.map((c) => <ChangeRow key={c.id} change={c} />)}
      {removed.map((c) => <ChangeRow key={c.id} change={c} />)}
      {modified.map((c) => <ChangeRow key={c.id} change={c} />)}
    </div>
  );
}

function ChangeRow({ change }: { change: EntityChangeSummary }) {
  return (
    <div className={`diff-change-row diff-change--${change.kind}`}>
      <span className={`diff-change-pill diff-pill--${change.kind}`}>{change.kind}</span>
      <span className="diff-change-type">{change.type}</span>
      <span className="diff-change-name">{change.name}</span>
      {change.kind === "modified" && change.changedFields && change.changedFields.length > 0 && (
        <span className="diff-change-fields">{change.changedFields.join(", ")}</span>
      )}
    </div>
  );
}
