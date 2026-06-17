import { Router } from "express";
import { GCSStorageProvider } from "../storage/gcs.js";
import { routeLLM } from "../llm/router.js";
import type {
  ProductCatalog,
  CatalogSummary,
  CatalogColumn,
  CatalogFieldMapping,
  CatalogIssue,
  CatalogFieldCategory,
  CatalogFieldType,
} from "@copper/contracts";
import { randomUUID } from "crypto";

let _storage: GCSStorageProvider | null = null;
function storage(): GCSStorageProvider {
  if (!_storage) _storage = new GCSStorageProvider();
  return _storage;
}

const INDEX_PATH   = "catalog_data/index.json";
const catalogPath  = (id: string) => `catalog_data/${id}/catalog.json`;

// ── CSV parsing ───────────────────────────────────────────────────────────────

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
    return {
      name,
      included: true,
      detectedType: detectType(samples),
      sampleValues: samples.slice(0, 3),
    };
  });
}

// ── AI field mapping ──────────────────────────────────────────────────────────

const MAPPING_SYSTEM = `You are a product catalog field mapper. Given a list of CSV column names with their detected types and sample values, map each column to a Synapse canonical product field.

Canonical Synapse fields and their categories:
- Identifier: SKU, Product ID, UPC, EAN, GTIN, Variant ID
- Product Info: Product Name, Title, Description, Short Description, Brand, Category, Sub-category, Tags, Condition, Color, Size, Material, Weight, Dimensions
- Pricing: Price, Sale Price, Original Price, Currency, Cost
- Media: Image URL, Thumbnail URL, Additional Images, Video URL
- Custom: (anything that doesn't fit above)

Return a JSON array (no markdown, no preamble):
[
  {
    "columnName": "<original column name>",
    "synapseField": "<canonical field name>",
    "category": "identifier|product_info|pricing|media|custom",
    "type": "text|number|url|date|boolean",
    "aiRecommended": true,
    "sampleValue": "<first sample value>"
  }
]`;

async function aiMapFields(
  columns: CatalogColumn[],
  llmModel: string,
): Promise<CatalogFieldMapping[]> {
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
    return JSON.parse(raw) as CatalogFieldMapping[];
  } catch {
    // fallback: identity mapping
    return columns.filter((c) => c.included).map((c) => ({
      columnName:    c.name,
      synapseField:  c.name,
      category:      "custom" as CatalogFieldCategory,
      type:          c.detectedType,
      aiRecommended: false,
      sampleValue:   c.sampleValues[0] ?? "",
    }));
  }
}

// ── AI issue detection + primary key ─────────────────────────────────────────

