# CoPPER Card Usage KB v0.1

## Purpose

This file is a specialized knowledge base for the v0.1 CoPPER card library.

Use it to decide which reusable TSX card should be rendered when the LLM observes, proposes, validates, or summarizes a project change.

The core rule is:

```text
Card identity is independent of surface.
```

A card can appear in chat, onboarding, an inspector, a changes panel, an activity stream, or a version/diff review screen. The card should not know which surface is rendering it.

For v0.1:

```text
One semantic card = one TSX file.
```

Do not prematurely collapse cards into abstract generic components. Build concrete cards first, use them, then refactor after patterns are visible.

---

## Source material

The v0.1 cards are extracted from the Synapse/Figma catalog import flow and the CoPPER refactor notes.

The Figma flow presents a wizard:

1. Upload and detect
2. Filtering rules
3. Primary key
4. Field mapping
5. Schedule
6. Catalog preview

The reusable cards hidden inside the wizard are not the wizard steps themselves. The reusable cards are the visual/semantic units that can move between surfaces.

---

## Global LLM-to-card translation rule

When the LLM produces structured output, classify each item by intent:

| LLM intent | Card |
|---|---|
| Ask user where data comes from | `SourceInputCard` |
| Report what was discovered after reading a source | `TableDiscoveryCard` |
| Report data-quality issues | `ValidationFindingsCard` |
| Recommend a filter | `FilterRecommendationCard` |
| Show consequences of active filters | `FilterImpactSummaryCard` |
| Let user define a custom filter | `CustomFilterCard` |
| Recommend or confirm a primary key | `KeySelectionCard` |
| Map source columns to system fields | `FieldMappingCard` |
| Define refresh behavior, schedule, name, source settings | `ImportSettingsCard` |
| Show final rows after processing | `TablePreviewCard` |
| Summarize a proposed or completed mutation | `ChangeSummaryCard` |

---

## Canonical card payload envelope

LLM output should be normalized into a card envelope before rendering.

```json
{
  "cardType": "TableDiscoveryCard",
  "surfaceHint": "chat",
  "objectRef": {
    "type": "table",
    "id": "table_products",
    "name": "Products"
  },
  "mode": "proposed",
  "payload": {},
  "actions": []
}
```

### Fields

`cardType`
: The TSX component name.

`surfaceHint`
: Optional. Suggested placement only. It must not change the card identity.

`objectRef`
: Optional pointer to the underlying project model object.

`mode`
: One of `draft`, `proposed`, `active`, `applied`, `failed`, `readonly`.

`payload`
: Card-specific props.

`actions`
: Semantic actions exposed by the card. Surfaces may decide how to route them.

---

# Cards

## 1. SourceInputCard

### When to use

Use when the system needs the user to choose or configure a data source.

Examples:

- User says: "Import my catalog."
- System needs to ask: Google Sheets, GCS, S3, Shopify, SFTP, or Upload?
- User has selected Google Sheets and must provide URL/auth.

### Do not use when

- The source has already been read and the system is summarizing rows/columns/warnings. Use `TableDiscoveryCard`.
- The user is configuring schedule or refresh behavior after connection. Use `ImportSettingsCard`.

### LLM input examples

```text
The user wants to import a product catalog but has not specified the source.
```

```text
The user selected Google Sheets and provided a sheet URL. Ask for authorization and connect.
```

### Card payload

```json
{
  "cardType": "SourceInputCard",
  "payload": {
    "selectedSourceId": "google_sheets",
    "options": [
      { "id": "google_sheets", "label": "Google Sheets", "kind": "live_feed" },
      { "id": "gcs", "label": "Google Cloud Store", "kind": "live_feed" },
      { "id": "amazon_s3", "label": "Amazon S3", "kind": "live_feed" },
      { "id": "sftp", "label": "SFTP", "kind": "live_feed" },
      { "id": "shopify", "label": "Shopify", "kind": "live_feed" },
      { "id": "upload", "label": "Upload File", "kind": "snapshot" }
    ],
    "authLabel": "Read-only Google account",
    "fields": [
      { "label": "URL", "value": "https://docs.google.com/spreadsheets/..." }
    ]
  }
}
```

### LLM extraction notes

Look for source words: `Google Sheets`, `GCS`, `Google Cloud Store`, `Amazon S3`, `SFTP`, `Shopify`, `Adobe S3`, `CSV`, `upload`, `feed`, `bucket`, `path`, `URL`, `auth`, `credential`.

---

## 2. TableDiscoveryCard

### When to use

Use immediately after a source has been sampled/read/analyzed and the system can summarize what it found.

Examples:

