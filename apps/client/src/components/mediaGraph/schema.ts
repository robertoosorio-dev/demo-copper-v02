// Media graph schema — entity-type vocabulary for the client.
// Mirrors system/entity-types/index.ts (PascalCase keys).
// This is read-only runtime data, not versioned project state.

export const EXTERNAL_TYPES = new Set(["Campaign", "AdGroup"]);

export const COL_ORDER = [
  "Campaign",
  "AdGroup",
  "MediaPartner",
  "PlacementGroup",
  "Placement",
  "ExperienceGroup",
  "Creative",
  "LandingPageGroup",
  "LandingPage",
  "Pixel",
] as const;

export type MediaEntityTypeKey = (typeof COL_ORDER)[number];

export const STATUS_META: Record<string, { c: string; bg: string; bd: string }> = {
  planned:  { c: "#334155", bg: "#f8fafc", bd: "#cbd5e1" },
  synced:   { c: "#15803d", bg: "#f0fdf4", bd: "#86efac" },
  live:     { c: "#1e40af", bg: "#eff6ff", bd: "#93c5fd" },
  modified: { c: "#92400e", bg: "#fffbeb", bd: "#fcd34d" },
  drifted:  { c: "#b91c1c", bg: "#fef2f2", bd: "#fca5a5" },
};

export const TYPE_META: Record<string, { label: string; c: string; bg: string; bd: string; idPrefix: string }> = {
  Campaign:         { label: "Campaign",           c: "#475569", bg: "#f8fafc", bd: "#cbd5e1", idPrefix: "cmp"  },
  AdGroup:          { label: "Ad Group",           c: "#64748b", bg: "#f1f5f9", bd: "#94a3b8", idPrefix: "ag"   },
  MediaPartner:     { label: "Media Partner",      c: "#9d174d", bg: "#fdf2f8", bd: "#f9a8d4", idPrefix: "m"    },
  PlacementGroup:   { label: "Placement Group",    c: "#6d28d9", bg: "#f5f3ff", bd: "#c4b5fd", idPrefix: "pg"   },
  Placement:        { label: "Placement",          c: "#1e40af", bg: "#eff6ff", bd: "#93c5fd", idPrefix: "tag"  },
  ExperienceGroup:  { label: "Experience Group",   c: "#0f766e", bg: "#f0fdfa", bd: "#5eead4", idPrefix: "eg"   },
  Creative:         { label: "Creative",           c: "#9a3412", bg: "#fff7ed", bd: "#fdba74", idPrefix: "crv"  },
  LandingPageGroup: { label: "Landing Page Group", c: "#92400e", bg: "#fffbeb", bd: "#fcd34d", idPrefix: "LPS"  },
  LandingPage:      { label: "Landing Page",       c: "#78350f", bg: "#fefce8", bd: "#fde68a", idPrefix: "lp"   },
  Pixel:            { label: "Pixel",              c: "#155e75", bg: "#ecfeff", bd: "#67e8f9", idPrefix: "PIX"  },
};

