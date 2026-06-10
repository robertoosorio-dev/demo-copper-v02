import React from "react";
import { IconFilter, IconSparkles } from "@tabler/icons-react";
import type { FilterEntity, AlgoAIEntity } from "@copper/contracts";

interface FilterProps {
  id: string;
  entity: FilterEntity;
  nodeRef: (el: HTMLDivElement | null) => void;
  selected: boolean;
  onClick: () => void;
}

interface AlgoAIProps {
  id: string;
  entity: AlgoAIEntity;
  nodeRef: (el: HTMLDivElement | null) => void;
  selected: boolean;
  onClick: () => void;
}

export function FilterEntityNode({ entity, nodeRef, selected, onClick }: FilterProps) {
  return (
    <div ref={nodeRef} className={`node node-flow${selected ? " selected" : ""}`} onClick={onClick}>
      <div className="flow-disc"><IconFilter size={14} /></div>
      <div className="flow-meta">
        <div className="flow-kind">Filter</div>
        <div className="flow-name">{entity.name}</div>
        {entity.predicate && <div className="flow-card">{entity.predicate}</div>}
      </div>
    </div>
  );
}

export function AlgoAIEntityNode({ entity, nodeRef, selected, onClick }: AlgoAIProps) {
  return (
    <div ref={nodeRef} className={`node node-flow node-flow--algo${selected ? " selected" : ""}`} onClick={onClick}>
      <div className="flow-disc"><IconSparkles size={14} /></div>
      <div className="flow-meta">
        <div className="flow-kind">{entity.optimization ?? "AlgoAI"}</div>
        <div className="flow-name">{entity.name}</div>
        {entity.promoted && <div className="flow-card">promoted</div>}
      </div>
    </div>
  );
}
