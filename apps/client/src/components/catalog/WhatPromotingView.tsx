import React, { useEffect, useState } from "react";
import { IconPlus, IconCheck, IconExternalLink, IconRefresh } from "@tabler/icons-react";
import { useStore } from "../../store.js";
import {
  listCatalogs, loadCatalog, createCatalog, saveCatalog,
} from "../../api.js";
import type { CatalogSummary, ProductCatalog } from "../../api.js";
import type { Version, TableEntity, ImportEntity, Field } from "@copper/contracts";
import CatalogSubFlow from "./CatalogSubFlow.js";

// ── Reconciliation helper ─────────────────────────────────────────────────────
// Reads a ProductCatalog and patches the version's data plan with a TableEntity
// + ImportEntity + the connection that wires them together.

export function applyCatalogToVersion(catalog: ProductCatalog, version: Version): Version {
  const tableId  = `tbl_cat_${catalog.id.slice(0, 8)}`;
  const importId = `imp_cat_${catalog.id.slice(0, 8)}`;

  // Build Field[] from the catalog's field mapping
  const fields: Field[] = catalog.fieldMapping.map((m, i) => ({
    id:           `fld_${tableId}_${i}`,
    name:         m.columnName,
    dataType:     m.type === "number" ? "Float" : m.type === "date" ? "Timestamp" : "Text",
    mode:         "Stored" as const,
    role:         m.category === "identifier" ? ("data" as const) : ("data" as const),
    isPrimaryKey: catalog.primaryKey === m.columnName,
  }));

  const tableEntity: TableEntity = {
    type:       "Table",
    name:       catalog.name,
    tableType:  "Input",
    primaryKey: catalog.primaryKey ?? undefined,
    description: `Product catalog: ${catalog.name}. ${catalog.rowCount} rows.`,
    fields,
  };

  const importEntity: ImportEntity = {
    type:      "Import",
    name:      `${catalog.name} Feed`,
    source:    catalog.source?.name ?? "File Upload",
    frequency: catalog.schedule === "auto" ? (catalog.syncCadence ?? "Daily") : "Manual",
    syncMode:  catalog.schedule,
  };

  // Build new entities map, removing any prior catalog-linked entities
  const prevEntities = version.plans.data.model?.entities ?? {};
  const filteredEntities: typeof prevEntities = {};
  for (const [k, v] of Object.entries(prevEntities)) {
    if (!k.startsWith("tbl_cat_") && !k.startsWith("imp_cat_")) {
      filteredEntities[k] = v;
    }
  }
  filteredEntities[tableId]  = tableEntity;
  filteredEntities[importId] = importEntity;

  // Build new connections, removing prior catalog links
  const prevConns = version.plans.data.model?.connections ?? [];
  const filteredConns = prevConns.filter(
    (c) => !c.from.startsWith("imp_cat_") && !c.to.startsWith("tbl_cat_"),
  );
  filteredConns.push({ from: importId, to: tableId });

  const linkedContext = { ...version.context, linkedCatalogId: catalog.id };

  return {
    ...version,
    context: linkedContext,
    plans: {
      ...version.plans,
      data: {
        ...version.plans.data,
        model: {
          ...(version.plans.data.model ?? { entities: {}, connections: [] }),
          entities:    filteredEntities,
          connections: filteredConns,
        },
      },
    },
  };
}

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    ready:   { bg: "#dcfce7", color: "#16a34a" },
    draft:   { bg: "#f1f5f9", color: "#64748b" },
    syncing: { bg: "#dbeafe", color: "#2563EB" },
    error:   { bg: "#fee2e2", color: "#dc2626" },
  };
  const c = colors[status] ?? colors.draft;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px",
      borderRadius: 4, background: c.bg, color: c.color,
    }}>
      {status}
    </span>
  );
}

// ── Linked catalog card ───────────────────────────────────────────────────────

