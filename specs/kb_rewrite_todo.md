# KB Rewrite — Work Log and To-Do

**Status:** Diagnosis complete. Fix not yet started.
**Started:** 2026-06-11
**Context:** See `qa_runbook1.md` for the test protocol (phases 1–4).

---

## What we found (diagnosis)

### The root cause

The KB is written entirely for the **v1 data model**. The v2 system uses a different model. These two are in direct conflict and the KB wins because it is more verbose than the system prompt entity reference.

**v1 model (what the KB describes):**
- Tables, Fields, FlowSegments, FlowObjects, UARef objects, ActivationEntry, Imports
- Mutation = "return the complete model JSON" (see `patterns.md` General Mutation Rules rule 1)
- Impression = an `[Input]` table with `impression_id` PK (per `data-plan-document.md` example)
- Activation = emergent property of FlowSegment + FlowObject combination (no discrete entity)
- Output = outbound UARef objects

**v2 model (what the system prompt and ops format require):**
- Entities and connections — `addEntity`, `addConnection`, `modifyEntity`, `removeEntity`, `removeConnection`, `updateDocument`
- Entity types for data plan: `Table`, `Import`, `Filter`, `AlgoAI`, `Output`
- Impression = NOT defined as an entity type anywhere (see gap below)
- Activation rule = maps to `Filter` or `AlgoAI` entity (but KB never says this)
- Output = `Output` entity with `maxRows` and `fields[]`

### The system prompt (`server/src/llm/systemPrompt.ts`)

The system prompt correctly asks for v2 ops format and lists entity types:
```
Table     — name, tableType (Input|Transform|Standard), fields[]
Import    — name, source, frequency, syncMode
Filter    — name, predicate
AlgoAI    — name, optimization, promoted (boolean)
Output    — name, maxRows, fields[]
```

It also injects the full KB content verbatim as `## DOMAIN KNOWLEDGE`. The KB is ~87 files worth of content describing the v1 model. The detailed v1 guidance overwhelms the sparse v2 entity reference.

### Gap classification (per runbook Phase 1 step 4)

**Primary: (a) absent** — No KB doc states "the default shape is Impression + activation rule + Output." The v1 KB has no such directive and can't have one because it doesn't know about v2 entity types.

**Secondary: the KB actively misleads** — It is worse than absent. It tells the LLM to think in v1 terms (Tables, FlowObjects, UARef) and return a complete graph JSON. This actively produces wrong output: stored tables under Data Sources, no Output entity, no activation rule entity.

### Specific problems to fix

1. **Impression entity type is undefined in v2.** The runbook expects "an impression entity" in almost every data plan. The system prompt entity type list does NOT include `Impression`. Options:
   - Add `Impression` as a new v2 entity type (requires schema + system prompt + KB change)
   - OR clarify that impression is represented as `Table` with `tableType: "Input"` — but the runbook explicitly says "do not model impression as a stored source table"
   - OR impression is the `$impression.*` reserved object system (CLAUDE.md section 4B) and does NOT appear as a project entity at all — in which case the KB should explain this and the system prompt should reference it
   - **TODO(human): Decide what "Impression entity" means in v2 before writing KB.** This is the single most important open question.

2. **"Activation rule" entity type is undefined.** The runbook says "at least one activation rule entity." The closest v2 types are `Filter` (predicate-based) and `AlgoAI` (recommendation/ML). The KB needs to say: "an activation rule is a Filter or AlgoAI entity."

3. **Output entity is in the schema but never explained.** The KB has no guidance on when to create an Output entity, what fields to put in it, or how its `sourceFieldId` references work. The system prompt lists `Output — name, maxRows, fields[]` with no context on how it connects to impression context or activation rules.

4. **KB general mutation rules say "return the complete model."** `patterns.md` Rule 1 explicitly says "Return the complete model. Not a patch, not a diff." This directly contradicts the system prompt which expects a `{ reasoning, ops, reply }` JSON object. The LLM receives conflicting instructions and the KB rule is more prominent.