- "I analyzed 12,567 rows and found 6 columns."
- "The product catalog has 3 warnings."
- "This is a live feed and will re-sync."

### Do not use when

- Listing specific validation issues. Use `ValidationFindingsCard`.
- Showing the final row grid. Use `TablePreviewCard`.
- Summarizing a mutation for approval. Use `ChangeSummaryCard`.

### Card payload

```json
{
  "cardType": "TableDiscoveryCard",
  "objectRef": { "type": "table", "id": "table_zesty_zing_catalog", "name": "Zesty Zing Catalog" },
  "payload": {
    "tableName": "Zesty Zing Catalog",
    "sourceLabel": "Google Sheets",
    "sourceUrl": "https://docs.google.com/spreadsheets/...",
    "rows": 12567,
    "columns": 6,
    "warnings": 3,
    "skippedRows": 6,
    "isLiveFeed": true,
    "status": "analyzed"
  }
}
```

### LLM extraction notes

Extract metrics exactly when available. Do not invent counts.

Preferred fields:

- `tableName`
- `sourceLabel`
- `rows`
- `columns`
- `warnings`
- `skippedRows`
- `isLiveFeed`
- `sourceUrl`

---

## 3. ValidationFindingsCard

### When to use

Use when the system has found data-quality issues in the source/table.

Examples:

- Empty cells in Price column: 18 rows affected.
- Empty cells in Product Name column: 10 rows affected.
- Broken URL in Image column: 4 rows affected.
- Duplicate primary key values.

### Do not use when

- The issue is a proposed change rather than a finding. Use `ChangeSummaryCard`.
- The issue is specifically about primary key selection. Use `KeySelectionCard`.
- The issue is a filter suggestion. Use `FilterRecommendationCard`.

### Card payload

```json
{
  "cardType": "ValidationFindingsCard",
  "payload": {
    "findings": [
      {
        "id": "missing_price",
        "title": "Empty cells in Price column",
        "column": "Price",
        "rowsAffected": 18,
        "severity": "warning",
        "status": "open"
      },
      {
        "id": "missing_product_name",
        "title": "Empty cells in Product Name column",
        "column": "Product Name",
        "rowsAffected": 10,
        "severity": "warning",
        "status": "open"
      },
      {
        "id": "broken_image_url",
        "title": "Broken URL in Image column",
        "column": "Image",
        "rowsAffected": 4,
        "severity": "warning",
        "status": "open"
      }
    ]
  },
  "actions": ["exclude", "ignore", "undo", "apply_all"]
}
```

### LLM action semantics

`Exclude from import`
: Do not import affected rows now or during future re-syncs.

`Ignore`
: Proceed but flag/monitor the issue.

`Undo`
: Revert a previous exclude/ignore decision.

---

## 4. FilterRecommendationCard

### When to use

Use when the agent recommends a specific filter rule.

Examples:

- "Exclude out-of-stock products."
- "Include only products from Category = Snacks."
- "Drop products without images."

### Do not use when

- The user is manually building a rule. Use `CustomFilterCard`.
- The system is showing the aggregate impact of all filters. Use `FilterImpactSummaryCard`.
- The filter has already become part of a broader proposed mutation. Use `ChangeSummaryCard`.

### Card payload

```json
{
  "cardType": "FilterRecommendationCard",
  "payload": {
    "title": "Exclude out-of-stock products",
    "reason": "2,312 products have availability = out of stock. Advertising items shoppers cannot buy wastes spend.",
    "rowsRemoved": 2312,
    "field": "availability",
    "operator": "=",
    "value": "out of stock",
    "status": "recommended"
  },
  "actions": ["apply", "dismiss"]
}
```

### LLM extraction notes

A filter recommendation requires:

- A rule or implied rule
- A reason
- An estimated impact when available

If impact is unknown, set `rowsRemoved` to `0` only if the UI supports unknown impact. Prefer delaying render until impact has been computed.

---

## 5. FilterImpactSummaryCard

### When to use

Use after one or more filters are active or proposed and the user needs to understand their combined effect.

Examples:

- Active filters: 1
- Rows kept: 10,223 of 12,535
- Rows removed: 2,312

### Do not use when

- Presenting a single recommendation. Use `FilterRecommendationCard`.
- Presenting validation issues. Use `ValidationFindingsCard`.

### Card payload

```json
{
  "cardType": "FilterImpactSummaryCard",
  "payload": {
    "originalRows": 12535,
    "currentRows": 10223,
    "activeFilters": 1
  }
}
```

---

## 6. CustomFilterCard

### When to use

Use when the user wants to build a custom filter manually.

Examples:

