# KB Fix Runbook — Data Plan Default Shape

**Task:** Locate why the data-plan KB fails to default to *impression + activation rule + output*, write a KB upgrade that fixes it, commit it, retest, and validate. Do **not** declare success on vocabulary matches — success is structural (the `ops` emitted), defined in Phase 4.

You (Claude Code) have the access; this brief gives you the business domain you're missing. Read the "Minimal domain" section before touching anything.

---

## Orientation (the two gaps in the readme)

- **Base URL:** prod = `https://copper-demo-v02-production.up.railway.app`, local = `http://localhost:3001`. Use whichever the running instance is.
- **Project id:** `GET /api/projects` returns an array of `{ id, name, version, ... }`. The field you need for `:id` in every other call is **`id`** (the slug-style string, e.g. `serge-test-01`), not `name`.

---

## Minimal domain (the basics — this is all you need)

A data plan is **not a catalog of data sources.** Its purpose is to produce **Output fields**: values delivered back to an impression at activation time. The runtime model is:

> **impression context → activation → output**

- **Impression context** = the entry. The runtime input the plan activates on (dmp_id, geo, device, placement_id). It is what *enters* the plan, not a stored table to be catalogued.
- **Activation rules** = the spine. Filters / lookups / recommendations that transform impression context toward an output.
- **Output fields** = the goal. The array-shaped result delivered back (capped by `maxRows`).

**The smell you're diagnosing:** a plan that is just stored tables — sources sitting under a "Data Sources" heading with no activation rule and no Output. That plan has missed the point. Almost every data plan should default to *at least* one impression entry, at least one activation rule, and an Output.

You do **not** need capsules, versioning internals, the consistency engine, or the full ontology. Just: *entry → activation → output is the default; bare tables is the smell.*

---

## Phase 1 — Locate (diagnose before editing)

1. **Reproduce.** `POST /api/debug/project/:id/submit` with:
   ```json
   { "message": "add impression, activation by zip, product tables and product-by-zip recommendation", "exchanges": [], "version": null }
   ```
   Capture **baseline** `ops` and `rlogEntry.reasoning`. Expected failure shape: stored tables under "Data Sources," impression materialized as an **Input table** with an `impression_id` PK, **no** activation-rule op, **no** Output op.

2. **Find what the agent actually sees.** Locate where the mutation system prompt is assembled — which KB files get concatenated into it. Check `diagnostics.systemPromptLength`. A short value (~1000) means the KB barely loaded; a normal value means it loaded but didn't instruct.

3. **Read the loaded files** (via `GET /api/admin/file?path=knowledge/...`) and answer one question: *does any loaded doc make impression + activation + output the directive default state?* Not "does the word impression appear" — does any doc say "default to this shape."

4. **Classify the gap** as exactly one of:
   - **(a) absent** — no doc states the default; agent falls back to "a table per noun."
   - **(b) present-but-not-loaded** — the guidance exists in a doc that is *not* in the assembled prompt (orphaned).
   - **(c) present-but-not-directive** — docs describe the primitives but never say "default to this shape."

   Report the file + line and which of a/b/c **before** editing. The fix differs: (a)/(c) → edit a loaded doc; (b) → wire the existing doc into the prompt assembly (editing its text won't help if it never loads).

---

## Phase 2 — Write the upgrade

Insert the directive below into a doc **that Phase 1 confirmed is loaded into the system prompt.** Do not create a new standalone KB file unless you also wire it into the prompt assembly — an unloaded new file recreates failure mode (b). Match the house style of the existing generation guidance; merge, don't bolt on.

> ### Data Plan Generation — Default Shape
>
> A data plan is not a catalog of data sources. Its purpose is to produce **Output fields**: the values delivered back to the impression at activation time. Every data plan exists to answer: *given this impression context, what do we output?*
>
> Runtime model: **impression context → activation → output.**
> - The **impression context** is the entry — the runtime input the plan activates on (e.g. dmp_id, geo, device, placement_id). It enters the plan; it is not a stored catalog table.
> - **Activation rules** are the spine — filters, lookups, and recommendations that transform impression context toward an output.
> - **Output fields** are the goal — the array-shaped result delivered back, capped by `maxRows`.
>
> **Directive:** When asked to build or extend a data plan, default to a plan that *activates* — at minimum an impression entry, at least one activation rule, and an Output. Stored source tables (Products, Users) are legitimate inputs but are never the endpoint. A plan that produces only source tables, with no activation rule and no Output, is **incomplete** and must not be offered as a finished plan.
>
> Do not model the impression as just another stored source table. It is the entry context the plan consumes, distinct from the catalog tables it joins against.

---

## Phase 3 — Commit

Persist to **the source the live agent actually reads** — verify which that is, don't assume:
- If the deployed app serves the KB from GCS via the admin endpoint: `PUT /api/admin/file` with `{ "path": "...", "content": "..." }` (writes restricted to `knowledge/`).
- If the KB is git-backed in the repo and read from disk: edit the file and commit through the repo.

Whichever it is, it must be the one whose content appeared in the Phase 1 assembled prompt. After writing, **re-read it back** (`GET /api/admin/file?path=...`) and confirm the new text is present. A commit to a source the agent doesn't load is the most common silent failure here.

---

## Phase 4 — Retest & validate

Re-run the **exact same** submit message from Phase 1. Diff the new `ops` against baseline.

- **PASS (KB-level fix):** `ops` now include at least one activation-rule op **and** an Output op; `rlogEntry.reasoning.justification` reasons toward producing output / activation rather than "data sources." The plan is no longer a bare table list.
- **PARTIAL (enum-blocked):** generation shape improved — activation rule and Output now appear — **but** the impression is still emitted as `addEntity` of type `Table`. This means the impression piece is blocked at the **type-set / schema** level, not the KB. Report it as such and **stop editing the KB** — the remaining fix is a schema change, out of scope for this PoC.
- **FAIL (didn't reach the agent):** `ops` unchanged (still bare tables) **and** `systemPromptLength` didn't change after the commit → the edited file isn't the one loaded. Return to Phase 1 step 2; you committed to the wrong source.

### Guardrails (the traps)
1. **Vocabulary match is not a pass.** "The word impression/output now appears in the reasoning text" proves nothing. Pass is structural — the `ops` emitted.
2. **A new KB file is not automatically loaded.** If you added a doc, prove it's in the assembled prompt or the fix is invisible.
3. **Impression-as-table may be a schema blocker, not a KB miss.** That's the PARTIAL outcome — diagnose it, don't keep rewriting the KB trying to force it.

### Report back
State the outcome (PASS / PARTIAL / FAIL), the file + line you changed, the gap class (a/b/c) from Phase 1, and paste the before/after `ops`. That's the proof the loop worked.