5. **All 11 KB patterns describe v1 primitives.** Every pattern in `patterns.md` builds FlowSegments, FlowObjects, and UARefs — none of which are valid v2 ops. These patterns are not just unhelpful, they actively teach wrong output format.

6. **`data-plan-document.md` example shows Impressions as an Input table.** The LLM follows concrete examples. This one example in the document format guide will cause "impression" to always be interpreted as a stored table with an `impression_id` PK.

---

## What needs to be done

### Step 1 — Resolve the Impression entity question (human decision required)

Before writing any KB, answer: **in v2, what IS the impression?**

Three options:
- **(A) Impression is a v2 entity type** — add it to the schema, to the system prompt entity reference, and write KB for it. It would be `addEntity` with `type: "Impression"`, fields would be the inbound context attributes (dmp_id, geo, device, placement_id). This is the cleanest model.
- **(B) Impression uses `$impression.*` reserved objects only** — it never appears as a project entity. Output fields reference `$impression.dmp_id` etc. via `sourceFieldId`. KB should explain this. No `addEntity` op for impression — instead the plan's Output entity has fields sourced from `$impression.*`.
- **(C) Impression is a Table entity with tableType "Input"** — the least clean option; explicitly contradicts the runbook's instruction to not model impression as a stored table.

**Recommendation: Option A** (add Impression as a proper v2 entity type). It makes the data model explicit, matches the runbook's expectation, and makes the KB easy to write. It requires a small schema addition but gives the LLM something concrete to emit.

### Step 2 — Rewrite the data-activation KB for v2

The entire `knowledge/data-activation/` folder needs to be rewritten. The v1 KB files (`activation-graph.md`, `patterns.md`, `schema.md`, `data-plan-document.md`, `etl-patterns.md`) can be archived or replaced.

New KB must cover:

**A. The default shape directive (highest priority)**
```
Every data plan should default to:
1. An Impression entity — the runtime entry context
2. At least one activation rule — a Filter or AlgoAI entity
3. An Output entity — the goal, what gets delivered back

A plan with only Table entities and no activation rule and no Output is incomplete.
When in doubt, propose Output fields. It is better to propose one that may not be
needed than to omit one that is.
```

