import React, { useEffect, useState } from "react";
import { IconPlus, IconSearch, IconAdjustmentsHorizontal, IconLayoutList, IconLayoutGrid, IconChevronDown, IconDots, IconCopy, IconBookmark, IconTrash } from "@tabler/icons-react";
import { useStore } from "../../store.js";
import type { SynapseEntity } from "../../store.js";
import type { CampaignSummary } from "../../api.js";
import { loadCampaign, listBrands, listCatalogs, listAudiences, deleteCampaign, deleteBrand, deleteCatalog, deleteAudience } from "../../api.js";

// ── Inline delete button with confirm ─────────────────────────────────────────

function DeleteButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (confirming) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} onClick={e => e.stopPropagation()}>
        <button
          onClick={async () => { setBusy(true); await onDelete(); setBusy(false); }}
          disabled={busy}
          style={{ padding: "3px 8px", borderRadius: 5, border: "none", background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >
          {busy ? "…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #e2e8f0", background: "#fff", fontSize: 11, cursor: "pointer", color: "#475569" }}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setConfirming(true); }}
      style={{ padding: 5, border: "none", background: "none", cursor: "pointer", borderRadius: 5, color: "#94a3b8" }}
      title="Delete"
    >
      <IconTrash size={14} />
    </button>
  );
}

const ENTITY_CONFIG: Record<SynapseEntity, { title: string; newLabel: string }> = {
  campaigns: { title: "Campaigns",        newLabel: "New Campaign"        },
  brands:    { title: "Brands",           newLabel: "New brand"           },
  catalogs:  { title: "Product Catalogs", newLabel: "New product catalog" },
  audiences: { title: "Audiences",        newLabel: "New table"           },
  assets:    { title: "Assets",           newLabel: "New asset"           },
  creatives: { title: "Creatives",        newLabel: "New creative"        },
};

// ── Status chip ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: "#f1f5f9", color: "#64748b", label: "Draft"     },
  running:   { bg: "#dcfce7", color: "#16a34a", label: "Running"   },
  paused:    { bg: "#fef9c3", color: "#ca8a04", label: "Paused"    },
  scheduled: { bg: "#dbeafe", color: "#2563eb", label: "Scheduled" },
  finished:  { bg: "#f3e8ff", color: "#7c3aed", label: "Finished"  },
  archived:  { bg: "#f1f5f9", color: "#94a3b8", label: "Archived"  },
};

