# V2 Architecture — Design Document

**Status:** Draft for review. This is a *thinking* document, not a build spec. It states what we have decided and, more importantly, *why* — with the alternatives we discarded — so the reasoning can be examined cleanly (including by a second model) before any of it is converted into an execution spec for Claude Code.

**The three documents and their registers.** This is one of three: the **Architecture doc (this one) = *why*** — the reasoning and the discarded alternatives. The **Schema doc = *how*** — the concrete object shapes, grounded in the actual ver1 source. The **CLAUDE.md = *do*** — the execution spec, fenced and decided, the only document Claude Code obeys. **Where this doc and the schema doc disagree on structure, the schema doc wins** — it is newer and code-grounded. This doc predates the entities-and-connections model redesign, so a few sections describe earlier framings (e.g. "graph node," the original filter treatment); they have been reconciled where they directly contradict, but read this for *rationale*, the schema doc for *shape*.

**Scope reminder (CoPPER):** Context → Plan → Project-model → Execution → Reality. We are building at **Co.P.P only**. Execution and Reality do not exist yet, and per standing instruction we do not let them shape design. Where they appear below, it is to bound a decision, not to build toward them.

**A note on the two goals (read before the rest).** The prototype has two purposes: (1) communicate design ideas to the team, and (2) validate that the architecture can actually support the behaviors we believe it requires — replay, correction, propagation, AI-authored mutation. **The second goal is the more important of the two.** This matters for how to read the document: several sections (the transaction tier, reasoning steps/spans, the intelligence black box) are *intentionally* more detailed than the current UX requires. That is not over-design and not implementation gravity — it is the proof that the architecture can work. We do not simplify those sections to match present UX needs, because validating them *is* a present need.

---

## The governing principle: Canonical Object → Projection → Surface

Before the individual decisions, one rule governs nearly all of them, and naming it once prevents restating it in every section.

```
Canonical Object   →   Projection   →   Surface
```

- A **canonical object** is the source of truth. It exists independently of any way of looking at it.
- A **projection** is a renderable form of that object. One object has many projections.
- A **surface** is where a projection lands, and the lifecycle it has there. One projection can render on many surfaces.

The same shape recurs throughout the system:

```
Table entity        →   grid / flow drawing   →   plan surface
Change Proposal     →   card                  →   chat / inspector / diff surface
Project state       →   version               →   UI surface
```

Two consequences fall out, and both are load-bearing elsewhere:

1. **Identity is independent of placement.** A card contract does not care whether it appears in chat, a wizard, an inspector, a diff panel, or a transaction log — those are rendering concerns. The object describes *what it is, what it means, what actions it offers, what state it holds*; the surface determines *location, lifecycle, dismissal, persistence*. "Placement is a prop" is the specific case of this general law.
2. **Projection ≠ surface.** These are two distinct layers, not one. It is tempting to collapse them (we did, with cards, until it caused confusion). The projection is the renderable thing; the surface is where it lives and how long. Keeping them separate is the same move every time it comes up.

This principle is the generalization of "promotion is visual, not ontological" (Section 7) and "definitions are canonical, views are projections." It is stated here as system-wide because it has shown up repeatedly in both the Media and Activation designs.

---

## 0. Why refactor at all

**Problem.** The current prototype is a tarball: server and client are coupled such that nothing can be reasoned about, discussed, or changed in isolation. The practical symptom is that UI work — which is the actual goal — cannot proceed without holding the entire backend in your head at the same time. Every UI change re-derives backend assumptions.

**Solution.** Re-cut the system so the backend compresses to a small, fixed surface that the UI depends on but does not have to re-reason about. Concretely: a single hard seam between "things that render" and "things that compute," plus a decomposition of the backend into labeled, independently-thinkable parts.

**Justification.** The relief being sought is not "think about the backend less" in general — it is "freeze the backend into one artifact small enough to hold in your head, so UI work stops re-deriving it." That artifact is a state-snapshot contract (Section 1). Once the UI is a pure function of a snapshot, UI design collapses to: *given this shape, what is on screen, and what can leave it?*