- "Only include snacks."
- "Filter the catalog to category = Snacks."
- "Drop rows where price is empty."

### Do not use when

- The agent is recommending a filter and asking for approval. Use `FilterRecommendationCard`.
- The filter is already applied and only impact is needed. Use `FilterImpactSummaryCard`.

### Card payload

```json
{
  "cardType": "CustomFilterCard",
  "payload": {
    "columns": ["SKU", "Product Name", "Category", "Price", "Image"],
    "operators": ["=", "!=", "contains", ">", "<"],
    "selectedColumn": "Category",
    "selectedOperator": "=",
    "value": "Snacks"
  },
  "actions": ["apply", "cancel"]
}
```

---

## 7. KeySelectionCard

### When to use

Use when choosing, confirming, or warning about a primary key.

Examples:

- "SKU is fully unique and stable."
- "Product Name has 8 duplicates."
- "Use Product Name + SKU as a composite key."

### Do not use when

- Showing general validation findings unrelated to key selection. Use `ValidationFindingsCard`.
- Mapping fields. Use `FieldMappingCard`.

### Card payload: valid single key

```json
{
  "cardType": "KeySelectionCard",
  "payload": {
    "keyName": "SKU",
    "mode": "single",
    "isRecommended": true,
    "isValid": true,
    "uniqueValues": 2808,
    "totalValues": 2808,
    "duplicates": 0,
    "missing": 0,
    "sampleValues": ["SKU-4954333", "SKU-58444333"],
    "reason": "SKU is unique, complete, and stable across syncs."
  },
  "actions": ["edit", "apply", "cancel"]
}
```

### Card payload: invalid key

```json
{
  "cardType": "KeySelectionCard",
  "payload": {
    "keyName": "Product Name",
    "mode": "single",
    "isRecommended": false,
    "isValid": false,
    "uniqueValues": 2800,
    "totalValues": 2808,
    "duplicates": 8,
    "missing": 0,
    "reason": "Product Name has 8 duplicates. De-duplication could merge distinct products and pin the wrong creative."
  }
}
```

### Card payload: composite key

```json
{
  "cardType": "KeySelectionCard",
  "payload": {
    "keyName": "Product Name + SKU",
    "mode": "composite",
    "isRecommended": true,
    "isValid": true,
    "uniqueValues": 2808,
    "totalValues": 2808,
    "duplicates": 0,
    "missing": 0,
    "reason": "Composite keys combine columns when no single column is unique on its own."
  }
}
```

---

## 8. FieldMappingCard

### When to use

Use when mapping source fields to system fields.

Examples:

- `SKU` maps to `sku`
- `Product Name` maps to `product_name`
- `Image` maps to `image_url`
- Price inferred as numerical but has a type warning

### Do not use when

- Selecting the primary key. Use `KeySelectionCard`.
- Showing raw preview rows. Use `TablePreviewCard`.

### Card payload

```json
{
  "cardType": "FieldMappingCard",
  "payload": {
    "mappedCount": 5,
    "totalCount": 5,
    "typeWarnings": 1,
    "rows": [
      {
        "id": "sku",
        "fileColumnName": "SKU",
        "systemColumnName": "sku",
        "category": "sku",
        "type": "String",
        "sampleValue": "SKU-595500064"
      },
      {
        "id": "price",
        "fileColumnName": "Price",
        "systemColumnName": "price",
        "category": "price",
        "type": "Numerical",
        "sampleValue": "5$",
        "warning": "Price contains currency symbol"
      }
    ]
  }
}
```

### LLM extraction notes

The LLM should preserve original column names and proposed system names separately. Do not erase the source names.

---

## 9. ImportSettingsCard

### When to use

Use when defining or reviewing import behavior after the source is known.

Examples:

- Catalog name: Zing Zesty Catalog
- Brand: Zing Zesty
- Schedule: Auto every hour
- Refresh behavior: Manual vs Auto

### Do not use when

- Choosing the source itself. Use `SourceInputCard`.
- Showing validation findings. Use `ValidationFindingsCard`.

### Card payload

```json
{
  "cardType": "ImportSettingsCard",
  "payload": {
    "tableName": "Zing Zesty Catalog",
    "brand": "Zing Zesty",
    "refreshMode": "auto",
    "scheduleLabel": "Every hour",
    "sourceLabel": "Google Sheets"
  },
  "actions": ["edit", "save"]
}
```

### LLM extraction notes

`ImportSettingsCard` represents import definition, not merely schedule.

It may include source settings, refresh behavior, schedule, and project/brand association.

---

## 10. TablePreviewCard

### When to use

Use to show the resulting rows after source read, validation decisions, filters, key selection, and field mapping.

