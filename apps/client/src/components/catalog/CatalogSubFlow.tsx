import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  IconArrowLeft, IconArrowRight, IconCheck, IconAlertTriangle,
  IconCloudUpload, IconRefresh, IconTrash, IconSparkles,
  IconTable, IconLayoutGrid, IconSearch, IconChevronDown,
  IconPlus, IconEdit,
} from "@tabler/icons-react";
import type {
  ProductCatalog, CatalogColumn, CatalogFieldMapping,
  CatalogIssue, CatalogFieldCategory, CatalogFieldType,
} from "@copper/contracts";
import { saveCatalog as apiSaveCatalog, detectCatalogCSV, listBrands } from "../../api.js";
import type { DetectResult } from "../../api.js";
import { useStore } from "../../store.js";
import BrandAgentPanel from "../brand/BrandAgentPanel.js";
import type { ExtractedField } from "../../api.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: "Connect & Detect Columns" },
  { num: 2, label: "Field Mapping" },
  { num: 3, label: "Upload & Detect Issues" },
  { num: 4, label: "Primary Key" },
  { num: 5, label: "Details & Schedule" },
  { num: 6, label: "Catalog Preview" },
];

const SOURCE_TYPES = [
  { type: "file",          label: "File Upload",       icon: "↓",    sub: "CSV, TSV — one-time snapshot",           color: "#f1f5f9" },
  { type: "google_sheets", label: "Google Sheets",     icon: "▦",    sub: "Auth + sheet URL",                       color: "#dcfce7" },
  { type: "gcs",           label: "Google Cloud Store",icon: "☁",    sub: "Auth · bucket · region · key",           color: "#dbeafe" },
  { type: "s3",            label: "Amazon S3",         icon: "⛁",    sub: "Credential · bucket · region · key",     color: "#fff7ed" },
  { type: "sftp",          label: "SFTP",              icon: "SFTP",  sub: "Credential · host · port · path",       color: "#dbeafe" },
  { type: "shopify",       label: "Shopify",           icon: "⬡",    sub: "Auth · store domain",                    color: "#dcfce7" },
  { type: "adobe_s3",      label: "Adobe S3",          icon: "A",     sub: "Auth · store domain",                   color: "#fee2e2" },
];

const CATEGORY_COLORS: Record<CatalogFieldCategory, string> = {
  identifier:   "#dbeafe",
  product_info: "#f0fdf4",
  pricing:      "#fff7ed",
  media:        "#fdf4ff",
  custom:       "#f8fafc",
};

const CATEGORY_LABELS: Record<CatalogFieldCategory, string> = {
  identifier:   "Identifier",
  product_info: "Product Info",
  pricing:      "Pricing",
  media:        "Media",
  custom:       "Custom",
};

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function AiBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 9999,
      background: "linear-gradient(90deg,#3b82f6,#9747ff)",
      color: "#fff", fontSize: 10, fontWeight: 700,
    }}>✦ AI</span>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Step 1: Connect & Detect ──────────────────────────────────────────────────

