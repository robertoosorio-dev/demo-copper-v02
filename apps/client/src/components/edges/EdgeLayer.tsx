import React from "react";
import type { DataPlanModel } from "@copper/contracts";
import type { NodeLayout } from "../../layout/autoLayout.js";

const COLORS = {
  import:  "#f59e0b",
  flow:    "#a855f7",
  output:  "#22c55e",
  default: "#60a5fa",
};

function marker(id: string, color: string) {
  return (
    <marker key={id} id={id} markerWidth="8" markerHeight="8" refX="8" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill={color} />
    </marker>
  );
}

type Side = "right" | "left" | "top" | "bottom";

function nodePorts(pos: NodeLayout, h: number): Record<Side, { x: number; y: number }> {
  const w = pos.width ?? 160;
  const cx = pos.x + w / 2;
  const cy = pos.y + h / 2;
  return {
    right:  { x: pos.x + w, y: cy },
    left:   { x: pos.x,     y: cy },
    top:    { x: cx,         y: pos.y },
    bottom: { x: cx,         y: pos.y + h },
  };
}

function selectPorts(
  srcPos: NodeLayout, srcH: number,
  tgtPos: NodeLayout, tgtH: number,
): { src: { x: number; y: number }; srcSide: Side; tgt: { x: number; y: number }; tgtSide: Side } {
  const srcW = srcPos.width ?? 160;
  const tgtW = tgtPos.width ?? 160;
  const srcCx = srcPos.x + srcW / 2;
  const srcCy = srcPos.y + srcH / 2;
  const tgtCx = tgtPos.x + tgtW / 2;
  const tgtCy = tgtPos.y + tgtH / 2;

  const angle = Math.atan2(tgtCy - srcCy, tgtCx - srcCx) * 180 / Math.PI;

  const sp = nodePorts(srcPos, srcH);
  const tp = nodePorts(tgtPos, tgtH);

  let srcSide: Side, tgtSide: Side;
  if (angle > -45 && angle <= 45) {
    srcSide = "right"; tgtSide = "left";
  } else if (angle > 45 && angle <= 135) {
    srcSide = "bottom"; tgtSide = "top";
  } else if (angle > 135 || angle <= -135) {
    srcSide = "left"; tgtSide = "right";
  } else {
    srcSide = "top"; tgtSide = "bottom";
  }

  return { src: sp[srcSide], srcSide, tgt: tp[tgtSide], tgtSide };
}

function bezier(
  x1: number, y1: number, srcSide: Side,
  x2: number, y2: number, tgtSide: Side,
): string {
  const d = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 0.45;

  const offsets: Record<Side, [number, number]> = {
    right:  [ d,  0],
    left:   [-d,  0],
    bottom: [ 0,  d],
    top:    [ 0, -d],
  };

  const [c1dx, c1dy] = offsets[srcSide];
  const [c2dx, c2dy] = offsets[tgtSide];

  return `M${x1},${y1} C${x1 + c1dx},${y1 + c1dy} ${x2 + c2dx},${y2 + c2dy} ${x2},${y2}`;
}

function edgeColor(fromType: string, toType: string): { color: string; markerId: string } {
  if (fromType === "Import")  return { color: COLORS.import,  markerId: "arrow-amber"  };
  if (toType   === "Output")  return { color: COLORS.output,  markerId: "arrow-green"  };
  if (fromType === "Filter" || fromType === "AlgoAI") {
    return { color: COLORS.flow, markerId: "arrow-purple" };
  }
  return { color: COLORS.default, markerId: "arrow-blue" };
}

interface Props {
  model: DataPlanModel;
  positions: Record<string, NodeLayout>;
  sizes: Record<string, number>;
  graphWidth: number;
  graphHeight: number;
}

export default function EdgeLayer({ model, positions, sizes, graphWidth, graphHeight }: Props) {
  const edges: Array<{ id: string; path: string; color: string; markerId: string }> = [];

  for (const conn of model.connections) {
    const srcPos = positions[conn.from];
    const tgtPos = positions[conn.to];
    if (!srcPos || !tgtPos) continue;

    const srcH = sizes[conn.from] ?? 80;
    const tgtH = sizes[conn.to]   ?? 80;

    const { src, srcSide, tgt, tgtSide } = selectPorts(srcPos, srcH, tgtPos, tgtH);

    const fromEntity = model.entities[conn.from];
    const toEntity   = model.entities[conn.to];
    const { color, markerId } = edgeColor(fromEntity?.type ?? "", toEntity?.type ?? "");

    edges.push({
      id:   `${conn.from}→${conn.to}`,
      path: bezier(src.x, src.y, srcSide, tgt.x, tgt.y, tgtSide),
      color,
      markerId,
    });
  }

  return (
    <svg
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}
      width={graphWidth}
      height={graphHeight}
    >
      <defs>
        {marker("arrow-amber",  COLORS.import)}
        {marker("arrow-purple", COLORS.flow)}
        {marker("arrow-green",  COLORS.output)}
        {marker("arrow-blue",   COLORS.default)}
      </defs>
      {edges.map((e) => (
        <path
          key={e.id}
          d={e.path}
          stroke={e.color}
          strokeWidth={1.5}
          fill="none"
          markerEnd={`url(#${e.markerId})`}
        />
      ))}
    </svg>
  );
}
