import type { Version, ReasoningLogEntry, Exchange, LibraryFile, Brand, BrandSummary } from "@copper/contracts";
import type { WizardShape } from "./wizardStandin.js";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error ?? `POST ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface CampaignSummary {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  createdAt: string;
  status: string;
  description: string;
  startDate: string;
  endDate: string;
  completedSteps: number;
  totalSteps: number;
  brandName: string | null;
}

export function listCampaigns(): Promise<CampaignSummary[]> {
  return get<CampaignSummary[]>("/projects");
}

export function createCampaign(name: string): Promise<Version> {
  return post<Version>("/projects", { name });
}

export function loadCampaign(id: string): Promise<Version> {
  return get<Version>(`/projects/${id}`);
}

export function deleteCampaign(id: string): Promise<void> {
  return del(`/projects/${id}`);
}

export function saveCampaign(id: string, version: Version): Promise<Version> {
  return put<Version>(`/projects/${id}`, version);
}

export function listTransactionPasses(id: string, versionNum: number): Promise<string[]> {
  return get<string[]>(`/projects/${id}/versions/${versionNum}/transactions`);
}

export function listReasoningEntries(
  id: string,
  versionNum: number,
  pass: string,
): Promise<ReasoningLogEntry[]> {
  return get<ReasoningLogEntry[]>(`/projects/${id}/versions/${versionNum}/transactions/${pass}`);
}

export interface VersionSummary {
  versionNum: number;
  parentVersion: number | null;
  authoredBy: "user" | "system";
  createdAt: string;
}

export interface EntityChangeSummary {
  id: string;
  type: string;
  name: string;
  plan: "data" | "media";
  kind: "added" | "removed" | "modified";
  changedFields?: string[];
}

export interface VersionDiff {
  fromVersion: number | null;
  toVersion: number;
  isInitial: boolean;
  entityChanges: EntityChangeSummary[];
  connectionsAdded: number;
  connectionsRemoved: number;
}

export interface ChatResponse {
  exchange: Exchange;
  version: Version | null;
  wizard?: WizardShape;
  clarificationQuestions?: import("@copper/contracts").ClarificationQuestion[];
}

export function chat(
  id: string,
  message: string,
  llmModel: string,
  exchanges: Exchange[],
  version: Version,
  libraryContext?: import("@copper/contracts").LibraryFile[],
  subStep?: string,
): Promise<ChatResponse> {
  return post<ChatResponse>(`/projects/${id}/chat`, { message, llmModel, exchanges, version, libraryContext, subStep });
}

export function listVersions(id: string): Promise<VersionSummary[]> {
  return get<VersionSummary[]>(`/projects/${id}/versions`);
}

export function getVersionDiff(id: string, versionNum: number): Promise<VersionDiff> {
  return get<VersionDiff>(`/projects/${id}/versions/${versionNum}/diff`);
}

export type { ReasoningLogEntry };

// ── Admin API ─────────────────────────────────────────────────────────────────

export interface AdminListResult {
  folders: string[];
  files: string[];
}

export function adminList(prefix: string): Promise<AdminListResult> {
  return get<AdminListResult>(`/admin/list?prefix=${encodeURIComponent(prefix)}`);
}

export function adminReadFile(path: string): Promise<{ path: string; content: string }> {
  return get(`/admin/file?path=${encodeURIComponent(path)}`);
}

export function adminWriteFile(path: string, content: string): Promise<{ ok: boolean; path: string }> {
  const res = fetch(`${BASE}/admin/file`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  return res.then((r) => {
    if (!r.ok) throw new Error(`PUT /admin/file → ${r.status}`);
    return r.json();
  });
}

// ── KB versioning ─────────────────────────────────────────────────────────────

export interface KBVersionMeta {
  realId: string;
  label: string;
  description: string;
  by: "human" | "agent";
  at: string;
  superseded?: boolean;
}

export function adminKBVersions(): Promise<{ versions: KBVersionMeta[] }> {
  return get("/admin/kb/versions");
}

export function adminKBCut(
  label: string,
  description: string,
  by: "human" | "agent",
): Promise<{ ok: boolean; version: KBVersionMeta }> {
  return post("/admin/kb/cut", { label, description, by });
}

export function adminKBVersionFiles(realId: string): Promise<{ files: string[] }> {
  return get(`/admin/kb/versions/${encodeURIComponent(realId)}/files`);
}

export function adminKBVersionFile(
  realId: string,
  name: string,
): Promise<{ name: string; content: string }> {
  return get(`/admin/kb/versions/${encodeURIComponent(realId)}/file?name=${encodeURIComponent(name)}`);
}

export function adminKBRollback(realId: string): Promise<{ ok: boolean; realId: string }> {
  return post(`/admin/kb/versions/${encodeURIComponent(realId)}/rollback`, {});
}

// ── QA agent ──────────────────────────────────────────────────────────────────

export interface QARunResult {
  ops: unknown[];
  reasoning: Record<string, unknown>;
  systemPromptLength: number;
}

export interface QAJudgeResult {
  judgment: "pass" | "fail";
  diagnosis: string | null;
  proposedFiles: Array<{ path: string; content: string; original: string }>;
}

const QA_EMPTY_VERSION = {
  id: "qa-test", name: "QA Test Project", version: 1,
  parentVersion: null, authoredBy: "system",
  createdAt: new Date().toISOString(),
  context: { contextFiles: [], exchanges: [] },
  plans: {
    data: { document: "", model: { entities: {}, connections: [] } },
    media: { document: "", model: { entities: {}, connections: [] } },
    creative: { document: "", model: null },
  },
};

export async function adminQARun(
  prompt: string,
  kbOverride?: Array<{ path: string; content: string }>,
): Promise<QARunResult> {
  const body: Record<string, unknown> = { message: prompt, version: QA_EMPTY_VERSION, exchanges: [] };
  if (kbOverride) body.kbOverride = kbOverride;
  const res = await fetch(`${BASE}/debug/project/qa-test/submit`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`QA run failed: ${res.status}`);
  const data = await res.json();
  return {
    ops: data.ops ?? [],
    reasoning: data.rlogEntry?.reasoning ?? {},
    systemPromptLength: data.diagnostics?.systemPromptLength ?? 0,
  };
}

export async function adminQAFetchKBFiles(): Promise<Array<{ path: string; content: string }>> {
  const { files } = await get<{ files: string[] }>("/admin/list?prefix=knowledge%2Fdata-activation%2F");
  const results = await Promise.all(
    files.filter((f: string) => f.endsWith(".md")).map(async (name: string) => {
      const path = `knowledge/data-activation/${name}`;
      const { content } = await get<{ content: string }>(`/admin/file?path=${encodeURIComponent(path)}`);
      return { path, content };
    }),
  );
  return results;
}

// ── Library ───────────────────────────────────────────────────────────────────

import type { LibraryData } from "@copper/contracts";
export type { LibraryData };

export function getLibrary(campaignId: string): Promise<LibraryData> {
  return get<LibraryData>(`/projects/${campaignId}/library`);
}

export function putLibrary(campaignId: string, data: LibraryData): Promise<{ ok: boolean }> {
  return put<{ ok: boolean }>(`/projects/${campaignId}/library`, data);
}

export async function uploadLibraryContent(
  campaignId: string,
  fileId: string,
  file: File,
): Promise<{ contentPath: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      post<{ ok: boolean; contentPath: string }>(
        `/projects/${campaignId}/library/upload`,
        { fileId, contentBase64: base64, mimeType: file.type || "application/octet-stream" },
      ).then(resolve).catch(reject);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function libraryContentUrl(campaignId: string, fileId: string): string {
  return `/api/projects/${campaignId}/library/${encodeURIComponent(fileId)}/content`;
}

// ── Card definitions ──────────────────────────────────────────────────────────

export interface CardDefinition {
  cardType: string;
  propsSchema: Record<string, string>;
  exampleProps: Record<string, unknown>;
  allowedActions: string[];
  fallbackText: string;
  whenToUse: string;
  whenNotToUse: string;
}

export interface CardVersionEntry {
  v: string;
  at: string;
  by: "seed" | "admin";
  note?: string;
}

export function loadCardDefinitions(): Promise<{ definitions: CardDefinition[] }> {
  return get("/cards/definitions");
}

export function seedCards(): Promise<{ ok: boolean; written: string[] }> {
  return post("/cards/seed", {});
}

export function getCardHistory(cardType: string): Promise<{ cardType: string; history: CardVersionEntry[] }> {
  return get(`/cards/${encodeURIComponent(cardType)}/history`);
}

export function getCardVersion(
  cardType: string,
  v: string,
): Promise<{ cardType: string; v: string; definition: CardDefinition }> {
  return get(`/cards/${encodeURIComponent(cardType)}/versions/${encodeURIComponent(v)}`);
}

export function rollbackCard(
  cardType: string,
  v: string,
): Promise<{ ok: boolean; cardType: string; rolledBackTo: string; newVersion: string }> {
  return post(`/cards/${encodeURIComponent(cardType)}/rollback/${encodeURIComponent(v)}`, {});
}

export function updateCard(
  cardType: string,
  patch: Partial<Pick<CardDefinition, "whenToUse" | "whenNotToUse" | "fallbackText" | "allowedActions" | "exampleProps">>,
): Promise<{ ok: boolean; cardType: string; version: string; definition: CardDefinition }> {
  return put(`/cards/${encodeURIComponent(cardType)}`, patch);
}

export function adminQAPropose(
  prompt: string,
  expected: string,
  run: QARunResult,
  kbFiles: Array<{ path: string; content: string }>,
): Promise<QAJudgeResult> {
  return post("/admin/qa/propose", {
    prompt, expected, ops: run.ops, reasoning: run.reasoning, kbFiles,
  });
}

// ── Brand API ─────────────────────────────────────────────────────────────────
export type { Brand, BrandSummary };

export function listBrands(): Promise<BrandSummary[]> {
  return get<BrandSummary[]>("/brands");
}

export function createBrand(name = "New Brand"): Promise<Brand> {
  return post<Brand>("/brands", { name });
}

export function loadBrand(id: string): Promise<Brand> {
  return get<Brand>(`/brands/${id}`);
}

export function saveBrand(id: string, brand: Brand): Promise<Brand> {
  return put<Brand>(`/brands/${id}`, brand);
}

export function deleteBrand(id: string): Promise<void> {
  return del(`/brands/${id}`);
}

export async function parseComplianceRules(
  brandId: string,
  opts: {
    text?: string;
    file?: File;
    llmModel?: string;
    intent?: "new" | "update" | "append";
    targetRuleSetName?: string;
  },
): Promise<import("@copper/contracts").RuleSet> {
  const { text, file, llmModel = "claude-sonnet-4-6", intent = "new", targetRuleSetName } = opts;
  let fileBase64: string | undefined;
  let mimeType: string | undefined;
  let fileName: string | undefined;

  if (file) {
    const buf = await file.arrayBuffer();
    fileBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    mimeType = file.type || "application/octet-stream";
    fileName = file.name;
  }

  const body = { text, fileBase64, mimeType, fileName, llmModel, intent, targetRuleSetName };
  const data = await post<{ ruleSet: import("@copper/contracts").RuleSet }>(`/brands/${brandId}/parse-rules`, body);
  return data.ruleSet;
}

export interface ExtractedField {
  value: string;
  confidence: "high" | "medium" | "low";
  sourceLabel: string;
  sourcePage: string | null;
}

export interface ExtractResponse {
  message: string;
  fields: Record<string, ExtractedField>;
}

export async function extractBrand(
  id: string,
  opts: { message?: string; file?: File; llmModel?: string },
): Promise<ExtractResponse> {
  const body: Record<string, unknown> = {
    llmModel: opts.llmModel ?? "claude-sonnet-4-6",
    message: opts.message ?? "",
  };
  if (opts.file) {
    body.fileName = opts.file.name;
    body.mimeType = opts.file.type || "application/octet-stream";
    body.fileBase64 = arrayBufferToBase64(await opts.file.arrayBuffer());
  }
  return post<ExtractResponse>(`/brands/${id}/extract`, body);
}

// ── Campaign Brief Extraction ─────────────────────────────────────────────────

export interface CampaignBriefExtractResult {
  brief: {
    campaignName?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
    objective?: string;
    primaryKpi?: string;
    targetAudience?: string;
    channels?: string[];
    regions?: string[];
    offerFocus?: string;
    complianceNotes?: string;
  };
}

export async function extractCampaignBrief(
  projectId: string,
  opts: { message?: string; file?: File; llmModel?: string },
): Promise<CampaignBriefExtractResult> {
  const body: Record<string, unknown> = {
    llmModel: opts.llmModel ?? "claude-sonnet-4-6",
    message: opts.message ?? "",
  };
  if (opts.file) {
    body.fileName = opts.file.name;
    body.mimeType = opts.file.type || "application/octet-stream";
    body.fileBase64 = arrayBufferToBase64(await opts.file.arrayBuffer());
  }
  return post<CampaignBriefExtractResult>(`/projects/${projectId}/extract-brief`, body);
}

// ── Audience API ──────────────────────────────────────────────────────────────
import type { Audience, AudienceSummary } from "@copper/contracts";
export type { Audience, AudienceSummary };

export function listAudiences(): Promise<AudienceSummary[]> {
  return get<AudienceSummary[]>("/audiences");
}

export function createAudience(): Promise<Audience> {
  return post<Audience>("/audiences", {});
}

export function loadAudience(id: string): Promise<Audience> {
  return get<Audience>(`/audiences/${id}`);
}

export function saveAudience(id: string, audience: Audience): Promise<Audience> {
  return put<Audience>(`/audiences/${id}`, audience);
}

export function deleteAudience(id: string): Promise<void> {
  return del(`/audiences/${id}`);
}

export interface AudienceDetectResult {
  audience: Audience;
  headers: string[];
  sampleRows: string[][];
}

export async function detectAudienceCSV(
  id: string,
  file: File,
  llmModel?: string,
): Promise<AudienceDetectResult> {
  const buf = await file.arrayBuffer();
  return post<AudienceDetectResult>(`/audiences/${id}/detect`, {
    csvBase64: arrayBufferToBase64(buf),
    fileName:  file.name,
    llmModel:  llmModel ?? "claude-sonnet-4-6",
  });
}

// ── Catalog API ───────────────────────────────────────────────────────────────
import type { ProductCatalog, CatalogSummary } from "@copper/contracts";
export type { ProductCatalog, CatalogSummary };

export function listCatalogs(brandId?: string): Promise<CatalogSummary[]> {
  return get<CatalogSummary[]>(brandId ? `/catalogs?brandId=${encodeURIComponent(brandId)}` : "/catalogs");
}

export function createCatalog(brandId?: string | null): Promise<ProductCatalog> {
  return post<ProductCatalog>("/catalogs", { brandId: brandId ?? null });
}

export function loadCatalog(id: string): Promise<ProductCatalog> {
  return get<ProductCatalog>(`/catalogs/${id}`);
}

export function saveCatalog(id: string, catalog: ProductCatalog): Promise<ProductCatalog> {
  return put<ProductCatalog>(`/catalogs/${id}`, catalog);
}

export function deleteCatalog(id: string): Promise<void> {
  return del(`/catalogs/${id}`);
}

export interface DetectResult {
  catalog: ProductCatalog;
  headers: string[];
  sampleRows: string[][];
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function detectCatalogCSV(
  id: string,
  file: File,
  llmModel?: string,
): Promise<DetectResult> {
  const buf = await file.arrayBuffer();
  return post<DetectResult>(`/catalogs/${id}/detect`, {
    csvBase64: arrayBufferToBase64(buf),
    fileName:  file.name,
    llmModel:  llmModel ?? "claude-sonnet-4-6",
  });
}
