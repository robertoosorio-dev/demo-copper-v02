import React from "react";
import { useStore } from "../../store.js";
import { TYPE_META, COL_ORDER } from "./schema.js";
import ViewFullGrid from "./ViewFullGrid.js";
import ViewGraphGrid from "./ViewGraphGrid.js";
import ViewColumnGraph from "./ViewColumnGraph.js";

const VIEW_ICONS = [
  <svg key={1} width={15} height={15} viewBox="0 0 15 15" fill="none">
    <rect x="1" y="1" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <rect x="1" y="7" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <rect x="8" y="1" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <rect x="8" y="7" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
  </svg>,
  <svg key={2} width={15} height={15} viewBox="0 0 15 15" fill="none">
    <rect x="1" y="4" width="4" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <rect x="7" y="2" width="7" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <rect x="7" y="8" width="7" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <path d="M5 7.5h2M5 5l2 2.5M5 10l2-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>,
  <svg key={3} width={15} height={15} viewBox="0 0 15 15" fill="none">
    <circle cx="2.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="2.5" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="7.5" cy="7.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="12.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="12.5" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M4 4l2 3M4 11l2-3M9 7l2-3M9 8l2 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
  </svg>,
];

const VIEW_TITLES = ["Full Grid", "Graph-Grid", "Column Graph"];

export default function MediaGraph() {
  const mediaModel     = useStore((s) => s.mediaModel());
  const organizeBy     = useStore((s) => s.graphOrganizeBy);
  const viewMode       = useStore((s) => s.graphViewMode);
  const selection      = useStore((s) => s.graphSelection);
  const setOrganizeBy  = useStore((s) => s.setGraphOrganizeBy);
  const setViewMode    = useStore((s) => s.setGraphViewMode);
  const setSelection   = useStore((s) => s.setGraphSelection);

  const entityCount = mediaModel ? Object.keys(mediaModel.entities).length : 0;
  const selCount    = selection.length;

  return (
    <div className="mg-shell">
      <div className="mg-toolbar">
        <span className="mg-toolbar-label">Organize by</span>
        <select
          className="sel"
          value={organizeBy}
          onChange={(e) => setOrganizeBy(e.target.value)}
          disabled={!mediaModel}
        >
          {COL_ORDER.map((t) => (
            <option key={t} value={t}>{(TYPE_META[t] ?? { label: t }).label}</option>
          ))}
        </select>

        <div className="mg-vm-sw">
          {[1, 2, 3].map((m) => (
            <button
              key={m}
              className={`mg-vm-btn${viewMode === m ? " active" : ""}`}
              title={VIEW_TITLES[m - 1]}
              onClick={() => setViewMode(m)}
              disabled={!mediaModel}
            >
              {VIEW_ICONS[m - 1]}
            </button>
          ))}
        </div>

        {entityCount > 0 && <span className="mg-ent-count">{entityCount} entities</span>}

        <button className="btn mg-sync-btn" disabled title="Coming soon">
          Sync to platforms →
        </button>
      </div>

      <div className="mg-view">
        {!mediaModel ? (
          <div className="mg-empty">
            <p>No media plan model yet. Describe your media plan in the context panel.</p>
          </div>
        ) : (
          <>
            {viewMode === 1 && (
              <ViewFullGrid model={mediaModel} organizeBy={organizeBy} selection={selection} onSelectionChange={setSelection} />
            )}
            {viewMode === 2 && (
              <ViewGraphGrid model={mediaModel} organizeBy={organizeBy} selection={selection} onSelectionChange={setSelection} />
            )}
            {viewMode === 3 && (
              <ViewColumnGraph model={mediaModel} organizeBy={organizeBy} selection={selection} onSelectionChange={setSelection} />
            )}
          </>
        )}
      </div>

      {selCount > 0 && (
        <div className="mg-bulk-bar">
          <span className="mg-bulk-count"><span>{selCount}</span> selected</span>
          <button className="btn" disabled>Edit in bulk</button>
          <button className="btn" disabled>Duplicate</button>
          <button className="btn" onClick={() => setSelection([])}>Clear</button>
        </div>
      )}
    </div>
  );
}
