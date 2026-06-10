import React, { useState, useRef, useEffect, useMemo } from "react";
import type { MediaPlanModel } from "@copper/contracts";
import { TYPE_META, COL_ORDER, EXTERNAL_TYPES, statusBadgeStyle } from "./schema.js";

const NW = 155;
const NH = 62;
const CGAP = 195;
const ROW_GAP = 8;

interface NodePos { id: string; type: string; name?: string; status?: string; size?: string; col: number; x: number; y: number; [k: string]: unknown }

function computeLayout(entities: MediaPlanModel["entities"], organizeBy: string) {
  const orgIdx = COL_ORDER.indexOf(organizeBy as (typeof COL_ORDER)[number]);
  const orderedTypes: string[] =
    orgIdx >= 0
      ? [...COL_ORDER.slice(orgIdx), ...COL_ORDER.slice(0, orgIdx)]
      : [...COL_ORDER];

  const colIdx: Record<string, number> = {};
  orderedTypes.forEach((t, i) => { colIdx[t] = i; });

  const colY: Record<number, number> = {};
  const nodes: NodePos[] = Object.entries(entities).map(([id, e]) => {
    const col = colIdx[e.type] ?? 0;
    colY[col] = colY[col] ?? 0;
    const x = col * CGAP + 16;
    const y = colY[col] + 20;
    colY[col] = (colY[col] ?? 0) + NH + ROW_GAP;
    return { id, ...e as object, col, x, y } as NodePos;
  });

  const maxY = Object.values(colY).reduce((a, b) => Math.max(a, b), 0);
  const totalW = orderedTypes.length * CGAP + NW + 40;
  const totalH = maxY + NH + 40;

  let fenceX: number | null = null;
  for (let i = 0; i < orderedTypes.length - 1; i++) {
    const curExt  = EXTERNAL_TYPES.has(orderedTypes[i]);
    const nextExt = EXTERNAL_TYPES.has(orderedTypes[i + 1]);
    if (curExt !== nextExt) {
      const rightEdge = i * CGAP + 16 + NW;
      const leftEdge  = (i + 1) * CGAP + 16;
      fenceX = (rightEdge + leftEdge) / 2;
      break;
    }
  }

  return { nodes, orderedTypes, colIdx, totalW, totalH, fenceX };
}

function usePanZoom(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [tx, setTx] = useState({ x: 20, y: 20, scale: 1 });
  const dragging = useRef<{ sx: number; sy: number; orig: typeof tx } | null>(null);
  const txRef = useRef(tx);
  useEffect(() => { txRef.current = tx; }, [tx]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setTx((t) => {
        const newScale = Math.min(2.5, Math.max(0.15, t.scale * factor));
        const rect = el.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        return { x: px - ((px - t.x) * newScale) / t.scale, y: py - ((py - t.y) * newScale) / t.scale, scale: newScale };
      });
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as Element).closest(".gn-card")) return;
      dragging.current = { sx: e.clientX, sy: e.clientY, orig: { ...txRef.current } };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const { sx, sy, orig } = dragging.current;
      setTx({ ...orig, x: orig.x + e.clientX - sx, y: orig.y + e.clientY - sy });
    };
    const onMouseUp = () => { dragging.current = null; };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return tx;
}

interface Props {
  model: MediaPlanModel;
  organizeBy: string;
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
}

