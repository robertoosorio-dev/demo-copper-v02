import React, { useState } from "react";
import { IconDatabase, IconArrowsExchange, IconChevronRight } from "@tabler/icons-react";
import type { TableEntity } from "@copper/contracts";

interface Props {
  id: string;
  entity: TableEntity;
  nodeRef: (el: HTMLDivElement | null) => void;
  selected: boolean;
  onClick: () => void;
}

export default function TableNode({ entity, nodeRef, selected, onClick }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const fields = entity.fields ?? [];
  const isTransform = entity.tableType === "Transform";

  return (
    <div
      ref={nodeRef}
      className={`node node-table${isTransform ? " node-table--transform" : ""}${selected ? " selected" : ""}`}
      onClick={onClick}
    >
      <div className="tbl-head">
        {isTransform ? <IconArrowsExchange size={13} /> : <IconDatabase size={13} />}
        <span className="tbl-name">{entity.name}</span>
        <span className="tbl-head-meta">{entity.tableType}</span>
      </div>
      <div
        className="collapse-row"
        onClick={(e) => { e.stopPropagation(); setCollapsed((v) => !v); }}
      >
        <span className={`collapse-chevron${collapsed ? "" : " open"}`}>
          <IconChevronRight size={11} />
        </span>
        {fields.length} fields
        {entity.primaryKey ? (
          <> · PK: <span className="fld-pk-name">{entity.primaryKey}</span></>
        ) : null}
      </div>
      {!collapsed && fields.map((f) => (
        <div key={f.id} className="fld">
          <span className="fn">{f.name}</span>
          {f.isPrimaryKey
            ? <span className="fb fb-pk">PK</span>
            : <span className="ft">{f.dataType}</span>
          }
        </div>
      ))}
    </div>
  );
}