**Alternatives discarded.**
- *Blank-slate rewrite.* Rejected. The rot is in the wiring, not the assets. Business-knowledge markdown, seed scenarios (Luminary, Best Buy), the plan↔model transform logic, and the graph-rendering component are earned and port over. The instruction is **selective migration**, not "start from nothing."
- *Incremental untangling of the current codebase.* Rejected. The seams are now clean enough to build *to* directly, and a prototype rewrite is cheap. Untangling in place would cost more than rebuilding against the known-good seams.

---

## 1. The seam: UI as a pure function of a snapshot

**Problem.** As long as the UI computes anything — derives model state, runs sync, reasons about consequences — it is coupled to the backend's internals and cannot be changed freely.

**Solution.** One hard line. **Above it**, the UI is a pure function of a single state snapshot: it renders a snapshot and emits intents, nothing else. **Below it**, the engines (sync, consistency, propagation) are defined only as "the things that produce snapshots." The two-way channel — *read a snapshot, emit an intent* — is the entire interface between the halves.

A **snapshot** is one serializable object: the pinned context (files + conversation), the active plan's document (already-rendered) and its model graph, the card payloads, inspector/selection state, and the version pointer. It carries both faces of the model *already transformed* — the UI shows the sync output; it does not run the sync.

An **intent** is what the UI emits: an edited doc, a dropped file, an Accept on a diff card, a tab switch. Something consumes `intent + current snapshot → next snapshot`. In production that "something" is the engines. For UI iteration it is a **tape of hand-authored snapshot fixtures** keyed by (version, intent), so the UI can be mutated all day with no engine running.

**Justification.** This is not a new architecture — it names a seam already implied by prior decisions (versioned state already says snapshots are immutable doc+model pairs; cards already emit structured data with no presentation; "render from the JSON model in memory" was already the rule). Naming it lets the UI commit to never crossing it. The payoff: as far as the UI is concerned, the entire backend is **one type (`Snapshot`) plus the intent set**.

**Alternatives discarded.**
- *Let the UI hold derived state and recompute.* This is the current coupling; it is the problem, not a solution.

---

## 2. Storage: three tiers, cut by ownership and rate of change

**Problem.** "One big store" is the tarball in data form. But splitting by feature produces arbitrary seams that drift.

**Solution.** Three tiers, cut by *who owns the data and how often it changes*:

1. **System tier (admin-owned).** The KB and its derivatives. Read-only at runtime; written only by the admin tooling. Contains:
   - `/business_knowledge` — usage knowledge and patterns. *Semantic* prose the LLM reads as reasoning input.
   - `/cards` — the interface cards. *Structural* contracts read by tooling and bound to renderers; **derived from the KB** (see Section 5). Cards mediate the KB to the UI.
2. **Project tier (user-owned).** The project itself and its library of files. **Also provides the versioning primitive** (see Section 6). Read/write at runtime; never touched by an author.
3. **Transaction tier (AI-facing, but not "used" by the AI).** A structured log of everything the intelligence reasoned and did. It is a *window* into the black box, kept for auditability, and it does double duty for rollback/replay.

**Justification.** The cut axis is ownership and trust, which makes the boundary enforceable: system is read-only at runtime; project is read/write; transaction is append-only. Different cadences (author-time / per-mutation / per-reasoning-step) and different failure modes fall out naturally. This is the recurring trick — **a store plus an intelligence that recomputes its derivatives on change** — applied at the admin tier (KB → cards) exactly as it is applied at the project tier (mutation → consequences).

**On the transaction tier's authority (a clarified non-question).** Only the project tier's version chain is authoritative. The transaction tier is *not* a competing source of truth; it is the reasoning *between* two authoritative versions. Structurally:

```
ver2  +  user mutation   →  ver3-seed   +  AI reasoning (step1..n)  →  ver3-proposed  →  ver3-final
└ base ┘ └ user-authored ─┘ └intermediate┘ └────── AI-authored ──────┘  └─ on approve ─┘
  (project tier: endpoints)   (transaction tier: the path between them)    (project tier)
```

