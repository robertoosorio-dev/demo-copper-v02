# V2 Object Schemas

**Status:** Draft for review, revision 4.1 — rev 4 plus five GPT-driven refinements: (1) Import gets the survival test applied explicitly and is flagged open-but-leaning-owned; (2) connections carry *topology*, with execution-order under branching/merging deferred rather than claimed; (3) backend is *storage*-generic, not *meaning*-generic — type contracts live in the KB/card layer; (4) output fields are *owned-identity + projected-value*, not pure projections; (5) consistency inconsistency is legal only if visible **and bounded**. Grounded in the actual ver1 source (client + server + seed). Supersedes revision 3.

**Format:** concrete JSON shapes first, plain-English commentary after each — what is decided, what is deliberately loose, where a choice is buried.

---

## What changed in this revision (read first)

Revision 3 described the data model as the ver1 code happened to store it (separate `tables` / `flow.segments` / `flowObjects` arrays). That structure is being **redesigned**, not documented. The major shifts:

1. **Vocabulary: entities and connections, not nodes and edges.** The model is *entities* (things) joined by *connections* (lightweight, direction-optional pointers). "Node/edge" carried graph-theory baggage that biased toward one rendering (a floating canvas) and made the media tree-of-grids look like a special case. It is not special. A tree of grids is simply what entities-and-connections look like when drawn as nested grids. The vocabulary is renderer-neutral on purpose.

2. **The data model collapses to entities + connections.** The `segment` and `flowObject` containers are gone. A "feed" is no longer a stored container — it is a *path through connected entities* (a table → its filters → an output). Order and wiring live in the connections, which makes the flow **visible as the path on the canvas** rather than buried as array position.

3. **Both plans are the same *kind* of thing** (entities + connections) but remain **separate models with separate surfaces.** Media draws as a tree of grids; data draws as a flow. They read alike and the machinery wraps them alike, but they are coded separately and do not share one storage instance.

4. **"Output" is a de novo term** replacing the code's `uaRefs`. Always array-shaped, with a chosen `maxRows` and fields that each carry a single `sourceFieldId` over one unified `object.field` id space. Deliberately free of UA/DO legacy.

5. **Consistency is computational, never structural** — within a plan (doc ↔ model) and across plans. The model does not enforce agreement; workers compute it. Temporary inconsistency is a legal state — but legal **only if visible AND bounded**: a countable set of pending ripples the system is actively settling, never open-ended drift. Visibility without a bound is how "temporary" rots into permanent. We punt on *how* inconsistency resolves; we do not punt on the guarantee that it cannot silently persist.

6. **Storage: full state per version, browsable folder layout.** Diffs are computed, never stored.

---

# Part A — The machinery

System-level, domain-agnostic. Identical whether the system manages ad campaigns or recipes. Fully decided and unchanged in substance from rev 3.

**The single authoritative object is the Version.** Not the event, not the diff, not the reasoning. A diff is computed from two versions; reasoning references versions; a proposal bundles a computed diff with reasoning references. **Version is state; everything else is derived or descriptive.**

## A1. Version

