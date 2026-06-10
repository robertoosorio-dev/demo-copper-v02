import React from "react";
import { IconArrowBarToRight } from "@tabler/icons-react";
import type { OutputEntity } from "@copper/contracts";

interface Props {
  id: string;
  entity: OutputEntity;
  nodeRef: (el: HTMLDivElement | null) => void;
  selected: boolean;
  onClick: () => void;
}

export default function OutputNode({ entity, nodeRef, selected, onClick }: Props) {
  return (
    <div ref={nodeRef} className={`node node-output${selected ? " selected" : ""}`} onClick={onClick}>
      <div className="out-head">
        <IconArrowBarToRight size={13} />
        <span className="out-name">{entity.name}</span>
        <span className="out-head-meta">max {entity.maxRows} row{entity.maxRows !== 1 ? "s" : ""}</span>
      </div>
      {entity.fields.length > 0 && (
        <table className="out-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {entity.fields.map((f) => (
              <tr key={f.id}>
                <td><div className="of-name">{f.name}</div></td>
                <td><span className="src-chip">{f.sourceFieldId}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
