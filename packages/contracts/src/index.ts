// ─────────────────────────────────────────────────────────────────────────────
// @copper/contracts — the spine
// Every shape here is authoritative per v2_object_schemas.md.
// Do not add fields without updating the schema doc.
// ─────────────────────────────────────────────────────────────────────────────

// ── Part A: Machinery ─────────────────────────────────────────────────────────

export interface ContextFile {
  name: string;
  kind: "file" | "spreadsheet";
  size: number;
  addedAt: string; // ISO 8601
  sheets?: Array<{
    name: string;
    rowCount: number;
    columns: string[];
    preview: string[][];
  }>;
}

export interface Exchange {
  id: string;
  role: "user" | "assistant";
  text: string;
  status: "pending" | "success" | "error";
  llmModel?: string;
  startedAt?: string;
  responseTimeMs?: number;
  planType?: "data" | "media" | null;
  proposal?: ProposalPayload | null;
  card?: {
    cardType: string;
    props: Record<string, unknown>;
  };
  rawResponse?: string;
  attachmentNames?: string[];
}

export interface ProposalPayload {
  description: string;
  backward: Array<{ type: "add" | "modify" | "warn"; label: string; note: string }>;
  forward: Array<{ type: "add" | "modify" | "warn"; label: string; note: string }>;
}

export type CampaignStatus = "draft" | "running" | "paused" | "scheduled" | "finished" | "archived";

export interface CampaignMeta {
  status: CampaignStatus;
  description: string;
  startDate: string;
  endDate: string;
  completedSteps: number;
  totalSteps: number;
  brandId: string | null;
  brandName: string | null;
}

export interface CampaignStrategyContext {
  deliveryType: "with-personalization" | "without-personalization" | null;
}

export interface ProjectContext {
  contextFiles: ContextFile[];
  exchanges: Exchange[];
  linkedCatalogId?: string | null;
  campaign?: CampaignMeta;
  brief?: Record<string, unknown>;
  confirmedSteps?: string[];
  campaignStrategy?: CampaignStrategyContext;
}

// ── A1. Version ───────────────────────────────────────────────────────────────

export interface Version {
  id: string;
  name: string;
  version: number;
  parentVersion: number | null;
  authoredBy: "user" | "system";
  createdAt: string; // ISO 8601

  context: ProjectContext;

  plans: {
    data: PlanSlot<DataPlanModel>;
    media: PlanSlot<MediaPlanModel>;
    creative: PlanSlot<CreativePlanModel>;
  };
}

export interface PlanSlot<M> {
  document: string; // markdown
  model: M | null;
}

// ── A2. Diff (computed, never stored) ─────────────────────────────────────────

export type DiffKind = "added" | "removed" | "modified";

export interface DiffChange {
  path: string; // e.g. "plans.data.model.entities[id=tbl_foo].name"
  kind: DiffKind;
  before: unknown;
  after: unknown;
}

export interface Diff {
  from: number; // version number
  to: number;
  changes: DiffChange[];
}

// ── A3. Reasoning log entry (append-only) ─────────────────────────────────────

export interface ReasoningLogEntry {
  id: string; // e.g. "rlog_0012"
  fromVersion: number;
  toVersion: number;
  pass: string; // e.g. "pass_a1b2" — groups entries in one transaction
  seq: number; // order within a pass

  reasoning: {
    problem: string;
    solution: string;
    justification: string;
    alternativesConsidered: string[]; // may be empty
  };

  producedChanges: string[]; // ProposedChange ids — zero is legal
  contextSeen: {
    chat?: {
      userMessage: string;
      history: Array<{ role: "user" | "assistant"; content: string }>;
    };
    // future: kbSnippets?, projectSnapshot?
  };
}

// ── A4. Proposed change ───────────────────────────────────────────────────────

export type ProposedChangeState = "pending" | "accepted" | "rejected";

export interface ProposedChange {
  id: string;
  planType: "data" | "media";
  fromVersion: number;
  proposedVersion: number;

  summary: string; // composed in-card from structured data, NOT LLM prose
  diff: Diff; // computed value, inline
  reasoning: string[]; // ReasoningLogEntry ids

