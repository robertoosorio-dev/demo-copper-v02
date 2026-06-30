import React from "react";
import { useStore } from "../../store.js";
import type { SynapseEntity } from "../../store.js";
import {
  IconLayoutKanban,
  IconBuildingStore,
  IconPackage,
  IconUsers,
  IconPhoto,
  IconBrush,
  IconSettings,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";

const ENTITIES: { id: SynapseEntity; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "campaigns",  label: "Campaigns",        icon: IconLayoutKanban  },
  { id: "brands",     label: "Brands",            icon: IconBuildingStore },
  { id: "catalogs",   label: "Product Catalogs",  icon: IconPackage       },
  { id: "audiences",  label: "Audiences",         icon: IconUsers         },
  { id: "assets",     label: "Assets",            icon: IconPhoto         },
  { id: "creatives",  label: "Creatives",         icon: IconBrush         },
];

export default function GlobalRail() {
  const synapseEntity    = useStore((s) => s.synapseEntity);
  const setSynapseEntity = useStore((s) => s.setSynapseEntity);
  const setCampaignOpen  = useStore((s) => s.setCampaignOpen);
  const setBrandOpen     = useStore((s) => s.setBrandOpen);
  const setCatalogOpen   = useStore((s) => s.setCatalogOpen);
  const setAudienceOpen  = useStore((s) => s.setAudienceOpen);

  return (
    <nav className="syn-rail">
      <div className="syn-rail-logo">S</div>

      {ENTITIES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`syn-rail-item${synapseEntity === id ? " active" : ""}`}
          title={label}
          onClick={() => {
            setSynapseEntity(id);
            if (id !== "campaigns") setCampaignOpen(false);
            if (id !== "brands")    setBrandOpen(false);
            if (id !== "catalogs")  setCatalogOpen(false);
            if (id !== "audiences") setAudienceOpen(false);
          }}
        >
          <Icon size={18} />
        </button>
      ))}

      <div className="syn-rail-spacer" />
      <div className="syn-rail-divider" />

      <Link to="/admin" className="syn-rail-item" title="Admin">
        <IconSettings size={18} />
      </Link>
    </nav>
  );
}