function LinkedCard({
  catalog,
  onSwap,
  onEdit,
}: {
  catalog: ProductCatalog;
  onSwap: () => void;
  onEdit: () => void;
}) {
  return (
    <div style={{
      background: "#fff", border: "1.5px solid #86efac",
      borderRadius: 12, padding: 18, marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 7, background: "#dcfce7",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
        }}>▦</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{catalog.name}</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {catalog.rowCount.toLocaleString()} rows · {catalog.fieldMapping.length} fields · {catalog.source?.name ?? "file"}
          </div>
        </div>
        <StatusChip status={catalog.status} />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onEdit}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", border: "1px solid #e2e8f0", borderRadius: 7, background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer" }}
          >
            <IconExternalLink size={13} /> Open
          </button>
          <button
            onClick={onSwap}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", border: "1px solid #e2e8f0", borderRadius: 7, background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer" }}
          >
            <IconRefresh size={13} /> Swap
          </button>
        </div>
      </div>

      {/* Field summary */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {catalog.fieldMapping.slice(0, 8).map((m) => (
          <span key={m.columnName} style={{
            fontSize: 11, padding: "3px 8px",
            borderRadius: 4, background: "#f8fafc",
            border: "1px solid #e2e8f0", color: "#475569",
            fontFamily: "monospace",
          }}>
            {m.synapseField}
          </span>
        ))}
        {catalog.fieldMapping.length > 8 && (
          <span style={{ fontSize: 11, color: "#94a3b8" }}>+{catalog.fieldMapping.length - 8} more</span>
        )}
      </div>

      <div style={{ marginTop: 12, padding: "10px 12px", background: "#f0fdf4", borderRadius: 8, fontSize: 12, color: "#15803d" }}>
        ✓ Data plan updated — <strong>{catalog.name}</strong> is now the product table in this campaign's data plan.
        Filters, ranking, and outputs will draw from its {catalog.fieldMapping.length} mapped fields.
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function WhatPromotingView() {
  const version          = useStore((s) => s.version);
  const patchVersion     = useStore((s) => s.patchVersion);
  const activeCatalog    = useStore((s) => s.activeCatalog);
  const setActiveCatalog = useStore((s) => s.setActiveCatalog);
  const catalogList      = useStore((s) => s.catalogList);
  const setCatalogList   = useStore((s) => s.setCatalogList);

  const [linkedCatalog, setLinkedCatalog]   = useState<ProductCatalog | null>(null);
  const [showPicker, setShowPicker]         = useState(false);
  const [openingCatalog, setOpeningCatalog] = useState<ProductCatalog | null>(null);
  const [loading, setLoading]               = useState(false);

  const linkedId = version?.context?.linkedCatalogId;

  // Load catalog list and resolve the linked catalog
  useEffect(() => {
    listCatalogs().then((list) => {
      setCatalogList(list);
      if (linkedId && !linkedCatalog) {
        loadCatalog(linkedId).then(setLinkedCatalog).catch(console.error);
      }
    }).catch(console.error);
  }, [linkedId]);

  async function handlePick(summary: CatalogSummary) {
    setLoading(true);
    try {
      const catalog = await loadCatalog(summary.id);
      linkCatalog(catalog);
      setShowPicker(false);
    } finally {
      setLoading(false);
    }
  }

  function linkCatalog(catalog: ProductCatalog) {
    if (!version) return;
    patchVersion(applyCatalogToVersion(catalog, version));
    setLinkedCatalog(catalog);
  }

  async function handleCreateNew() {
    setLoading(true);
    try {
      const catalog = await createCatalog();
      setActiveCatalog(catalog);
      setOpeningCatalog(catalog);
    } finally {
      setLoading(false);
    }
  }

  function handleCatalogSaved(catalog: ProductCatalog) {
    // Called when user finishes/saves the catalog sub-flow from within the campaign
    setOpeningCatalog(null);
    setActiveCatalog(catalog);
    if (catalog.status === "ready" || catalog.fieldMapping.length > 0) {
      linkCatalog(catalog);
    }
  }

  // Full-screen catalog sub-flow overlay (inline, within campaign)
  if (openingCatalog) {
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "#f8fafc" }}>
        <CatalogSubFlow
          catalog={openingCatalog}
          onBack={() => {
            // Re-load in case it was saved
            loadCatalog(openingCatalog.id).then((c) => {
              handleCatalogSaved(c);
            }).catch(() => setOpeningCatalog(null));
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 820 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
        What are you promoting?
      </div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24, maxWidth: 560 }}>
        Link a product catalog to this campaign. Synapse maps its fields into the data plan — so
        filters, rankings, and creative outputs can all reference your product data directly.
      </p>

      {/* Linked catalog */}
      {linkedCatalog && !showPicker && (
        <LinkedCard
          catalog={linkedCatalog}
          onSwap={() => setShowPicker(true)}
          onEdit={() => setOpeningCatalog(linkedCatalog)}
        />
      )}

      {/* Picker / no catalog yet */}
      {(!linkedCatalog || showPicker) && (
        <div>
          {showPicker && (
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 12 }}>
              Choose a different catalog:
            </div>
          )}

          {catalogList.length === 0 && !loading ? (
            <div style={{
              padding: "28px", textAlign: "center",
              background: "#f8fafc", border: "1.5px dashed #cbd5e1",
              borderRadius: 12, marginBottom: 16,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                No catalogs yet
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Create one below — you can also manage catalogs from Product Catalogs in the main nav.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {catalogList.map((c) => {
                const isLinked = c.id === linkedId;
                return (
                  <button
                    key={c.id}
                    onClick={() => handlePick(c)}
                    disabled={loading}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px", textAlign: "left",
                      background: "#fff",
                      border: `1.5px solid ${isLinked ? "#86efac" : "#e2e8f0"}`,
                      borderRadius: 10, cursor: loading ? "wait" : "pointer",
                    }}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: 7, background: "#f1f5f9",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0,
                    }}>▦</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        {c.rowCount.toLocaleString()} rows · updated {new Date(c.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <StatusChip status={c.status} />
                    {isLinked && <IconCheck size={16} color="#16a34a" />}
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={handleCreateNew}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 18px", border: "1.5px dashed #9747FF",
              borderRadius: 10, background: "#faf5ff",
              fontSize: 13, fontWeight: 600, color: "#9747FF",
              cursor: loading ? "wait" : "pointer", width: "100%",
            }}
          >
            <IconPlus size={15} />
            {loading ? "Creating…" : "Create new product catalog"}
            <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 400, color: "#c084fc" }}>
              Opens the catalog wizard
            </span>
          </button>

          {showPicker && (
            <button
              onClick={() => setShowPicker(false)}
              style={{ marginTop: 12, background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
