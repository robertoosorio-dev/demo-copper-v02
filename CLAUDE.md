# CLAUDE.md — V2 Build Specification

> **Register: this is the *do* document.** It is the only document you obey. Two companions sit beside it in this directory and you must read both before building, but they are *context*, not orders:
> - `v2_architecture_design.md` — the **why** (rationale, discarded alternatives). Read it to make good judgment calls.
> - `v2_object_schemas.md` — the **how** (concrete object shapes, grounded in the real ver1 code). **Authoritative on all data structures.** Where it and the architecture doc disagree on shape, the schema doc wins.
>
> **All three documents live together in `demo.v02/specs/`.** This is your system directory. The build target is `demo.v02/`. The migration source is `demo.v01/` (the complete current prototype — read-only; never modify it).

---

## 0. Prime directive

**Do not invent. Every decision in scope has been made.** If you reach a point that is genuinely undecided, **stop and flag it in a comment or a `TODO(human)` — do not guess.** Guessing at an undecided point is the single failure mode this spec exists to prevent. You cannot ask questions mid-build, so when in doubt, build the smaller thing and flag, rather than the larger thing and assume.

Three more standing rules:
- **Migrate, don't reinvent.** Where `demo.v01/` already solves something (GCS wiring, LLM routing, route plumbing, seed data), port it. Rebuild only what this spec explicitly says to rebuild.
- **Scope is fenced.** Section 7 lists what you must NOT build. Treat it as hard.
- **Match the schema doc exactly** for every object shape. Do not "improve" the model.

---

## 1. What we are building

A v2 of the prototype: **same product surface as ver1, entirely new backend.** The thesis being proven is architectural — that an AI-native plan/model system can support versioned state, AI-authored mutation, reasoning capture, and computed consistency. The UI exists to demonstrate it.

**Scope is Co.P.P only** (Context → Plan → Project-model). **Execution and Reality do not exist** and must not shape any decision. If a design choice seems to need them, you have misread the scope — flag it.

**Two goals, in priority order:** (1) prove the architecture works; (2) communicate design to the team. When they conflict, favor (1) — e.g. the reasoning log and transaction viewer are intentionally richer than the current UX strictly needs, because validating them *is* the point. Do not simplify them away.

---

## 2. Scope of the build

- **Backend: whole new build.** Do not port ver1's backend structure wholesale. Rebuild it around the v2 model (Sections 4–5).
- **Frontend: at least ver1's functionality, plus new surfaces the v2 backend enables.** Keep every capability ver1's UI has. Add the surfaces v2 introduces — most importantly the **transaction-log / QA viewer** (reads the reasoning log; see Section 4C). The frontend is not frozen at parity; it grows where the backend gives it something new to show.
- **Milestones (Section 6) gate the work.** Milestone 1 stands up the shell with no engines. Do not build engines before the shell renders from a fixture.

---

## 3. Repository layout

A **TypeScript monorepo** (workspace with project references). One runtime server, two frontend apps, shared typed packages. Decoupling is expressed as **typed packages**, not microservices — a contract change must surface as a compile error at every call site.

```
demo.v02/
  specs/                         ← the three documents (this dir)
  packages/
    contracts/                   ← the spine: Version, Diff, ReasoningLogEntry,
                                   ProposedChange, Entity, Connection, Intent,
                                   card contracts. Depends on nothing; everything depends on it.
    kb/                          ← business_knowledge + card contracts + loader (read-only at runtime)
    project-store/               ← versioning, serialization, artifacts, reasoning-log journal,
                                   conversation storage (GCS-backed)
    intelligence/                ← the black box: worker SEAMS (sync, consistency, import-validate),
                                   exposes submit(intent) -> { version, trace }. SYNCHRONOUS for now.
    admin-tools/                 ← offline/author-time: KB->card derivation, audit/index. NOT a server.
  server/                        ← one Express app; mounts routes; serves built client
  apps/
    client/                      ← the product UI (React/Vite). Debug/QA viewer is a ROUTE here.
    admin/                       ← KB / card management UI. Separate app, separate audience.
  system/                        ← SYSTEM-LAYER DATA (not versioned, not per-project):
    reserved-objects/            ← the finite, hardcoded $-object catalog ($impression.*, etc.)
    entity-types/                ← per-plan entity-type vocabulary + legal adjacency (ver1's schema.js content)
    (kb content may live here or in a bucket; see Section 5)
```

