import type { Version, Intent, DataPlanEntity, MediaPlanEntity } from "@copper/contracts";

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

    default:
      return v;
  }
}
