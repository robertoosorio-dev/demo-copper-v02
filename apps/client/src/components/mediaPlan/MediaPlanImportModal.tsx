import React, { useState } from "react";
import { IconX } from "@tabler/icons-react";
import type { ContextFile } from "@copper/contracts";

interface SheetSelection {
  sheetName: string;
  selected: boolean;
  note: string;
  rowCount: number;
  columns: string[];
  preview: string[][];
}

interface Props {
  fileName: string;
  parsed: ContextFile;
  onClose: () => void;
  onAnalyze: (message: string) => void;
}

function buildAnalysisMessage(fileName: string, sheets: SheetSelection[]): string {
  const selected = sheets.filter((s) => s.selected);

  const sheetBlocks = selected.map((s) => {
    const header    = s.columns.join(" | ");
    const separator = s.columns.map(() => "---").join(" | ");
    const rows      = s.preview.map((r) => r.join(" | ")).join("\n");
    const noteStr   = s.note.trim() ? `\n*User note: "${s.note.trim()}"*` : "";
    const moreRows  = s.rowCount > s.preview.length
      ? `\n*(${s.rowCount - s.preview.length} more rows not shown)*`
      : "";
    return `**Sheet: ${s.sheetName}** (${s.rowCount} rows)${noteStr}\n${header}\n${separator}\n${rows}${moreRows}`;
  });

  return [
    `I'm importing a media plan from "${fileName}". I've selected ${selected.length} sheet${selected.length !== 1 ? "s" : ""} for analysis:\n`,
    ...sheetBlocks.map((b) => `---\n${b}`),
    `---
Please analyze this media plan and:
1. Propose how to translate the line items into our structure: Experience Groups → Flights → Placement Groups → Placements → Creative Placeholders
2. Identify any targeting or audience signals that should inform personalization in the Campaign Strategy
3. Show me your proposed entity structure BEFORE creating anything — I want to review it first

Do not create any entities yet. Just propose and explain your reasoning.`,
  ].join("\n\n");
}

export default function MediaPlanImportModal({ fileName, parsed, onClose, onAnalyze }: Props) {
  const [sheets, setSheets] = useState<SheetSelection[]>(() =>
    (parsed.sheets ?? []).map((s) => ({
      sheetName: s.name,
      selected:  s.rowCount > 0,
      note:      "",
      rowCount:  s.rowCount,
      columns:   s.columns,
      preview:   s.preview ?? [],
    }))
  );

  function toggleSheet(idx: number) {
    setSheets((prev) => prev.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s));
  }

  function setNote(idx: number, note: string) {
    setSheets((prev) => prev.map((s, i) => i === idx ? { ...s, note } : s));
  }

  const hasSelection = sheets.some((s) => s.selected);

  function handleAnalyze() {
    const msg = buildAnalysisMessage(fileName, sheets);
    onClose();
    onAnalyze(msg);
  }

  return (
    <div className="mp-import-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mp-import-modal">

        {/* Header */}
        <div className="mp-import-header">
          <div>
            <div className="mp-import-title">Import Media Plan</div>
            <div className="mp-import-filename">{fileName}</div>
          </div>
          <button className="mp-import-close" onClick={onClose}><IconX size={14} /></button>
        </div>

        {/* Sheet list */}
        <div className="mp-import-body">
          <p className="mp-import-hint">
            Found {sheets.length} sheet{sheets.length !== 1 ? "s" : ""} — select which to send to the agent for analysis:
          </p>
          <div className="mp-import-sheets">
            {sheets.map((s, idx) => (
              <div key={s.sheetName} className={`mp-sheet-row${s.selected ? " mp-sheet-row--on" : ""}`}>
                <label className="mp-sheet-check-label">
                  <input
                    type="checkbox"
                    className="mp-sheet-checkbox"
                    checked={s.selected}
                    onChange={() => toggleSheet(idx)}
                  />
                  <div className="mp-sheet-info">
                    <span className="mp-sheet-name">{s.sheetName}</span>
                    <span className="mp-sheet-meta">
                      {s.rowCount} row{s.rowCount !== 1 ? "s" : ""}
                      {s.columns.length > 0 && (
                        <> · {s.columns.slice(0, 4).join(", ")}{s.columns.length > 4 ? "…" : ""}</>
                      )}
                    </span>
                  </div>
                </label>
                {s.selected && (
                  <input
                    className="mp-sheet-note"
                    type="text"
                    placeholder="Optional hint: what does this sheet represent?"
                    value={s.note}
                    onChange={(e) => setNote(idx, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mp-import-footer">
          <button className="syn-modal-btn syn-modal-btn--cancel" onClick={onClose}>Cancel</button>
          <button
            className="syn-modal-btn syn-modal-btn--create"
            disabled={!hasSelection}
            onClick={handleAnalyze}
          >
            Analyze with Agent →
          </button>
        </div>
      </div>
    </div>
  );
}