const VALIDATE_SYSTEM = `You are a product catalog data quality analyzer. Given a field mapping and sample rows, identify data issues and recommend a primary key.

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
  catalog: ProductCatalog,
  rows: string[][],
  headers: string[],
  llmModel: string,
): Promise<{ issues: CatalogIssue[]; primaryKey: string | null; pkReason: string }> {
  const mappingDesc = catalog.fieldMapping.map((m) => `${m.columnName} → ${m.synapseField} (${m.category})`).join("\n");
  const sampleRows  = rows.slice(0, 10).map((r) => headers.map((h, i) => `${h}: ${r[i] ?? ""}`).join(", ")).join("\n");

  const result = await routeLLM({
    llmModel,
    systemPrompt: VALIDATE_SYSTEM,
    userMessage:  `Field mapping:\n${mappingDesc}\n\nSample rows:\n${sampleRows}\n\nTotal rows: ${catalog.rowCount}`,
  });

  const raw = (result.rawResponse ?? result.reply ?? "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(raw) as {
      issues: CatalogIssue[];
      primaryKeyRecommendation: { column: string; reason: string; uniquenessPercent: number };
    };
    return {
      issues:     parsed.issues ?? [],
      primaryKey: parsed.primaryKeyRecommendation?.column ?? null,
      pkReason:   parsed.primaryKeyRecommendation?.reason ?? "",
    };
  } catch {
    return { issues: [], primaryKey: catalog.fieldMapping[0]?.columnName ?? null, pkReason: "" };
  }
}

// ── GCS helpers ───────────────────────────────────────────────────────────────

async function readIndex(): Promise<CatalogSummary[]> {
  try { return JSON.parse(await storage().read(INDEX_PATH)) as CatalogSummary[]; }
  catch { return []; }
}

async function writeIndex(index: CatalogSummary[]): Promise<void> {
  await storage().write(INDEX_PATH, JSON.stringify(index, null, 2));
}

function blankCatalog(id: string): ProductCatalog {
  const now = new Date().toISOString();
  return {
    id, name: "", brandId: null,
    status: "draft", createdAt: now, updatedAt: now,
    currentStep: 1,
    source: null, columns: [], fieldMapping: [], issues: [],
    primaryKey: null, compositeKey: null,
    schedule: "manual", syncCadence: null,
    rowCount: 0, warningCount: 0,
    sampleRows: [], headers: [],
  };
}

// ── Router ────────────────────────────────────────────────────────────────────

export function makeCatalogsRouter(): Router {
  const router = Router();

  // List
  router.get("/", async (_req, res) => {
    try { res.json(await readIndex()); }
    catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  // Create
  router.post("/", async (_req, res) => {
    try {
      const id      = `cat-${randomUUID().split("-")[0]}`;
      const catalog = blankCatalog(id);
      await storage().write(catalogPath(id), JSON.stringify(catalog, null, 2));
      const index   = await readIndex();
      index.unshift({ id, name: catalog.name, status: catalog.status, rowCount: 0, createdAt: catalog.createdAt, updatedAt: catalog.updatedAt });
      await writeIndex(index);
      res.status(201).json(catalog);
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  // Get
  router.get("/:id", async (req, res) => {
    try { res.json(JSON.parse(await storage().read(catalogPath(req.params.id)))); }
    catch { res.status(404).json({ error: "Catalog not found" }); }
  });

  // Save
  router.put("/:id", async (req, res) => {
    try {
      const catalog = req.body as ProductCatalog;
      catalog.updatedAt = new Date().toISOString();
      await storage().write(catalogPath(req.params.id), JSON.stringify(catalog, null, 2));
      const index   = await readIndex();
      const summary: CatalogSummary = { id: catalog.id, name: catalog.name, status: catalog.status, rowCount: catalog.rowCount, createdAt: catalog.createdAt, updatedAt: catalog.updatedAt };
      const idx = index.findIndex((c) => c.id === req.params.id);
      if (idx >= 0) index[idx] = summary; else index.unshift(summary);
      await writeIndex(index);
      res.json(catalog);
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  // POST /:id/detect — upload CSV, detect schema, run AI field mapping + validation
  router.post("/:id/detect", async (req, res) => {
    try {
      const { csvBase64, fileName, llmModel = "claude-sonnet-4-6" } = req.body as {
        csvBase64: string;
        fileName: string;
        llmModel?: string;
      };

      if (!csvBase64) return void res.status(400).json({ error: "csvBase64 required" });

      const csvText = Buffer.from(csvBase64, "base64").toString("utf-8");
      const { headers, rows } = parseCSV(csvText);

      if (headers.length === 0) return void res.status(400).json({ error: "Could not parse CSV headers" });

      // Load catalog
      let catalog: ProductCatalog;
      try { catalog = JSON.parse(await storage().read(catalogPath(req.params.id))); }
      catch { catalog = blankCatalog(req.params.id); }

      // Build columns
      const columns = buildColumnsFromCSV(headers, rows);

      // AI field mapping
      const fieldMapping = await aiMapFields(columns, llmModel);

      // AI validation + primary key
      const updated: ProductCatalog = {
        ...catalog,
        source: {
          type: "file",
          name: fileName,
          params: {},
          connectedAt: new Date().toISOString(),
        },
        columns,
        fieldMapping,
        rowCount: rows.length,
        currentStep: 2,
        updatedAt: new Date().toISOString(),
        headers,
        sampleRows: rows.slice(0, 50),
      };

      const { issues, primaryKey } = await aiValidate(updated, rows, headers, llmModel);
      updated.issues      = issues;
      updated.primaryKey  = primaryKey;
      updated.warningCount = issues.filter((i) => i.resolution === "pending").length;

      await storage().write(catalogPath(req.params.id), JSON.stringify(updated, null, 2));

      // Update index
      const index = await readIndex();
      const summary: CatalogSummary = { id: updated.id, name: updated.name, status: updated.status, rowCount: updated.rowCount, createdAt: updated.createdAt, updatedAt: updated.updatedAt };
      const idx = index.findIndex((c) => c.id === req.params.id);
      if (idx >= 0) index[idx] = summary; else index.unshift(summary);
      await writeIndex(index);

      res.json({ catalog: updated, headers, sampleRows: rows.slice(0, 20) });
    } catch (err) {
      console.error("[catalog/detect]", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