  state: ProposedChangeState;
  base: Version; // full version for rollback
}

// ─────────────────────────────────────────────────────────────────────────────
// Part B: The project model (entities + connections)
// ─────────────────────────────────────────────────────────────────────────────

// ── B common: Connection ──────────────────────────────────────────────────────

export interface Connection {
  from: string; // entity id
  to: string; // entity id
  // direction-optional: topology only; execution-order under branching is deferred
}

// ── B common: Field ───────────────────────────────────────────────────────────

export type FieldDataType = "Text" | "Integer" | "Timestamp" | "Float" | "Boolean";
export type FieldMode = "Stored" | "Derived" | "Fetched";
export type FieldRole = "data" | "decision";

export interface Field {
  id: string;
  name: string;
  dataType: FieldDataType;
  mode?: FieldMode;
  role?: FieldRole;
  isPrimaryKey?: boolean;
}

// ── B1: Data-plan entity types ────────────────────────────────────────────────

export interface TableEntity {
  type: "Table";
  name: string;
  tableType: "Input" | "Transform" | "Standard";
  primaryKey?: string;
  description?: string;
  fields: Field[];
}

export interface ImportEntity {
  type: "Import";
  name: string;
  source: string;
  frequency?: string; // e.g. "Daily"
  syncMode?: string;
  // TODO(human): Import may be canonical if it is named & kept across source changes
  // — see schema doc B1. Currently treated as owned by its connected Table.
}

export interface FilterEntity {
  type: "Filter";
  name: string;
  predicate: string; // WHERE-clause description
  // Filter is canonical: id + name survive predicate changes (schema doc B1)
}

export interface AlgoAIEntity {
  type: "AlgoAI";
  name: string;
  optimization?: string; // e.g. "CTR", "Route"
  promoted: boolean; // communication-shaped prominence flag
}

export interface OutputField {
  id: string;
  name: string; // macro name — operationally significant for downstream media
  sourceFieldId: string; // "object.field" pointer — e.g. "tbl_events.fld_user_id" or "$impression.QUERY_STRING_Q"
}

export interface OutputEntity {
  type: "Output";
  name: string;
  maxRows: number; // cap — 1 for scalar audience, >1 for product rec
  fields: OutputField[];
}

export interface ImpressionEntity {
  type: "Impression";
  name: string;
  fields: Field[]; // inbound context attributes: dmp_id, geo, device, placement_id
}

// ── B2: Media-plan entity types ───────────────────────────────────────────────

export type EntityStatus = "planned" | "synced" | "live" | "modified" | "drifted";

export interface MediaPartnerEntity {
  type: "MediaPartner";
  name: string;
  connector?: string;
  deliveryFormat?: string;
  clickTracking?: string;
  status: EntityStatus;
}

export interface PlacementGroupEntity {
  type: "PlacementGroup";
  name: string;
  seat?: string;
  advertiser?: string;
  campaign?: string;
  status: EntityStatus;
}

export interface PlacementEntity {
  type: "Placement";
  name: string;
  size?: string;
  deliveryFormat?: string;
  creativeUnit?: string;
  serving?: string;
  dspCreativeId?: string;
  status: EntityStatus;
}

export interface ExperienceGroupEntity {
  type: "ExperienceGroup";
  name: string;
  creativeUnit?: string;
  servingStatus?: string;
  currentFlight?: string;
  impressions?: number;
  status: EntityStatus;
}

export interface CreativeEntity {
  type: "Creative";
  name: string;
  creativeUnit?: string;
  sizes?: string;
  costType?: string;
  qaStatus?: string;
  status: EntityStatus;
}

export interface LandingPageGroupEntity {
  type: "LandingPageGroup";
  name: string;
  scope?: string;
  description?: string;
  status: EntityStatus;
}

export interface LandingPageEntity {
  type: "LandingPage";
  name: string;
  condition?: string;
  weight?: number;
  url?: string;
  status: EntityStatus;
}