function StatusChip({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

// ── Campaign list ─────────────────────────────────────────────────────────────

function CampaignList({
  projects,
  onOpen,
  onNew,
  onDelete,
}: {
  projects: CampaignSummary[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function fmtDate(iso: string) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return "—"; }
  }

  function fmtRange(start: string, end: string) {
    if (!start && !end) return "—";
    const fmt = (d: string) => {
      try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }); } catch { return d; }
    };
    if (start && end) return `${fmt(start)} — ${fmt(end)}`;
    if (start) return `From ${fmt(start)}`;
    return `Until ${fmt(end)}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fff" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "20px 28px 16px", borderBottom: "1px solid #f1f5f9" }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.01em", textTransform: "uppercase" }}>Campaigns</h1>
        <div style={{ flex: 1 }} />
        <button
          onClick={onNew}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          <IconPlus size={14} />
          New Campaign
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 28px", borderBottom: "1px solid #f1f5f9" }}>
        <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
          <IconAdjustmentsHorizontal size={14} />
          Filters »
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "#64748b" }}>Order by:</span>
        <button style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#0f172a", cursor: "pointer" }}>
          Updated Date <IconChevronDown size={12} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", border: "1px solid #e2e8f0", borderRadius: 7, background: "#fff" }}>
          <IconSearch size={13} color="#94a3b8" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search"
            style={{ border: "none", outline: "none", fontSize: 12, color: "#0f172a", width: 130, background: "transparent" }}
          />
        </div>
        <div style={{ display: "flex", gap: 2, padding: 3, border: "1px solid #e2e8f0", borderRadius: 7, background: "#f8fafc" }}>
          <button style={{ padding: "4px 7px", borderRadius: 5, border: "none", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <IconLayoutList size={14} color="#0f172a" />
          </button>
          <button style={{ padding: "4px 7px", borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <IconLayoutGrid size={14} color="#94a3b8" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "60px 28px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            {search ? "No campaigns match your search." : "No campaigns yet — create one to get started."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                {[
                  { label: "Campaign",     style: { minWidth: 240 } },
                  { label: "Status",       style: { minWidth: 140 } },
                  { label: "Timeline",     style: { minWidth: 200 } },
                  { label: "CTR",          style: { minWidth: 80, textAlign: "center" as const } },
                  { label: "Impressions",  style: { minWidth: 100, textAlign: "right" as const } },
                  { label: "Updated Date", style: { minWidth: 160 } },
                  { label: "Created Date", style: { minWidth: 160 } },
                  { label: "",             style: { minWidth: 90 } },
                ].map(col => (
                  <th key={col.label} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#94a3b8", textAlign: "left", whiteSpace: "nowrap", background: "#fff", ...col.style }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const isDraft = !p.status || p.status === "draft";
                const needsSetup = isDraft && (p.completedSteps ?? 0) < (p.totalSteps ?? 5);
                return (
                  <tr
                    key={p.id}
                    onClick={() => onOpen(p.id)}
                    style={{ borderBottom: "1px solid #f8fafc", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafbfc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    {/* Campaign name */}
                    <td style={{ padding: "12px 12px" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 2 }}>{p.name}</div>
                      {p.description && (
                        <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>
                          {p.description}
                        </div>
                      )}
                    </td>

                    {/* Status + setup */}
                    <td style={{ padding: "12px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: needsSetup ? 4 : 0 }}>
                        <StatusChip status={p.status ?? "draft"} />
                        {needsSetup && (
                          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
                            {p.completedSteps ?? 0}/{p.totalSteps ?? 5}
                          </span>
                        )}
                      </div>
                      {needsSetup && (
                        <button
                          onClick={e => { e.stopPropagation(); onOpen(p.id); }}
                          style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: "#2563EB", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                        >
                          Continue Setup
                        </button>
                      )}
                    </td>

                    {/* Timeline */}
                    <td style={{ padding: "12px 12px", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>
                      {fmtRange(p.startDate, p.endDate)}
                    </td>

                    {/* CTR */}
                    <td style={{ padding: "12px 12px", fontSize: 12, color: "#94a3b8", textAlign: "center" }}>N/A</td>

                    {/* Impressions */}
                    <td style={{ padding: "12px 12px", fontSize: 12, color: "#94a3b8", textAlign: "right" }}>N/A</td>

                    {/* Updated */}
                    <td style={{ padding: "12px 12px", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>
                      {fmtDate(p.updatedAt)}
                    </td>

                    {/* Created */}
                    <td style={{ padding: "12px 12px", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>
                      {fmtDate(p.createdAt ?? p.updatedAt)}
                    </td>

                    {/* Row actions */}
                    <td style={{ padding: "12px 12px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <button style={{ padding: 5, border: "none", background: "none", cursor: "pointer", borderRadius: 5, color: "#94a3b8" }} title="Duplicate"><IconCopy size={14} /></button>
                        <button style={{ padding: 5, border: "none", background: "none", cursor: "pointer", borderRadius: 5, color: "#94a3b8" }} title="Save"><IconBookmark size={14} /></button>
                        <DeleteButton onDelete={() => onDelete(p.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      {filtered.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", padding: "10px 28px", borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#94a3b8" }}>
          <span>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          <div style={{ flex: 1 }} />
          <button style={{ padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", fontSize: 12, cursor: "pointer", color: "#475569", marginRight: 4 }}>‹ Prev</button>
          <button style={{ padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", fontSize: 12, cursor: "pointer", color: "#475569" }}>Next ›</button>
        </div>
      )}
    </div>
  );
}

// ── Generic entity list ───────────────────────────────────────────────────────

export default function EntityListView({
  entity,
  onOpenCampaign,
  onOpenBrand,
  onOpenCatalog,
  onOpenAudience,
  onNew,
}: {
  entity: SynapseEntity;
  onOpenCampaign: (id: string) => void;
  onOpenBrand: (id: string) => void;
  onOpenCatalog: (id: string) => void;
  onOpenAudience: (id: string) => void;
  onNew: () => void;
}) {
  const config              = ENTITY_CONFIG[entity];
  const availableCampaigns  = useStore((s) => s.availableCampaigns);
  const setAvailableCampaigns = useStore((s) => s.setAvailableCampaigns);
  const loadVersionStore    = useStore((s) => s.loadVersion);
  const version             = useStore((s) => s.version);
  const brandList         = useStore((s) => s.brandList);
  const setBrandList      = useStore((s) => s.setBrandList);
  const catalogList       = useStore((s) => s.catalogList);
  const setCatalogList    = useStore((s) => s.setCatalogList);
  const audienceList      = useStore((s) => s.audienceList);
  const setAudienceList   = useStore((s) => s.setAudienceList);

  useEffect(() => {
    if (entity === "brands")    listBrands().then(setBrandList).catch(console.error);
    if (entity === "catalogs")  listCatalogs().then(setCatalogList).catch(console.error);
    if (entity === "audiences") listAudiences().then(setAudienceList).catch(console.error);
  }, [entity]);

  if (entity === "campaigns") {
    return (
      <CampaignList
        projects={availableCampaigns}
        onOpen={async (id) => {
          if (version?.id !== id) {
            const v = await loadCampaign(id);
            loadVersionStore(v);
          }
          onOpenCampaign(id);
        }}
        onNew={onNew}
        onDelete={async (id) => {
          await deleteCampaign(id);
          const { listCampaigns } = await import("../../api.js");
          listCampaigns().then(setAvailableCampaigns).catch(console.error);
        }}
      />
    );
  }

  const rows =
    entity === "brands"
      ? brandList.map(b => ({ id: b.id, name: b.name, status: b.status, createdAt: new Date(b.createdAt).toLocaleDateString(), modifiedAt: new Date(b.updatedAt).toLocaleDateString() }))
      : entity === "audiences"
      ? audienceList.map(a => ({ id: a.id, name: a.name, status: a.status, createdAt: new Date(a.createdAt).toLocaleDateString(), modifiedAt: new Date(a.updatedAt).toLocaleDateString() }))
      : entity === "catalogs"
      ? catalogList.map(c => ({ id: c.id, name: c.name, status: c.status, createdAt: new Date(c.createdAt).toLocaleDateString(), modifiedAt: new Date(c.updatedAt).toLocaleDateString() }))
      : [];

  const handleRowClick = (id: string) => {
    if (entity === "brands")    onOpenBrand(id);
    if (entity === "catalogs")  onOpenCatalog(id);
    if (entity === "audiences") onOpenAudience(id);
  };

  const handleDelete = async (id: string) => {
    if (entity === "brands")    { await deleteBrand(id);    listBrands().then(setBrandList).catch(console.error); }
    if (entity === "catalogs")  { await deleteCatalog(id);  listCatalogs().then(setCatalogList).catch(console.error); }
    if (entity === "audiences") { await deleteAudience(id); listAudiences().then(setAudienceList).catch(console.error); }
  };

  return (
    <div className="syn-entity-list">
      <div className="syn-entity-header">
        <h1 className="syn-entity-title">{config.title}</h1>
        <button className="syn-btn-primary" onClick={onNew}>
          <IconPlus size={14} />
          {config.newLabel}
        </button>
      </div>
      <div className="syn-table-wrap">
        {rows.length === 0 ? (
          <div className="syn-empty">{`No ${config.title.toLowerCase()} yet.`}</div>
        ) : (
          <table className="syn-table">
            <thead>
              <tr>
                <th>Name</th><th>Status</th><th>Created at</th><th>Modified at</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} onClick={() => handleRowClick(row.id)} style={{ cursor: "pointer" }}>
                  <td className="syn-table-name">{row.name}</td>
                  <td><span className={`syn-status-chip syn-status-${row.status}`}>{row.status}</span></td>
                  <td>{row.createdAt}</td>
                  <td>{row.modifiedAt}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <DeleteButton onDelete={() => handleDelete(row.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {rows.length > 0 && (
        <div className="syn-table-footer">
          <span>{rows.length} result{rows.length !== 1 ? "s" : ""}</span>
          <div className="syn-table-footer-spacer" />
          <button className="syn-pager-btn">‹ Prev</button>
          <button className="syn-pager-btn">Next ›</button>
        </div>
      )}
    </div>
  );
}
