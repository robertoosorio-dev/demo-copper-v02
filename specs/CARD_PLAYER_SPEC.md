# Card Player — v0.1 Spec

This is the build spec for the CoPPER card player. It is grounded in two existing
artifacts: the 11 TSX cards and `card_usage.md`, both from the Synapse/Figma import
flow. The cards are renderers. `card_usage.md` is the first human-readable draft of
the Card Definitions described below.

The job of v0.1 is to prove one thing: **a card can substitute for text on a
surface, driven by data, with no surface knowledge inside the card.**

---

## The spine

One canonical object — the **Card Definition** — is the primary artifact. Everything
else derives from it.

```
        Card Definition   (the contract; KB-adjacent data, the product artifact)
        /      |      \
  engine     renderer   admin           ← derive semantics from the definition
  reads      keys to    edits
  (to emit)  schema     (card editor)

        Card Definition
              ↓
           Registry      (an index: cardType → component. Almost an impl detail.)
              ↓
            Player       (renders the bound component, or degrades to text)
```

We did not design five components. We designed one contract, and the registry and
player are downstream machinery over it.

- The **engine** reads the definition to emit conforming cards. *(not v0.1)*
- The **renderer** (TSX) is keyed to the definition's prop schema.
- The **admin** edits the definition — the card editor. *(not v0.1)*
- The **registry** is a downstream index that binds `cardType → component`. It is the
  one place frontend code identity meets KB data — which is exactly why the component
  reference lives here and not in the definition.

Source of truth is the definition, held as **data**. The TSX conforms to it; it does
not own it. The registry, the engine KB, the admin UI, and documentation all derive
from the definition — it is the product artifact; they are consumers.

---

## What v0.1 builds

1. **Card Definitions** — five, seeded from `specs/cards_v01` into the KB store at
   `knowledge/ux-cards/`. Data, not code-buried. Read at runtime from the store.
2. **Registry** — index over the definitions, `cardType → component`.
3. **Player** — renders the card if it can; falls back to text if it can't; bubbles
   actions up. Understands nothing about tables, filters, or plans.
4. **Five cards** — TSX renderers, adapted from the zip.

Proven by rendering one card from a static `{ say, card }` envelope, **no surface
and no engine attached.**

### Explicitly not v0.1

No engine. No admin card editor. No action framework, permission framework, or
lifecycle management. No KB-schema ↔ prop-type checker. These are later faces on the
same data; do not build them now.

---

## Where definitions live

Card Definitions are **System-tier KB data**, not project state. They are versioned
within the KB, never under a project version.

### Seed, once

The initial definitions (the five-card set, identical to what is in `card_usage.md`
and the TSX) sit at:

```
C:\code\CoPPER\demo.v02\specs\cards_v01
```

This is **authoring input, not a runtime source.** It lives under `specs/` precisely
because it is a one-time seed. The build:

1. reads the definitions from `specs/cards_v01`,
2. pushes them to the KB store in GCS,
3. forgets the local path.

Nothing at runtime reads `specs/cards_v01`. After the seed, the source of truth is the
KB store.

### Source of truth, at runtime

```
<root>/knowledge/ux-cards/
```

Card Definitions live here, in the KB, and are **versioned from here** — not under any
project version (`project/verNN/` is project state and is the wrong tier). The card
editor, when it exists, edits this location.

The registry loads definitions from `knowledge/ux-cards/`, not from bundled frontend
files. "Static for v0.1" means *not engine-generated* — it does not mean *baked into
the build*. The definitions are data in the store from the start.

---

## The wire envelope

A single intelligence engine communicates in JSON. The card travels **with** the
intent, as a UX hint:

```json
{
  "say": "I analyzed the catalog and found 12,567 rows across 6 columns.",
  "card": { "cardType": "tableDiscovery", "props": { } }
}
```

- `say` — the text. Always renderable.
- `card` — optional. A **hint**: the player renders it if it has the facility; if not
  (unknown cardType, read-only surface, no renderer), it ignores the card and shows
  `say`. Hint = degradable, never required.

The player reads `card`, resolves `cardType` against the registry, renders. No card,
or unresolvable card → render `say`.

For v0.1 the engine does not exist. The envelope is hand-authored as a fixture. This
spec settles its shape so the fixture is correct.

