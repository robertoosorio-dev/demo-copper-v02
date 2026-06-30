import React, { useState, useRef, useEffect } from "react";
import { IconCheck, IconChevronDown, IconCloudUpload } from "@tabler/icons-react";
import { useStore } from "../../store.js";
import { listBrands, loadBrand } from "../../api.js";
import { useAgentChat } from "../../hooks/useAgentChat.js";
import type { BrandSummary, Brand } from "../../api.js";
import type { CampaignMeta } from "@copper/contracts";

// ── Campaign Brief schema ─────────────────────────────────────────────────────

export interface CampaignBrief {
  campaignName: string;
  startDate: string;
  endDate: string;
  description: string;
  objective: string;
  primaryKpi: string;
  targetAudience: string;
  channels: string[];
  regions: string[];
  offerFocus: string;
  complianceNotes: string;
  brandId: string | null;
  brandName: string | null;
  confirmedAt: string | null;
}

function blankBrief(): CampaignBrief {
  return {
    campaignName: "", startDate: "", endDate: "", description: "",
    objective: "", primaryKpi: "", targetAudience: "",
    channels: [], regions: [], offerFocus: "",
    complianceNotes: "", brandId: null, brandName: null, confirmedAt: null,
  };
}

// ── Brand selector section ────────────────────────────────────────────────────

