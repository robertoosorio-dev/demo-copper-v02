import React from "react";
import { useStore } from "../store.js";
import GraphCanvas from "./GraphCanvas.js";
import MediaGraph from "./mediaGraph/MediaGraph.js";

export default function ProjectModel() {
  const activePlan = useStore((s) => s.activePlan);

  if (activePlan === "creative") {
    return (
      <div className="project-model project-model--empty">
        <div className="model-empty-msg">Creative Plan model — coming soon</div>
      </div>
    );
  }

  return (
    <div className="project-model">
      {activePlan === "data"  && <GraphCanvas />}
      {activePlan === "media" && <MediaGraph />}
    </div>
  );
}