The project tier stores the *endpoints* (immutable versions). The transaction tier stores the *path*. "Re-reason from here" means: pick an endpoint, replay the path forward under amended context. The path is always *relative to* a base version, which is exactly why it is never authoritative on its own.

**Alternatives discarded.**
- *Transaction tier as the event-sourced source of truth (project chain as a projection of it).* Considered. Real for a production event-sourced system, but premature here: it forces true replay semantics before we need them. For now the project chain is authoritative and the transaction tier observes. The choice is named so it can be revisited; the one thing that breaks either way is async data (Section 8 of the capsule rules) — fetched-on-return data must land *inside* the version, or the log describes a state the data didn't produce.

### 2a. File ≠ Table (a vocabulary rule, not a lifecycle)

**Problem.** It is easy to unconsciously rebuild `File → Table` or `Import → Table` as a *lifecycle* — to treat a file as a precursor that gets promoted into a table. This is wrong and causes design confusion.

**Solution.** The words are rigid and the destinations are fundamentally different:

```
File   →   Context        (an artifact that informs understanding)
Table  →   Project Model  (an operational object that participates in execution)
```

A **file** lives in Context. A **table** lives in the Project Model. **Tables do not descend from files.** There is no promotion ladder in either direction — a file is not a precursor to a table, and a table is not a refined file. They are different kinds of thing with different homes and different purposes.

The **only** ambiguous event in the system is a *spreadsheet*, which could legitimately be either. Dropped into Context, the system asks "file or table?". Dropped onto the Project Model, there is no question — it is a table. `[Add]` is one action; the system detects type and routes; there is no picker.

**Justification.** Stating this explicitly prevents the lifecycle framing from creeping back in. It also aligns with the governing principle indirectly: a table is a canonical object in the project model; a file is a context artifact; neither is a projection of the other.

**Alternatives discarded.**
- *File-to-table promotion ladder.* Rejected outright. It is the exact misconception this rule exists to prevent.

---

## 3. The intelligence black box

**Problem.** The hardest thing to hold in your head is the intelligence — sync, consistency, propagation, queues. If its internals leak into the UI or the storage reasoning, the whole decomposition fails.

**Solution.** Treat the intelligence as a black box with **the diff as its interface**. It takes a diff (the user-authored `ver2 → ver3-seed` change) and returns a diff (the AI-authored `ver3-seed → ver3-proposed` change). Same shape both directions. Everything inside — the message queue, the workers, the stack-guard, emit-on-delta — is hidden behind that.

Internally, propagation is **message-based "ripples in a pond"**: a thing that changes emits "I changed"; workers react and emit again; no component knows the global order; termination is emit-on-delta-only plus a stack-guard. Two workers, not one pipeline: **deterministic sync** (doc↔model) and the **consistency engine** are separate workers on the same change events.

For the prototype, propagation is **simulated synchronously** (edit → recompute → render) but the worker *seams are real*, so a real queue can be swapped in later with no structural change.

**Justification.** A black box whose interface is the diff intersects cleanly with the project tier (the diff is the versioning payload) and the transaction tier (as it reasons, it logs there). The symmetry — diff in, diff out, one type both directions — is the thing small enough to hold in your head while doing UI work.

**Alternatives discarded.**
- *Real message queue now.* Rejected for the prototype. It forces the network/async boundary prematurely. Synchronous-behind-real-seams gets the same architecture without the distributed-systems cost.
- *One unified pipeline for sync + consistency.* Rejected. They are separate concerns reacting to the same events; fusing them couples two things that should be independently changeable.

---

## 4. The data shapes (the spine)

**Problem.** Everything above refers to "the diff" and "the reasoning." If those are described in prose but never written down, every layer invents its own version and they drift. These shapes are the heart of the new project; everything depends on them.

**Solution.** Three nested shapes, with a deliberate decision about which is primary.

