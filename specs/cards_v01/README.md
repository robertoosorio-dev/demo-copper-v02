# CoPPER Card Library v0.1

This package contains a candidate v0.1 card library extracted from the Synapse/Figma catalog import flow.

## Principle

One semantic card = one TSX file.

Cards are reusable components. Surfaces are places cards appear.

## Files

- `cards/SourceInputCard.tsx`
- `cards/TableDiscoveryCard.tsx`
- `cards/ValidationFindingsCard.tsx`
- `cards/FilterRecommendationCard.tsx`
- `cards/FilterImpactSummaryCard.tsx`
- `cards/CustomFilterCard.tsx`
- `cards/KeySelectionCard.tsx`
- `cards/FieldMappingCard.tsx`
- `cards/ImportSettingsCard.tsx`
- `cards/TablePreviewCard.tsx`
- `cards/ChangeSummaryCard.tsx`
- `cards/index.ts`
- `card_usage.md`

## First-build recommendation

Build and test these first:

1. `TableDiscoveryCard`
2. `ValidationFindingsCard`
3. `FilterRecommendationCard`
4. `KeySelectionCard`
5. `ChangeSummaryCard`

## Styling assumption

The TSX files use Tailwind-style utility classes. If the prototype does not use Tailwind, treat the class names as a design-token spec and translate them to the local styling system.
