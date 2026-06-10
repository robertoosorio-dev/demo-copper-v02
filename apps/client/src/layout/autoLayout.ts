import type { DataPlanModel, AnyEntity } from "@copper/contracts";

export interface NodeLayout {
  x: number;
  y: number;
  width: number;
}

export interface LayoutResult {
  nodes: Record<string, NodeLayout>;
  graphWidth: number;
  graphHeight: number;
  div1X: number; // left divider (before Tables)
  div2X: number; // right divider (before Outputs)
}

// Column x positions and widths by entity type
const COL: Record<string, { x: number; w: number }> = {
  Import:  { x: 24,   w: 160 },
  Table:   { x: 230,  w: 188 },
  Filter:  { x: 490,  w: 160 },
  AlgoAI:  { x: 490,  w: 160 },
  Output:  { x: 730,  w: 380 },
};

const Y_START = 60;
const Y_GAP   = 130;

export function computeLayout(model: DataPlanModel | null): LayoutResult {
  if (!model) {
    return { nodes: {}, graphWidth: 1300, graphHeight: 700, div1X: 210, div2X: 700 };
  }

  const { entities, connections } = model;

  // Group entity ids by type, preserving insertion order
  const groups: Record<string, string[]> = {};
  for (const [id, entity] of Object.entries(entities)) {
    const t = entity.type;
    (groups[t] = groups[t] || []).push(id);
  }

  // For Tables: sort Input before Transform using connection topology
  if (groups.Table) {
    // Input tables (have no incoming connections from other tables/filters)
    const inputFirst = groups.Table.sort((a, b) => {
      const ea = entities[a] as { tableType?: string };
      const eb = entities[b] as { tableType?: string };
      if (ea.tableType === "Input" && eb.tableType !== "Input") return -1;
      if (ea.tableType !== "Input" && eb.tableType === "Input") return 1;
      return 0;
    });
    groups.Table = inputFirst;
  }

  // Assign y-positions within each column; also subdivide Table column if needed
  // Input Tables at top, Transform Tables further down
  const nodes: Record<string, NodeLayout> = {};

  for (const [type, ids] of Object.entries(groups)) {
    const col = COL[type];
    if (!col) continue;

    if (type === "Table") {
      // Split Input and Transform tables into two sub-columns
      let inputIdx = 0;
      let transformIdx = 0;
      for (const id of ids) {
        const entity = entities[id] as { type: string; tableType?: string };
        if (entity.tableType === "Input" || entity.tableType === "Standard") {
          nodes[id] = { x: col.x, y: Y_START + inputIdx * Y_GAP, width: col.w };
          inputIdx++;
        } else {
          // Transform tables go to a second column
          nodes[id] = { x: col.x + col.w + 60, y: Y_START + transformIdx * Y_GAP, width: col.w };
          transformIdx++;
        }
      }
    } else {
      ids.forEach((id, i) => {
        nodes[id] = { x: col.x, y: Y_START + i * Y_GAP, width: col.w };
      });
    }
  }

  // Shift Output and Filter/AlgoAI columns rightward if Transform tables exist
  const hasTransform = (groups.Table ?? []).some(
    (id) => (entities[id] as { tableType?: string }).tableType === "Transform",
  );
  const transformShift = hasTransform ? 240 : 0;

  for (const [id, node] of Object.entries(nodes)) {
    const entity = entities[id] as AnyEntity;
    if (entity.type === "Filter" || entity.type === "AlgoAI") {
      nodes[id] = { ...node, x: 490 + transformShift };
    }
    if (entity.type === "Output") {
      nodes[id] = { ...node, x: 730 + transformShift };
    }
  }

  // Compute graph bounds
  const maxX = Math.max(...Object.values(nodes).map((n) => n.x + n.width), 1200);
  const maxY = Math.max(...Object.values(nodes).map((n) => n.y), Y_START) + 200;

  const inputTableX = COL.Table.x;
  const div1X = inputTableX - 12;
  const outputX = (groups.Output?.[0] !== undefined) ? (nodes[groups.Output[0]]?.x ?? 730) : 730 + transformShift;
  const div2X = outputX - 12;

  return {
    nodes,
    graphWidth: maxX + 60,
    graphHeight: Math.max(700, maxY),
    div1X,
    div2X,
  };
}