- **Diff — the atom.** The object-level changes (the "N-object diff") plus an authorship stamp (user | AI). This is what the project tier's versions store and what the user-facing net-change view renders. Standalone.

- **Reasoning step — the transaction-tier unit, and the *primary* record.** A decision the AI made: `{ decision point, options considered, chosen + why, context-seen }`, which **references zero or more diffs**. The relationship is one-reason-to-many-(or-zero)-diffs.

- **Reasoning span — the chain** of steps between two versions, hanging off a base version. This is what the debug/audit view renders. It collapses to a net diff (for the user-facing view) by unioning the diffs its steps reference.

**The decision that matters: reasoning is the noun, diffs are what it points to.** The transaction tier is a *record of reasoning and their consequences* — **not** consequences and their explanation. A reasoning step is "DIFF PLUS": the *plus* (the why) is the primary content; the diff is the trailing consequence. We are not principally interested in the incremental diffs (if we were, we would just show `diff(ver2, ver3)`); we are interested in *why each change was proposed*, because that is what lets us locate a wrong choice and correct/restart from it.

**The structural consequence — reasons can have no diff.** "I considered Experience Groups and rejected them" is a logged decision with an *empty* diff. The moment those exist, reason and diff cannot be one record with two fields — a step has one rationale and zero-or-more diffs. So they are **separate records with a one-to-many edge**, not a single record with field-order to argue about. Reasons-with-no-diff are exactly the records that explain *why an expected change did not happen* — the part the user-facing collapse throws away and the debug view keeps.

**Collapse identity.** A version's net diff = the union of the diffs referenced by the reasoning steps in its span. Reasons with no diff contribute nothing to the collapse. This is correct: they survive in "why," vanish from "what changed."

**Justification.** This makes "find where it went wrong and restart" actually representable. A changelog-with-explanations cannot represent a no-diff deliberation step; a reasoning-log treats it as first-class. The diff remains the shared atom across all layers, which is why it is worth pinning first.

**Alternatives discarded.**
- *Diff-primary, reason as an annotation/third column.* Rejected. It cannot represent a reason that produces no diff, and it inverts what we actually care about (the why).
- *Field-order debate (diff+reason vs reason+diff).* Dissolved. Cosmetic once they are separate records with a reference.

---

## 5. Cards: derived from the KB, default-locked

**Problem.** We want auto-generated UI from the KB (so the interface stays consistent with the knowledge), but auto-generated UI that silently changes under the user is hostile. We are afraid of what fully-automatic UI generation means for the user.

**Solution.** Split the difference. Cards are **auto-generated from the KB**, then **locked** as UI elements. A KB-born card is **born locked and immediately usable** — no admin approval gate at birth (this is the low-friction prototype path). An admin *can* edit a card; edits are also locked. Once locked, a card is frozen against subsequent KB drift. A change to an existing card must be **proposed** (when the KB later drifts, that raises an upgrade proposal the admin acts on); new cards can be generated freely.

Cards split three ways by the same cadence axis as storage:
- **Contracts/vocabulary** (the card definitions) — author-time data, live in the System tier `/cards`.
- **Renderers** (the TSX keyed to contracts) — build-time *code*, ship with the UI, stored nowhere in the KB. The KB stores specs/data, **never executable code**.
- **Payloads/instances** (`{cardType, objectId, diff}` a mutation emits) — per-project runtime data, live in the Project/Transaction tiers.

The same card renders across chat / diff / inspector / wizard — **placement is a prop**. This resolves the long-standing inline-vs-wizard fork. Unknown cardType = hard error.

**Surfaces vs. card identity (the structural split above is orthogonal to this).** The contract/renderer/payload split describes a card's *structural layers*. Separately, there are named **surfaces** a card can render on — **Feedback** (in the chat/scroll), **Wizard** (gathering input), **Inspector** (viewing an existing object). The default assumption, and the goal, is that **the same card contract renders in any surface**; surface-specific card *types* are introduced only when a shared contract proves insufficient. The surfaces are not three kinds of card — they are three places a card lands, and they differ primarily in **lifecycle**, not identity:

- **Feedback** surfaces are *historical* — they land in the scroll and stay.
- **Wizard** surfaces are *transient* — they exist only while gathering information, then dismiss.
- **Inspector** surfaces are *persistent* — they remain while an object is selected.

So the card describes *object / meaning / actions / state*; the surface determines *location / lifecycle / dismissal / persistence*. This is the cards-specific instance of the governing principle (Canonical Object → Projection → Surface): the card is the projection, the surface is the surface, and they are independent layers.

**Change Proposal (named, not yet designed).** A recurring thing a card renders is a *change proposal* — `{ summary, diff, accept, reject }` — which appears for table creation, table modification, plan modification, compilation, media changes, and more. It is worth naming Change Proposal as a first-class canonical object now (it projects *to* a card, which renders *on* a surface), because diff-review is plausibly more fundamental than "card." But its concrete design — what the review surface actually looks and feels like — is deliberately **left open**; we know we need it and do not yet know what it is. Naming it reserves the slot without spending the design headspace it will eventually require.

**Justification.** The lock is a *trust mechanism*: it buys stable UI from a generative source. Default-locked-and-usable kills admin friction for the prototype while preserving the property that nothing mutates UI under the user. It is reversible later by reinstating a birth-time proposal. The KB→card derivation is the same propagation mechanism as the project intelligence (change emits, workers recompute derivatives), instantiated at the admin tier — the recurring trick again.

**Alternatives discarded.**
- *Cards as a regenerable cache (disposable, recomputed on KB change).* Rejected. The point is the lock. Generate-once-then-lock with propose-on-change is the opposite of a cache and is what delivers the trust property.
- *Admin approval gate at card birth.* Deferred. Adds friction with no prototype payoff; can be added later.

---

## 6. Versioned state

**Problem.** With a user edit and an AI cascade both changing the model, "who wins?" looks like a hard concurrency question.

**Solution.** A linear chain of immutable version snapshots (doc + model together), Git-*like* by analogy only. The sequence within one transition is three-layered:

```
ver2 (base)  +  user mutation  →  ver3-seed  +  AI mutations  →  ver3-proposed  →  (approve) ver3-final
```

`ver3-seed` is a *real, addressable intermediate state*: base plus only the user mutation, before the cascade. The HEAD lands at one of three points: **discard** (back to base), **keep my edit, decline the cascade** (the seed), or **accept all** (the proposed/final, the typical case).

**Justification.** "Who wins" is a non-question: actions are serial, the most recent is HEAD. The three authored layers (user / intermediate / AI) give the diff schema its authorship dimension cleanly, and the seed is the seam the debug view can point at. Versioning is **not** premature infrastructure: the diff is the intelligence's interface, a diff requires two versions to exist, therefore versioning is load-bearing *now*, forced by the interface — not a feature indulged early. (Keep this justification attached to it so it is not later "simplified" away.)

**The one hard duty:** inconsistency must be visible/unmissable.

**Alternatives discarded.**
- *Speculative/dry-run framing for the cascade.* Replaced. The cascade result (`ver3-proposed`) is a *real computed state*, not a preview.
- *Cherry-pick (reject one consequence, keep others).* Held off. It breaks the linear chain and "actions are serial." We stay with three landing points unless we consciously decide otherwise.

---

## 7. Model shape: communication-shaped but compilable

**Problem.** The model can sit at one of three points: shaped like what *reads well* (communication), shaped like what *executes* (reality), or a clean third abstraction translated both ways (ontological/split). The translation between communication and reality has to happen *somewhere*; the question is which direction we pay for, and how often.

**Solution.** **Communication-shaped, but compilable.** The model is optimized for reading and editing. Where pulling something out of its underlying mechanical home aids comprehension, we do — AlgoAI, randomized selection, activation rules, and filters are all examples of things promoted to visual prominence because burying them hurts readability. The discipline attached: every comprehension-driven promotion must be **reversible to reality in principle**, even though we do not build the reverse now — i.e. we refuse to draw anything that *couldn't* be translated.