### Two kinds of "unknown card" — do not conflate them

These are different events with opposite handling. The earlier draft of this spec
wrongly called both a hard failure.

**Unknown card on the wire** — the engine (or fixture) emits a `cardType` this player
cannot render. The card is a hint; hints degrade. The player **renders `say` and
continues** — never breaks the turn. In development it may also log a visible warning
(`Unknown cardType: <x>`); in production it falls back silently. A hard failure here
would make cards non-degradable, which breaks the whole premise.

**Broken KB↔registry binding** — a definition exists in `knowledge/ux-cards/` but the
registry binds it to no component, or a definition's `cardType` has no renderer at all.
That is not a degradable hint; it is a wiring defect. This **should be loud**, at least
in development — it means the registry and the KB disagree, which is exactly the drift
the contract is meant to prevent.

In short: **the wire degrades; the binding is checked.**

---

## The Card Definition

One per card. KB-adjacent contract object. Static file for v0.1; editable object
later. Treated as **data** from day one — co-located with the card is fine,
code-buried is not.

Fields, with the engine's judgment fields kept deliberately distinct from the
mechanical ones:

```
Card Definition
├── cardType            string, unique. The key everything else binds to.
├── propsSchema         the shape of props the card accepts.
├── exampleProps        a valid example, for fixtures and the editor.
├── allowedActions      the ceiling of semantic actions this card may emit.
├── fallbackText        guidance for what `say` should convey if the card is dropped.
│
└── WHEN  ── the only fields the engine reads as judgment ──
    ├── whenToUse        the situations this card is the right answer for.
    └── whenNotToUse     the near-misses, each pointing to the correct card instead.
```

The definition holds no `component` reference. A component is frontend implementation;
the definition is KB data. The `cardType → component` binding lives in the **registry**,
which is the seam where code meets KB data. Keep code identity out of the definition.

The WHEN block is the part that had to be invented — it is not self-evident. Keep it
legible as its own section in every definition, not buried among plumbing. Everything
above WHEN is mechanical.

---

## The card contract

The boundary, stated once and enforced everywhere:

```
Cards receive typed props and emit semantic actions. Nothing else.

A card never imports wizard state, chat state, project state, router state,
or engine text. A card never executes business logic, never mutates the
project, never talks to the engine.
```

The DOM analogy is exact:

```
User clicks button  →  card emits action  →  player catches  →  engine decides meaning
```

The card is the layer where the click happens. Reacting to the click is the engine's
job, above the player. The card only bubbles.

### Actions

- `allowedActions` in the definition is the **ceiling** — the maximum set a card may
  ever emit.
- The card narrows to a subset **by its own data** (e.g. a finding that is already
  excluded shows *Undo*, not *Exclude*). The player does not worry about this; it
  supports the full ceiling and lets the card choose.
- The surface may narrow further — at minimum a **read-only mode** the player passes
  through as a prop. The card chooses to show no buttons. Read-only is just
  `allowedActions` resolving to none; it is not a framework.
- An emitted action outside the ceiling is a defect. For v0.1 this is the card
  developer's discipline, not a runtime checker.

The engine chooses **presentation** (which card), never **action** (what the click
does). Picking the card is upstream intent and belongs to whoever forms the intent.
Reacting to the action stays downstream. Only the action edge was ever the dangerous
one, and it stays out of the card.

---

## The two surfaces

Same player, same cards, same envelope. The difference is **who authors `card`**.

| | Chat surface | Wizard surface (table creation) |
|---|---|---|
| who fills `card` | the engine, per turn | the flow, by step |
| WHEN decision | the engine's judgment | the script — step 3 *is* the key step |
| on screen | a stream; old cards become history | one card — the current step |
| action effect | next turn / mutation | advance step; final card commits once |

On the wizard, WHEN is mostly solved by the sequence, so the WHEN block does little
work. On chat, WHEN is the whole problem and the WHEN block earns its existence. The
player cannot tell the two apart, and must not try to.

Build order: **player + registry + cards first** (provable from a fixture), then the
wizard surface (deterministic, easiest to get right), then the chat surface
(reactive, messier inbound). Neither surface is required to prove v0.1.

---

## The five cards

Adapted from the zip. First build, in this order:

1. `tableDiscovery`
2. `validationFindings`
3. `filterRecommendation`
4. `keySelection`
5. `changeSummary`

The other six (`sourceInput`, `filterImpactSummary`, `customFilter`, `fieldMapping`,
`importSettings`, `tablePreview`) follow the same contract and are added after.

### Definition drafts

Drawn from `card_usage.md` and the existing TSX props. `propsSchema` is summarized;
`exampleProps` lives in the fixture file.

**tableDiscovery**
- props: `tableName, sourceLabel?, sourceUrl?, rows, columns, warnings?, skippedRows?, isLiveFeed?, status?`
- allowedActions: `inspect, reload, delete`
- whenToUse: a source has been read and the system can summarize what it found
  (counts, live-feed status).
- whenNotToUse: listing specific issues → `validationFindings`; showing the row grid →
  `tablePreview`; summarizing a mutation → `changeSummary`.

**validationFindings**
- props: `findings[] { id, title, column?, rowsAffected, severity?, status? }`
- allowedActions: `exclude, ignore, undo` (per-finding; the action carries which one)
- whenToUse: data-quality issues found in the source/table.
- whenNotToUse: a proposed change → `changeSummary`; a key problem → `keySelection`; a
  filter suggestion → `filterRecommendation`.

**filterRecommendation**
- props: `title, reason, rowsRemoved, field?, operator?, value?, status?`
- allowedActions: `apply, dismiss, undo`
- whenToUse: the agent recommends one specific filter rule.
- whenNotToUse: the user is building a rule by hand → `customFilter`; aggregate effect
  of all filters → `filterImpactSummary`; the filter is part of a larger mutation →
  `changeSummary`.

**keySelection**
- props: `keyName, mode?, isRecommended?, isValid, uniqueValues, totalValues, duplicates, missing, sampleValues?, reason?`
- allowedActions: `edit, apply, cancel`
- whenToUse: choosing, confirming, or warning about a primary key (single or
  composite).
- whenNotToUse: general findings → `validationFindings`; field mapping →
  `fieldMapping`.

**changeSummary**
- props: `title, status?, why?, changes[] { id, op, label?, detail? }, consequences?, warnings?, affectedObjects?`
- allowedActions: `accept, reject, inspect` (plus `undo`/rollback where applicable)
- whenToUse: summarizing a proposed, applied, rejected, or rolled-back mutation. The
  general-purpose approval card.
- whenNotToUse: just choosing a source → `sourceInput`; a single specialized
  recommendation with no approval bundle → use the specialized card first.

---

## Known deltas from the zip (settled cleanups, not re-openings)

Three small corrections to make while adapting, each already agreed:

1. **`changeSummary` composes its own text.** The zip hands it pre-written phrases
   (`label: "Create table"`, `detail: "Products"`). Cards receive **data** and write
   their own text. The card takes the structured change (op + target) and composes the
   line itself. The envelope carries facts, not sentences.
2. **`changeSummary` drops "Sync to reality" from its whenToUse.** That is Execution /
   Reality — out of Co.P.P scope, must not shape this design.
3. **Filter cards: lens wording, not removal wording.** Filters are non-destructive
   execution-time overlays. Render impact as scope under a named lens, not "rows
   removed / −2,312." This is a wording change in the renderer, not a prop change. Low
   priority for v0.1 but on the list so it is a choice, not an oversight.

No other behavior changes. The five cards are otherwise adopted as built.

---

## Done means

- The five definitions are seeded from `specs/cards_v01` into `knowledge/ux-cards/` in
  GCS, and the seed step is one-time — nothing at runtime reads the local `specs` path.
- The registry loads definitions from the KB store, not from bundled frontend files.
- A registry binds all five `cardType`s to their components. A definition with no
  bound component (a KB↔registry mismatch) is a loud, visible failure in development —
  not a silent drop.
- An unknown `cardType` **on the wire** (a card the player can't render) degrades to
  `say` and never breaks the turn; in development it may log a visible warning.
- The player renders any of the five from a static `{ say, card }` fixture, with no
  surface and no engine present.
- Passing `readonly` to the player suppresses the card's actions via the card, not via
  player-side logic.
- No card file imports surface, project, router, or engine state.
