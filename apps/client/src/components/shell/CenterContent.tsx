import React, { useEffect } from "react";
import { useStore } from "../../store.js";
import PlanDocument from "../PlanDocument.js";
import ProjectModel from "../ProjectModel.js";
import WhatPromotingView from "../catalog/WhatPromotingView.js";
import BrandBriefView from "../campaign/BrandBriefView.js";
import MediaPlanDocView from "../mediaPlan/MediaPlanDocView.js";
import CampaignStrategyView from "../campaignStrategy/CampaignStrategyView.js";

function Stub({ label }: { label: string }) {
  return (
    <div className="syn-center-stub">
      <span>{label}</span>
      <p>Coming soon</p>
    </div>
  );
}

export default function CenterContent() {
  const synapseStage   = useStore((s) => s.synapseStage);
  const synapseSubStep = useStore((s) => s.synapseSubStep);
  const setActivePlan  = useStore((s) => s.setActivePlan);

  // Sync activePlan so existing components read the right plan from the store
  useEffect(() => {
    if (synapseStage === "blueprint") {
      if (synapseSubStep === "brand_brief" || synapseSubStep === "what_promoting") {
        setActivePlan("data");
      } else {
        setActivePlan("media");
      }
    } else if (synapseStage === "launch") {
      setActivePlan("media");
    }
  }, [synapseStage, synapseSubStep]);

  // Plan
  if (synapseStage === "blueprint") {
    if (synapseSubStep === "brand_brief")    return <BrandBriefView />;
    if (synapseSubStep === "media_plan")     return <MediaPlanDocView />;
    if (synapseSubStep === "creative_units") return <Stub label="Creative Units" />;
    if (synapseSubStep === "what_promoting") return <WhatPromotingView />;
    if (synapseSubStep === "strategy")      return <CampaignStrategyView />;
  }

  // Create
  if (synapseStage === "regen") {
    if (synapseSubStep === "assets")     return <Stub label="Assets" />;
    if (synapseSubStep === "creatives")  return <Stub label="Creatives" />;
    if (synapseSubStep === "regenerate") return <Stub label="Regenerate — use the Agent panel →" />;
  }

  // Approve
  if (synapseStage === "preview_approve") {
    if (synapseSubStep === "compliance") return <Stub label="Compliance Review" />;
    if (synapseSubStep === "approvals")  return <Stub label="Client Approvals" />;
  }

  // Activate
  if (synapseStage === "launch") {
    if (synapseSubStep === "trafficking") return <ProjectModel />;
    if (synapseSubStep === "go_live")     return <Stub label="Go Live" />;
  }

  return <Stub label="Select a step from the left" />;
}