function BrandSection({
  brands, selectedBrand, loadedBrand, confirmed,
  onSelect, onConfirm,
}: {
  brands: BrandSummary[];
  selectedBrand: BrandSummary | null;
  loadedBrand: Brand | null;
  confirmed: boolean;
  onSelect: (b: BrandSummary) => void;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (confirmed && loadedBrand) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
          <IconCheck size={14} color="#16a34a" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Brand</span>
          <span style={{ fontSize: 13, color: "#64748b", marginLeft: 4 }}>{loadedBrand.name}</span>
          <button onClick={onConfirm} style={{ marginLeft: "auto", fontSize: 11, color: "#2563EB", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Change</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>⌄ Brand</span>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
          Select a brand to ensure the campaign aligns with its guidelines.
        </p>

        <div style={{ position: "relative", marginBottom: 16 }}>
          <button
            onClick={() => setOpen(!open)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", fontSize: 13, cursor: "pointer", color: selectedBrand ? "#0f172a" : "#94a3b8" }}
          >
            <span>{selectedBrand?.name ?? "Select a brand"}</span>
            <IconChevronDown size={14} color="#94a3b8" />
          </button>
          {open && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 10, marginTop: 4 }}>
              {brands.map(b => (
                <button key={b.id} onClick={() => { onSelect(b); setOpen(false); }} style={{ width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", fontSize: 13, cursor: "pointer", color: "#0f172a", borderBottom: "1px solid #f8fafc" }}>
                  {b.name}
                </button>
              ))}
              {brands.length === 0 && <div style={{ padding: "9px 14px", fontSize: 12, color: "#94a3b8" }}>No brands yet — create one first</div>}
            </div>
          )}
        </div>

        {loadedBrand && (
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Brand Guidelines</div>
            <div style={{ display: "flex", gap: 32 }}>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Brand Name</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{loadedBrand.name}</div>
              </div>
              {loadedBrand.fields?.industry?.value && (
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Industry</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{loadedBrand.fields.industry.value}</div>
                </div>
              )}
            </div>
            {loadedBrand.fields?.primaryColors?.value && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>Color Palette</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {String(loadedBrand.fields.primaryColors.value).split(",").slice(0, 5).map((c, i) => (
                    <div key={i} title={c.trim()} style={{ width: 22, height: 22, borderRadius: 4, background: c.trim(), border: "1px solid rgba(0,0,0,0.08)" }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onConfirm}
          disabled={!selectedBrand}
          style={{ width: "100%", padding: "9px", borderRadius: 8, border: "none", background: selectedBrand ? "#2563EB" : "#e2e8f0", color: selectedBrand ? "#fff" : "#94a3b8", fontSize: 13, fontWeight: 600, cursor: selectedBrand ? "pointer" : "default" }}
        >
          Confirm &amp; Save
        </button>
      </div>
    </div>
  );
}

// ── Brief form ────────────────────────────────────────────────────────────────

function BriefForm({
  brief, onChange, onConfirm, confirmed,
}: {
  brief: CampaignBrief;
  onChange: (p: Partial<CampaignBrief>) => void;
  onConfirm: () => void;
  confirmed: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { submit } = useAgentChat();

  const filled = !!brief.campaignName && !!brief.startDate && !!brief.endDate && !!brief.description;

  async function handleFile(file: File) {
    setDropping(true);
    try {
      await submit(
        `I dropped "${file.name}" in the Campaign Brief form. Please analyze it, extract all relevant campaign brief fields, and fill in the form. Ask me if anything is unclear.`,
        [{ id: `lib_${Date.now()}_${file.name}`, name: file.name, file }],
      );
    } finally {
      setDropping(false);
    }
  }

  if (confirmed) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
          <IconCheck size={14} color="#16a34a" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Campaign Brief</span>
          <span style={{ fontSize: 13, color: "#64748b", marginLeft: 4 }}>{brief.campaignName}</span>
          <button onClick={onConfirm} style={{ marginLeft: "auto", fontSize: 11, color: "#2563EB", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Edit</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>⌄ Campaign Brief{brief.campaignName ? ` — ${brief.campaignName}` : ""}</span>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
          Fill in your campaign details or drop a brief file below — fields will be extracted automatically. You can also describe the campaign to the Agent on the right.
        </p>

        {/* Drop zone for brief extraction */}
        <div
          onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => fileRef.current?.click()}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: `1.5px dashed ${dragOver ? "#2563EB" : "#e2e8f0"}`, borderRadius: 8, background: dragOver ? "#eff6ff" : "#f8fafc", cursor: "pointer", marginBottom: 14 }}
        >
          <IconCloudUpload size={16} color={dragOver ? "#2563EB" : "#94a3b8"} />
          <span style={{ fontSize: 12, color: dropping ? "#2563EB" : "#64748b" }}>
            {dropping ? "Analyzing document…" : "Drop a PDF, doc, or email — Agent will analyze and fill the form"}
          </span>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" style={{ display: "none" }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

        <label style={labelStyle}>Campaign Name <span style={{ color: "#dc2626" }}>*</span></label>
        <input
          value={brief.campaignName}
          onChange={e => onChange({ campaignName: e.target.value })}
          placeholder="Type here"
          style={{ ...inputStyle, marginBottom: 12 }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Start Date</label>
            <input type="date" value={brief.startDate} onChange={e => onChange({ startDate: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>End Date</label>
            <input type="date" value={brief.endDate} onChange={e => onChange({ endDate: e.target.value })} style={inputStyle} />
          </div>
        </div>

        <label style={labelStyle}>Campaign Description <span style={{ color: "#dc2626" }}>*</span></label>
        <textarea
          value={brief.description}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Describe your campaign or use the Agent on the right →"
          rows={4}
          style={{ ...inputStyle, resize: "vertical", height: "auto", paddingTop: 10, paddingBottom: 10, marginBottom: 14 }}
        />

        <div style={{ paddingTop: 14, borderTop: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Additional Fields</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {([
              { label: "Objective",       key: "objective"      as const, placeholder: "e.g. Conversions" },
              { label: "Primary KPI",     key: "primaryKpi"     as const, placeholder: "e.g. ROAS, CPA"   },
              { label: "Target Audience", key: "targetAudience" as const, placeholder: "e.g. 25-44 F, US" },
              { label: "Offer / Product", key: "offerFocus"     as const, placeholder: "e.g. Summer line"  },
            ] as const).map(({ label, key, placeholder }) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input value={(brief as any)[key]} onChange={e => onChange({ [key]: e.target.value })} placeholder={placeholder} style={inputStyle} />
              </div>
            ))}
          </div>
          <label style={labelStyle}>Channels</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["Display", "Video", "Social", "HTML5", "Email", "Search"].map(ch => (
              <button
                key={ch}
                onClick={() => {
                  const chs = brief.channels.includes(ch) ? brief.channels.filter(c => c !== ch) : [...brief.channels, ch];
                  onChange({ channels: chs });
                }}
                style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${brief.channels.includes(ch) ? "#2563EB" : "#e2e8f0"}`, background: brief.channels.includes(ch) ? "#eff6ff" : "#fff", color: brief.channels.includes(ch) ? "#2563EB" : "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onConfirm}
          disabled={!filled}
          style={{ width: "100%", padding: "9px", borderRadius: 8, border: "none", background: filled ? "#2563EB" : "#e2e8f0", color: filled ? "#fff" : "#94a3b8", fontSize: 13, fontWeight: 600, cursor: filled ? "pointer" : "default", marginTop: 16 }}
        >
          Confirm &amp; Save
        </button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 5,
};
const inputStyle: React.CSSProperties = {
  width: "100%", height: 38, border: "1px solid #e2e8f0", borderRadius: 7,
  padding: "0 12px", fontSize: 13, color: "#0f172a", background: "#fff",
  boxSizing: "border-box", outline: "none",
};

// ── Main view ─────────────────────────────────────────────────────────────────

export default function BrandBriefView() {
  const version           = useStore(s => s.version);
  const patchVersion      = useStore(s => s.patchVersion);
  const saveNow           = useStore(s => s.saveNow);
  const setSynapseSubStep = useStore(s => s.setSynapseSubStep);

  // brief lives in version.context.brief — no local copy
  const brief: CampaignBrief = { ...blankBrief(), ...((version?.context as any)?.brief ?? {}) };
  const briefConfirmed = !!brief.confirmedAt;

  const [brands, setBrands]               = useState<BrandSummary[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<BrandSummary | null>(null);
  const [loadedBrand, setLoadedBrand]     = useState<Brand | null>(null);
  const [brandConfirmed, setBrandConfirmed] = useState(false);

  // Restore brand UI state from context on mount
  useEffect(() => {
    listBrands().then(list => {
      setBrands(list);
      const ctx = (version?.context as any) ?? {};
      if (ctx.brief?.brandId) {
        setBrandConfirmed(true);
        const b = list.find((x: BrandSummary) => x.id === ctx.brief.brandId);
        if (b) { setSelectedBrand(b); loadBrand(b.id).then(setLoadedBrand).catch(console.error); }
      }
    }).catch(console.error);
  }, []);

  // Write a brief patch directly to version.context and save
  function patchBrief(patch: Partial<CampaignBrief>) {
    if (!version) return;
    const next = { ...brief, ...patch };
    patchVersion({ ...version, context: { ...version.context, brief: next } as any });
  }

  async function handleSelectBrand(b: BrandSummary) {
    setSelectedBrand(b);
    try { setLoadedBrand(await loadBrand(b.id)); } catch {}
  }

  function handleConfirmBrand() {
    if (brandConfirmed) { setBrandConfirmed(false); patchBrief({ confirmedAt: null as any }); return; }
    if (!selectedBrand) return;
    setBrandConfirmed(true);
    patchBrief({ brandId: selectedBrand.id, brandName: selectedBrand.name });
  }

  function handleConfirmBrief() {
    if (briefConfirmed) { patchBrief({ confirmedAt: null as any }); return; }
    const confirmedAt = new Date().toISOString();
    const confirmed = { ...brief, confirmedAt };
    const campaign: CampaignMeta = {
      status: (version?.context as any)?.campaign?.status ?? "draft",
      description: confirmed.description,
      startDate: confirmed.startDate,
      endDate: confirmed.endDate,
      completedSteps: 1,
      totalSteps: 5,
      brandId: confirmed.brandId,
      brandName: confirmed.brandName,
    };
    if (version) {
      patchVersion({ ...version, context: { ...version.context, brief: confirmed, campaign } as any });
      saveNow();
    }
  }

  const bothDone = brandConfirmed && briefConfirmed;

  return (
    <div style={{ overflowY: "auto", padding: 24 }}>
      <div style={{ maxWidth: 560 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Brand &amp; Campaign Brief</div>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          Pick a brand and fill in the brief. Drop a file below to auto-extract fields, or describe the campaign to the Agent on the right.
        </p>

        <BrandSection
          brands={brands}
          selectedBrand={selectedBrand}
          loadedBrand={loadedBrand}
          confirmed={brandConfirmed}
          onSelect={handleSelectBrand}
          onConfirm={handleConfirmBrand}
        />

        {brandConfirmed && (
          <BriefForm
            brief={brief}
            onChange={patchBrief}
            onConfirm={handleConfirmBrief}
            confirmed={briefConfirmed}
          />
        )}

        {bothDone && (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setSynapseSubStep("media_plan")}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", border: "none", borderRadius: 8, background: "#0f172a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Next → What are you promoting?
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