**System directory note.** The `system/` tree holds everything the schema doc calls "system knowledge, not versioned": the reserved-object catalog and the per-plan entity-type vocabulary. This is distinct from project data (which lives in the version store, Section 5). Do not put project state in `system/`, and do not version the contents of `system/`.

---

## 4. The data the system stores

All shapes are defined in `v2_object_schemas.md`. **Implement them exactly.** Summary of the four machinery types and the model — read the schema doc for the full field lists.

### 4A. Machinery (package `contracts`, persisted by `project-store`)

- **Version** — one complete JSON document of the whole project (`context` + `plans`). The single authoritative object. `version`/`parentVersion` form a linear chain. **Full state per version — never a delta.**
- **Diff** — **computed, never stored.** Derived by comparing two versions. `{ path, kind, before, after }`. Storing diffs is forbidden (they accumulate and rot).
- **ReasoningLogEntry** — append-only. `{ fromVersion, toVersion, pass, seq, reasoning{problem,solution,justification,alternativesConsidered}, producedChanges[], contextSeen }`. One reasoning entry references **zero-or-more** changes; zero is legal (a rejected option with no diff).
- **ProposedChange** — `{ summary, diff, reasoning[], state, base }`. The summary is composed in-card from structured data, **not** authored by the LLM. Whole-proposal accept/reject only.

### 4B. The project model (package `contracts`; per-plan, inside each Version)

**Entities and connections** — NOT nodes/edges, NOT segments/flowObjects. This is a rebuild of ver1's data model.

- An **entity**: `{ id, type, name, ...flexible bag }`.
- A **connection**: a lightweight, **direction-optional** pointer `{ from, to }`. Connections carry **topology**. They do **not** yet carry execution order — where paths branch/merge, that is **deferred** (Section 7). Do not invent sequence semantics.
- **Both plans use this same container.** Data plan and media plan differ in entity *types* and in *surface*, not in container shape.
- **Entity types** per the schema doc: Table, Field, Import, Filter, AlgoAI/transforms, Output (data plan); MediaPartner, PlacementGroup, Placement, ExperienceGroup, Creative, LandingPageGroup, LandingPage, Pixel, Campaign, AdGroup (media plan).
- **Output** is always array-shaped: `{ maxRows, fields[] }`, each field `{ id, name, sourceFieldId }`. `sourceFieldId` is a single `object.field` pointer over the unified id space — a project entity's field OR a `$`-reserved system object's field. **The origin kind is read by resolving the pointer; never store an "originKind".**
- **`$`-reserved objects** are finite, hardcoded, and live in `system/reserved-objects/`. Validate a `sourceFieldId` against them; do not let users create them.
- **`promoted`** is a real boolean field on transform entities (communication-shaped visibility). Preserve it.

**Layout is never stored.** Positions are computed at render time. The model holds logical structure only.

### 4C. Storage layout (package `project-store`, GCS)

**Full state per version. Browsable folder layout. Diffs computed, never stored.**

```
{project-id}/
  ver01/
    project.json                 ← full state of the whole project at v1
    transactions/
      {pass-id}/                 ← one folder = one transaction (one pass)
        rlog_0000.json           ← one file = one reasoning log entry
        rlog_0001.json
  ver02/
    project.json
    transactions/ ...
```

- **Version is the outer folder**, plans live inside `project.json`. A version may touch any subset of plans; every current plan is present in every version's full state.
- **Reasoning log is folders, not one fat JSON** — one folder per transaction, one file per entry. Append-only by construction. The transaction/QA viewer reads this as a directory listing.
- External browsability is a goal: a person should be able to walk the bucket as plain folders.

---

## 5. What to port from `demo.v01/` vs. rebuild

**PORT (read `demo.v01/`, adapt, keep working):**
- **GCS storage wiring** (`demo.v01/server/storage/`) — keep GCS as the backend. Adapt to the new folder layout (Section 4C).
- **LLM router** (`demo.v01/server/llm/`) — multi-model (Anthropic/OpenAI/Google), server-side keys. Port as-is.
- **Route plumbing & SSE streaming** — the Express setup, CORS, health check, SPA serving. Port the shape; the route *bodies* change.
- **Seed data** (`demo.v01/server/seed/`) — the Luminary Health Q3 project. Port it, **translated into the v2 entities-and-connections model** (the ver1 seed uses the old `tables`/`flow`/`uaRefs` shape; convert to entities + connections, `uaRefs` → Output entities).
- **System knowledge** — ver1's `mediaGraph/schema.js` (type metadata, columns, legal adjacency, status vocab) → migrate into `system/entity-types/`. The `$impression`-style reserved objects → `system/reserved-objects/`.
- **KB content** (business_knowledge, plan-to-graph, etl patterns) — port into `packages/kb`.