export const COLS: Record<string, Array<{ k: string; l: string; w: number }>> = {
  Campaign:         [{ k:"name",l:"Campaign",w:200},{k:"partner",l:"Partner",w:90},{k:"objective",l:"Objective",w:110},{k:"extId",l:"Ext ID",w:110},{k:"status",l:"Status",w:80}],
  AdGroup:          [{ k:"name",l:"Ad Group",w:200},{k:"campaign",l:"Campaign",w:170},{k:"extId",l:"Ext ID",w:110},{k:"status",l:"Status",w:80}],
  MediaPartner:     [{ k:"name",l:"Partner",w:170},{k:"connector",l:"Connector",w:150},{k:"clickTracking",l:"Click Track",w:80},{k:"status",l:"Status",w:80},{k:"createdBy",l:"Created By",w:90}],
  PlacementGroup:   [{ k:"name",l:"Name",w:190},{k:"seat",l:"Seat",w:110},{k:"advertiser",l:"Advertiser",w:90},{k:"campaign",l:"Campaign",w:160},{k:"status",l:"Status",w:80}],
  Placement:        [{ k:"name",l:"Name",w:200},{k:"size",l:"Size",w:80},{k:"deliveryFormat",l:"Format",w:130},{k:"creativeUnit",l:"Creative Unit",w:90},{k:"dspCreativeId",l:"DSP Creative",w:100},{k:"status",l:"Status",w:80}],
  ExperienceGroup:  [{ k:"name",l:"Name",w:185},{k:"creativeUnit",l:"Creative Unit",w:90},{k:"servingStatus",l:"Serving",w:80},{k:"currentFlight",l:"Current Flight",w:145},{k:"impressions",l:"Imps",w:80},{k:"status",l:"Status",w:80}],
  Creative:         [{ k:"name",l:"Name",w:190},{k:"creativeUnit",l:"Creative Unit",w:90},{k:"sizes",l:"Sizes",w:110},{k:"costType",l:"Cost Type",w:120},{k:"qaStatus",l:"QA",w:80},{k:"status",l:"Status",w:80}],
  LandingPageGroup: [{ k:"name",l:"Name",w:165},{k:"scope",l:"Scope",w:90},{k:"description",l:"Description",w:210},{k:"status",l:"Status",w:80}],
  LandingPage:      [{ k:"condition",l:"Condition",w:100},{k:"weight",l:"Weight",w:60},{k:"url",l:"URL",w:240},{k:"status",l:"Status",w:80}],
  Pixel:            [{ k:"name",l:"Pixel",w:165},{k:"scope",l:"Scope",w:80},{k:"tracksInteraction",l:"Tracks",w:100},{k:"pixelType",l:"Type",w:90},{k:"targetingType",l:"Targets",w:80},{k:"status",l:"Status",w:80}],
};

export const ADJACENCY: Array<{ a: string; b: string }> = [
  { a:"Campaign",b:"AdGroup" },
  { a:"MediaPartner",b:"PlacementGroup" },
  { a:"PlacementGroup",b:"Placement" },
  { a:"Placement",b:"ExperienceGroup" },
  { a:"Placement",b:"Pixel" },
  { a:"ExperienceGroup",b:"Creative" },
  { a:"Creative",b:"LandingPageGroup" },
  { a:"Creative",b:"Pixel" },
  { a:"LandingPageGroup",b:"LandingPage" },
  { a:"LandingPageGroup",b:"ExperienceGroup" },
  { a:"PlacementGroup",b:"Campaign" },
  { a:"Placement",b:"AdGroup" },
];

export function getRelated(
  id: string,
  entities: Record<string, { type: string }>,
  connections: Array<{ from: string; to: string }>,
): Record<string, string[]> {
  const related: Record<string, string[]> = {};
  connections.forEach((c) => {
    if (c.from === id && entities[c.to]) {
      const t = entities[c.to].type;
      (related[t] = related[t] || []).push(c.to);
    }
    if (c.to === id && entities[c.from]) {
      const t = entities[c.from].type;
      (related[t] = related[t] || []).push(c.from);
    }
  });
  return related;
}

export function getRootRows(type: string, entities: Record<string, { type: string; name?: string }>) {
  return Object.entries(entities)
    .filter(([, e]) => e.type === type)
    .map(([id, e]) => ({ id, ...e }));
}

export function statusBadgeStyle(status: string) {
  const m = STATUS_META[status] ?? STATUS_META.planned;
  return { background: m.bg, color: m.c, border: `1px solid ${m.bd}` };
}

export function typeBadgeStyle(type: string) {
  const m = TYPE_META[type] ?? TYPE_META.MediaPartner;
  return { background: m.bg, color: m.c, border: `1px solid ${m.bd}` };
}
