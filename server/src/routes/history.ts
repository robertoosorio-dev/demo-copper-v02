import { Router } from "express";
import type { ProjectStore } from "../store.js";
import type { Version } from "@copper/contracts";

export interface EntityChangeSummary {
  id: string;
  type: string;
  name: string;
  plan: "data" | "media";
  kind: "added" | "removed" | "modified";
  changedFields?: string[];
}

export interface VersionDiff {
  fromVersion: number | null;
  toVersion: number;
  isInitial: boolean;
  entityChanges: EntityChangeSummary[];
  connectionsAdded: number;
  connectionsRemoved: number;
}

function entityName(e: Record<string, unknown>): string {
  return (e["name"] as string) ?? "(unnamed)";
}

function computeEntityDiff(from: Version | null, to: Version): VersionDiff {
  const fromDataEntities  = from?.plans.data.model?.entities  ?? {};
  const toDataEntities    = to.plans.data.model?.entities     ?? {};
  const fromMediaEntities = from?.plans.media.model?.entities ?? {};
  const toMediaEntities   = to.plans.media.model?.entities    ?? {};

  const changes: EntityChangeSummary[] = [];

  function diffPlan(
    fromMap: Record<string, unknown>,
    toMap: Record<string, unknown>,
    plan: "data" | "media",
  ) {
    const allIds = new Set([...Object.keys(fromMap), ...Object.keys(toMap)]);
    for (const id of allIds) {
      const fe = fromMap[id] as Record<string, unknown> | undefined;
      const te = toMap[id]   as Record<string, unknown> | undefined;
      if (!fe && te) {
        changes.push({ id, type: te["type"] as string, name: entityName(te), plan, kind: "added" });
      } else if (fe && !te) {
        changes.push({ id, type: fe["type"] as string, name: entityName(fe), plan, kind: "removed" });
      } else if (fe && te && JSON.stringify(fe) !== JSON.stringify(te)) {
        const changedFields = Object.keys(te).filter(
          (k) => JSON.stringify(fe[k]) !== JSON.stringify(te[k]),
        );
        changes.push({ id, type: te["type"] as string, name: entityName(te), plan, kind: "modified", changedFields });
      }
    }
  }

  diffPlan(fromDataEntities  as Record<string, unknown>, toDataEntities  as Record<string, unknown>, "data");
  diffPlan(fromMediaEntities as Record<string, unknown>, toMediaEntities as Record<string, unknown>, "media");

  const fromDataConns  = from?.plans.data.model?.connections.length  ?? 0;
  const toDataConns    = to.plans.data.model?.connections.length     ?? 0;
  const fromMediaConns = from?.plans.media.model?.connections.length ?? 0;
  const toMediaConns   = to.plans.media.model?.connections.length    ?? 0;

  const connectionsAdded   = Math.max(0, toDataConns - fromDataConns) + Math.max(0, toMediaConns - fromMediaConns);
  const connectionsRemoved = Math.max(0, fromDataConns - toDataConns) + Math.max(0, fromMediaConns - toMediaConns);

  return {
    fromVersion: from?.version ?? null,
    toVersion: to.version,
    isInitial: !from,
    entityChanges: changes,
    connectionsAdded,
    connectionsRemoved,
  };
}

export function makeHistoryRouter(store: ProjectStore): Router {
  const router = Router();

  // GET /api/projects/:id/versions — list all version summaries (newest first)
  router.get("/:id/versions", async (req, res) => {
    try {
      const summaries = await store.listVersionSummaries(req.params.id);
      res.json(summaries.slice().reverse()); // newest first
    } catch (err) {
      console.error("[history] list versions failed:", (err as Error).message);
      res.status(500).json({ error: "Failed to list versions" });
    }
  });

  // GET /api/projects/:id/versions/:ver/diff — entity-level diff vs parent
  router.get("/:id/versions/:ver/diff", async (req, res) => {
    try {
      const versionNum = Number(req.params.ver);
      const target = await store.loadVersionAt(req.params.id, versionNum);
      if (!target) return res.status(404).json({ error: "Version not found" });

      let parent: Version | null = null;
      if (target.parentVersion != null) {
        parent = await store.loadVersionAt(req.params.id, target.parentVersion);
      }

      res.json(computeEntityDiff(parent, target));
    } catch (err) {
      console.error("[history] diff failed:", (err as Error).message);
      res.status(500).json({ error: "Failed to compute diff" });
    }
  });

  return router;
}
