import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  IconArrowLeft, IconArrowRight, IconCheck, IconAlertTriangle,
  IconCloudUpload, IconRefresh, IconTable, IconLayoutGrid,
  IconSearch, IconChevronDown, IconPlus, IconEdit,
} from "@tabler/icons-react";
import type {
  Audience, AudienceFieldMapping, AudienceFieldCategory, CatalogIssue,
} from "@copper/contracts";
import { saveAudience as apiSaveAudience, detectAudienceCSV, listBrands } from "../../api.js";
import type { AudienceDetectResult } from "../../api.js";
import { useStore } from "../../store.js";
import BrandAgentPanel from "../brand/BrandAgentPanel.js";
import type { ExtractedField } from "../../api.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: "Connect & Detect Columns" },
  { num: 2, label: "Field Mapping" },
  { num: 3, label: "Validate & Issues" },
  { num: 4, label: "Identity Key" },
  { num: 5, label: "Details & Schedule" },
  { num: 6, label: "Audience Preview" },
];

const SOURCE_TYPES = [
  { type: "file",          label: "File Upload",        icon: "↓",   sub: "CSV — one-time snapshot",              color: "#f1f5f9" },
  { type: "google_sheets", label: "Google Sheets",      icon: "▦",   sub: "Auth + sheet URL",                     color: "#dcfce7" },
  { type: "gcs",           label: "Google Cloud Store", icon: "☁",   sub: "Auth · bucket · region · key",         color: "#dbeafe" },
  { type: "s3",            label: "Amazon S3",          icon: "⛁",   sub: "Credential · bucket · region · key",   color: "#fff7ed" },
  { type: "sftp",          label: "SFTP",               icon: "SFTP", sub: "Credential · host · port · path",      color: "#dbeafe" },
  { type: "shopify",       label: "Shopify",            icon: "⬡",   sub: "Auth · store domain",                  color: "#dcfce7" },
];

const CATEGORY_COLORS: Record<AudienceFieldCategory, string> = {
  identifier:   "#dbeafe",
  demographics: "#f0fdf4",
  behavioral:   "#fff7ed",
  engagement:   "#fdf4ff",
  custom:       "#f8fafc",
};

const CATEGORY_LABELS: Record<AudienceFieldCategory, string> = {
  identifier:   "Identifier",
  demographics: "Demographics",
  behavioral:   "Behavioral",
  engagement:   "Engagement",
  custom:       "Custom",
};

const SYNAPSE_FIELDS: Record<AudienceFieldCategory, string[]> = {
  identifier:   ["User ID", "Email", "Phone", "Cookie ID", "Device ID", "MAID", "CRM ID", "Hashed Email", "Hashed Phone"],
  demographics: ["Age", "Age Range", "Gender", "Income", "Income Range", "Education", "Marital Status", "Household Size", "Occupation", "Language", "Country", "State", "City", "Zip Code", "DMA"],
  behavioral:   ["Purchase History", "Page Views", "Sessions", "Events", "Search Terms", "App Opens", "Video Views", "Click Rate", "Conversion Events", "Product Viewed", "Category Interest"],
  engagement:   ["Last Active", "First Seen", "Recency", "Frequency", "Monetary Value", "LTV", "Churn Score", "Engagement Score", "Days Since Purchase", "Total Orders"],
  custom:       ["Custom Field"],
};

const ALL_FIELDS = Object.values(SYNAPSE_FIELDS).flat();

// ── Shared UI ─────────────────────────────────────────────────────────────────

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

// ── Step 1 ────────────────────────────────────────────────────────────────────