**B. What each entity type IS and when to create it**
- `Impression` — the entry context. Not a stored table. Has fields for each inbound attribute (dmp_id, geo, device, placement_id). Created once per plan. There is only one.
- `Table` — stored data the plan works with (user profiles, product catalogs, etc.). `tableType`: Input (ETL'd, read-only), Transform (derived from other tables), Standard (anything else).
- `Filter` — an activation rule that gates or filters based on a predicate. E.g., "by zip", "by segment", "eligibility check".
- `AlgoAI` — an activation rule that produces a ranked/recommended list. E.g., "product-by-zip recommendation". Has `optimization` (CTR, CVR, etc.) and `promoted` (boolean for canvas visibility).
- `Import` — ETL descriptor for a Table. Has `source`, `frequency`, `syncMode`.
- `Output` — the goal. Array-shaped result delivered back. Has `maxRows` and `fields[]`. Each field has a `sourceFieldId` pointing to a Table field, an AlgoAI output, or a `$impression.*` reserved attribute.

**C. The activation flow (connections)**
- Impression → Filter/AlgoAI → Table (the lookup) → Output
- `addConnection` wires the flow
- Connections carry topology only, no sequence semantics

**D. The ops format (replace the "return the complete model" rule)**
Replace the v1 instruction with:
```
All mutations are expressed as ops arrays. Never return a complete JSON model.
Use: addEntity, addConnection, modifyEntity, removeEntity, removeConnection, updateDocument.
```

**E. Output field sourcing**
- Output fields reference source values via `sourceFieldId: "entity_id.field_name"` OR `$impression.geo` etc.
- When adding Output fields, look at what the AlgoAI or Table produces and wire those as sources.
- Over-index on proposing Output fields — if a value could plausibly be useful to creative, add it.

**F. Geo expansion pattern (keep from etl-patterns.md, translate to v2)**
The ProductsByZip / StoresByZip pattern is still valid — just expressed as `addEntity` + `addConnection` instead of FlowSegment + FlowObject.

### Step 3 — Update the system prompt entity reference

`server/src/llm/systemPrompt.ts` needs to be updated to:
1. Add `Impression` to the entity type reference (if Option A is chosen above)
2. Expand the entity descriptions to include brief "when to use" context, not just field list
3. Strengthen the default shape rule: add an explicit rule that data plans must include Output

Current sparse reference:
```
Table     — name, tableType (Input|Transform|Standard), fields[]
Filter    — name, predicate
AlgoAI    — name, optimization, promoted (boolean)
Output    — name, maxRows, fields[]
```

Should become something like (after Impression decision):
```
Impression — the runtime entry context. One per plan. Fields: dmp_id, geo, device, placement_id.
Table      — stored data (tableType: Input|Transform|Standard). Fields contain the data values.
Filter     — activation rule: gates/filters on a predicate (e.g. by zip, by segment).
AlgoAI     — activation rule: produces ranked recommendations. optimization, promoted.
Import     — ETL descriptor for a Table. source, frequency, syncMode.
Output     — the plan's goal. maxRows, fields[]. Each field has sourceFieldId.
```

And add a new rule (after current RULES section):
```
6. Data plans must include at least one Output entity. If the user's request is
   plausible for output, propose Output fields. Err on the side of inclusion.
7. The default data plan shape is: Impression → activation rule (Filter or AlgoAI)
   → Table → Output. A plan with only Tables is incomplete.
```

### Step 4 — Test loop (per qa_runbook1.md phases 3-4)

After writing the new KB to GCS and restarting the server:

**Test message:**
```json
{ "message": "add impression, activation by zip, product tables and product-by-zip recommendation", "exchanges": [], "version": null }
```

**PASS criteria:**
- `ops` contains at least one `addEntity` with type `AlgoAI` or `Filter` (the activation rule)
- `ops` contains at least one `addEntity` with type `Output`
- `rlogEntry.reasoning.justification` reasons toward producing output / activation

**PARTIAL criteria (stop here, flag as schema issue):**
- Activation rule and Output appear in ops
- BUT Impression is still emitted as `addEntity` of type `Table` (schema blocker — needs Impression entity type added)

**FAIL criteria:**
- ops unchanged (still only Table entities)
- Check `diagnostics.systemPromptLength` before vs. after to confirm KB loaded

---

## Files to change (ordered)

1. **`packages/contracts/src/index.ts`** — add `Impression` to data plan entity types (if Option A)
2. **`server/src/llm/systemPrompt.ts`** — update entity reference + add default shape rules
3. **`knowledge/data-activation/` in GCS** — rewrite all 5 files (or replace with new set)
   - Keep the geo-expansion content from `etl-patterns.md` (translated to v2 ops)
   - Archive or delete the v1-model content in `patterns.md`, `schema.md`, `activation-graph.md`
   - Rewrite `data-plan-document.md` to NOT show Impressions as an [Input] table
4. **Server restart** after GCS write to reload KB
5. **Commit git** — KB files should also be committed to repo if they live in git (confirm source of truth)

---

## Open questions (human decisions needed before coding)

1. **What is the Impression entity in v2?** (Options A/B/C above) — blocks KB writing
2. **Does the KB in GCS match the KB in git?** The server loads from GCS at startup. When Railway redeploys from git, does it re-seed the KB to GCS or just use whatever is already in GCS? If git doesn't affect what's in GCS, then git commits to KB files are cosmetic only.
3. **Should the v1 KB files be deleted or archived?** They are actively harmful (teach wrong model). Suggest delete from GCS + replace with v2 versions. Archive in git if history is wanted.

---

## How to continue on another machine

1. `git pull` — gets this to-do doc and all recent code changes
2. Start server: `node server/dist/index.js` (reads GCS credentials from `.env`, loads KB from GCS)
3. Verify server is up: `GET http://localhost:3001/health`
4. Pick up at **Step 1** above (Impression entity decision)
5. Use `POST http://localhost:3001/api/debug/project/luminary-health-q3-2025/submit` for all testing
6. Update KB via `PUT http://localhost:3001/api/admin/file` + restart server
7. Full endpoint reference: `specs/debug_readme.md`