export default function ViewColumnGraph({ model, organizeBy, selection, onSelectionChange }: Props) {
  const { entities, connections } = model;
  const containerRef = useRef<HTMLDivElement>(null);
  const tx = usePanZoom(containerRef);

  const layout = useMemo(() => computeLayout(entities, organizeBy), [entities, organizeBy]);
  const { nodes, orderedTypes, totalW, totalH, fenceX } = layout;

  const nodeMap = useMemo(() => {
    const m: Record<string, NodePos> = {};
    nodes.forEach((n) => { m[n.id] = n; });
    return m;
  }, [nodes]);

  const handleNodeClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onSelectionChange(selection.includes(id) ? selection.filter((i) => i !== id) : [...selection, id]);
  };

  const rootColIdx = orderedTypes.indexOf(organizeBy);
  const rootColX   = rootColIdx >= 0 ? rootColIdx * CGAP + 16 : null;

  return (
    <div className="mg-v3" ref={containerRef} onClick={() => onSelectionChange([])}>
      <div
        style={{
          transform: `translate(${tx.x}px,${tx.y}px) scale(${tx.scale})`,
          transformOrigin: "0 0",
          position: "relative",
          width: totalW,
          height: totalH,
        }}
      >
        <svg style={{ position: "absolute", inset: 0, width: totalW, height: totalH, overflow: "visible", pointerEvents: "none" }}>
          <defs>
            <marker id="v3-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={4} markerHeight={4} orient="auto-start-reverse">
              <path d="M2 2L8 5L2 8" fill="none" stroke="#c8c5ba" strokeWidth={1.5} strokeLinecap="round" />
            </marker>
          </defs>

          {rootColX !== null && (
            <rect x={rootColX - 4} y={16} width={NW + 8} height={totalH - 20} rx={6} fill={(TYPE_META[organizeBy] ?? TYPE_META.MediaPartner).bg} opacity={0.45} />
          )}

          {orderedTypes.map((t, i) => {
            const tm = TYPE_META[t] ?? TYPE_META.MediaPartner;
            const isExternal = EXTERNAL_TYPES.has(t);
            return (
              <text key={t} x={i * CGAP + 16 + NW / 2} y={12} textAnchor="middle" fontSize={9} fontWeight={600} letterSpacing=".8px" fill={tm.c} opacity={isExternal ? 0.6 : 1} style={{ textTransform: "uppercase", fontFamily: "var(--font)" }}>
                {tm.label}
              </text>
            );
          })}

          {fenceX !== null && (
            <g>
              <line x1={fenceX} y1={16} x2={fenceX} y2={totalH - 10} stroke="var(--b2)" strokeWidth={1} strokeDasharray="4 3" />
              <text x={fenceX} y={totalH / 2} textAnchor="middle" fontSize={8} fill="var(--txt3)" fontWeight={600} letterSpacing=".8px" style={{ textTransform: "uppercase", fontFamily: "var(--font)", writingMode: "vertical-rl" }}>
                fence
              </text>
            </g>
          )}

          {connections.map((c, ci) => {
            const s = nodeMap[c.from];
            const t = nodeMap[c.to];
            if (!s || !t) return null;
            const x1 = s.x + NW;
            const y1 = s.y + NH / 2;
            const x2 = t.x;
            const y2 = t.y + NH / 2;
            const mx = (x1 + x2) / 2;
            const crossFence = EXTERNAL_TYPES.has(s.type) !== EXTERNAL_TYPES.has(t.type);
            return (
              <path key={ci} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke={crossFence ? "var(--blue-bd)" : "#d4d0c8"} strokeWidth={crossFence ? 1.5 : 1.2} strokeOpacity={crossFence ? 0.7 : 0.8} markerEnd="url(#v3-arrow)" />
            );
          })}
        </svg>

        {nodes.map((n) => {
          const tm = TYPE_META[n.type] ?? TYPE_META.MediaPartner;
          const sm = statusBadgeStyle(n.status ?? "planned");
          const isSel = selection.includes(n.id);
          const isExternal = EXTERNAL_TYPES.has(n.type);
          return (
            <div
              key={n.id}
              className={`gn-card${isSel ? " sel" : ""}${isExternal ? " external" : ""}`}
              style={{ position: "absolute", left: n.x, top: n.y, width: NW, height: NH, borderLeftColor: tm.c }}
              onClick={(e) => handleNodeClick(e, n.id)}
              title={n.name}
            >
              <div className="gn-type" style={{ color: tm.c }}>{tm.label}</div>
              <div className="gn-name">{n.name ?? n.id}</div>
              <div className="gn-ft">
                <span className="mg-badge" style={{ ...sm, fontSize: 9, padding: "1px 5px", borderRadius: 3 }}>
                  {n.status ?? "planned"}
                </span>
                {n.size && <span style={{ fontSize: 9, color: "var(--txt3)", fontFamily: "var(--mono)" }}>{n.size}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