Examples:

- Final catalog preview before save.
- Preview of a filtered table.
- Preview of table after mapping.

### Do not use when

- Only high-level metrics are needed. Use `TableDiscoveryCard`.
- The table is being edited in a full grid surface. The card may link into the full surface instead.

### Card payload

```json
{
  "cardType": "TablePreviewCard",
  "payload": {
    "tableName": "Zing Zesty Catalog",
    "rowsCount": 1290,
    "columns": ["SKU", "Product Name", "Description", "Price", "Image"],
    "pageSize": 50,
    "rows": [
      {
        "SKU": "SKU-58444333",
        "Product Name": "Tangy Lime",
        "Description": "Zesty snack that combines the refreshing taste...",
        "Price": "5$",
        "Image": "https://images.example.com/ssld344"
      }
    ]
  },
  "actions": ["save"]
}
```

---

## 11. ChangeSummaryCard

### When to use

Use whenever the system needs to summarize a proposed, accepted, applied, rejected, or rolled-back mutation.

This is the most important general-purpose card.

Use it for:

- Data table creation
- Import definition changes
- Filter additions/removals
- Key changes
- Field mapping changes
- Plan diffs
- Project model mutations
- Media entity compilation
- Sync to reality
- Rollback

### Do not use when

- The user is simply choosing a source. Use `SourceInputCard`.
- The system is only showing a single specialized recommendation and no approval bundle. Use the specialized card first.

### Card payload

```json
{
  "cardType": "ChangeSummaryCard",
  "objectRef": { "type": "table", "id": "table_products", "name": "Products" },
  "mode": "proposed",
  "payload": {
    "title": "Create Products Table",
    "status": "proposed",
    "why": "The uploaded Google Sheet appears to be an operational product catalog, not a context file.",
    "changes": [
      { "id": "create_table", "op": "add", "label": "Create table", "detail": "Products" },
      { "id": "set_key", "op": "add", "label": "Set primary key", "detail": "SKU" },
      { "id": "add_filter", "op": "add", "label": "Add filter", "detail": "Exclude out-of-stock products" },
      { "id": "map_fields", "op": "modify", "label": "Map 5 fields", "detail": "SKU, Product Name, Description, Price, Image" }
    ],
    "warnings": ["3 validation issues remain flagged but non-blocking"],
    "consequences": ["2,312 rows will be excluded on every sync", "The table will refresh every hour"],
    "affectedObjects": ["Products Table", "Import Definition", "Catalog Preview"]
  },
  "actions": ["accept", "reject", "inspect"]
}
```

### LLM translation rules

Use `ChangeSummaryCard` when the LLM output contains any of these verbs:

- create
- update
- modify
- delete
- remove
- add
- import
- sync
- compile
- rollback
- approve
- reject
- apply

### Operation mapping

| Natural language | `op` |
|---|---|
| added / created / enabled | `add` |
| changed / remapped / renamed / updated | `modify` |
| removed / deleted / excluded | `remove` |
| warning / risk / unresolved issue | `warning` |

---

# Surface examples

## Surface 1: Chat / agent transcript

Use chat when the card is the result of a conversational turn.

Example sequence:

1. User: "Import this Google Sheet as a product catalog."
2. Render `SourceInputCard` if source/auth missing.
3. Render `TableDiscoveryCard` after analysis.
4. Render `ValidationFindingsCard` for issues.
5. Render `ChangeSummaryCard` before committing.

Cards should be compact in chat. Prefer one primary card per agent turn plus optional secondary cards collapsed below it.

## Surface 2: Wizard step canvas

Use the wizard canvas when guiding a first-time setup or onboarding.

Example sequence:

- Upload and detect → `SourceInputCard`, then `TableDiscoveryCard`, then `ValidationFindingsCard`
- Filtering rules → `FilterRecommendationCard`, `CustomFilterCard`, `FilterImpactSummaryCard`
- Primary key → `KeySelectionCard`
- Field mapping → `FieldMappingCard`
- Schedule → `ImportSettingsCard`
- Catalog preview → `TablePreviewCard`, then `ChangeSummaryCard`

The wizard is a surface, not a card identity.

## Surface 3: Inspector drawer

Use inspector when the object already exists and the user is managing it.

Possible cards:

- `TableDiscoveryCard` as object summary
- `ValidationFindingsCard` as data-quality panel
- `FilterImpactSummaryCard` as current filter state
- `KeySelectionCard` for key configuration
- `FieldMappingCard` for mapping configuration
- `ImportSettingsCard` for refresh/source settings
- `TablePreviewCard` for sampled rows

