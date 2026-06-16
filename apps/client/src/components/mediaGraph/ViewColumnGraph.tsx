import React, { useState, useRef, useEffect, useMemo } from "react";
import type { MediaPlanModel } from "@copper/contracts";
import { TYPE_META, COL_ORDER, EXTERNAL_TYPES, statusBadgeStyle } from "./schema.js";

const NW = 155;
const NH = 62;
const CGAP = 195;
const ROW_GAP = 8;

const POSITIONS_KEY = "copper-gn-positions";

function loadPositions(): Record<string, { x: number; y: number }> {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function savePositions(pos: Record<string, { x: number; y: number }>) {
  try {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(pos));
  } catch {}
}

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

  return { tx, txRef };
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
  const { tx, txRef } = usePanZoom(containerRef);

  const layout = useMemo(() => computeLayout(entities, organizeBy), [entities, organizeBy]);
  const { nodes, orderedTypes, totalW, totalH, fenceX } = layout;

  // Per-node position overrides (drag moves)
  const [posOverrides, setPosOverrides] = useState<Record<string, { x: number; y: number }>>(() => loadPositions());
  const draggingNode = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);

  // Apply overrides to layout nodes
  const effectiveNodes = useMemo(() =>
    nodes.map((n) => posOverrides[n.id] ? { ...n, ...posOverrides[n.id] } : n),
    [nodes, posOverrides],
  );

  const nodeMap = useMemo(() => {
    const m: Record<string, NodePos> = {};
    effectiveNodes.forEach((n) => { m[n.id] = n; });
    return m;
  }, [effectiveNodes]);

  // Node drag handlers
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingNode.current) return;
      const { id, sx, sy, ox, oy } = draggingNode.current;
      const scale = txRef.current.scale;
      const dx = (e.clientX - sx) / scale;
      const dy = (e.clientY - sy) / scale;
      setPosOverrides((prev) => ({ ...prev, [id]: { x: ox + dx, y: oy + dy } }));
    };
    const onUp = () => {
      if (draggingNode.current) {
        draggingNode.current = null;
        setPosOverrides((prev) => { savePositions(prev); return prev; });
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNodeMouseDown = (e: React.MouseEvent, id: string, x: number, y: number) => {
    e.stopPropagation();
    draggingNode.current = { id, sx: e.clientX, sy: e.clientY, ox: x, oy: y };
  };

  const handleNodeClick = (e: React.MouseEvent, id: string) => {
    // Only register as a click if we didn't drag
    if (draggingNode.current) return;
    e.stopPropagation();
    onSelectionChange(selection.includes(id) ? selection.filter((i) => i !== id) : [...selection, id]);
  };

  const rootColIdx = orderedTypes.indexOf(organizeBy);
  const rootColX   = rootColIdx >= 0 ? rootColIdx * CGAP + 16 : null;

  // Canvas size accounts for dragged nodes
  const allX = effectiveNodes.map((n) => n.x + NW);
  const allY = effectiveNodes.map((n) => n.y + NH);
  const dynW = allX.length ? Math.max(...allX) + 40 : totalW;
  const dynH = allY.length ? Math.max(...allY) + 40 : totalH;

  return (
    <div className="mg-v3" ref={containerRef} onClick={() => onSelectionChange([])}>
      <div
        style={{
          transform: `translate(${tx.x}px,${tx.y}px) scale(${tx.scale})`,
          transformOrigin: "0 0",
          position: "relative",
          width: dynW,
          height: dynH,
        }}
      >
        <svg style={{ position: "absolute", inset: 0, width: dynW, height: dynH, overflow: "visible", pointerEvents: "none" }}>
          <defs>
            <marker id="v3-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={4} markerHeight={4} orient="auto-start-reverse">
              <path d="M2 2L8 5L2 8" fill="none" stroke="#c8c5ba" strokeWidth={1.5} strokeLinecap="round" />
            </marker>
          </defs>

          {rootColX !== null && (
            <rect x={rootColX - 4} y={16} width={NW + 8} height={dynH - 20} rx={6} fill={(TYPE_META[organizeBy] ?? TYPE_META.MediaPartner).bg} opacity={0.45} />
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
              <line x1={fenceX} y1={16} x2={fenceX} y2={dynH - 10} stroke="var(--b2)" strokeWidth={1} strokeDasharray="4 3" />
              <text x={fenceX} y={dynH / 2} textAnchor="middle" fontSize={8} fill="var(--txt3)" fontWeight={600} letterSpacing=".8px" style={{ textTransform: "uppercase", fontFamily: "var(--font)", writingMode: "vertical-rl" }}>
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

        {effectiveNodes.map((n) => {
          const tm = TYPE_META[n.type] ?? TYPE_META.MediaPartner;
          const sm = statusBadgeStyle(n.status ?? "planned");
          const isSel = selection.includes(n.id);
          const isExternal = EXTERNAL_TYPES.has(n.type);
          return (
            <div
              key={n.id}
              className={`gn-card${isSel ? " sel" : ""}${isExternal ? " external" : ""}`}
              style={{ position: "absolute", left: n.x, top: n.y, width: NW, height: NH, borderLeftColor: tm.c, cursor: "grab" }}
              onMouseDown={(e) => handleNodeMouseDown(e, n.id, n.x, n.y)}
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
