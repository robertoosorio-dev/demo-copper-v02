import React, { useState } from "react";
import type { MediaPlanModel, AnyEntity } from "@copper/contracts";
import {
  TYPE_META,
  COLS,
  getRelated,
  getRootRows,
  statusBadgeStyle,
  typeBadgeStyle,
} from "./schema.js";

type RowData = Record<string, unknown> & { id: string };

function CellValue({ col, row }: { col: { k: string; l: string; w: number }; row: RowData }) {
  if (col.k === "status") {
    const st = (row.status as string) ?? "planned";
    return <span className="mg-badge" style={statusBadgeStyle(st)}>{st}</span>;
  }
  const v = row[col.k];
  if (v == null) return <span className="mg-cell-empty">—</span>;
  return <span>{String(v)}</span>;
}

interface FGTableProps {
  type: string;
  rows: RowData[];
  entities: Record<string, AnyEntity>;
  connections: Array<{ from: string; to: string }>;
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
}

function FGTable({ type, rows, entities, connections, selection, onSelectionChange }: FGTableProps) {
  const cols = COLS[type] ?? [];
  const [expanded, setExpanded] = useState<Record<string, Record<string, boolean>>>({});
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const toggleChild = (rowId: string, childType: string) => {
    setExpanded((prev) => {
      const rowState = prev[rowId] ?? {};
      if (rowState[childType]) {
        const next = { ...rowState };
        delete next[childType];
        return { ...prev, [rowId]: next };
      }
      return { ...prev, [rowId]: { ...rowState, [childType]: true } };
    });
    setOpenMenu(null);
  };

  return (
    <table className="mg-table">
      <thead>
        <tr>
          <th style={{ width: 32 }} />
          <th style={{ width: 24 }} />
          {cols.map((c) => <th key={c.k} style={{ minWidth: c.w }}>{c.l}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const isSel = selection.includes(row.id);
          const related = getRelated(row.id, entities as Record<string, { type: string }>, connections);
          const available = Object.keys(related).filter((t) => t !== type);
          const rowExpanded = expanded[row.id] ?? {};

          return (
            <React.Fragment key={row.id}>
              <tr
                className={isSel ? "mg-row sel" : "mg-row"}
                onClick={() =>
                  onSelectionChange(isSel ? selection.filter((i) => i !== row.id) : [...selection, row.id])
                }
              >
                {/* Expand button — LEFT column */}
                <td style={{ padding: "4px 4px 4px 8px" }}>
                  {available.length > 0 && (
                    <div style={{ position: "relative", display: "inline-block" }}>
                      <button
                        className={`mg-xb${Object.keys(rowExpanded).length ? " on" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenu(openMenu === row.id ? null : row.id);
                        }}
                      >
                        ▾
                      </button>
                      {openMenu === row.id && (
                        <div className="mg-xmenu">
                          {available.map((t) => {
                            const tm = TYPE_META[t] ?? TYPE_META.MediaPartner;
                            return (
                              <div
                                key={t}
                                className={`mg-xopt${rowExpanded[t] ? " on" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleChild(row.id, t);
                                }}
                              >
                                <span className="mg-xdot" style={{ background: tm.c }} />
                                {tm.label} ({(related[t] ?? []).length})
                                {rowExpanded[t] && " ✓"}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                {/* Checkbox */}
                <td style={{ padding: "4px 4px" }}>
                  <div className={`mg-ck${isSel ? " on" : ""}`} onClick={(e) => e.stopPropagation()} />
                </td>
                {cols.map((c) => (
                  <td key={c.k} className={c.k === "name" ? "mg-cell-name" : ""}>
                    <CellValue col={c} row={row} />
                  </td>
                ))}
              </tr>
              {Object.keys(rowExpanded).map((childType) => {
                if (!rowExpanded[childType]) return null;
                const childIds = related[childType] ?? [];
                if (!childIds.length) return null;
                const childRows = childIds.map((id) => ({ id, ...(entities[id] as object) })) as RowData[];
                const tm2 = TYPE_META[childType] ?? TYPE_META.MediaPartner;
                return (
                  <tr key={`child-${row.id}-${childType}`}>
                    <td colSpan={cols.length + 2} style={{ padding: "0 0 4px 18px" }}>
                      <div style={{ borderLeft: `2px solid ${tm2.bd}`, marginTop: 3, marginBottom: 3 }}>
                        <div style={{ padding: "2px 8px", fontSize: 9, fontWeight: 600, letterSpacing: ".6px", textTransform: "uppercase", color: tm2.c, background: tm2.bg }}>
                          {tm2.label}
                        </div>
                        <FGTable
                          type={childType}
                          rows={childRows}
                          entities={entities}
                          connections={connections}
                          selection={selection}
                          onSelectionChange={onSelectionChange}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

interface Props {
  model: MediaPlanModel;
  organizeBy: string;
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
}

export default function ViewFullGrid({ model, organizeBy, selection, onSelectionChange }: Props) {
  const [bodyOpen, setBodyOpen] = useState(true);
  const { entities, connections } = model;
  const rootRows = getRootRows(organizeBy, entities as Record<string, { type: string; name?: string }>) as RowData[];
  const tm = TYPE_META[organizeBy] ?? TYPE_META.MediaPartner;

  return (
    <div className="mg-v1">
      <div className="mg-fg-wrap">
        <div
          className="mg-fg-hdr"
          style={{ borderLeft: `3px solid ${tm.c}` }}
          onClick={() => setBodyOpen((v) => !v)}
        >
          <span className="mg-fg-chev">{bodyOpen ? "▾" : "▸"}</span>
          <span className="mg-type-tag" style={typeBadgeStyle(organizeBy)}>{tm.label}</span>
          <span className="mg-fg-tname">{tm.label} — all</span>
          <span className="mg-fg-count">{rootRows.length} entities</span>
        </div>
        {bodyOpen && (
          <FGTable
            type={organizeBy}
            rows={rootRows}
            entities={entities as Record<string, AnyEntity>}
            connections={connections}
            selection={selection}
            onSelectionChange={onSelectionChange}
          />
        )}
      </div>
    </div>
  );
}