function Step1({ audience, onDetected }: { audience: Audience; onDetected: (r: AudienceDetectResult) => void }) {
  const llmModel  = useStore((s) => s.llmModel);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setLoading(true); setError(null);
    try { onDetected(await detectAudienceCSV(audience.id, file, llmModel)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  if (audience.source) {
    return (
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Connect &amp; Detect Columns</div>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20, maxWidth: 580 }}>Source connected. Agent detected the schema below.</p>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ width: 28, height: 28, borderRadius: 7, background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👥</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{audience.source.name}</span>
            <button onClick={() => fileRef.current?.click()} style={{ ...linkBtn, marginLeft: "auto" }}>↻ Replace</button>
          </div>
          <div style={{ display: "flex", gap: 56, paddingTop: 16 }}>
            <StatBox label="Columns" value={`${audience.columns.filter(c => c.included).length}/${audience.columns.length}`} />
            <StatBox label="Records" value={audience.rowCount.toLocaleString()} />
            <StatBox label="Warnings" value={String(audience.warningCount)} sub={audience.warningCount > 0 ? "review in step 3" : "clean"} />
          </div>
        </div>
        <div style={{ marginBottom: 12, fontSize: 12, fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: 8 }}>
          Detected columns <AiBadge />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
          {audience.columns.map((col) => (
            <div key={col.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}>
              <input type="checkbox" checked={col.included} readOnly style={{ accentColor: "#9747FF" }} />
              <span style={{ flex: 1, fontFamily: "monospace", color: "#0f172a" }}>{col.name}</span>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>{col.detectedType}</span>
            </div>
          ))}
        </div>
        <input ref={fileRef} type="file" accept=".csv,.tsv" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Connect &amp; Detect Columns</div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20, maxWidth: 580 }}>
        Upload a file or connect a live feed. The agent detects the schema and maps every column to a canonical audience field automatically.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {SOURCE_TYPES.filter(s => s.type !== "file").map(src => (
          <button key={src.type} style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, cursor: "pointer", textAlign: "left" }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: src.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: src.type === "sftp" ? 9 : 15, fontWeight: 700, color: "#475569", flexShrink: 0 }}>{src.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{src.label}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{src.sub}</div>
            </div>
          </button>
        ))}
      </div>
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => !loading && fileRef.current?.click()}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 20px", border: `1.5px dashed ${dragOver ? "#9747FF" : "#cbd5e1"}`, borderRadius: 10, background: dragOver ? "#faf5ff" : "#f8fafc", cursor: loading ? "wait" : "pointer", transition: "all 150ms" }}
      >
        <IconCloudUpload size={20} color={loading ? "#94a3b8" : "#64748b"} />
        <span style={{ fontSize: 13, color: "#475569" }}>
          {loading
            ? <><span style={{ color: "#9747FF" }}>Agent analyzing…</span> detecting schema and mapping fields</>
            : <><strong style={{ color: "#0f172a" }}>Files — one-time snapshot.</strong> Click or drag to upload a CSV of your audience.</>
          }
        </span>
      </div>
      {error && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>{error}</div>}
      <input ref={fileRef} type="file" accept=".csv,.tsv" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
    </div>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────────────