**Possible (not committed):** a second, hidden, reality-based model plus a hidden compile step. This would be a down payment on E/R and a sanity check — if the comm-model won't compile to the reality-model, we have drawn something impossible.

**Justification.** The cost asymmetry decides it. Rendering happens constantly; execution happens rarely (and right now, never). If the model were reality-shaped, we would pay the model→communication translation on *every render*, forever, starting now, in the layer we most want to keep simple — to serve a reality layer that does not yet exist. Communication-shaped pushes the translation to *execute*: later, once per run, in the E/R layer that is *defined* as the boundary to the outside world, and **free until E/R exists**. It also matches the model's actual job — the model is AI working memory made visible and editable; that job is comprehension and mutation, not execution fidelity. Going reality-shaped would let a non-existent layer (E) dictate model shape today, which is exactly what the scope rule forbids.

**Alternatives discarded.**
- *Reality-shaped model.* Rejected for the reasons above. Its one genuine advantage — it is impossible to draw something that can't execute — is recovered cheaply by the "reversible in principle" discipline.
- *Ontological/split model with two translators.* Rejected for the prototype. It is the "correct" abstract answer but doubles translators and adds a third abstraction to hold in the head — against the entire purpose of this refactor (reduce what must be held).

### 7a. Filters specifically

> **Note (reconciled with the schema doc, which is code-grounded and authoritative on *how*):** An earlier version of this section argued a filter "belongs to its source table" with "no view-node in the model." The actual ver1 code — and the schema doc that documents it — settled this the other way, and better. The text below reflects the settled position.

**A filter is its own thing — canonical.** It is the `WHERE` clause: `SELECT * FROM table WHERE A,B,C`. It is *related to* a table (it selects from one), but it is **managed separately for communication purposes** and has its own identity. The survival test confirms it: a filter has an `id` and a human name ("Items in stock", "Everything on sale") that *survive changes to its predicate* — the predicate can change while the filter stays the same filter. That surviving identity is what makes it canonical rather than a table property.

In the **entities-and-connections** model (see the schema doc), a filter is therefore its own **entity**, connected to the table it draws from — not an overlay buried inside the table. Ver1 already implements it this way (a flow entity with id + name), so this is *already built*, not a construction task.

This is consistent with "promotion is visual, not ontological": the filter's *identity* is real (canonical entity); how prominently it is *drawn* is a rendering judgment. The two were never in tension once the filter is its own entity.

---

## 8. Code structure: monorepo, one server, typed packages

**Problem.** "Multiple backends, multiple frontends" intuition pulls toward microservices, on the gut feeling that separate services are more decoupled than "just routes."

**Solution.** A **monorepo** in **TypeScript** (porting the current JS), with one runtime server and decoupling expressed as **typed packages** in a workspace, not as separate services.

- **One runtime server process.** The backend is *modules*, not deployables.
- **Two frontend apps:** **client** (the product) and **admin** (KB/card management — different user, different store, different lifecycle). **Debug/audit is a route inside client** for now, promotable to its own app later.
- **Packages:** `contracts` (the spine — diff / reasoning-step / span / snapshot / intent / card-contract; depends on nothing, everything depends on it), `kb` (business_knowledge + cards + loader, read-only at runtime), `project-store` (versioning, serialization, artifacts, the transaction-tier reasoning journal, plus conversation storage), `intelligence` (the black box — worker seams + sync/consistency/import-validate, synchronous for now), and offline `admin-tools` (KB→card derivation + audit/index; author-time scripts, not a server).

