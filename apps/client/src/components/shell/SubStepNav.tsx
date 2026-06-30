import React from "react";
import { useStore } from "../../store.js";
import type { CampaignStage } from "../../store.js";
import type { Version } from "@copper/contracts";

const STEPS: Record<CampaignStage, { id: string; label: string }[]> = {
  blueprint: [
    { id: "brand_brief",    label: "Brand & Campaign Brief" },
    { id: "media_plan",     label: "Media Plan"             },
    { id: "creative_units", label: "Creative Units"         },
    { id: "what_promoting", label: "Products"               },
    { id: "strategy",       label: "Campaign Strategy"      },
  ],
  regen: [
    { id: "assets",      label: "Assets"      },
    { id: "creatives",   label: "Creatives"   },
    { id: "regenerate",  label: "Regenerate"  },
  ],
  preview_approve: [
    { id: "compliance",  label: "Compliance Review"  },
    { id: "approvals",   label: "Client Approvals"   },
  ],
  launch: [
    { id: "trafficking", label: "Trafficking" },
    { id: "go_live",     label: "Go Live"     },
  ],
};

const STAGE_LABELS: Record<CampaignStage, string> = {
  blueprint:       "Plan",
  regen:           "Create",
  preview_approve: "Approve",
  launch:          "Activate",
};

type StepStatus = "confirmed" | "changed" | "empty";

const DOT_COLORS: Record<StepStatus, string> = {
  confirmed: "#16a34a",
  changed:   "#f59e0b",
  empty:     "#cbd5e1",
};

function getStepStatus(stepId: string, version: Version | null): StepStatus {
  if (!version) return "empty";
  const context = version.context as any;
  const confirmedSteps: string[] = context?.confirmedSteps ?? [];
  const mediaEntities = version.plans?.media?.model?.entities ?? {};

  switch (stepId) {
    case "brand_brief": {
      if (context?.brief?.confirmedAt) return "confirmed";
      const brief = context?.brief ?? {};
      if (Object.keys(brief).length > 0) return "changed";
      return "empty";
    }
    case "media_plan": {
      if (confirmedSteps.includes("media_plan")) return "confirmed";
      if (Object.keys(mediaEntities).length > 0) return "changed";
      return "empty";
    }
    case "creative_units": {
      if (confirmedSteps.includes("creative_units")) return "confirmed";
      const hasCreative = Object.values(mediaEntities).some((e: any) => e?.type === "creative");
      if (hasCreative) return "changed";
      return "empty";
    }
    case "what_promoting": {
      if (confirmedSteps.includes("what_promoting")) return "confirmed";
      if (context?.linkedCatalogId) return "changed";
      return "empty";
    }
    case "strategy": {
      if (confirmedSteps.includes("strategy")) return "confirmed";
      if (version.plans?.media?.document) return "changed";
      return "empty";
    }
    default:
      return "empty";
  }
}

export default function SubStepNav() {
  const synapseStage      = useStore((s) => s.synapseStage);
  const synapseSubStep    = useStore((s) => s.synapseSubStep);
  const setSynapseSubStep = useStore((s) => s.setSynapseSubStep);
  const version           = useStore((s) => s.version);

  const steps = STEPS[synapseStage];

  return (
    <nav className="syn-subnav">
      <div className="syn-subnav-eyebrow">{STAGE_LABELS[synapseStage]}</div>
      {steps.map(({ id, label }) => {
        const isActive = id === synapseSubStep;
        const status = getStepStatus(id, version ?? null);
        return (
          <button
            key={id}
            className={`syn-subnav-item${isActive ? " active" : ""}`}
            onClick={() => setSynapseSubStep(id)}
          >
            <span
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: DOT_COLORS[status],
                flexShrink: 0,
                marginRight: 6,
              }}
            />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