## Surface 4: Changes panel / diff review

Use when the user or agent has generated one or more pending mutations.

Primary card:

- `ChangeSummaryCard`

Secondary cards may be embedded or linked:

- `FilterRecommendationCard`
- `KeySelectionCard`
- `ValidationFindingsCard`
- `TablePreviewCard`

## Surface 5: Activity log / transaction log

Use after a change has been applied.

Primary card:

- `ChangeSummaryCard` with `status: "applied"`

The log should show outcomes, not ask setup questions.

---

# Minimum v0.1 build order

Build first:

1. `TableDiscoveryCard.tsx`
2. `ValidationFindingsCard.tsx`
3. `FilterRecommendationCard.tsx`
4. `KeySelectionCard.tsx`
5. `ChangeSummaryCard.tsx`

Then add:

6. `SourceInputCard.tsx`
7. `FilterImpactSummaryCard.tsx`
8. `CustomFilterCard.tsx`
9. `FieldMappingCard.tsx`
10. `ImportSettingsCard.tsx`
11. `TablePreviewCard.tsx`

---

# Anti-patterns

## Do not encode surface into card names

Bad:

```text
ChatTableDiscoveryCard
WizardValidationCard
InspectorImportSettingsCard
```

Good:

```text
TableDiscoveryCard
ValidationFindingsCard
ImportSettingsCard
```

## Do not make File and Table a promotion ladder

A spreadsheet may become either:

- Context File
- Project Model Table

But File is not a precursor to Table.

If the user needs to decide, render a selection surface/card before creating the project model object.

## Do not hide proposed mutations inside specialized cards

Specialized cards can recommend or configure.

But if the system is about to mutate the Project Model or Reality, render `ChangeSummaryCard` before commit.

## Do not invent metrics

If row counts, warning counts, duplicate counts, or impact counts are unknown, either omit the metric or mark it as pending. Do not fabricate values.

---

# LLM output examples

## Example A: source analyzed

```json
[
  {
    "cardType": "TableDiscoveryCard",
    "payload": {
      "tableName": "Zesty Zing Catalog",
      "sourceLabel": "Google Sheets",
      "rows": 12567,
      "columns": 6,
      "warnings": 3,
      "skippedRows": 6,
      "isLiveFeed": true,
      "status": "analyzed"
    }
  },
  {
    "cardType": "ValidationFindingsCard",
    "payload": {
      "findings": [
        { "id": "price_missing", "title": "Empty cells in Price column", "column": "Price", "rowsAffected": 18, "severity": "warning", "status": "open" },
        { "id": "name_missing", "title": "Empty cells in Product Name column", "column": "Product Name", "rowsAffected": 10, "severity": "warning", "status": "open" },
        { "id": "image_broken", "title": "Broken URL in Image column", "column": "Image", "rowsAffected": 4, "severity": "warning", "status": "open" }
      ]
    }
  }
]
```

## Example B: filter recommendation

```json
[
  {
    "cardType": "FilterRecommendationCard",
    "payload": {
      "title": "Exclude out-of-stock products",
      "reason": "2,312 products have availability = out of stock. No point advertising items shoppers cannot buy right now.",
      "rowsRemoved": 2312,
      "field": "availability",
      "operator": "=",
      "value": "out of stock",
      "status": "recommended"
    }
  },
  {
    "cardType": "FilterImpactSummaryCard",
    "payload": {
      "originalRows": 12535,
      "currentRows": 10223,
      "activeFilters": 1
    }
  }
]
```

## Example C: approval bundle

```json
{
  "cardType": "ChangeSummaryCard",
  "payload": {
    "title": "Create Zing Zesty Catalog",
    "status": "proposed",
    "why": "The connected Google Sheet contains an operational product catalog that should participate in execution.",
    "changes": [
      { "id": "table", "op": "add", "label": "Create table", "detail": "Zing Zesty Catalog" },
      { "id": "import", "op": "add", "label": "Create import definition", "detail": "Google Sheets, auto sync every hour" },
      { "id": "key", "op": "add", "label": "Set primary key", "detail": "SKU" },
      { "id": "filter", "op": "add", "label": "Apply filter", "detail": "Exclude out-of-stock products" },
      { "id": "mapping", "op": "modify", "label": "Map fields", "detail": "5 of 5 source columns mapped" }
    ],
    "warnings": ["3 validation issues remain non-blocking"],
    "consequences": ["2,312 rows excluded on each sync", "10,223 rows available after filtering"],
    "affectedObjects": ["Table Definition", "Import Definition", "Filter Rules", "Field Mapping"]
  },
  "actions": ["accept", "reject", "inspect"]
}
```
