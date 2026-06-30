import React from "react";
import { useStore } from "../../store.js";
import type { CampaignStage } from "../../store.js";
import { IconCheck, IconChevronLeft } from "@tabler/icons-react";

const STAGES: { id: CampaignStage; label: string }[] = [
  { id: "blueprint",       label: "Plan"     },
  { id: "regen",           label: "Create"   },
  { id: "preview_approve", label: "Approve"  },
  { id: "launch",          label: "Activate" },
];

const STAGE_ORDER: CampaignStage[] = ["blueprint", "regen", "preview_approve", "launch"];

export default function WorkflowTopBar({ onBack }: { onBack: () => void }) {
  const version       = useStore((s) => s.version);
  const synapseStage  = useStore((s) => s.synapseStage);
  const setSynapseStage = useStore((s) => s.setSynapseStage);

  const currentIdx = STAGE_ORDER.indexOf(synapseStage);

  return (
    <div className="syn-topbar">
      <button className="syn-topbar-back" onClick={onBack} title="Back to campaigns">
        <IconChevronLeft size={16} />
      </button>
      <span className="syn-topbar-brand">Synapse</span>
      <span className="syn-topbar-sep">·</span>
      <span className="syn-topbar-campaign">{version?.name ?? "—"}</span>

      <div className="syn-stages">
        {STAGES.map(({ id, label }, i) => {
          const isActive  = id === synapseStage;
          const isDone    = i < currentIdx;
          return (
            <React.Fragment key={id}>
              {i > 0 && <span className="syn-stage-sep">›</span>}
              <button
                className={`syn-stage${isActive ? " active" : ""}${isDone ? " completed" : ""}`}
                onClick={() => setSynapseStage(id)}
              >
                {isDone && <IconCheck size={11} />}
                {label}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