export interface PixelEntity {
  type: "Pixel";
  name: string;
  scope?: string;
  tracksInteraction?: string;
  pixelType?: string;
  targetingType?: string;
  notificationType?: string;
  status: EntityStatus;
}

export interface CampaignEntity {
  type: "Campaign";
  name: string;
  partner?: string;
  objective?: string;
  extId?: string;
  status: EntityStatus;
}

export interface AdGroupEntity {
  type: "AdGroup";
  name: string;
  campaign?: string;
  extId?: string;
  status: EntityStatus;
}

// ── Union types ───────────────────────────────────────────────────────────────

export type DataPlanEntity =
  | ImpressionEntity
  | TableEntity
  | ImportEntity
  | FilterEntity
  | AlgoAIEntity
  | OutputEntity;

export type MediaPlanEntity =
  | MediaPartnerEntity
  | PlacementGroupEntity
  | PlacementEntity
  | ExperienceGroupEntity
  | CreativeEntity
  | LandingPageGroupEntity
  | LandingPageEntity
  | PixelEntity
  | CampaignEntity
  | AdGroupEntity;

export type AnyEntity = DataPlanEntity | MediaPlanEntity;

export type DataPlanEntityType = DataPlanEntity["type"];
export type MediaPlanEntityType = MediaPlanEntity["type"];

// ── Plan models ───────────────────────────────────────────────────────────────

export interface DataPlanModel {
  name?: string;
  entities: Record<string, DataPlanEntity>;
  connections: Connection[];
}

export interface MediaPlanModel {
  entities: Record<string, MediaPlanEntity>;
  connections: Connection[];
}

// ── Creative plan model ───────────────────────────────────────────────────────

export interface ColumnMapping {
  fromTable: string;   // table id or name
  fromColumn: string;
  toTable: string;
  toColumn: string;
  relationship: string; // e.g. "Audience ID joins on Audience ID", drives DCO logic description
}

export interface DataTableLink {
  id: string;
  name: string;
  type: "catalog" | "imported" | "builtin-signal";
}

export interface PersonalizationStrategy {
  id: string;
  title: string;           // e.g. "Audience Segment - Product Category - Headline - Country"
  description: string;
  tables: DataTableLink[]; // ordered chain starting from product catalog
  columnMappings: ColumnMapping[];
  createdAt: string;
  confirmedAt?: string;
}

export interface CreativePlanModel {
  deliveryType: "with-personalization" | "without-personalization" | null;
  personalizationStrategies: PersonalizationStrategy[];
  productDisplayOrder: string[]; // entity IDs in preferred display order
}

// ── Clarification question (used by askClarification op) ─────────────────────

export interface ClarificationOption {
  id: string;
  label: string;
}

export interface ClarificationQuestion {
  id: string;
  text: string;
  multiSelect: boolean;
  options: ClarificationOption[];
}

// ── Intents (generic mutation ops) ───────────────────────────────────────────

export interface AddEntityIntent {
  op: "addEntity";
  id: string;
  entity: AnyEntity;
  planType: "data" | "media";
}

export interface ModifyEntityIntent {
  op: "modifyEntity";
  id: string;
  patch: Partial<AnyEntity>;
  planType: "data" | "media";
}

export interface RemoveEntityIntent {
  op: "removeEntity";
  id: string;
  planType: "data" | "media";
}

export interface AddConnectionIntent {
  op: "addConnection";
  connection: Connection;
  planType: "data" | "media";
}

export interface RemoveConnectionIntent {
  op: "removeConnection";
  from: string;
  to: string;
  planType: "data" | "media";
}

export interface UpdateDocumentIntent {
  op: "updateDocument";
  planType: "data" | "media";
  document: string;
}

export interface PatchContextIntent {
  op: "patchContext";
  patch: Record<string, unknown>;
}

export interface PatchCreativeIntent {
  op: "patchCreative";
  patch: Partial<CreativePlanModel>;
}

export interface AskClarificationIntent {
  op: "askClarification";
  questions: ClarificationQuestion[];
}

