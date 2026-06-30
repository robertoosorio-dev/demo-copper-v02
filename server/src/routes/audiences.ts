import { Router } from "express";
import { GCSStorageProvider } from "../storage/gcs.js";
import { routeLLM } from "../llm/router.js";
import type {
  Audience, AudienceSummary, AudienceFieldMapping, AudienceFieldCategory,
  CatalogColumn, CatalogIssue, CatalogFieldType,
} from "@copper/contracts";
import { randomUUID } from "crypto";

let _storage: GCSStorageProvider | null = null;
function storage(): GCSStorageProvider {
  if (!_storage) _storage = new GCSStorageProvider();
  return _storage;
}

const INDEX_PATH    = "audience_data/index.json";
const audiencePath  = (id: string) => `audience_data/${id}/audience.json`;

// ── CSV parsing (same as catalogs) ───────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  function splitLine(line: string): string[] {
    const cells: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === "," && !inQ) { cells.push(cur.trim()); cur = ""; }
      else { cur += c; }
    }
    cells.push(cur.trim());
    return cells;
  }
  const headers = splitLine(lines[0]);
  const rows    = lines.slice(1).map(splitLine);
  return { headers, rows };
}

function detectType(samples: string[]): CatalogFieldType {
  const nonEmpty = samples.filter(Boolean);
  if (nonEmpty.every((v) => /^https?:\/\//i.test(v))) return "url";
  if (nonEmpty.every((v) => !isNaN(Number(v)))) return "number";
  if (nonEmpty.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v))) return "date";
  return "text";
}

function buildColumnsFromCSV(headers: string[], rows: string[][]): CatalogColumn[] {
  return headers.map((name, colIdx) => {
    const samples = rows.slice(0, 5).map((r) => r[colIdx] ?? "").filter(Boolean);
    return { name, included: true, detectedType: detectType(samples), sampleValues: samples.slice(0, 3) };
  });
}

// ── AI field mapping ──────────────────────────────────────────────────────────

const MAPPING_SYSTEM = `You are an audience data field mapper. Given CSV column names with their detected types and sample values, map each column to a Synapse canonical audience field.

Canonical Synapse audience fields and their categories:
- Identifier: User ID, Email, Phone, Cookie ID, Device ID, MAID, CRM ID, Hashed Email, Hashed Phone
- Demographics: Age, Age Range, Gender, Income, Income Range, Education, Marital Status, Household Size, Occupation, Language, Country, State, City, Zip Code, DMA
- Behavioral: Purchase History, Page Views, Sessions, Events, Search Terms, App Opens, Video Views, Click Rate, Conversion Events, Product Viewed, Category Interest
- Engagement: Last Active, First Seen, Recency, Frequency, Monetary Value, LTV, Churn Score, Engagement Score, Days Since Purchase, Total Orders
- Custom: (anything that does not fit above)

Return a JSON array (no markdown, no preamble):
[
  {
    "columnName": "<original column name>",
    "synapseField": "<canonical field name>",
    "category": "identifier|demographics|behavioral|engagement|custom",
    "type": "text|number|url|date|boolean",
    "aiRecommended": true,
    "sampleValue": "<first sample value>"
  }
]`;

async function aiMapFields(columns: CatalogColumn[], llmModel: string): Promise<AudienceFieldMapping[]> {
  const colDesc = columns
    .filter((c) => c.included)
    .map((c) => `${c.name} (${c.detectedType}) — samples: ${c.sampleValues.join(", ")}`)
    .join("\n");

  const result = await routeLLM({
    llmModel,
    systemPrompt: MAPPING_SYSTEM,
    userMessage: `Map these columns:\n${colDesc}`,
  });

  const raw = (result.rawResponse ?? result.reply ?? "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(raw) as AudienceFieldMapping[];
  } catch {
    return columns.filter((c) => c.included).map((c) => ({
      columnName: c.name, synapseField: c.name,
      category: "custom" as AudienceFieldCategory,
      type: c.detectedType, aiRecommended: false, sampleValue: c.sampleValues[0] ?? "",
    }));
  }
}

// ── AI validation ─────────────────────────────────────────────────────────────

const VALIDATE_SYSTEM = `You are an audience data quality analyzer. Given a field mapping and sample rows, identify data issues and recommend a primary key (the column that uniquely identifies each person).

Return JSON (no markdown, no preamble):
{
  "issues": [
    {
      "id": "<unique-id>",
      "type": "empty_cell|broken_url|type_mismatch|duplicate",
      "column": "<column name>",
      "description": "<human description>",
      "affectedRows": <estimated count>,
      "resolution": "pending"
    }
  ],
  "primaryKeyRecommendation": {
    "column": "<column name>",
    "reason": "<why this is the best primary key>",
    "uniquenessPercent": <0-100>
  }
}`;