One complete saved state of the whole project — a single JSON document. (Git's word: *version*.) The ver1 seed already has this shape: a project root with `context` + `plans`.

```json
{
  "id": "summer-campaign",
  "name": "Summer Campaign 2025",
  "version": 4,
  "parentVersion": 3,
  "authoredBy": "user",
  "createdAt": "2025-06-10T14:00:00Z",

  "context": {
    "contextFiles": [
      { "name": "brief.pdf", "kind": "file", "size": 184320, "addedAt": "..." }
    ],
    "exchanges": [
      { "id": "ex_01", "role": "user", "text": "...", "status": "success" }
    ]
  },

  "plans": {
    "data":     { "document": "# Data Plan\n...", "model": { "...": "see B1" } },
    "media":    { "document": "# Media Plan\n...", "model": { "...": "see B2" } },
    "creative": { "document": "", "model": null }
  }
}
```

**Decided.**
- A version is the entire project as one JSON document. Saving creates a version. **Full state, never a delta** (see A2 and the storage section for why).
- `version` / `parentVersion` form the linear chain. `authoredBy` is `"user"` or `"system"` — the three-layer authorship (base → user-authored → system-authored).
- **Four-layer structure made concrete:** `context` (shared, universal — files + conversation) sits at the project root, *outside* `plans`. Each entry in `plans` is one plan type, carrying its own `document` (the markdown face) and `model` (the structured face). Reality is the fourth layer — shared, underneath, and **out of scope** (does not exist yet, does not shape design).
- The version number is the **project's clock**, not a per-plan counter. One chain advances the whole project; a given version may touch any subset of plans.

**Deliberately loose.**
- `authoredBy` may later carry more (which user, which agent run). One field for now.

**Buried choice / flag.**
- **Naming standardized:** both plans use `model` for the structured face (ver1's media code calls it `graph` — renamed). A graph is one *projection* of the model, so `graph` is the wrong word for the canonical structure.

---

## A2. Diff

**A diff is computed, never stored.** It is derived by comparing two complete versions. This is a hard principle, not a convenience: **stored diffs accumulate error.** Deltas drift from the truth they describe, reconstructing "state at verN" by replaying them compounds mistakes, and the chain rots. Full versions are each independently true; diffs between them are always fresh and trustworthy.

A computed diff, as a value passed to a Proposed Change:

```json
{
  "from": 3,
  "to": 4,
  "changes": [
    {
      "path": "plans.data.model.entities[id=out_high_intent].maxRows",
      "kind": "modified",
      "before": 1,
      "after": 10
    },
    {
      "path": "plans.data.model.entities[id=fil_broad]",
      "kind": "added",
      "before": null,
      "after": { "id": "fil_broad", "type": "Filter", "name": "Broad Health" }
    }
  ]
}
```

**Decided.**
- Diff = `diff(versionA, versionB)`, derived from two full documents.
- One change is fully-qualified: a `path` into the document plus `before`/`after`. `kind` is `added` / `removed` / `modified` (add = `before:null`, remove = `after:null` — falls out of presence/absence).
- The JSON encoding (nested document, marked deltas) is what makes "show every property, mark only what changed, no row-per-change" work.

**Deliberately loose.**
- `path` syntax is illustrative. The real addressing scheme is an implementation detail; the *shape* (path + before + after + kind) is the decision.

**Buried choice / flag.**
- A whole-document diff reports every structural change, including incidental ones (a cached count). The diff renderer will eventually want a notion of "salient vs. incidental." Noted, not solved now.

---

## A3. Reasoning log entry

The reasoning is a **log** appended to whenever the system decides something. One pass of the black box returns an **array** of entries (it may decide several things per pass). Granularity falls out naturally — one entry per decision. ("Span" is not an object; "everything between v3 and v4" is just the entries from that pass.)

```json
{
  "id": "rlog_0012",
  "fromVersion": 3,
  "toVersion": 4,
  "pass": "pass_a1b2",
  "seq": 0,

  "reasoning": {
    "problem": "User asked to personalize the hero banner by loyalty tier.",
    "solution": "Use Experience Group targeting rather than Data Manager.",
    "justification": "Loyalty tier is a small enumerable set and the decision is presentation-only; a UI decision tree is clearer and avoids a join.",
    "alternativesConsidered": "Data Manager (mail-merge style) was considered and rejected: it fits high-cardinality row-level substitution, not a 3-way branch."
  },

  "producedChanges": ["chg_04_a", "chg_04_b"],
  "contextSeen": "ctx_hash_9f2e"
}
```

**Decided.**
- Append-only log. Each entry ties to `fromVersion`/`toVersion` and the `pass`; `seq` orders entries within a pass.
- `reasoning` is **one free-form JSON blob** with four fields: problem / solution / justification / alternativesConsidered. All free-form LLM text, expandable later without schema change.
- An entry **references** the changes it produced by id (`producedChanges`) — does not contain them. One reasoning entry → zero-or-more changes. **Zero is legal** — "considered Data Manager, rejected it" is a valid entry with empty `producedChanges`, and it is exactly the record that explains why an expected change didn't happen.
- `contextSeen` is a **reference** to the context state reasoned against, not a copy. This is what makes replay-as-context-correction possible: replay = take the log, amend the context at an entry, re-reason forward. **The canonical example (Appendix A) — Data Manager vs. Experience Group — is the reference case for why reasoning state must be preserved, not just object state.**

**Deliberately loose.**
- The four `reasoning` fields aren't individually enforced. Promote one later (e.g. render "alternatives" specially) without schema change.
- `contextSeen` as a hash assumes content-addressable context; can start as a plain reference for the prototype.

**Buried choice / flag.**
- This section is **intentionally more detailed than the current UX requires.** The prototype's more important goal is proving the architecture *can* support inspect / correct / replay. This is the proof surface, not future-debugger sugar. Keep it.

---

## A4. Proposed change

The **non-visual** form of a change offered for accept/reject — in scope; styling deferred. The data behind the diff-review surface. Ver1 has a thin version already (`pendingChange`, with base state kept for rollback).

```json
{
  "id": "prop_04",
  "planType": "data",
  "fromVersion": 3,
  "proposedVersion": 4,

  "summary": "Raise product-rec output cap to 10 rows; add Broad Health filter.",
  "diff": { "...": "a computed diff value, see A2" },
  "reasoning": ["rlog_0012", "rlog_0013"],

  "state": "pending",
  "base": { "...": "full version snapshot for rollback" }
}
```

**Decided.**
- Carries: a `summary` (composed in-card from structured data, **not** LLM prose), the computed `diff`, and references to the `reasoning` entries that justify it. Minimum viable shape: **summary + diff + reasoning.**
- `state` is `pending` / `accepted` / `rejected`. Accept lands HEAD at the proposed version; reject at base.
- `base` is a full version for rollback (consistent with full-state-per-version).

**Deliberately loose.**
- This is the **named-not-designed** object. The data shape is in scope; what the review *looks and feels like* (inline card vs. center-staged wizard, diff visualization) is still open.

**Buried choice / flag.**
- **Partial accept** (cherry-pick some changes) is **deferred** — the design holds at whole-state landing points to keep the chain linear and avoid diff accumulation.

---

# Part B — The content (the project model)

What lives inside `plans.*.model`. **Entities and connections.** The container shape is fixed enough to render; the contents of each entity stay flexible JSON so the entity vocabulary can grow without rewriting the container.

**Two principles govern Part B:**

**1. Entities and connections — renderer-neutral.** An **entity** is a thing (it has an `id`, a `type`, a `name`, and a flexible property bag). A **connection** is a lightweight, direction-optional pointer from one entity to another. That is the whole container. A "graph," a "tree of grids," and a "flow" are all just *drawings* of the same entities-and-connections. The model commits to none of them.

**2. Layout is never stored.** Positions are computed at render time (ver1 already does this — `layout/autoLayout.js` for data, the view components for media). The model holds **logical structure only**; visual arrangement is derived. This is the governing principle (Canonical → Projection → Surface) confirmed by working code: **layout is a projection, not state.**

**Generic backend, specific frontend.** The backend is **storage-generic**: it stores entities and connections with a `type` string, and a *new entity type can be introduced without new backend code* — no per-type mutation ops. The frontend is **type-aware**: each entity type has its own enforced visual treatment (a Table looks unmistakably unlike an Output), **with a graceful fallback renderer** for types it doesn't recognize yet. So: invent a type → backend stores it immediately → frontend renders it generically until someone designs its specific look. (This softens the old "unknown type = hard error" to "unknown type = default render.")

**Storage-generic is not meaning-generic.** A new type *stores* freely, but to be *validated, diffed meaningfully, and rendered specifically* it still needs a **type contract** — and that contract lives in the **system/KB layer (card metadata)**, as data, not as hand-written backend code. This is the KB-backed-cards architecture exactly: the backend stays type-agnostic for storage, while meaning (validation rules, diff salience, render spec) is supplied by a KB contract keyed to the type. So "no backend code for a new type" is true; "no contract anywhere for a new type" is not — the contract just isn't *code*, it's KB data. A type with no contract still stores and renders via fallback, but is not meaningfully validated until its contract exists.

**The canonical-object lens** (the survival test). An entity is **canonical** if its identity *survives changes to its context* (a Products table stays the Products table when its source moves CSV→BigQuery). It is **owned** if it exists only in service of a parent and has no identity apart from it. A **projection** is a view onto something else canonical. The tags below are the current best reading, and the next phase confirms or revises them.

## B1. Data-plan model (drawn as a flow)

Reconciled against the ver1 server's ops schema and seed data, then **redesigned** to entities + connections.

```json
{
  "name": "LMH Q3 Activation",

  "entities": {
    "tbl_events": {
      "type": "Table",
      "name": "HealthUserEvents",
      "tableType": "Input",
      "primaryKey": "user_id",
      "fields": [
        { "id": "fld_user_id", "name": "user_id", "dataType": "Text", "isPrimaryKey": true },
        { "id": "fld_event",   "name": "event_type", "dataType": "Text", "mode": "Stored", "role": "data" }
      ]
    },

    "imp_events": {
      "type": "Import",
      "name": "HealthUserEvents Feed",
      "source": "Health Portal",
      "frequency": "Daily"
    },

    "fil_high_intent": {
      "type": "Filter",
      "name": "High Intent",
      "predicate": "event_type = form_submit OR appt_request within 30d"
    },

    "alg_rank": {
      "type": "AlgoAI",
      "name": "Product Rank",
      "optimization": "CTR",
      "promoted": true
    },

    "out_high_intent": {
      "type": "Output",
      "name": "LMH High Intent",
      "maxRows": 1,
      "fields": [
        { "id": "of_user", "name": "user_id", "sourceFieldId": "tbl_events.fld_user_id" },
        { "id": "of_qs",   "name": "campaign", "sourceFieldId": "$impression.QUERY_STRING_Q" }
      ]
    }
  },

  "connections": [
    { "from": "imp_events", "to": "tbl_events" },
    { "from": "tbl_events", "to": "fil_high_intent" },
    { "from": "fil_high_intent", "to": "alg_rank" },
    { "from": "alg_rank", "to": "out_high_intent" }
  ]
}
```

**Decided.**
- The model is **`entities` (a map keyed by id) + `connections` (an array of pointers).** Identical container to media (B2).
- **The flow is the connection path.** `imp → table → filter → algo → output` is the "feed" — a path through connected entities, not a stored container. This is the Reality chain (store → feed → object) collapsed to what a human reads: table, the things done to it, the output. **Caveat (open):** a plain `{from, to}` connection defines *topology*, not necessarily *execution order*. Where paths branch or merge (two filters feeding one output — sequential? parallel? AND?), topology alone is ambiguous, and a connection will likely need a `type`/`sequence`/explicit path semantics. This is **deferred, not solved** — connections carry topology today; ordered-execution semantics are added when the branching/merging cases force them.

**Entity types and their canonical reads:**

- **Table — canonical.** The gravitational center. `tableType` (`Input` / `Standard`), `primaryKey`, `fields[]`.
- **Field — canonical.** Lives in a table; has its own identity. `dataType`, `mode` (Stored / Derived / Fetched), `role` (data / decision), `isPrimaryKey`.
- **Import — owned (leaning), pending one clarification.** A table *owns* an import (its extract/route/refresh definition); a table is *not* an import — a table survives swapping CSV→BigQuery, and ver1's code already separates them with a two-way reference (ownership, not identity). This is why the activation work moved deliberately from import-first to **table-first**. *But the survival test cuts both ways and needs one sentence to settle:* if "HealthUserEvents Feed" is a thing you **name and keep managing while its source changes underneath it** (Health Portal → a new CRM, same feed), then the import has surviving identity and is **canonical** like Filter. If it is merely "how this table refreshes," it is **owned**. The seed names imports with their own ids, which leans canonical; the table-first framing leans owned. Treated as **owned for now**, flagged as the one open canonical question in the data model.
- **Filter — canonical.** Has an `id`, a human `name` ("Items in stock", "Everything on sale"), and a mutable `predicate`. By the survival test it is canonical: the name/identity survives changes to the predicate. (Ver1 already implements filters as flow entities with id + name — this is *already built*, not a construction task as previously feared.)
- **AlgoAI / Route / and other transform types — canonical entity, communication-shaped promotion.** These carry `promoted` (a real boolean in ver1's data) — the "promotion is visual, not ontological" principle is literally a field. The transform is a real entity; whether a given *kind* deserves first-class visibility is a comprehension judgment the `promoted` flag records.
- **Output — canonical (de novo term, replacing `uaRefs`).** **Always array-shaped.** Has a chosen `maxRows` (the cap — "current store" resolves to 1 row; "product rec" caps at e.g. 10). Has `fields[]`, each `{ id, name, sourceFieldId }`. An output field is **owned by the Output for identity, projection-like for value**: its *name/macro* can matter operationally (downstream media may reference it by name), so it has identity *within* its parent and dies with the parent — that is *owned*, not pure projection. But its *value* traces to exactly one origin via `sourceFieldId` — that provenance is projection-like. Both/and: owned identity, projected value.

**The unified id space (important).**
- `sourceFieldId` is a single pointer of the form `object.field`. It needs no "origin kind" tag — the kind is read by resolving the pointer, never stored. **Don't store what you can resolve.**
- Origins are uniform: a project entity's field (`tbl_events.fld_user_id`) **or** a system-reserved object's field (`$impression.QUERY_STRING_Q`).
- **`$`-prefixed objects are system-reserved** — not user-creatable, but addressed identically to real entities. The `$` *is* the kind marker (a naming convention, not stored metadata). The reserved set is **finite and hardcoded**, bounded by the entity types the system can draw — same shelf as media's hardcoded type metadata, lives in the system/KB layer, never versioned. A `sourceFieldId` pointing at a reserved field is valid only if the system knows that field exists.

**Deliberately loose.**
- Field `dataType`, transform `kind`, and the exact import settings are free strings / flexible bags. New entity types and new transform kinds are addable without backend changes (generic backend).

**Buried choice / flag.**
- **`uaRefs` → `outputs`** is a real rename, not cosmetic — the de novo term is the point (no UA/DO baggage). Ver1's three seed UAs become scalar-feeling Outputs (maxRows 1); a product-rec is an Output with maxRows > 1. Same entity.
- The old `inFieldIds`/`outFieldIds` on flow objects are dropped in favor of **connections carrying the wiring** — consistent across both plans.

## B2. Media-plan model (drawn as a tree of grids)

Same container as B1 — entities + connections — but drawn primarily as a **tree of grids** (nested tables), not a flow. This is the surface difference; the storage idea is shared.

```json
{
  "entities": {
    "mp_meta":  { "type": "MediaPartner", "name": "Meta", "connector": "Meta Ads", "status": "synced" },
    "pg_q3":    { "type": "PlacementGroup", "name": "Q3 Prospecting", "status": "planned" },
    "pl_feed":  { "type": "Placement", "name": "Feed 1200x628", "size": "1200x628", "status": "planned" },
    "eg_hero":  { "type": "ExperienceGroup", "name": "Hero A/B", "status": "live" }
  },
  "connections": [
    { "from": "mp_meta", "to": "pg_q3" },
    { "from": "pg_q3",   "to": "pl_feed" },
    { "from": "pl_feed", "to": "eg_hero" }
  ]
}
```

**Decided.**
- Same `entities` + `connections` container. (Ver1's media model is already this shape — `entities` map + `relations` list — so this is a **rename + merge into the shared vocabulary**, not a redesign. `relations` → `connections`.)
- Entity types (10): MediaPartner, PlacementGroup, Placement, ExperienceGroup, Creative, LandingPageGroup, LandingPage, Pixel, Campaign, AdGroup. Each **canonical**, with `status` (planned / synced / live / modified / drifted) and a type-specific bag.
- **Connections are direction-optional with no inherent parent/child.** A tree is *one way to read* undirected connections by picking a root — which is exactly the "Organize By" capability (re-root the same connections to reorganize the grids). This is a media-model property worth preserving explicitly.
- Type metadata, legal adjacency, status vocabulary, column definitions are **system knowledge** (hardcoded, like ver1's `schema.js`), not per-project model data. The per-project model is just `entities` + `connections`.

**Deliberately loose.**
- Entity properties are per-type free bags.

**Buried choice / flag.**
- **The tree-of-grids is the primary surface, coded separately from the data flow surface.** Shared: the container shape and all of Part A. Not shared: the renderers/editors. Media and data read alike and version alike; they do not share visual code.
- The hard part was never the graph (media is strikingly simple — entities + connections). The complexity is in the **projections** (views, organize-by, inspection, mutation). That is a good sign: keep investment in the projections, not the container.

---

# Part C — Storage layout

GCS for the prototype. **Full state per version. Diffs computed, never stored.** External browsability is a first-class goal — a person should be able to open the bucket and *walk* the project as plain folders and files.

```
summer-campaign/
  ver01/
    project.json            ← full state of the whole project at v1
    media-plan/             ← (optional human-friendly split of the plan faces)
      document.md
      model.json
    transactions/
      pass_a1b2/            ← one folder = one transaction (one pass)
        rlog_0000.json      ← one file = one reasoning log entry
        rlog_0001.json
  ver02/
    project.json
    data-plan/ ...
    transactions/ ...
  ver04/
    project.json            ← full state; both plans present whether or not both changed
    ...
```

**Decided.**
- **Version is the outer folder**, plans are inside it — because a version is a property of the *project*, not of a plan. (Inverts an earlier `plan/version` instinct.)
- **Full state per version.** Each `verNN/` is a complete, self-contained snapshot. Open any version, see the whole project as it stood — no reconstruction, trivial folder-to-folder diffing. Chosen over delta folders specifically to avoid **diff accumulation rot**: stored deltas drift and compound; full versions are each independently true.
- **Version spill is natural.** The project clock advances as one chain; a version may touch any subset of plans (v1 media, v2 data, v4 both). Under full-state, every current plan is present in every version folder; *what changed* is answered by the computed diff, not by which folders exist.
- **The reasoning log is folders, not one fat JSON.** One folder per transaction (pass), one file per reasoning entry. Append-only by construction (drop a new file, never rewrite a big doc), and browsable — the transaction-log/QA viewer's job becomes a directory listing.
- **Artifacts isolated:** versions are folders, transactions are folders within, KB is its own area. The whole project is a navigable tree on disk — the same readability instinct as dropping "edges."

**Deliberately loose.**
- Whether the per-version split into `media-plan/document.md` + `model.json` is physically separate files or just keys inside `project.json` is a browsability nicety, not a model decision. Shown above as separate for human walkability; either is fine.

**Buried choice / flag.**
- **Hosted deployment is deferred.** GCS is plenty for the demo. When hosting comes up, the folder approach may move to SQLite or similar — but that is a later slice and does not shape the model now.

---

# Summary

**Part A — machinery (settled):**
- Version = full-state, chained, authored. The one authoritative object.
- Diff = computed, never stored (avoids accumulation rot).
- Reasoning = append-only log of free-form blobs, each referencing zero-or-more changes.
- Proposed change = summary + diff + reasoning refs, whole-proposal accept/reject.

**Part B — content (redesigned to entities + connections):**
- One container shape for both plans: `entities` (typed, flexible bag) + `connections` (lightweight, direction-optional). Renderer-neutral.
- Generic backend (add a type without code) / specific frontend (per-type visuals, graceful fallback).
- Layout is derived, never stored.
- Data plan drawn as a flow (feed = a connection path); media plan drawn as a tree of grids. Same storage idea, separate surfaces, separately coded.

**Entity canonical reads:**

| Entity | Tag | Note |
|---|---|---|
| Table | canonical | center of the data model; survives source changes |
| Field | canonical | lives in a table, own identity |
| Filter | canonical | id + name survive predicate changes; already built in ver1 |
| Import | owned (leaning) / open | table *owns* it; canonical if you keep+rename it across source changes — one clarification pending |
| AlgoAI / transforms | canonical + promoted | `promoted` flag = communication-shaped, in the data |
| Output | canonical | de novo; always array; maxRows; fields are owned-identity + projected-value |
| Output field | owned + projected | identity owned by Output; value traces to one `sourceFieldId` |
| Media entities (10) | canonical | status + type bag; connections direction-optional |
| Connection | relationship | lightweight pointer; no independent identity |

**Cross-cutting principles:**
- Consistency is computational, never structural — within a plan (doc↔model) and across plans. Inconsistency is legal only if *visible AND bounded* (a countable set of pending ripples being settled, never open-ended drift); resolution mechanics are punted to observe the ripples (no "ACID before SQL"), but silent-persistence is not.
- One unified id space: `object.field`, project entities or `$`-reserved system objects; kind read by resolving, never stored.
- Reserved objects are finite, hardcoded, system-layer, bounded by drawable types.

**Correctly parked (next phase):**
- Final ratification of the canonical-entity set per plan (this doc gives the current read).
- The Proposed-Change *surface* design (inline vs. wizard).
- Any genuinely new entity types — addable without backend change by design.
