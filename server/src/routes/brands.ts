import { Router } from "express";
import { GCSStorageProvider } from "../storage/gcs.js";
import type { Brand, BrandSummary, BrandField, RuleSet } from "@copper/contracts";
import { randomUUID } from "crypto";
import { routeLLM } from "../llm/router.js";

let _storage: GCSStorageProvider | null = null;
function storage(): GCSStorageProvider {
  if (!_storage) _storage = new GCSStorageProvider();
  return _storage;
}

const INDEX_PATH = "brand_data/index.json";
const brandPath  = (id: string) => `brand_data/${id}/brand.json`;

function emptyField(): BrandField {
  return { value: "", confidence: null, sourceLabel: null, sourcePage: null, confirmed: false };
}
function filledField(value: string): BrandField {
  return { value, confidence: "high", sourceLabel: null, sourcePage: null, confirmed: true };
}

function blankBrand(id: string, name: string): Brand {
  const now = new Date().toISOString();
  return {
    id, name, status: "draft", createdAt: now, updatedAt: now,
    sources: [],
    basicDetails: {
      name:      filledField(name),
      industry:  emptyField(),
      regions:   emptyField(),
      languages: emptyField(),
    },
    guidelines: {
      promiseAndStory: {
        brandPromise: emptyField(),
        brandStory:   emptyField(),
      },
      toneAndVoice: {
        traits:               emptyField(),
        personalityAttributes: emptyField(),
        isIsNotFraming:       emptyField(),
        voiceScale:           emptyField(),
        situationalTone:      emptyField(),
        calibratedCopy:       emptyField(),
      },
      textGuidelines: {
        dosAndDonts:       emptyField(),
        requiredPhrases:   emptyField(),
        restrictedLanguage: emptyField(),
      },
      visualIdentity: {
        logoVariants:        emptyField(),
        colorPalette:        emptyField(),
        typographyHierarchy: emptyField(),
        imagetreatment:      emptyField(),
      },
      imageGuidelines: {
        dosAndDonts:           emptyField(),
        compositionConstraints: emptyField(),
        styleConstraints:      emptyField(),
      },
      messagingGuidelines: {
        guidelines:       emptyField(),
        tagline:          emptyField(),
        taglineUsageRules: emptyField(),
        cobrandingRules:  emptyField(),
      },
    },
    complianceRules: {
      requiredDisclaimers: emptyField(),
      restrictedTerms:     emptyField(),
      legalNotes:          emptyField(),
      regulatedCategories: emptyField(),
    },
    ruleSets: [],
    connectors: { sourceLinks: [], connectedAccounts: [] },
    aiSeverity: {
      promiseAndStory:    "preference",
      toneAndVoice:       "preference",
      textGuidelines:     "preference",
      visualIdentity:     "suggestion",
      imageGuidelines:    "suggestion",
      messagingGuidelines: "preference",
      complianceRules:    "required",
    },
  };
}

async function readIndex(): Promise<BrandSummary[]> {
  try {
    return JSON.parse(await storage().read(INDEX_PATH)) as BrandSummary[];
  } catch {
    return [];
  }
}

async function writeIndex(index: BrandSummary[]): Promise<void> {
  await storage().write(INDEX_PATH, JSON.stringify(index, null, 2));
}

