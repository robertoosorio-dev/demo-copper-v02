import type { Version, Intent, DataPlanEntity, MediaPlanEntity, CreativePlanModel } from "@copper/contracts";

export function applyOps(version: Version, ops: Intent[]): Version {
  return ops.reduce(applyOp, version);
}

function applyOp(v: Version, op: Intent): Version {
  switch (op.op) {
    case "updateDocument":
      if (op.planType === "data")
        return { ...v, plans: { ...v.plans, data:  { ...v.plans.data,  document: op.document } } };
      if (op.planType === "media")
        return { ...v, plans: { ...v.plans, media: { ...v.plans.media, document: op.document } } };
      return v;

    case "addEntity": {
      if (op.planType === "data") {
        const m = v.plans.data.model ?? { entities: {}, connections: [] };
        return { ...v, plans: { ...v.plans, data: { ...v.plans.data,
          model: { ...m, entities: { ...m.entities, [op.id]: op.entity as DataPlanEntity } } } } };
      }
      if (op.planType === "media") {
        const m = v.plans.media.model ?? { entities: {}, connections: [] };
        return { ...v, plans: { ...v.plans, media: { ...v.plans.media,
          model: { ...m, entities: { ...m.entities, [op.id]: op.entity as MediaPlanEntity } } } } };
      }
      return v;
    }

    case "modifyEntity": {
      if (op.planType === "data" && v.plans.data.model) {
        const existing = v.plans.data.model.entities[op.id];
        if (!existing) return v;
        return { ...v, plans: { ...v.plans, data: { ...v.plans.data,
          model: { ...v.plans.data.model,
            entities: { ...v.plans.data.model.entities,
              [op.id]: { ...existing, ...op.patch } as DataPlanEntity } } } } };
      }
      if (op.planType === "media" && v.plans.media.model) {
        const existing = v.plans.media.model.entities[op.id];
        if (!existing) return v;
        return { ...v, plans: { ...v.plans, media: { ...v.plans.media,
          model: { ...v.plans.media.model,
            entities: { ...v.plans.media.model.entities,
              [op.id]: { ...existing, ...op.patch } as MediaPlanEntity } } } } };
      }
      return v;
    }

    case "removeEntity": {
      if (op.planType === "data" && v.plans.data.model) {
        const { [op.id]: _r, ...rest } = v.plans.data.model.entities;
        return { ...v, plans: { ...v.plans, data: { ...v.plans.data,
          model: { ...v.plans.data.model, entities: rest } } } };
      }
      if (op.planType === "media" && v.plans.media.model) {
        const { [op.id]: _r, ...rest } = v.plans.media.model.entities;
        return { ...v, plans: { ...v.plans, media: { ...v.plans.media,
          model: { ...v.plans.media.model, entities: rest } } } };
      }
      return v;
    }

    case "addConnection": {
      if (op.planType === "data" && v.plans.data.model)
        return { ...v, plans: { ...v.plans, data: { ...v.plans.data,
          model: { ...v.plans.data.model,
            connections: [...v.plans.data.model.connections, op.connection] } } } };
      if (op.planType === "media" && v.plans.media.model)
        return { ...v, plans: { ...v.plans, media: { ...v.plans.media,
          model: { ...v.plans.media.model,
            connections: [...v.plans.media.model.connections, op.connection] } } } };
      return v;
    }

    case "removeConnection": {
      if (op.planType === "data" && v.plans.data.model)
        return { ...v, plans: { ...v.plans, data: { ...v.plans.data,
          model: { ...v.plans.data.model,
            connections: v.plans.data.model.connections.filter(
              (c) => !(c.from === op.from && c.to === op.to)) } } } };
      if (op.planType === "media" && v.plans.media.model)
        return { ...v, plans: { ...v.plans, media: { ...v.plans.media,
          model: { ...v.plans.media.model,
            connections: v.plans.media.model.connections.filter(
              (c) => !(c.from === op.from && c.to === op.to)) } } } };
      return v;
    }

    case "patchCreative": {
      const existingSlot = (v.plans as any).creative ?? { document: "", model: null };
      const existing: CreativePlanModel = existingSlot.model ?? {
        deliveryType: null,
        personalizationStrategies: [],
        productDisplayOrder: [],
      };
      const patch = op.patch;
      const merged: CreativePlanModel = {
        ...existing,
        ...patch,
        // Deep-merge strategies array: patch replaces by id, new ones are appended
        personalizationStrategies: patch.personalizationStrategies !== undefined
          ? mergeStrategies(existing.personalizationStrategies, patch.personalizationStrategies)
          : existing.personalizationStrategies,
      };
      return { ...v, plans: { ...v.plans, creative: { ...existingSlot, model: merged } } };
    }

    case "askClarification":
      // UI-only signal — questions are surfaced to the client via the exchange,
      // not stored in version state. No-op here.
      return v;

    case "patchContext": {
      const existing = (v.context as unknown as Record<string, unknown>) ?? {};
      const existingBrief = (existing.brief ?? {}) as Record<string, unknown>;
      const patchBrief = (op.patch.brief ?? {}) as Record<string, unknown>;

      // Merge confirmedSteps as a set (append-only, no duplicates)
      const existingConfirmed = (existing.confirmedSteps ?? []) as string[];
      const patchConfirmed = (op.patch.confirmedSteps ?? []) as string[];
      const mergedConfirmed = Array.from(new Set([...existingConfirmed, ...patchConfirmed]));

      const patch = { ...op.patch } as Record<string, unknown>;
      delete patch.brief;
      delete patch.confirmedSteps;

      return {
        ...v,
        context: {
          ...existing,
          ...patch,
          // Deep-merge brief so we don't wipe fields the LLM didn't mention
          brief: { ...existingBrief, ...patchBrief },
          confirmedSteps: mergedConfirmed,
        } as typeof v.context,
      };
    }

    default:
      return v;
  }
}

function mergeStrategies(
  existing: import("@copper/contracts").PersonalizationStrategy[],
  incoming: import("@copper/contracts").PersonalizationStrategy[],
): import("@copper/contracts").PersonalizationStrategy[] {
  const map = new Map(existing.map((s) => [s.id, s]));
  for (const s of incoming) map.set(s.id, s);
  return Array.from(map.values());
}
