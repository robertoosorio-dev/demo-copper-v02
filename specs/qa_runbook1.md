# QA Runbook — KB Test Protocol

This is the **how-to-run** document: server setup, endpoint reference, pass criteria notation, and the diagnostic checklist.

The **test log** (what was tested, findings, fixes) lives in `specs/test_log.md`. Read that first.
The **fix procedure and bug queue** lives in `specs/kb_rewrite_todo.md`.

---

## How to run a test

```
1. Start server:     node server/dist/index.js
2. Get project id:   GET http://localhost:3001/api/projects
3. Run test:         POST http://localhost:3001/api/debug/project/:id/submit
4. Inspect:          ops[], rlogEntry.reasoning, diagnostics.systemPromptLength
5. Fix KB if needed: PUT http://localhost:3001/api/admin/file  (one file at a time)
6. Restart server:   kill old pid, node server/dist/index.js
7. Re-run from 3
```

For a **new project / empty plan** test, pass `version` in the request body:

```json
{
  "message": "your prompt here",
  "exchanges": [],
  "version": {
    "id": "test-new", "name": "Test Project", "version": 1,
    "parentVersion": null, "authoredBy": "system",
    "createdAt": "2026-06-11T00:00:00.000Z",
    "context": { "contextFiles": [], "exchanges": [] },
    "plans": {
      "data":    { "document": "", "model": { "entities": {}, "connections": [] } },
      "media":   { "document": "", "model": { "entities": {}, "connections": [] } },
      "creative":{ "document": "", "model": null }
    }
  }
}
```

---

## Pass criteria notation

Each test defines criteria as a checklist. A test PASSES only when every item is checked.

| Symbol | Meaning |
|---|---|
| `types:[X,Y,Z]` | ops must include addEntity for each listed type |
| `tables:N` | exactly N Table entities emitted |
| `output_fields:any[X,Y,Z]` | Output.fields must contain AT LEAST ONE of the listed names (case-insensitive substring match) |
| `output_fields:all[X,Y,Z]` | Output.fields must contain ALL of the listed names |
| `no_type:X` | no addEntity of type X should appear |

---

## Diagnostic checklist (when a test fails)

1. `diagnostics.systemPromptLength` — if < 5000, KB probably didn't load. Restart server.
2. `ops` is empty — LLM replied but produced no changes. Check `exchange.text` for refusal.
3. Wrong entity types — check `rlogEntry.reasoning.justification`. Is the LLM referencing KB concepts or v1 FlowObject/UARef language?
4. Correct types but wrong fields — the KB pattern example has the wrong fields. Fix the pattern, not the schema.
5. Output fields missing — check if the referenced Table entity even has those fields. The Output can only reference fields that exist on Table entities or $impression.* attributes.
6. `alternativesConsidered` is empty — LLM jumped straight to answer; prompt may be too easy or KB rules too prescriptive.

---

## Test log

All test cases and run history are in `specs/test_log.md`.
