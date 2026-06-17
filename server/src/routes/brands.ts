import { Router } from "express";
import { GCSStorageProvider } from "../storage/gcs.js";
import type { Brand, BrandSummary, BrandField } from "@copper/contracts";
import { randomUUID } from "crypto";

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
      const id    = `brand-${randomUUID().split("-")[0]}`;
      const brand = blankBrand(id, name.trim());
      await storage().write(brandPath(id), JSON.stringify(brand, null, 2));
      const index = await readIndex();
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
      brand.updatedAt = new Date().toISOString();
      await storage().write(brandPath(req.params.id), JSON.stringify(brand, null, 2));
      const index   = await readIndex();
      const summary: BrandSummary = { id: brand.id, name: brand.name, status: brand.status, createdAt: brand.createdAt, updatedAt: brand.updatedAt };
      const idx     = index.findIndex((b) => b.id === req.params.id);
      if (idx >= 0) index[idx] = summary; else index.unshift(summary);
      await writeIndex(index);
      res.json(brand);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
