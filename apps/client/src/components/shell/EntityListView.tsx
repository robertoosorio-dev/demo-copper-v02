import React, { useEffect } from "react";
import { IconPlus } from "@tabler/icons-react";
import { useStore } from "../../store.js";
import type { SynapseEntity } from "../../store.js";
import { loadProject, listBrands, listCatalogs } from "../../api.js";

const ENTITY_CONFIG: Record<SynapseEntity, { title: string; newLabel: string }> = {
  campaigns: { title: "Campaigns",        newLabel: "New campaign"        },
  brands:    { title: "Brands",           newLabel: "New brand"           },
  catalogs:  { title: "Product Catalogs", newLabel: "New product catalog" },
  audiences: { title: "Audiences",        newLabel: "New table"           },
  assets:    { title: "Assets",           newLabel: "New asset"           },
  creatives: { title: "Creatives",        newLabel: "New creative"        },
};

export default function EntityListView({
  entity,
  onOpenCampaign,
  onOpenBrand,
  onOpenCatalog,
  onNew,
}: {
  entity: SynapseEntity;
  onOpenCampaign: (id: string) => void;
  onOpenBrand: (id: string) => void;
  onOpenCatalog: (id: string) => void;
  onNew: () => void;
}) {
  const config            = ENTITY_CONFIG[entity];
  const availableProjects = useStore((s) => s.availableProjects);
  const loadVersionStore  = useStore((s) => s.loadVersion);
  const version           = useStore((s) => s.version);
  const brandList         = useStore((s) => s.brandList);
  const setBrandList      = useStore((s) => s.setBrandList);
  const catalogList       = useStore((s) => s.catalogList);
  const setCatalogList    = useStore((s) => s.setCatalogList);

  useEffect(() => {
    if (entity === "brands") {
      listBrands().then(setBrandList).catch(console.error);
    } else if (entity === "catalogs") {
      listCatalogs().then(setCatalogList).catch(console.error);
    }
  }, [entity]);

  async function handleRowClick(id: string) {
    if (entity === "campaigns") {
      if (version?.id !== id) {
        const v = await loadProject(id);
        loadVersionStore(v);
      }
      onOpenCampaign(id);
    } else if (entity === "brands") {
      onOpenBrand(id);
    } else if (entity === "catalogs") {
      onOpenCatalog(id);
    }
  }

  const rows =
    entity === "campaigns"
      ? availableProjects.map((p) => ({
          id:         p.id,
          name:       p.name,
          status:     `v${p.version}`,
          createdAt:  new Date(p.updatedAt).toLocaleDateString(),
          modifiedAt: new Date(p.updatedAt).toLocaleDateString(),
        }))
      : entity === "brands"
      ? brandList.map((b) => ({
          id:         b.id,
          name:       b.name,
          status:     b.status,
          createdAt:  new Date(b.createdAt).toLocaleDateString(),
          modifiedAt: new Date(b.updatedAt).toLocaleDateString(),
        }))
      : entity === "catalogs"
      ? catalogList.map((c) => ({
          id:         c.id,
          name:       c.name,
          status:     c.status,
          createdAt:  new Date(c.createdAt).toLocaleDateString(),
          modifiedAt: new Date(c.updatedAt).toLocaleDateString(),
        }))
      : [];

  const clickable = entity === "campaigns" || entity === "brands" || entity === "catalogs";

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
          <div className="syn-empty">
            {entity === "campaigns"
              ? "No campaigns yet — create one to get started."
              : `No ${config.title.toLowerCase()} yet.`}
          </div>
        ) : (
          <table className="syn-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Created at</th>
                <th>Modified at</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => clickable && handleRowClick(row.id)}
                  style={{ cursor: clickable ? "pointer" : "default" }}
                >
                  <td className="syn-table-name">{row.name}</td>
                  <td>
                    <span className={`syn-status-chip syn-status-${row.status}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{row.createdAt}</td>
                  <td>{row.modifiedAt}</td>
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