**REBUILD (do not carry ver1's structure):**
- **The data model** — entities + connections (Section 4B), replacing ver1's `tables`/`flow.segments`/`flowObjects` arrays.
- **The mutation/ops protocol** — generic and **storage-generic**: `addEntity`/`modifyEntity`/`removeEntity`/`addConnection`/`removeConnection`, carrying a `type` string. A new entity type must be storable **without new backend code**. (Meaning — validation, diff salience, render spec — comes from KB/card contracts, not backend code. Storage-generic ≠ meaning-generic.)
- **The version chain + reasoning log** — new (ver1 has neither). Build per Sections 4A/4C.

---

## 6. Build milestones (do them in order)

**Milestone 1 — the shell, from a fixture, zero engines.**
- Scaffold the monorepo (Section 3). Write the `contracts` package types (Section 4) exactly per the schema doc.
- Hand-author one **Version fixture** (the ported Luminary seed, in v2 shape).
- The client renders the full ver1 surface **from that fixture**: context (files + conversation), the plan tabs, each plan's document face and model face (data as flow, media as tree-of-grids).
- **No intelligence, no real mutation, no GCS writes yet.** Render-only, from the fixture in memory.
- This proves the seam: UI is a pure function of a Version.

**Milestone 2 — persistence + the version chain.**
- Wire `project-store` to GCS with the folder layout (4C). Load/save full-state versions. Implement computed diff (never stored).
- Frontend can load a project, see its version, and the transaction/QA viewer can read an (empty for now) reasoning log.

**Milestone 3 — mutation through the intelligence seam.**
- Implement `intelligence.submit(intent) -> { version, trace }`, **synchronous behind real worker seams** (sync, consistency, import-validate). A chat turn produces ops + reasoning-log entries; ops apply via the generic reducer; a new full-state version is written; reasoning entries are journaled.
- The ProposedChange surface appears (data shape per 4A; visual design is open — keep it minimal).

**Stop after each milestone and leave it runnable.** Do not race ahead into engine sophistication.

---

## 7. Fences — do NOT build

- **No Execution, no Reality.** Co.P.P only.
- **No real message queue.** Propagation is **simulated synchronously** behind real worker seams. Keep the seams real so a queue can drop in later; do not build the queue.
- **No stored diffs.** Diffs are always computed from two full versions.
- **No delta versions.** Full state per version, always.
- **No partial accept** of a ProposedChange. Whole-proposal accept/reject only. Do not add per-change state.
- **No invented entity types or model fields.** Use exactly what the schema doc lists. A new type is *storable* generically, but do not *invent* one to fill a gap — flag the gap.
- **No execution-order / sequence semantics on connections.** Connections carry topology only; branch/merge ordering is deferred. Do not invent it.
- **No reconcile-resolution guarantees.** Consistency is computed, and inconsistency is allowed *if visible and bounded*. Do not build "who wins" resolution logic — surface inconsistency, let the (synchronous) ripples settle, and stop there.
- **No new canvas primitives** beyond what the surfaces require. Reuse; do not multiply.
- **Never modify `demo.v01/`.** It is the read-only migration source.

---

## 8. The one open decision (build it provisionally, flag it)

**Import: canonical or owned?** The schema doc leaves this open, leaning *owned*. Build it as **owned for now** (a table owns its import; ver1's two-way reference is fine). But mark it: `TODO(human): Import may be canonical if it is named & kept across source changes — see schema doc B1.` Do not silently harden either way.

---

## 9. Working agreement

- Build to **this** document; consult the architecture doc for *why* and the schema doc for *shape*.
- When the three documents conflict on **structure**, the **schema doc wins**. When they conflict on **scope or fences**, **this document wins**.
- Prefer the smaller, flagged build over the larger, assumed one.
- Leave each milestone runnable and stop.