**Justification.** Decoupling comes from the *module boundary and the contract between modules*, not from the deployment unit. A typed package and a microservice express the *same* logical decoupling; they differ only in what sits in the gap. Package boundary → a typed function call; crossing it wrong is a **compile error, at the call site, instantly**. Service boundary → a network call across a wire format; crossing it wrong is a **runtime error, in a log, maybe, after it ships** — plus per-service servers, serialization at every hop, async failure, version skew, local orchestration, and distributed debugging. Microservices give the *same* decoupling, enforced *later and weaker*, at much higher cost. The cost is not in the writing (Claude Code will happily emit five servers); it is in *your head* every time you run, debug, or change a contract — the opposite of the headspace this refactor is meant to buy. Microservices would also force the real async queue prematurely, contradicting Section 3.

The decisive test, stated plainly: *when the diff shape changes, do you want a compile error at every call site, or a runtime error in a log later?* That answers it. And it is reversible — a clean typed package promotes to a service trivially if a real constraint (e.g. the intelligence getting heavy) later demands it. Separate by boundary now; separate by deployment only when forced.

**The genuine separations that do exist:** `admin-tools` is separate from the runtime entirely (author-time, not request-path). And debug-as-route promotes to debug-as-app the same way a package promotes to a service — when weight justifies it.

**Alternatives discarded.**
- *Microservices.* Rejected as above. Over-decoupled for a localhost prototype.
- *Everything in routes in one app ("just routes").* Rejected as the under-decoupled extreme — the tarball. Typed packages are the missing middle.
- *Three frontend apps from day one.* Rejected. Debug rides inside client because it renders the same diff/reasoning atoms client already holds; a standalone debug app would duplicate the contracts, card renderers, and snapshot plumbing to show a different *composition* of the same components.

---

## 9. Build approach (for when this becomes a spec)

Not part of this document's job, but recorded so the eventual spec inherits it:

- **Migration, not blank slate.** Port KB content, seed scenarios, plan↔model transform, and graph component from the current dir.
- **Milestone one:** the shell renders from a **hand-authored snapshot fixture**, with zero engines wired. This delivers the UI-mutation headroom *before* any worker exists. The fixture is a decision we make (likely seeded by the personalization example), not something Claude Code invents — if it invents the fixture, it invents the data model by accident.
- **The eventual spec is an execution document, not a discussion.** Because Claude Code starts with no context and cannot ask questions mid-build, every decision must be pre-made and freedom explicitly fenced (decided / do-not-do / provided). Its failure mode is inventing at any undecided point. (This document is the opposite register — problem/solution/justification, written to be argued with. The fenced execution spec comes *after* this is refined.)

---

## Appendix A — The canonical reasoning example (personalization method choice)

This example is the reference case for what the debug/audit UI must expose, and for what "replay" means.

To personalize, there are (at least) two methods: **Data Manager** (essentially a mail-merge) or **Experience Group targeting** (essentially a UI decision tree). Each has tradeoffs; the correct choice depends on circumstances. The AI must *choose*.

- If the AI **chooses wrong**, the fix is not to hand-edit the output — it is to **add more context**. Newly surfaced facts force a different choice.
- This is the precise meaning of **replay**: take a reasoning chain, **insert a context correction** at some step, and **re-reason from that point**. Because the surfaced facts may flip the choice (Data Manager → Experience Groups), and a flipped choice produces a *different* diff, you cannot replay *diffs* forward — you replay *decisions* forward, and the diffs regenerate as consequences.

This is why the transaction tier must store, per step: the decision point ("which personalization method"), the options considered (Data Manager | Experience Groups), the context facts that drove the pick, and the resulting diff. Drop the first three and keep only the diff, and the system can *show* the change but never *correct* it — the exact failure mode being designed against.

---

## Appendix B — Open questions remaining

- **Transaction-tier authority (Section 2):** observer now, event-sourced source-of-truth later? Named, deferred. The async-data constraint (fetched data must land inside the version) holds either way.
- **Hidden reality-model + compile step (Section 7):** candidate, not committed. Decide if/when it earns its place as an E/R down payment.
- **Summary-in-card vs summary-from-LLM:** leaning summary-in-card (the mutation emits structured data and no presentation; the card composes its own summary). Confirm.
- **Build-order:** the sequencing in any prior CLAUDE.md §8 was a suggestion, not ratified; revisit when writing the execution spec.