function Step2({ audience, onChange }: { audience: Audience; onChange: (m: AudienceFieldMapping[]) => void }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Field Mapping</div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16, maxWidth: 580 }}>
        Synapse mapped every column to a canonical audience field — identifiers, demographics, behavioral signals, and engagement metrics.
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
        {audience.fieldMapping.map((row, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.1fr 28px 1.4fr 1fr 0.7fr 1fr", gap: 12, padding: "11px 14px", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "#0f172a" }}>{row.columnName}</span>
            <span style={{ color: "#cbd5e1", fontSize: 14, textAlign: "center" }}>→</span>
            <select
              value={row.synapseField}
              onChange={(e) => { const u = [...audience.fieldMapping]; u[idx] = { ...row, synapseField: e.target.value, aiRecommended: false }; onChange(u); }}
              style={{ fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 10px", background: "#fff" }}
            >
              {ALL_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select
              value={row.category}
              onChange={(e) => { const u = [...audience.fieldMapping]; u[idx] = { ...row, category: e.target.value as AudienceFieldCategory }; onChange(u); }}
              style={{ fontSize: 11, border: "1px solid #e2e8f0", borderRadius: 7, padding: "4px 8px", background: CATEGORY_COLORS[row.category], color: "#475569", fontWeight: 600 }}
            >
              {(Object.keys(CATEGORY_LABELS) as AudienceFieldCategory[]).map((c) => (
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

// ── Step 3 ────────────────────────────────────────────────────────────────────

function Step3({ audience, onChange }: { audience: Audience; onChange: (issues: CatalogIssue[]) => void }) {
  const pending = audience.issues.filter((i) => i.resolution === "pending");
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Validate &amp; Issues</div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20, maxWidth: 580 }}>
        Synapse validated every record. Resolve each warning before this audience powers any campaign targeting.
      </p>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 56, paddingTop: 4 }}>
          <StatBox label="Records" value={audience.rowCount.toLocaleString()} />
          <StatBox label="Columns" value={String(audience.columns.filter(c => c.included).length)} />
          <StatBox label="Warnings" value={String(audience.warningCount)} sub={audience.warningCount > 0 ? `${pending.length} pending` : "none"} />
        </div>
      </div>
      {audience.issues.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, color: "#16a34a", fontSize: 13, fontWeight: 600 }}>
          ✓ No issues detected — audience looks clean
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {audience.issues.map((issue, idx) => (
            <div key={issue.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#fff", border: `1px solid ${issue.resolution === "pending" ? "#fde68a" : "#e2e8f0"}`, borderRadius: 10 }}>
              <IconAlertTriangle size={16} color={issue.resolution === "pending" ? "#d97706" : "#94a3b8"} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{issue.description}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  Column: <span style={{ fontFamily: "monospace" }}>{issue.column}</span> · {issue.affectedRows.toLocaleString()} records affected
                </div>
              </div>
              {issue.resolution === "pending" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { const u = [...audience.issues]; u[idx] = { ...issue, resolution: "exclude" }; onChange(u); }} style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 6, border: "1px solid #dc2626", color: "#dc2626", background: "#fff7f7", cursor: "pointer" }}>
                    Exclude
                  </button>
                  <button onClick={() => { const u = [...audience.issues]; u[idx] = { ...issue, resolution: "ignore" }; onChange(u); }} style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 6, border: "1px solid #e2e8f0", color: "#64748b", background: "#f8fafc", cursor: "pointer" }}>
                    Ignore
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 4, background: issue.resolution === "exclude" ? "#fee2e2" : "#f1f5f9", color: issue.resolution === "exclude" ? "#dc2626" : "#64748b" }}>
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

// ── Step 4 ────────────────────────────────────────────────────────────────────

function Step4({ audience, onChange }: { audience: Audience; onChange: (pk: string) => void }) {
  const [editing, setEditing] = useState(false);
  const columns = audience.columns.filter((c) => c.included);

  function uniquenessFor(colName: string) {
    const col = audience.columns.find((c) => c.name === colName);
    if (!col) return null;
    const samples = col.sampleValues;
    const unique = new Set(samples).size;
    return samples.length > 0 ? Math.round((unique / samples.length) * 100) : null;
  }

  const pct     = audience.primaryKey ? uniquenessFor(audience.primaryKey) : null;
  const isValid = pct !== null ? pct >= 90 : true;

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Identity Key</div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20, maxWidth: 580 }}>
        The identity key is the column that uniquely identifies each person. Synapse uses it to de-duplicate the audience and match records across syncs and activation platforms.
      </p>
      <div style={{ background: "#fff", border: `1.5px solid ${isValid ? "#86efac" : "#fca5a5"}`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{audience.primaryKey ?? "—"}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{isValid ? "Fully unique — safe to use as identity key." : "Has duplicates or missing values."}</div>
          </div>
          <AiBadge />
        </div>
        <div style={{ display: "flex", gap: 48, marginBottom: 20 }}>
          <StatBox label="Sample uniqueness" value={pct !== null ? `${pct}%` : "—"} sub={isValid ? "✓ Valid" : "⚠ Review"} />
          <StatBox label="Duplicates" value={audience.issues.filter(i => i.type === "duplicate").length > 0 ? "Found" : "0"} />
          <StatBox label="Missing" value={audience.issues.filter(i => i.type === "empty_cell" && i.column === audience.primaryKey).length > 0 ? "Found" : "0"} />
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, background: isValid ? "#dcfce7" : "#fee2e2", color: isValid ? "#16a34a" : "#dc2626", fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
          {isValid ? <IconCheck size={14} /> : <IconAlertTriangle size={14} />}
          {isValid ? "Valid identity key" : "Invalid identity key"}
        </div>
        {editing ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 8 }}>Select a different column:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {columns.map((col) => (
                <button key={col.name} onClick={() => { onChange(col.name); setEditing(false); }} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1.5px solid ${col.name === audience.primaryKey ? "#9747FF" : "#e2e8f0"}`, background: col.name === audience.primaryKey ? "#faf5ff" : "#fff", color: col.name === audience.primaryKey ? "#9747FF" : "#475569", cursor: "pointer" }}>
                  {col.name}
                </button>
              ))}
            </div>
            <button onClick={() => setEditing(false)} style={{ ...linkBtn, marginTop: 12 }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} style={{ ...linkBtn, display: "flex", alignItems: "center", gap: 6 }}>
            <IconEdit size={13} /> Edit — pick a different identity column
          </button>
        )}
      </div>
    </div>
  );
}

// ── Step 5 ────────────────────────────────────────────────────────────────────

function Step5({ audience, onChange }: { audience: Audience; onChange: (p: Partial<Audience>) => void }) {
  const brandList = useStore((s) => s.brandList);
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Audience Details &amp; Schedule</div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24, maxWidth: 580 }}>
        Name this audience, associate it with a brand, and choose how Synapse keeps it in sync.
      </p>
      <div style={{ maxWidth: 560 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Audience Name</label>
        <input type="text" value={audience.name} onChange={(e) => onChange({ name: e.target.value })} style={{ width: "100%", height: 44, border: "1px solid #e2e8f0", borderRadius: 8, padding: "0 14px", fontSize: 14, color: "#0f172a", marginBottom: 18, boxSizing: "border-box", outline: "none" }} />

        <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
          Brand <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <select
          value={audience.brandId ?? ""}
          onChange={(e) => onChange({ brandId: e.target.value || null })}
          style={{ width: "100%", height: 44, border: `1px solid ${!audience.brandId ? "#fca5a5" : "#e2e8f0"}`, borderRadius: 8, padding: "0 14px", fontSize: 14, color: audience.brandId ? "#0f172a" : "#94a3b8", marginBottom: 4, boxSizing: "border-box", background: "#fff" }}
        >
          <option value="">— Select a brand —</option>
          {brandList.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {!audience.brandId && <div style={{ fontSize: 11, color: "#dc2626", marginBottom: 20 }}>A brand is required</div>}
        {audience.brandId && <div style={{ marginBottom: 20 }} />}

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Schedule:</span>
          {(["auto", "manual"] as const).map((s) => (
            <label key={s} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <span style={{ width: 18, height: 18, borderRadius: 9999, border: `4px solid ${audience.schedule === s ? "#9747FF" : "#cbd5e1"}`, background: "#fff", display: "inline-block" }} onClick={() => onChange({ schedule: s })} />
              <span style={{ fontWeight: 500, color: audience.schedule === s ? "#0f172a" : "#64748b" }}>{s === "auto" ? "Auto" : "Manual"}</span>
            </label>
          ))}
        </div>

        {audience.schedule === "auto" && (
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Sync cadence</label>
            <select value={audience.syncCadence ?? "daily"} onChange={(e) => onChange({ syncCadence: e.target.value })} style={{ width: "100%", height: 44, border: "1px solid #e2e8f0", borderRadius: 8, padding: "0 14px", fontSize: 14, color: "#0f172a", boxSizing: "border-box", background: "#fff" }}>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        )}

        <div style={{ padding: "12px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
          {audience.schedule === "auto"
            ? <><strong style={{ color: "#0f172a" }}>Live audience.</strong> Re-syncs from source on schedule. New records are added, removed records are suppressed automatically.</>
            : <><strong style={{ color: "#0f172a" }}>Manual.</strong> A one-time import; the audience stays frozen until you sync it yourself.</>
          }
        </div>
      </div>
    </div>
  );
}

// ── Step 6 ────────────────────────────────────────────────────────────────────

function Step6({ audience, sampleRows }: { audience: Audience; sampleRows: string[][] }) {
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [search, setSearch]     = useState("");
  const headers  = audience.fieldMapping.map((m) => m.synapseField);
  const filtered = sampleRows.filter((row) => !search || row.some((cell) => cell.toLowerCase().includes(search.toLowerCase())));

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 3 }}>Audience Preview</div>
      <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
        The exact records Synapse will import after filters and field mapping are applied.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", fontSize: 13, color: "#64748b", cursor: "pointer" }}>
          <IconChevronDown size={14} /> Filters
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
            <IconSearch size={13} color="#94a3b8" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" style={{ border: "none", outline: "none", fontSize: 13, color: "#0f172a", width: 140, background: "transparent" }} />
          </div>
          <button onClick={() => setViewMode("table")} style={{ width: 34, height: 34, border: `1px solid ${viewMode === "table" ? "#9747FF" : "#e2e8f0"}`, borderRadius: 8, background: viewMode === "table" ? "#faf5ff" : "#fff", color: viewMode === "table" ? "#9747FF" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <IconTable size={16} />
          </button>
          <button onClick={() => setViewMode("grid")} style={{ width: 34, height: 34, border: `1px solid ${viewMode === "grid" ? "#9747FF" : "#e2e8f0"}`, borderRadius: 8, background: viewMode === "grid" ? "#faf5ff" : "#fff", color: viewMode === "grid" ? "#9747FF" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <IconLayoutGrid size={16} />
          </button>
        </div>
      </div>

      {viewMode === "table" ? (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                  {headers.map((h) => <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 20).map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    {headers.map((_, ci) => <td key={ci} style={{ padding: "8px 12px", color: "#0f172a", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row[ci] ?? ""}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {filtered.slice(0, 20).map((row, i) => {
            const nameIdx = audience.fieldMapping.findIndex(m => ["Email", "User ID", "CRM ID"].includes(m.synapseField));
            return (
              <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ width: 36, height: 36, borderRadius: 9999, background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginBottom: 8 }}>👤</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{nameIdx >= 0 ? row[nameIdx] : `Record ${i + 1}`}</div>
                {audience.fieldMapping.slice(0, 3).map((m, ci) => (
                  <div key={ci} style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.synapseField}: {row[ci] ?? ""}</div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
        <span>Showing {Math.min(filtered.length, 20)} of {audience.rowCount.toLocaleString()} records</span>
        <div style={{ flex: 1 }} />
        <button style={{ ...pagerBtn }}>‹ Prev</button>
        <button style={{ ...pagerBtn }}>Next ›</button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AudienceSubFlow({
  audience: initialAudience,
  onBack,
}: {
  audience: Audience;
  onBack: () => void;
}) {
  const [audience, setAudience]   = useState<Audience>(initialAudience);
  const [sampleRows, setSampleRows] = useState<string[][]>(initialAudience.sampleRows ?? []);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState("");
  const setActiveAudience         = useStore((s) => s.setActiveAudience);
  const setBrandList              = useStore((s) => s.setBrandList);
  const brandList                 = useStore((s) => s.brandList);

  useEffect(() => {
    if (brandList.length === 0) {
      listBrands().then(setBrandList).catch(console.error);
    }
  }, []);

  const step = audience.currentStep;

  function patch(p: Partial<Audience>) {
    setAudience((prev) => ({ ...prev, ...p }));
  }

  function canAdvance(): boolean {
    if (step === 1) return !!audience.source;
    if (step === 4) return !!audience.primaryKey;
    if (step === 5) return !!audience.name.trim() && !!audience.brandId;
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
      const saved = await apiSaveAudience(audience.id, { ...audience, status: step === 6 ? "ready" : "draft" });
      setAudience(saved);
      setActiveAudience(saved);
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch {
      setSaveMsg("Error saving");
    } finally {
      setSaving(false);
    }
  }

  function handleDetected(result: AudienceDetectResult) {
    setAudience(result.audience);
    setSampleRows(result.sampleRows);
  }

  const handleAgentFields = useCallback((_fields: Record<string, ExtractedField>) => {}, []);

  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column", background: "#f8fafc" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: "#fff", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "4px 8px", borderRadius: 6 }}>
          <IconArrowLeft size={16} /> Audiences
        </button>
        <div style={{ width: 1, height: 20, background: "#e2e8f0" }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{audience.name || "New Audience"}</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: audience.status === "ready" ? "#dcfce7" : "#f1f5f9", color: audience.status === "ready" ? "#16a34a" : "#64748b", border: `1px solid ${audience.status === "ready" ? "#86efac" : "#e2e8f0"}` }}>
          {audience.status === "ready" ? "Ready" : "Draft"}
        </span>
        <div style={{ flex: 1 }} />
        {saveMsg && <span style={{ fontSize: 12, color: saveMsg === "Saved" ? "#16a34a" : "#dc2626" }}>{saveMsg}</span>}
        <button onClick={handleSave} disabled={saving} style={{ fontSize: 13, fontWeight: 600, background: "#9747FF", color: "#fff", border: "none", borderRadius: 6, padding: "7px 18px", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left step nav */}
        <div style={{ width: 220, background: "#fff", borderRight: "1px solid #e2e8f0", padding: "16px 0", flexShrink: 0, overflowY: "auto" }}>
          {STEPS.map(({ num, label }) => {
            const active    = step === num;
            const done      = step > num;
            const reachable = num <= Math.max(step, audience.source ? 2 : 1);
            return (
              <button key={num} onClick={() => reachable && setAudience((p) => ({ ...p, currentStep: num }))} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "8px 16px", border: "none", borderLeft: active ? "3px solid #9747FF" : "3px solid transparent", background: active ? "#faf5ff" : "transparent", cursor: reachable ? "pointer" : "default", opacity: reachable ? 1 : 0.4 }}>
                <span style={{ width: 22, height: 22, borderRadius: 9999, flexShrink: 0, background: done ? "#9747FF" : active ? "#faf5ff" : "#f1f5f9", border: `1.5px solid ${done ? "#9747FF" : active ? "#9747FF" : "#e2e8f0"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: done ? 11 : 10, fontWeight: 700, color: done ? "#fff" : active ? "#9747FF" : "#94a3b8", fontFamily: "monospace" }}>
                  {done ? "✓" : `0${num}`}
                </span>
                <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? "#9747FF" : done ? "#475569" : "#94a3b8" }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Center */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ maxWidth: 820 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "monospace" }}>{step}/6</span>
              <span>·</span>
              <span style={{ color: "#9747FF" }}>{STEPS[step - 1]?.label}</span>
            </div>

            {step === 1 && <Step1 audience={audience} onDetected={handleDetected} />}
            {step === 2 && <Step2 audience={audience} onChange={(m) => patch({ fieldMapping: m })} />}
            {step === 3 && <Step3 audience={audience} onChange={(issues) => patch({ issues, warningCount: issues.filter(i => i.resolution === "pending").length })} />}
            {step === 4 && <Step4 audience={audience} onChange={(pk) => patch({ primaryKey: pk })} />}
            {step === 5 && <Step5 audience={audience} onChange={patch} />}
            {step === 6 && <Step6 audience={audience} sampleRows={sampleRows} />}

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 28 }}>
              {step > 1 && (
                <button onClick={retreat} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
                  <IconArrowLeft size={15} /> Back
                </button>
              )}
              <div style={{ flex: 1 }} />
              {step < 6 ? (
                <button onClick={advance} disabled={!canAdvance()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 22px", border: "none", borderRadius: 8, background: canAdvance() ? "#9747FF" : "#e2e8f0", fontSize: 13, fontWeight: 600, color: canAdvance() ? "#fff" : "#94a3b8", cursor: canAdvance() ? "pointer" : "default" }}>
                  Confirm &amp; Continue <IconArrowRight size={15} />
                </button>
              ) : (
                <button onClick={handleSave} disabled={saving} style={{ padding: "9px 28px", border: "none", borderRadius: 8, background: "#9747FF", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Saving…" : "Save Audience"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Agent */}
        <BrandAgentPanel brandId={audience.id} onFieldsExtracted={handleAgentFields} />
      </div>
    </div>
  );
}