export function makeBrandsRouter(): Router {
  const router = Router();

  // List all brands
  router.get("/", async (_req, res) => {
    try {
      res.json(await readIndex());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Create brand
  router.post("/", async (req, res) => {
    try {
      const { name } = req.body as { name: string };
      if (!name?.trim()) return void res.status(400).json({ error: "name required" });
      const existingBrands = await readIndex();
      // For the default placeholder name, auto-suffix to avoid collisions (e.g. "New Brand 2")
      let finalName = name.trim();
      if (existingBrands.some((b) => b.name.toLowerCase() === finalName.toLowerCase())) {
        if (finalName.toLowerCase() === "new brand") {
          let n = 2;
          while (existingBrands.some((b) => b.name.toLowerCase() === `new brand ${n}`)) n++;
          finalName = `New Brand ${n}`;
        } else {
          return void res.status(409).json({ error: `A brand named "${finalName}" already exists` });
        }
      }
      const id    = `brand-${randomUUID().split("-")[0]}`;
      const brand = blankBrand(id, finalName);
      await storage().write(brandPath(id), JSON.stringify(brand, null, 2));
      const index = existingBrands;
      index.unshift({ id, name: brand.name, status: brand.status, createdAt: brand.createdAt, updatedAt: brand.updatedAt });
      await writeIndex(index);
      console.log(`[brands] created ${id} "${name}"`);
      res.status(201).json(brand);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Get brand
  router.get("/:id", async (req, res) => {
    try {
      const raw = await storage().read(brandPath(req.params.id));
      res.json(JSON.parse(raw));
    } catch {
      res.status(404).json({ error: "Brand not found" });
    }
  });

  // Save brand
  router.put("/:id", async (req, res) => {
    try {
      const brand = req.body as Brand;
      const allBrands = await readIndex();
      const duplicate = allBrands.find(
        (b) => b.id !== req.params.id && b.name.toLowerCase() === brand.name.trim().toLowerCase()
      );
      if (duplicate) {
        return void res.status(409).json({ error: `A brand named "${brand.name.trim()}" already exists` });
      }
      brand.updatedAt = new Date().toISOString();
      await storage().write(brandPath(req.params.id), JSON.stringify(brand, null, 2));
      const index   = allBrands;
      const summary: BrandSummary = { id: brand.id, name: brand.name, status: brand.status, createdAt: brand.createdAt, updatedAt: brand.updatedAt };
      const idx     = index.findIndex((b) => b.id === req.params.id);
      if (idx >= 0) index[idx] = summary; else index.unshift(summary);
      await writeIndex(index);
      res.json(brand);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Delete brand
  router.delete("/:id", async (req, res) => {
    try {
      await storage().delete(brandPath(req.params.id));
      const index = (await readIndex()).filter((b) => b.id !== req.params.id);
      await writeIndex(index);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ── Parse compliance rules from text/file into RuleSet structure ──────────
  router.post("/:id/parse-rules", async (req, res) => {
    const {
      llmModel = "claude-sonnet-4-6",
      text,
      fileBase64,
      mimeType,
      fileName,
      intent = "new",
      targetRuleSetName,
    } = req.body as {
      llmModel?: string;
      text?: string;
      fileBase64?: string;
      mimeType?: string;
      fileName?: string;
      intent?: "new" | "update" | "append";
      targetRuleSetName?: string;
    };

    const intentHint = intent === "update"
      ? `The user is REPLACING an existing Rule Set named "${targetRuleSetName}". Produce a complete replacement.`
      : intent === "append"
      ? `The user is ADDING to an existing Rule Set named "${targetRuleSetName}". Extract only the new rules from this content.`
      : "Create a new Rule Set from this content.";

    const systemPrompt = `You are a compliance rule parser for an advertising platform. Given content (a document, legal brief, brand guideline, or manually entered rule), extract and structure it into a RuleSet.

${intentHint}

Return a single JSON object with EXACTLY this shape (no markdown, no preamble):
{
  "name": "short descriptive name for this rule set",
  "description": "1-2 sentence summary of what these rules cover",
  "properties": [{"key": "category", "value": "legal"}, ...],
  "sections": [
    {
      "id": "s1",
      "name": "section name",
      "description": "what this section covers",
      "properties": [],
      "rules": [
        {
          "id": "r1",
          "name": "short rule name (5 words max)",
          "description": "clear, specific statement of what is required or prohibited",
          "severity": "required",
          "properties": [{"key": "applies_to", "value": "all formats"}]
        }
      ]
    }
  ],
  "rules": []
}

Guidelines:
- Group logically related rules into sections. If all rules are the same type, one section is fine.
- If there are fewer than 3 rules and they don't group naturally, put them directly in "rules" (skip sections).
- Each rule's "description" should be a complete, actionable statement an AI agent can check against.
- Each rule MUST have a "severity" field — one of: "required" (must never be broken), "preference" (should follow, user can override), "suggestion" (nice to have). Infer from the language: "must", "shall", "prohibited", "never" → required; "should", "avoid", "prefer" → preference; "consider", "recommended" → suggestion. Default to "required" for legal/compliance rules.
- Rule IDs must be unique within the response: s1/s2... for sections, r1/r2... for rules.
- Return ONLY the JSON object.`;

    const userMessage = fileBase64
      ? `Extract compliance rules from the attached file "${fileName ?? "document"}".`
      : text || "No content provided.";

    const libraryContent = fileBase64 && mimeType
      ? [{ name: fileName ?? "document", mimeType, base64: fileBase64 }]
      : undefined;

    try {
      const result = await routeLLM({ llmModel, systemPrompt, userMessage, libraryContent });
      const raw = result.rawResponse ?? result.reply ?? result.summary ?? "{}";
      let parsed: Partial<RuleSet> = {};
      try {
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
        parsed = JSON.parse(cleaned);
      } catch { /* return empty ruleset */ }

      const now = new Date().toISOString();
      const ruleSet: RuleSet = {
        id: `rs_${randomUUID().slice(0, 8)}`,
        name: parsed.name ?? (fileName ? fileName.replace(/\.[^.]+$/, "") : "New Rule Set"),
        description: parsed.description ?? "",
        sourceFile: fileName,
        properties: parsed.properties ?? [],
        sections: (parsed.sections ?? []).map((s, si) => ({
          id: s.id ?? `s${si + 1}`,
          name: s.name ?? `Section ${si + 1}`,
          description: s.description ?? "",
          properties: s.properties ?? [],
          rules: (s.rules ?? []).map((r, ri) => ({
            id: r.id ?? `r${si + 1}_${ri + 1}`,
            name: r.name ?? `Rule ${ri + 1}`,
            description: r.description ?? "",
            severity: (["required","preference","suggestion"].includes(r.severity) ? r.severity : "required") as RuleSet["sections"][0]["rules"][0]["severity"],
            confirmed: false,
            aiExtracted: true,
            properties: r.properties ?? [],
          })),
        })),
        rules: (parsed.rules ?? []).map((r, ri) => ({
          id: r.id ?? `r${ri + 1}`,
          name: r.name ?? `Rule ${ri + 1}`,
          description: r.description ?? "",
          severity: (["required","preference","suggestion"].includes(r.severity) ? r.severity : "required") as RuleSet["rules"][0]["severity"],
          confirmed: false,
          aiExtracted: true,
          properties: r.properties ?? [],
        })),
        createdAt: now,
        updatedAt: now,
      };

      console.log(`[parse-rules] ✅ ${req.params.id} — "${ruleSet.name}" | sections:${ruleSet.sections.length} rules:${ruleSet.rules.length}`);
      res.json({ ruleSet });
    } catch (err) {
      console.error("[parse-rules]", (err as Error).message);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
