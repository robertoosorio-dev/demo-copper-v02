# Library — Implementation Package

For Claude Code. Two jobs in here, independent enough to land in either order:

1. **Adopt the new design language as the app default** (a visual-only token pass).
2. **Build the Library** in the Context region — collapsed shelf (default) + expanded takeover.

The two HTML files in `reference/` are the **pixel-level source of truth**. They are *intent*, not structure — match the rendered look and spacing; the component breakdown and class names are yours. Tokens in `design-tokens.css` are canonical and must be used verbatim.

Report back what files you changed and why. Do not invent decisions that aren't here — open items are marked `TODO(human)` at the end; pick the stated default and flag it, don't resolve it.

---

## 0. Scope

**In.** The Library UI (both states), the reusable file-preview primitive, and migrating the app's chrome to the new tokens.

**Out — do not build, do not let it shape the UI.** Retrieval (no RAG, no search backend, no compression). Cross-project / shared storage. Any behavior where a folder or tier *does* something. The folder structure here is **pure human UX sugar — the engine sees nothing.** A folder is inert view metadata; global/local is a label, not infrastructure.

**Leave intact.** The transient composer attachment (files scoped to a single chat submission) is a *separate* surface from the Library. Do not merge them, do not refactor one into the other. They must stay visibly distinct (see §2.2).

---

## 1. Adopt the design language as default

Introduce `design-tokens.css` as the canonical token layer and migrate the app to it. **Visual-only: no layout or behavior changes.** This is a token swap and a base-chrome restyle, not a rewrite.

- Wire `design-tokens.css` into the global stylesheet (the token layer `CLAUDE.md` already points to). Replace existing ad-hoc color/spacing variables by mapping them onto these tokens; delete duplicates.
- Restyle shared chrome to match the reference: app bar, panels, cards, buttons, inputs, tabs, hairlines, focus rings. Use the reference files for the exact treatment.
- Enforce the three conventions everywhere, not just in the Library:
  - **One accent.** `--accent` is the only saturated UI color. Active tabs, selection, primary affordances. Nothing else competes.
  - **Type-colors are for documents only.** `--type-*` appears on file previews and type chips, never on chrome.
  - **Mono for data.** Counts, IDs, sizes, dates, breadcrumbs, plan lines, latency stamps → `--font-mono`. UI text → `--font-ui`.
- Keep the quality floor: visible `:focus-visible`, `prefers-reduced-motion` respected (both already in the tokens file).

---

## 2. The Library

Lives in the **Context region** (pinned, outside the Plan tab system). The Library has two states; the conversation is the third sibling. Default is the conversation showing with the **collapsed shelf** pinned on top.

### 2.1 FilePreview — the signature primitive

One component, used at two sizes. This is what earns the large-icon view: it renders a **faithful miniature of the actual document**, not a generic glyph.

- Props: `type` (`docx|xlsx|pptx|pdf|md|…`), `size` (`mini` | `large`), `name`.
- Set `data-type={type}` on the wrapper so `--tc` resolves (see tokens). The type-color drives the spine, the chip, and the heading/header accents inside the sketch.
- Content sketch by type (see reference for exact look):
  - **docx** — heading bar + paragraph lines.
  - **xlsx** — cell grid with a colored header row.
  - **pptx** — slide: title bar + content blocks.
  - **pdf** — dense text lines.
  - **md** — a `# heading` line in mono + lines.
- `large` shows a `TYPE` chip bottom-left and a folded top-right corner. `mini` drops the chip (too small); shape + spine color carry it.
- Unknown type → neutral page with the extension as the chip. Never crash on an unmapped type.

### 2.2 Collapsed — the shelf (default state)

A **thin shelf pinned above the conversation.** It is a *peek*, not a list. See `reference/library_collapsed.html`.