async function aiValidate(
  audience: Audience, rows: string[][], headers: string[], llmModel: string,
): Promise<{ issues: CatalogIssue[]; primaryKey: string | null }> {
  const mappingDesc = audience.fieldMapping.map((m) => `${m.columnName} → ${m.synapseField} (${m.category})`).join("\n");
  const sampleRows  = rows.slice(0, 10).map((r) => headers.map((h, i) => `${h}: ${r[i] ?? ""}`).join(", ")).join("\n");

  const result = await routeLLM({
    llmModel,
    systemPrompt: VALIDATE_SYSTEM,
    userMessage: `Field mapping:\n${mappingDesc}\n\nSample rows:\n${sampleRows}\n\nTotal rows: ${audience.rowCount}`,
  });

  const raw = (result.rawResponse ?? result.reply ?? "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(raw) as {
      issues: CatalogIssue[];
      primaryKeyRecommendation: { column: string };
    };
    return { issues: parsed.issues ?? [], primaryKey: parsed.primaryKeyRecommendation?.column ?? null };
  } catch {
    return { issues: [], primaryKey: audience.fieldMapping[0]?.columnName ?? null };
  }
}

// ── GCS helpers ───────────────────────────────────────────────────────────────

async function readIndex(): Promise<AudienceSummary[]> {
  try { return JSON.parse(await storage().read(INDEX_PATH)) as AudienceSummary[]; }
  catch { return []; }
}

async function writeIndex(index: AudienceSummary[]): Promise<void> {
  await storage().write(INDEX_PATH, JSON.stringify(index, null, 2));
}

function blankAudience(id: string): Audience {
  const now = new Date().toISOString();
  return {
    id, name: "", brandId: null,
    status: "draft", createdAt: now, updatedAt: now,
    currentStep: 1,
    source: null, columns: [], fieldMapping: [], issues: [],
    primaryKey: null,
    schedule: "manual", syncCadence: null,
    rowCount: 0, warningCount: 0, sampleRows: [], headers: [],
  };
}

// ── Router ────────────────────────────────────────────────────────────────────

export function makeAudiencesRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try { res.json(await readIndex()); }
    catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.post("/", async (_req, res) => {
    try {
      const id       = `aud-${randomUUID().split("-")[0]}`;
      const audience = blankAudience(id);
      await storage().write(audiencePath(id), JSON.stringify(audience, null, 2));
      const index = await readIndex();
      index.unshift({ id, name: "", status: "draft", rowCount: 0, createdAt: audience.createdAt, updatedAt: audience.updatedAt });
      await writeIndex(index);
      res.status(201).json(audience);
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.get("/:id", async (req, res) => {
    try { res.json(JSON.parse(await storage().read(audiencePath(req.params.id)))); }
    catch { res.status(404).json({ error: "Audience not found" }); }
  });

  router.put("/:id", async (req, res) => {
    try {
      const audience = req.body as Audience;
      audience.updatedAt = new Date().toISOString();
      await storage().write(audiencePath(req.params.id), JSON.stringify(audience, null, 2));
      const index = await readIndex();
      const summary: AudienceSummary = { id: audience.id, name: audience.name, status: audience.status, rowCount: audience.rowCount, createdAt: audience.createdAt, updatedAt: audience.updatedAt };
      const idx = index.findIndex((a) => a.id === req.params.id);
      if (idx >= 0) index[idx] = summary; else index.unshift(summary);
      await writeIndex(index);
      res.json(audience);
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.post("/:id/detect", async (req, res) => {
    try {
      const { csvBase64, fileName, llmModel = "claude-sonnet-4-6" } = req.body as {
        csvBase64: string; fileName: string; llmModel?: string;
      };

      if (!csvBase64) return void res.status(400).json({ error: "csvBase64 required" });

      const csvText = Buffer.from(csvBase64, "base64").toString("utf-8");
      const { headers, rows } = parseCSV(csvText);
      if (headers.length === 0) return void res.status(400).json({ error: "Could not parse CSV headers" });

      let audience: Audience;
      try { audience = JSON.parse(await storage().read(audiencePath(req.params.id))); }
      catch { audience = blankAudience(req.params.id); }

      const columns      = buildColumnsFromCSV(headers, rows);
      const fieldMapping = await aiMapFields(columns, llmModel);

      const updated: Audience = {
        ...audience,
        source: { type: "file", name: fileName, params: {}, connectedAt: new Date().toISOString() },
        columns, fieldMapping,
        rowCount: rows.length,
        currentStep: 2,
        updatedAt: new Date().toISOString(),
        headers,
        sampleRows: rows.slice(0, 50),
      };

      const { issues, primaryKey } = await aiValidate(updated, rows, headers, llmModel);
      updated.issues       = issues;
      updated.primaryKey   = primaryKey;
      updated.warningCount = issues.filter((i) => i.resolution === "pending").length;

      await storage().write(audiencePath(req.params.id), JSON.stringify(updated, null, 2));

      const index = await readIndex();
      const summary: AudienceSummary = { id: updated.id, name: updated.name, status: updated.status, rowCount: updated.rowCount, createdAt: updated.createdAt, updatedAt: updated.updatedAt };
      const idx = index.findIndex((a) => a.id === req.params.id);
      if (idx >= 0) index[idx] = summary; else index.unshift(summary);
      await writeIndex(index);

      res.json({ audience: updated, headers, sampleRows: rows.slice(0, 20) });
    } catch (err) {
      console.error("[audience/detect]", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Delete
  router.delete("/:id", async (req, res) => {
    try {
      await storage().delete(audiencePath(req.params.id));
      const index = (await readIndex()).filter((a) => a.id !== req.params.id);
      await writeIndex(index);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  return router;
}