export type Intent =
  | AddEntityIntent
  | ModifyEntityIntent
  | RemoveEntityIntent
  | AddConnectionIntent
  | RemoveConnectionIntent
  | UpdateDocumentIntent
  | PatchContextIntent
  | PatchCreativeIntent
  | AskClarificationIntent;

// ── Card contracts (stub — grows in later milestones) ─────────────────────────

export interface CardContract {
  cardType: string;
  version: string;
  description: string;
}

export interface CardInstance {
  cardType: string;
  objectId: string;
  payload: Record<string, unknown>;
}

// ── Library — view metadata (stored at project_data/{id}/library.json) ────────

export interface LibraryFile {
  id: string;
  name: string;
  type: "docx" | "xlsx" | "pptx" | "pdf" | "md" | string;
  tier: "global" | "local";
  folderPath: string;          // "" = root; flat folder name (no nesting)
  updatedAt: string;
  size?: number;
  selectedForContext: boolean; // whether LLM context includes this file; default true
  contentPath?: string;        // GCS path for the uploaded binary (undefined until uploaded)
}

export interface LibraryData {
  files: LibraryFile[];
  folders: string[];           // explicit folder names (supports empty folders)
}

// ── Brand / Advertiser ────────────────────────────────────────────────────────

// Compliance Rule Sets — dynamic hierarchy
export interface ComplianceProperty {
  key: string;
  value: string;
}

export type BrandSeverity   = "suggestion" | "preference" | "required";

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  severity: BrandSeverity;
  confirmed: boolean;          // true = user has reviewed this rule
  aiExtracted: boolean;        // false = manually entered
  properties: ComplianceProperty[];
}

export interface ComplianceSection {
  id: string;
  name: string;
  description: string;
  properties: ComplianceProperty[];
  rules: ComplianceRule[];
}

export interface RuleSet {
  id: string;
  name: string;
  description: string;
  sourceFile?: string;          // original filename for fuzzy-match detection
  properties: ComplianceProperty[];
  sections: ComplianceSection[];
  rules: ComplianceRule[];      // rules not belonging to any section
  createdAt: string;
  updatedAt: string;
}

export type BrandConfidence = "high" | "medium" | "low";
export type BrandStatus     = "draft" | "ready";

export interface BrandField {
  value: string;
  confidence: BrandConfidence | null;
  sourceLabel: string | null;  // exact term used in source doc
  sourcePage: string | null;   // page/section in source doc
  confirmed: boolean;
}

export interface BrandSource {
  id: string;
  name: string;
  type: "file" | "url" | "text";
  addedAt: string;
}

export interface ConnectedAccount {
  platform: "meta" | "dv360" | "tiktok" | "instagram" | string;
  purpose: "media_buying" | "content_source";
  accountName: string;
  accountId: string;
  status: "connected" | "error" | "pending";
}

export interface Brand {
  id: string;
  name: string;
  status: BrandStatus;
  createdAt: string;
  updatedAt: string;
  sources: BrandSource[];

  basicDetails: {
    name: BrandField;
    industry: BrandField;
    regions: BrandField;
    languages: BrandField;
  };

  guidelines: {
    promiseAndStory: {
      brandPromise: BrandField;
      brandStory: BrandField;
    };
    toneAndVoice: {
      traits: BrandField;
      personalityAttributes: BrandField;
      isIsNotFraming: BrandField;
      // AI-only (stored, not shown in UI)
      voiceScale: BrandField;
      situationalTone: BrandField;
      calibratedCopy: BrandField;
    };
    textGuidelines: {
      dosAndDonts: BrandField;
      requiredPhrases: BrandField;
      restrictedLanguage: BrandField;
    };
    visualIdentity: {
      logoVariants: BrandField;
      colorPalette: BrandField;
      typographyHierarchy: BrandField;
      imagetreatment: BrandField; // AI-only
    };
    imageGuidelines: {
      dosAndDonts: BrandField;
      compositionConstraints: BrandField;
      styleConstraints: BrandField;
    };
    messagingGuidelines: {
      guidelines: BrandField;
      tagline: BrandField;
      taglineUsageRules: BrandField;
      cobrandingRules: BrandField;
    };
  };