function Step1({
  catalog, onDetected,
}: {
  catalog: ProductCatalog;
  onDetected: (result: DetectResult) => void;
}) {
  const llmModel       = useStore((s) => s.llmModel);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const result = await detectCatalogCSV(catalog.id, file, llmModel);
      onDetected(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (catalog.source) {
    // Already connected — show source card
    return (
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Connect &amp; Detect Columns</div>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20, maxWidth: 580 }}>
          Source connected. Agent detected the schema below.
        </p>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ width: 28, height: 28, borderRadius: 7, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>▦</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{catalog.source.name}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
              <button onClick={() => fileRef.current?.click()} style={linkBtn}>↻ Replace</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 56, paddingTop: 16 }}>
            <StatBox label="Columns" value={`${catalog.columns.filter(c => c.included).length}/${catalog.columns.length}`} />
            <StatBox label="Rows" value={catalog.rowCount.toLocaleString()} />
            <StatBox label="Warnings" value={String(catalog.warningCount)} sub={catalog.warningCount > 0 ? "review in step 3" : "clean"} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            Detected columns <AiBadge />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
            {catalog.columns.map((col) => (
              <div key={col.name} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", background: col.included ? "#fff" : "#f8fafc",
                border: `1px solid ${col.included ? "#e2e8f0" : "#f1f5f9"}`,
                borderRadius: 8, fontSize: 12,
              }}>
                <input
                  type="checkbox"
                  checked={col.included}
                  readOnly
                  style={{ cursor: "pointer", accentColor: "#2563EB" }}
                />
                <span style={{ flex: 1, fontFamily: "monospace", color: col.included ? "#0f172a" : "#94a3b8" }}>{col.name}</span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>{col.detectedType}</span>
              </div>
            ))}
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".csv,.tsv" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Connect &amp; Detect Columns</div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20, maxWidth: 580 }}>
        Upload a file or connect a live feed. The agent detects the schema and runs validation — so you know the catalog is clean before it powers any creative.
      </p>

      {/* Source tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {SOURCE_TYPES.filter(s => s.type !== "file").map(src => (
          <button key={src.type} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: 14, background: "#fff",
            border: "1px solid #e2e8f0", borderRadius: 10,
            cursor: "pointer", textAlign: "left",
          }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: src.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: src.type === "sftp" ? 9 : 15, fontWeight: 700, color: src.type === "adobe_s3" ? "#dc2626" : "#475569", flexShrink: 0 }}>{src.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{src.label}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{src.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* File drop zone */}
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => !loading && fileRef.current?.click()}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "18px 20px",
          border: `1.5px dashed ${dragOver ? "#2563EB" : "#cbd5e1"}`,
          borderRadius: 10,
          background: dragOver ? "#eff6ff" : "#f8fafc",
          cursor: loading ? "wait" : "pointer",
          transition: "all 150ms",
        }}
      >
        <IconCloudUpload size={20} color={loading ? "#94a3b8" : "#64748b"} />
        <span style={{ fontSize: 13, color: "#475569" }}>
          {loading
            ? <><span style={{ color: "#9747FF" }}>Agent analyzing…</span> detecting schema and mapping fields</>
            : <><strong style={{ color: "#0f172a" }}>Files — one-time snapshot.</strong> Click or drag to upload a CSV. Update later by uploading a new version.</>
          }
        </span>
      </div>
      {error && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>{error}</div>}
      <input ref={fileRef} type="file" accept=".csv,.tsv" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
    </div>
  );
}

// ── Step 2: Field Mapping ─────────────────────────────────────────────────────

