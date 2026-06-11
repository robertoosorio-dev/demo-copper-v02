# KB Test Log

This file is the permanent record of every KB test case: what was tested, what the LLM actually produced, how failures were diagnosed, and exactly what KB change fixed them.

**Read this first** at the start of any KB debugging session. The status index shows where things stand. Individual entries show the full run history so you are not repeating work already done.

The test protocol (how to run, pass criteria notation, diagnostic checklist) lives in `specs/qa_runbook1.md`.

---

## Methodology

### The loop

```
define criteria → run → record → diagnose → fix one thing → restart → run → record → repeat until PASS
```

Every step is recorded here in real time. Do not batch: record the run result before touching the KB.

### Four rules that must hold on every fix

**1. Test before touching.** Always run first. The failure output — not your hypothesis — tells you which KB file and which concept is wrong. A fix applied without a confirming failure run is a guess.

**2. One change per iteration.** Fix the most upstream failure first, restart, re-run. If the Products table has no description field and the Output therefore has no description field, fix the table fields first — not both at once. Batching changes makes it impossible to know which change fixed (or broke) what.

**3. Diagnose from the LLM's output, not from the KB text.** Read `rlogEntry.reasoning.justification`. If it mentions v1 concepts (FlowObject, UARef, ActivationEntry), the LLM is reading stale KB. If it names the right entity types but gets fields wrong, the KB structure is right but the example fields are wrong. The diagnosis comes from the response, not from re-reading the KB.

**4. Fixes must be generic.** A fix that names a specific brand, project, or entity is wrong — it will pass this test and fail the next. Every fix must be statable as a transferable rule: *"when the user mentions X, always include Y"* or *"for any entity used for display/recommendation, include these fields."* If you cannot state it generically, you have not found the real root cause.

### What to record for each run

**On failure:**
- Which criteria passed and which failed (the table format)
- Root cause: *which KB file*, *which concept or example was wrong*, *why the LLM did what it did*
- Fix applied: *which file*, *what was added/changed*, stated as a rule/principle (KB is in GCS, not git — this log is the only diff record)

**On pass:**
- Which criteria passed (the table format)
- No diagnosis needed — just record it and move on

**On unexpected results** (criteria pass but output looks wrong in some other way):
- Record it as a note, not a failure — unless you add a criterion for it
- Consider whether a new criterion is needed before the next test case

### When to add a test case

Add the entry (prompt + criteria) **before running**, not after. Writing the criteria first forces you to be explicit about what "correct" means for this prompt. If you cannot write the criteria before running, the test is underspecified — clarify with the user first.

### How future Claude should use this file

1. Read the status index first — it tells you which tests are pending or failing
2. For any FAIL entry, read the last run's diagnosis before doing anything
3. Do not re-run a test that is already PASS unless something in the KB has changed
4. New test cases from the user go here first (define criteria), then run

---

## Status index

| ID | Description | Status | Last run |
|---|---|---|---|
| TC-001 | Zip activation + product recommendation, empty project | ✅ PASS | 2026-06-11 |

---

## Test cases

---

### TC-001 — Zip activation + product recommendation, empty project

**Status:** ✅ PASS

**Prompt:**
```
add impression, activation by zip and then a Products table and a ProductsByZip recommendation table
```

**Starting state:** Empty data plan (pass `TEMP/test_empty_version.json` as `version` field — see runbook)

**Pass criteria:**
- `types:[Impression, Table, Filter, Output]` — zip lookup is a Filter, not AlgoAI
- `tables:2` — Products (Input) and ProductsByZip (Transform); no extras
- `output_fields:any[sku, description, image, price, image_url]` — at least one commercial field
- `no_type:AlgoAI`

---

#### Run 1 — 2026-06-11 — ❌ FAIL

| Criterion | Result | Detail |
|---|---|---|
| `types:[Impression,Table,Filter,Output]` | ✅ | All present |
| `tables:2` | ✅ | Products + ProductsByZip |
| `output_fields:any[sku,description,image,price]` | ❌ | Output: product_id, product_name, zip, distance_miles, geo |
| `no_type:AlgoAI` | ✅ | |

**Root cause:** `knowledge/data-activation/patterns.md` Pattern 2 defines the Products table with only 3 fields (`product_id, name, category`). The Output can only reference fields that exist on a Table. Because the pattern example was sparse, the LLM copied a sparse Products table and the Output had no commercial fields to reference.

**KB diff applied:**

File: `knowledge/data-activation/patterns.md`

Added to General rules: *"Rule: Output fields must cover downstream display needs"* — states that commercial entity tables (products, offers, content) must include the standard 5-field set: `sku`, `name`, `description`, `image_url`, `price`. These belong on the Table AND in the Output. The Output cannot reference fields that do not exist on the Table.

Updated Pattern 2 (product recommendation): Products table now has all 5 commercial fields; Output now references all 5.

Updated Pattern 5 (eligibility + recommendation, now Pattern 6): same Products table update.

Added Pattern 4 (geo/zip + product recommendation): combines the geo ETL shape (Products Input + ProductsByZip Transform + Filter) with the full commercial field set on Products and Output. This is the exact combined shape TC-001 exercises.

---

#### Run 2 — 2026-06-11 — ✅ PASS

| Criterion | Result | Detail |
|---|---|---|
| `types:[Impression,Table,Filter,Output]` | ✅ | |
| `tables:2` | ✅ | Products (sku,name,description,image_url,price) + ProductsByZip |
| `output_fields:any[sku,description,image,price]` | ✅ | Output: sku, name, description, image_url, price |
| `no_type:AlgoAI` | ✅ | |

---