  complianceRules: {
    requiredDisclaimers: BrandField;
    restrictedTerms: BrandField;
    legalNotes: BrandField;
    regulatedCategories: BrandField;
  };

  ruleSets: RuleSet[];

  connectors: {
    sourceLinks: string[];
    connectedAccounts: ConnectedAccount[];
  };

  aiSeverity: {
    promiseAndStory: BrandSeverity;
    toneAndVoice: BrandSeverity;
    textGuidelines: BrandSeverity;
    visualIdentity: BrandSeverity;
    imageGuidelines: BrandSeverity;
    messagingGuidelines: BrandSeverity;
    complianceRules: BrandSeverity;
  };
}

export interface BrandSummary {
  id: string;
  name: string;
  status: BrandStatus;
  createdAt: string;
  updatedAt: string;
}

// ── Product Catalog ───────────────────────────────────────────────────────────

export type CatalogStatus     = "draft" | "ready" | "syncing" | "error";
export type CatalogSourceType = "file" | "google_sheets" | "gcs" | "s3" | "sftp" | "shopify" | "adobe_s3";
export type CatalogFieldCategory = "identifier" | "product_info" | "pricing" | "media" | "custom";
export type CatalogFieldType  = "text" | "number" | "url" | "date" | "boolean";
export type IssueResolution   = "exclude" | "ignore" | "pending";
export type IssueType         = "empty_cell" | "broken_url" | "type_mismatch" | "duplicate";

export interface CatalogSource {
  type: CatalogSourceType;
  name: string;
  params: Record<string, string>;
  connectedAt: string;
}

export interface CatalogColumn {
  name: string;
  included: boolean;
  detectedType: CatalogFieldType;
  sampleValues: string[];
}

export interface CatalogFieldMapping {
  columnName: string;
  synapseField: string;
  category: CatalogFieldCategory;
  type: CatalogFieldType;
  aiRecommended: boolean;
  sampleValue: string;
}

export interface CatalogIssue {
  id: string;
  type: IssueType;
  column: string;
  description: string;
  affectedRows: number;
  resolution: IssueResolution;
}

export interface ProductCatalog {
  id: string;
  name: string;
  brandId: string | null;
  status: CatalogStatus;
  createdAt: string;
  updatedAt: string;
  currentStep: number;

  source: CatalogSource | null;
  columns: CatalogColumn[];
  fieldMapping: CatalogFieldMapping[];
  issues: CatalogIssue[];
  primaryKey: string | null;
  compositeKey: string[] | null;

  schedule: "auto" | "manual";
  syncCadence: string | null;

  rowCount: number;
  warningCount: number;
  sampleRows: string[][];
  headers: string[];
}

export interface CatalogSummary {
  id: string;
  name: string;
  brandId: string | null;
  status: CatalogStatus;
  rowCount: number;
  createdAt: string;
  updatedAt: string;
}

// ── Audience types ────────────────────────────────────────────────────────────

export type AudienceStatus = "draft" | "ready" | "syncing" | "error";
export type AudienceFieldCategory = "identifier" | "demographics" | "behavioral" | "engagement" | "custom";

export interface AudienceFieldMapping {
  columnName: string;
  synapseField: string;
  category: AudienceFieldCategory;
  type: CatalogFieldType;
  aiRecommended: boolean;
  sampleValue: string;
}

export interface Audience {
  id: string;
  name: string;
  brandId: string | null;
  status: AudienceStatus;
  createdAt: string;
  updatedAt: string;
  currentStep: number;

  source: CatalogSource | null;
  columns: CatalogColumn[];
  fieldMapping: AudienceFieldMapping[];
  issues: CatalogIssue[];
  primaryKey: string | null;

  schedule: "auto" | "manual";
  syncCadence: string | null;

  rowCount: number;
  warningCount: number;
  sampleRows: string[][];
  headers: string[];
}

export interface AudienceSummary {
  id: string;
  name: string;
  status: AudienceStatus;
  rowCount: number;
  createdAt: string;
  updatedAt: string;
}