- One row, **never wraps**: a `Library` label + file count (mono), then a horizontal strip of `mini` FilePreviews, then a `+N` overflow tile, then an expand control.
- The strip is **flat recents** — most-recently-touched files across the whole Library, *ignoring folders and tier*. The mix is intentional (a global brand PDF can sit next to local files). Sort by `updatedAt`, take the first N that fit.
- Names under minis hard-truncate (`Media…`); the shape + type-color do the "what's in it" work at this width. Full names live in the expanded view.
- The whole shelf is the affordance: clicking it (or the expand control) opens the takeover.
- **Distinct from the composer attachment.** The shelf renders document previews up top. The transient attachment renders as a plain mono pill at the composer (`file.xlsx ✕`). Different shapes on purpose — do not unify.

### 2.3 Expanded — the takeover

Clicking the shelf expands the Library into a tab that **takes over the conversation's space within the Context region.** The Plan tabs (right) are untouched. See `reference/library_takeover.html`.

- The region **borrows width** when expanded (the conversation column is thin; large icons need room, and browsing source material is a deliberate mode). The Plans region yields to a narrower width but stays visible. Do not overlay or modal it — it's an in-region mode swap.
- Header: a **‹ Conversation** control (the way back / collapse), a `Library` title, a breadcrumb (mono), a view toggle (large-icons / list — large-icons is the only one built for now; list is a stub), and a single **`Add`** button.
- Body is two panes:
  - **Folder tree** (left). Derived purely by grouping files on their inert `folderPath`. Two tiers as rendered: `Global` / `Local`, then `Media` / `Data` under each. Show per-folder counts (mono). Selecting a node filters the grid.
  - **Large-icon grid** (right). `large` FilePreviews for the selected folder, with filename + a mono meta line (date or size). One tile selectable.
- **`Add` is a single action** — system detects the type, no picker. Non-spreadsheet files drop silently into the Library. A *spreadsheet* dropped into Context is the one ambiguous case ("file or table?") — that routing rule already exists; respect it, don't reimplement it here.
- Optional, low priority: a client-side filename filter behind the search field. **No backend search.** If not trivial, leave the field as a visual placeholder.

---

## 3. View-level data shape

This is **view metadata only** — not a storage model. A Library file:

```ts
type LibraryFile = {
  id: string;
  name: string;
  type: 'docx' | 'xlsx' | 'pptx' | 'pdf' | 'md' | string;
  tier: 'global' | 'local';   // a LABEL — no engine meaning
  folderPath: string;         // inert; the tree is grouped from this
  updatedAt: string;          // drives flat recents
  size?: number;
};
```

The tree is *derived*, never authored: group by `tier` then by the next path segment. Recents = `sort(updatedAt desc).slice(0, N)`. Nothing reads `folderPath` except the tree renderer.

---

## 4. Behaviors

- Shelf click / expand control → expand to takeover. **‹ Conversation** → collapse.
- Tree node select → grid shows that folder (group by `folderPath`).
- Tile: hover lift, single-select. (No multi-select, no inline rename for now.)
- `Add` → one action, type-detected, silent for non-spreadsheets.
- Motion is minimal: a soft staggered fade-in on grid tiles, disabled under reduced-motion. Nothing else.

---

## 5. Open items — `TODO(human)`

Build the stated default, mark it, wait for Serge. Do not resolve.

- **Tier ordering.** The tree puts `Global/Local` outer, `Media/Data` inner. This is the single-axis-as-tree commitment. Default = as rendered; flag for review.
- **Empty shelf.** The two-line-email case has zero files. Default = shelf collapses to a slim `Add files` affordance rather than rendering empty tiles. Flag for review.
- **List view.** Toggle is present; only large-icons is built. List is a stub.

---

## 6. Reference

- `reference/library_collapsed.html` — default state, the shelf.
- `reference/library_takeover.html` — expanded state, tree + large-icon grid.
- `design-tokens.css` — canonical tokens. Use verbatim.

The HTML is the look. The tokens are the law. Component structure is yours.
