import React from "react";
import { useStore } from "../../store.js";
import type { CampaignStage } from "../../store.js";

const STEPS: Record<CampaignStage, { id: string; label: string }[]> = {
  blueprint: [
    { id: "brand_brief",     label: "Brand & Campaign Brief"  },
    { id: "what_promoting",  label: "What are you promoting?" },
    { id: "creative_units",  label: "Creative Units"          },
    { id: "strategy",        label: "Campaign Strategy"       },
  ],
  regen: [
    { id: "assets",      label: "Assets"      },
    { id: "creatives",   label: "Creatives"   },
    { id: "regenerate",  label: "Regenerate"  },
  ],
  preview_approve: [
    { id: "compliance",  label: "Compliance review"  },
    { id: "approvals",   label: "Client approvals"   },
  ],
  launch: [
    { id: "media_plan",   label: "Media plan"   },
    { id: "trafficking",  label: "Trafficking"  },
    { id: "go_live",      label: "Go live"      },
  ],
};

const STAGE_LABELS: Record<CampaignStage, string> = {
  blueprint:       "Blueprint",
  regen:           "Regen",
  preview_approve: "Preview & Approve",
  launch:          "Launch",
};

export default function SubStepNav() {
  const synapseStage    = useStore((s) => s.synapseStage);
  const synapseSubStep  = useStore((s) => s.synapseSubStep);
  const setSynapseSubStep = useStore((s) => s.setSynapseSubStep);

  const steps = STEPS[synapseStage];

  return (
    <nav className="syn-subnav">
      <div className="syn-subnav-eyebrow">{STAGE_LABELS[synapseStage]}</div>
      {steps.map(({ id, label }) => {
        const isActive = id === synapseSubStep;
        return (
          <button
            key={id}
            className={`syn-subnav-item${isActive ? " active" : ""}`}
            onClick={() => setSynapseSubStep(id)}
          >
            <span className={`syn-subnav-dot${isActive ? " active" : ""}`} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