function Step2({ catalog, onChange }: { catalog: ProductCatalog; onChange: (mapping: CatalogFieldMapping[]) => void }) {
  const SYNAPSE_FIELDS: Record<CatalogFieldCategory, string[]> = {
    identifier:   ["SKU", "Product ID", "UPC", "EAN", "GTIN", "Variant ID"],
    product_info: ["Product Name", "Title", "Description", "Short Description", "Brand", "Category", "Sub-category", "Tags", "Condition", "Color", "Size", "Material"],
    pricing:      ["Price", "Sale Price", "Original Price", "Currency", "Cost"],
    media:        ["Image URL", "Thumbnail URL", "Additional Images", "Video URL"],
    custom:       ["Custom Field"],
  };
  const allFields = Object.values(SYNAPSE_FIELDS).flat();

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Field Mapping</div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16, maxWidth: 580 }}>
        Synapse matched every column to a system field — these mappings tell each creative where to pull its copy, price, and imagery from.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <AiBadge /> <span style={{ fontSize: 12, color: "#64748b" }}>Auto-mapped — adjust any field via the dropdowns</span>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 28px 1.4fr 1fr 0.7fr 1fr", gap: 12, padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
          {["File column", "", "Synapse field", "Category", "Type", "Sample value"].map((h, i) => (
            <span key={i} style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{h}</span>
          ))}
        </div>
        {catalog.fieldMapping.map((row, idx) => (
          <div key={idx} style={{
            display: "grid", gridTemplateColumns: "1.1fr 28px 1.4fr 1fr 0.7fr 1fr",
            gap: 12, padding: "11px 14px", borderBottom: "1px solid #f1f5f9", alignItems: "center",
          }}>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "#0f172a" }}>{row.columnName}</span>
            <span style={{ color: "#cbd5e1", fontSize: 14, textAlign: "center" }}>→</span>
            <select
              value={row.synapseField}
              onChange={(e) => {
                const updated = [...catalog.fieldMapping];
                updated[idx] = { ...row, synapseField: e.target.value, aiRecommended: false };
                onChange(updated);
              }}
              style={{ fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 10px", background: "#fff" }}
            >
              {allFields.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select
              value={row.category}
              onChange={(e) => {
                const updated = [...catalog.fieldMapping];
                updated[idx] = { ...row, category: e.target.value as CatalogFieldCategory };
                onChange(updated);
              }}
              style={{
                fontSize: 11, border: "1px solid #e2e8f0", borderRadius: 7,
                padding: "4px 8px", background: CATEGORY_COLORS[row.category],
                color: "#475569", fontWeight: 600,
              }}
            >
              {(Object.keys(CATEGORY_LABELS) as CatalogFieldCategory[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <span style={{ fontSize: 11, color: "#64748b" }}>{row.type}</span>
            <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.sampleValue}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 3: Issues ────────────────────────────────────────────────────────────

function Step3({ catalog, onChange }: { catalog: ProductCatalog; onChange: (issues: CatalogIssue[]) => void }) {
  const pending = catalog.issues.filter((i) => i.resolution === "pending");

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Upload &amp; Detect Issues</div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20, maxWidth: 580 }}>
        Synapse validated every row against the mapping. Resolve each warning — exclude the affected rows or ignore and proceed.
      </p>
      {/* Stats */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 14, borderBottom: "1px solid #f1f5f9" }}>
          <span style={{ width: 26, height: 26, borderRadius: 6, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>▦</span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{catalog.source?.name}</span>
        </div>
        <div style={{ display: "flex", gap: 56, paddingTop: 16 }}>
          <StatBox label="Rows" value={catalog.rowCount.toLocaleString()} />
          <StatBox label="Columns" value={String(catalog.columns.filter(c => c.included).length)} />
          <StatBox label="Warnings" value={String(catalog.warningCount)} sub={catalog.warningCount > 0 ? `${pending.length} pending` : "none"} />
        </div>
      </div>

      {catalog.issues.length === 0 ? (
        <div style={{ padding: "24px", textAlign: "center", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, color: "#16a34a", fontSize: 13, fontWeight: 600 }}>
          ✓ No issues detected — catalog looks clean
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {catalog.issues.map((issue, idx) => (
            <div key={issue.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", background: "#fff",
              border: `1px solid ${issue.resolution === "pending" ? "#fde68a" : "#e2e8f0"}`,
              borderRadius: 10,
            }}>
              <IconAlertTriangle size={16} color={issue.resolution === "pending" ? "#d97706" : "#94a3b8"} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{issue.description}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  Column: <span style={{ fontFamily: "monospace" }}>{issue.column}</span> · {issue.affectedRows.toLocaleString()} rows affected
                </div>
              </div>
              {issue.resolution === "pending" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => { const u = [...catalog.issues]; u[idx] = { ...issue, resolution: "exclude" }; onChange(u); }}
                    style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 6, border: "1px solid #dc2626", color: "#dc2626", background: "#fff7f7", cursor: "pointer" }}
                  >
                    Exclude −{issue.affectedRows.toLocaleString()} rows
                  </button>
                  <button
                    onClick={() => { const u = [...catalog.issues]; u[idx] = { ...issue, resolution: "ignore" }; onChange(u); }}
                    style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 6, border: "1px solid #e2e8f0", color: "#64748b", background: "#f8fafc", cursor: "pointer" }}
                  >
                    Ignore
                  </button>
                </div>
              ) : (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  padding: "3px 10px", borderRadius: 4,
                  background: issue.resolution === "exclude" ? "#fee2e2" : "#f1f5f9",
                  color: issue.resolution === "exclude" ? "#dc2626" : "#64748b",
                }}>
                  {issue.resolution === "exclude" ? "Excluded" : "Ignored"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step 4: Primary Key ───────────────────────────────────────────────────────

function Step4({ catalog, onChange }: { catalog: ProductCatalog; onChange: (pk: string) => void }) {
  const [editing, setEditing] = useState(false);
  const columns = catalog.columns.filter((c) => c.included);

  // Compute uniqueness estimate from sample values
  function uniquenessFor(colName: string) {
    const col = catalog.columns.find((c) => c.name === colName);
    if (!col) return null;
    const samples = col.sampleValues;
    const unique = new Set(samples).size;
    return samples.length > 0 ? Math.round((unique / samples.length) * 100) : null;
  }

  const pct = catalog.primaryKey ? uniquenessFor(catalog.primaryKey) : null;
  const isValid = pct !== null ? pct >= 90 : true;

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Primary Key</div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20, maxWidth: 580 }}>
        Primary key is the column that uniquely identifies each product. Synapse uses it to de-duplicate the feed and match products across syncs.
      </p>

      <div style={{ background: "#fff", border: `1.5px solid ${isValid ? "#86efac" : "#fca5a5"}`, borderRadius: 12, padding: 20 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{catalog.primaryKey ?? "—"}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {isValid ? "Fully unique and stable across syncs." : "Has duplicate or missing values — consider a different column."}
            </div>
          </div>
          <AiBadge />
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 48, marginBottom: 20 }}>
          <StatBox label="Sample uniqueness" value={pct !== null ? `${pct}%` : "—"} sub={isValid ? "✓ Valid" : "⚠ Review"} />
          <StatBox label="Duplicates" value={catalog.issues.filter(i => i.type === "duplicate").length > 0 ? "Found" : "0"} />
          <StatBox label="Missing" value={catalog.issues.filter(i => i.type === "empty_cell" && i.column === catalog.primaryKey).length > 0 ? "Found" : "0"} />
        </div>

        {/* Valid/invalid badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 14px", borderRadius: 8,
          background: isValid ? "#dcfce7" : "#fee2e2",
          color: isValid ? "#16a34a" : "#dc2626",
          fontSize: 12, fontWeight: 700, marginBottom: 16,
        }}>
          {isValid ? <IconCheck size={14} /> : <IconAlertTriangle size={14} />}
          {isValid ? "Valid primary key" : "Invalid primary key"}
        </div>

        {/* Edit */}
        {editing ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 8 }}>Select a different column:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {columns.map((col) => (
                <button
                  key={col.name}
                  onClick={() => { onChange(col.name); setEditing(false); }}
                  style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1.5px solid ${col.name === catalog.primaryKey ? "#2563EB" : "#e2e8f0"}`,
                    background: col.name === catalog.primaryKey ? "#eff6ff" : "#fff",
                    color: col.name === catalog.primaryKey ? "#2563EB" : "#475569",
                    cursor: "pointer",
                  }}
                >
                  {col.name}
                </button>
              ))}
            </div>
            <button onClick={() => setEditing(false)} style={{ ...linkBtn, marginTop: 12 }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} style={{ ...linkBtn, display: "flex", alignItems: "center", gap: 6 }}>
            <IconEdit size={13} /> Edit — pick another column or build composite key
          </button>
        )}
      </div>
    </div>
  );
}

// ── Step 5: Details & Schedule ────────────────────────────────────────────────

function Step5({
  catalog, onChange,
}: {
  catalog: ProductCatalog;
  onChange: (patch: Partial<ProductCatalog>) => void;
}) {
  const brandList = useStore((s) => s.brandList);

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Catalog Details &amp; Schedule</div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24, maxWidth: 580 }}>
        Confirm the catalog details and choose how often Synapse keeps the feed in sync. The agent has pre-filled everything; adjust anything, then continue.
      </p>
      <div style={{ maxWidth: 560 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Catalog Name</label>
        <input
          type="text"
          value={catalog.name}
          onChange={(e) => onChange({ name: e.target.value })}
          style={{ width: "100%", height: 44, border: "1px solid #e2e8f0", borderRadius: 8, padding: "0 14px", fontSize: 14, color: "#0f172a", marginBottom: 18, boxSizing: "border-box", outline: "none" }}
        />

        <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
          Brand <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <select
          value={catalog.brandId ?? ""}
          onChange={(e) => onChange({ brandId: e.target.value || null })}
          style={{
            width: "100%", height: 44,
            border: `1px solid ${!catalog.brandId ? "#fca5a5" : "#e2e8f0"}`,
            borderRadius: 8, padding: "0 14px", fontSize: 14,
            color: catalog.brandId ? "#0f172a" : "#94a3b8",
            marginBottom: 4, boxSizing: "border-box", background: "#fff",
          }}
        >
          <option value="">— Select a brand —</option>
          {brandList.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {!catalog.brandId && (
          <div style={{ fontSize: 11, color: "#dc2626", marginBottom: 20 }}>A brand is required</div>
        )}
        {catalog.brandId && <div style={{ marginBottom: 20 }} />}

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Schedule:</span>
          {(["auto", "manual"] as const).map((s) => (
            <label key={s} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <span style={{
                width: 18, height: 18, borderRadius: 9999,
                border: `4px solid ${catalog.schedule === s ? "#2563EB" : "#cbd5e1"}`,
                background: "#fff", display: "inline-block",
              }} onClick={() => onChange({ schedule: s })} />
              <span style={{ fontWeight: 500, color: catalog.schedule === s ? "#0f172a" : "#64748b" }}>
                {s === "auto" ? "Auto" : "Manual"}
              </span>
            </label>
          ))}
        </div>

        {catalog.schedule === "auto" && (
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Sync cadence</label>
            <select
              value={catalog.syncCadence ?? "daily"}
              onChange={(e) => onChange({ syncCadence: e.target.value })}
              style={{ width: "100%", height: 44, border: "1px solid #e2e8f0", borderRadius: 8, padding: "0 14px", fontSize: 14, color: "#0f172a", boxSizing: "border-box", background: "#fff" }}
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        )}

        <div style={{ padding: "12px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
          {catalog.schedule === "auto"
            ? <><strong style={{ color: "#0f172a" }}>Live feed.</strong> This catalog re-syncs from {catalog.source?.name ?? "source"} on a schedule, so the row count and values will change over time. Filters &amp; mapping re-apply automatically on every sync.</>
            : <><strong style={{ color: "#0f172a" }}>Manual.</strong> A one-time import; the catalog stays frozen until you sync it yourself.</>
          }
        </div>
      </div>
    </div>
  );
}

// ── Step 6: Preview ───────────────────────────────────────────────────────────

function Step6({ catalog, sampleRows }: { catalog: ProductCatalog; sampleRows: string[][] }) {
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [search, setSearch] = useState("");
  const headers = catalog.fieldMapping.map((m) => m.synapseField);
  const filtered = sampleRows.filter((row) =>
    !search || row.some((cell) => cell.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 3 }}>Catalog Preview</div>
      <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
        The exact rows Synapse will import after filters and field mapping are applied.
      </p>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", fontSize: 13, color: "#64748b", cursor: "pointer" }}>
          <IconChevronDown size={14} /> Filters
        </div>
        <span style={{ fontSize: 12, color: "#64748b" }}>Order by:</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Creation Date ↑↓</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
            <IconSearch size={13} color="#94a3b8" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              style={{ border: "none", outline: "none", fontSize: 13, color: "#0f172a", width: 140, background: "transparent" }}
            />
          </div>
          <button onClick={() => setViewMode("table")} style={{ width: 34, height: 34, border: `1px solid ${viewMode === "table" ? "#2563EB" : "#e2e8f0"}`, borderRadius: 8, background: viewMode === "table" ? "#eff6ff" : "#fff", color: viewMode === "table" ? "#2563EB" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <IconTable size={16} />
          </button>
          <button onClick={() => setViewMode("grid")} style={{ width: 34, height: 34, border: `1px solid ${viewMode === "grid" ? "#2563EB" : "#e2e8f0"}`, borderRadius: 8, background: viewMode === "grid" ? "#eff6ff" : "#fff", color: viewMode === "grid" ? "#2563EB" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <IconLayoutGrid size={16} />
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#475569" }}>
            <IconPlus size={13} /> New Row
          </button>
        </div>
      </div>

      {viewMode === "table" ? (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                  {headers.map((h) => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 20).map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    {headers.map((_, ci) => (
                      <td key={ci} style={{ padding: "8px 12px", color: "#0f172a", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row[ci] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {filtered.slice(0, 20).map((row, i) => {
            const imgIdx = catalog.fieldMapping.findIndex(m => m.category === "media");
            const nameIdx = catalog.fieldMapping.findIndex(m => m.synapseField === "Product Name" || m.synapseField === "Title");
            return (
              <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ height: 100, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: 12 }}>
                  {imgIdx >= 0 && row[imgIdx] ? "🖼" : "No image"}
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>
                    {nameIdx >= 0 ? row[nameIdx] : row[0] ?? `Row ${i + 1}`}
                  </div>
                  {catalog.fieldMapping.slice(0, 3).map((m, ci) => (
                    <div key={ci} style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.synapseField}: {row[ci] ?? ""}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
        <span>Showing {Math.min(filtered.length, 20)} of {catalog.rowCount.toLocaleString()} rows</span>
        <div style={{ flex: 1 }} />
        <button style={{ ...pagerBtn }}>‹ Prev</button>
        <button style={{ ...pagerBtn }}>Next ›</button>
      </div>
    </div>
  );
}

// ── Shared button styles ──────────────────────────────────────────────────────

const linkBtn: React.CSSProperties = {
  background: "transparent", border: "none",
  color: "#2563EB", fontSize: 12, fontWeight: 600,
  cursor: "pointer", padding: 0,
};
const pagerBtn: React.CSSProperties = {
  padding: "4px 10px", border: "1px solid #e2e8f0",
  borderRadius: 6, fontSize: 12, color: "#64748b",
  background: "#fff", cursor: "pointer",
};

// ── Main component ────────────────────────────────────────────────────────────

export default function CatalogSubFlow({
  catalog: initialCatalog,
  onBack,
}: {
  catalog: ProductCatalog;
  onBack: () => void;
}) {
  const [catalog, setCatalog]     = useState<ProductCatalog>(initialCatalog);
  const [sampleRows, setSampleRows] = useState<string[][]>(initialCatalog.sampleRows ?? []);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState("");
  const setActiveCatalog          = useStore((s) => s.setActiveCatalog);
  const llmModel                  = useStore((s) => s.llmModel);
  const setBrandList              = useStore((s) => s.setBrandList);
  const brandList                 = useStore((s) => s.brandList);

  // Ensure brand list is always populated regardless of navigation order
  useEffect(() => {
    if (brandList.length === 0) {
      listBrands().then(setBrandList).catch(console.error);
    }
  }, []);

  const step = catalog.currentStep;

  function patch(p: Partial<ProductCatalog>) {
    setCatalog((prev) => ({ ...prev, ...p }));
  }

  function canAdvance(): boolean {
    if (step === 1) return !!catalog.source;
    if (step === 4) return !!catalog.primaryKey;
    if (step === 5) return !!catalog.name.trim() && !!catalog.brandId;
    return true;
  }

  function advance() {
    if (!canAdvance()) return;
    patch({ currentStep: Math.min(6, step + 1) });
  }

  function retreat() {
    patch({ currentStep: Math.max(1, step - 1) });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await apiSaveCatalog(catalog.id, { ...catalog, status: step === 6 ? "ready" : "draft" });
      setCatalog(saved);
      setActiveCatalog(saved);
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch {
      setSaveMsg("Error saving");
    } finally {
      setSaving(false);
    }
  }

  function handleDetected(result: DetectResult) {
    setCatalog(result.catalog);
    setSampleRows(result.sampleRows);
  }

  // Agent panel: for catalog context, field extraction isn't applicable
  // but the agent can answer questions about the data
  const handleAgentFields = useCallback((_fields: Record<string, ExtractedField>) => {}, []);

  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column", background: "#f8fafc" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: "#fff", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "4px 8px", borderRadius: 6 }}>
          <IconArrowLeft size={16} /> Product Catalogs
        </button>
        <div style={{ width: 1, height: 20, background: "#e2e8f0" }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
          {catalog.name || "New Product Catalog"}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
          background: catalog.status === "ready" ? "#dcfce7" : "#f1f5f9",
          color: catalog.status === "ready" ? "#16a34a" : "#64748b",
          border: `1px solid ${catalog.status === "ready" ? "#86efac" : "#e2e8f0"}`,
        }}>
          {catalog.status === "ready" ? "Ready" : "Draft"}
        </span>
        <div style={{ flex: 1 }} />
        {saveMsg && <span style={{ fontSize: 12, color: saveMsg === "Saved" ? "#16a34a" : "#dc2626" }}>{saveMsg}</span>}
        <button onClick={handleSave} disabled={saving} style={{ fontSize: 13, fontWeight: 600, background: "#2563EB", color: "#fff", border: "none", borderRadius: 6, padding: "7px 18px", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left step nav */}
        <div style={{ width: 220, background: "#fff", borderRight: "1px solid #e2e8f0", padding: "16px 0", flexShrink: 0, overflowY: "auto" }}>
          {STEPS.map(({ num, label }) => {
            const active   = step === num;
            const done     = step > num;
            const reachable = num <= Math.max(step, catalog.source ? 2 : 1);
            return (
              <button
                key={num}
                onClick={() => reachable && setCatalog((p) => ({ ...p, currentStep: num }))}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", textAlign: "left",
                  padding: "8px 16px", border: "none",
                  borderLeft: active ? "3px solid #2563EB" : "3px solid transparent",
                  background: active ? "#eff6ff" : "transparent",
                  cursor: reachable ? "pointer" : "default",
                  opacity: reachable ? 1 : 0.4,
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 9999, flexShrink: 0,
                  background: done ? "#2563EB" : active ? "#eff6ff" : "#f1f5f9",
                  border: `1.5px solid ${done ? "#2563EB" : active ? "#2563EB" : "#e2e8f0"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: done ? 11 : 10, fontWeight: 700,
                  color: done ? "#fff" : active ? "#2563EB" : "#94a3b8",
                  fontFamily: "monospace",
                }}>
                  {done ? "✓" : `0${num}`}
                </span>
                <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? "#2563EB" : done ? "#475569" : "#94a3b8" }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Center content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ maxWidth: 820 }}>
            {/* Step progress breadcrumb */}
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "monospace" }}>{step}/6</span>
              <span>·</span>
              <span style={{ color: "#9747FF" }}>{STEPS[step - 1]?.label}</span>
            </div>

            {step === 1 && <Step1 catalog={catalog} onDetected={handleDetected} />}
            {step === 2 && <Step2 catalog={catalog} onChange={(m) => patch({ fieldMapping: m })} />}
            {step === 3 && <Step3 catalog={catalog} onChange={(issues) => patch({ issues, warningCount: issues.filter(i => i.resolution === "pending").length })} />}
            {step === 4 && <Step4 catalog={catalog} onChange={(pk) => patch({ primaryKey: pk })} />}
            {step === 5 && <Step5 catalog={catalog} onChange={patch} />}
            {step === 6 && <Step6 catalog={catalog} sampleRows={sampleRows} />}

            {/* Navigation buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 28 }}>
              {step > 1 && (
                <button onClick={retreat} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
                  <IconArrowLeft size={15} /> Back
                </button>
              )}
              <div style={{ flex: 1 }} />
              {step < 6 ? (
                <button
                  onClick={advance}
                  disabled={!canAdvance()}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 22px", border: "none", borderRadius: 8, background: canAdvance() ? "#2563EB" : "#e2e8f0", fontSize: 13, fontWeight: 600, color: canAdvance() ? "#fff" : "#94a3b8", cursor: canAdvance() ? "pointer" : "default" }}
                >
                  Confirm &amp; Continue <IconArrowRight size={15} />
                </button>
              ) : (
                <button onClick={handleSave} disabled={saving} style={{ padding: "9px 28px", border: "none", borderRadius: 8, background: "#2563EB", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Saving…" : "Save Catalog"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Agent panel */}
        <BrandAgentPanel
          brandId={catalog.id}
          onFieldsExtracted={handleAgentFields}
        />
      </div>
    </div>
  );
}
