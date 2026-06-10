import React from "react";
import { IconCloudDownload } from "@tabler/icons-react";
import type { ImportEntity } from "@copper/contracts";

interface Props {
  id: string;
  entity: ImportEntity;
  nodeRef: (el: HTMLDivElement | null) => void;
  selected: boolean;
  onClick: () => void;
}

export default function ImportNode({ entity, nodeRef, selected, onClick }: Props) {
  return (
    <div ref={nodeRef} className={`node node-import${selected ? " selected" : ""}`} onClick={onClick}>
      <div className="imp-head">
        <IconCloudDownload size={13} />
        <span>{entity.name}</span>
      </div>
      <div className="imp-source">{entity.source}</div>
      {entity.frequency && <div className="imp-freq">{entity.frequency}</div>}
    </div>
  );
}
