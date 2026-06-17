import { Router } from "express";
import { GCSStorageProvider } from "../storage/gcs.js";
import { routeLLM } from "../llm/router.js";
import type { Brand, BrandConfidence } from "@copper/contracts";

let _storage: GCSStorageProvider | null = null;
function storage(): GCSStorageProvider {
  if (!_storage) _storage = new GCSStorageProvider();
  return _storage;
}

const brandPath = (id: string) => `brand_data/${id}/brand.json`;

const EXTRACTION_SYSTEM = `You are a brand intelligence assistant. Your job is to read brand guideline documents and extract structured brand information.

When given a document, extract as many of the following fields as you can find. Return a JSON object with this exact shape:

{
  "message": "<friendly summary of what you found>",
  "fields": {
    "basicDetails.name":       { "value": "...", "confidence": "high|medium|low", "sourceLabel": "...", "sourcePage": "..." },
    "basicDetails.industry":   { "value": "...", "confidence": "high|medium|low", "sourceLabel": "...", "sourcePage": "..." },
    "basicDetails.regions":    { "value": "...", "confidence": "high|medium|low", "sourceLabel": "...", "sourcePage": "..." },
    "basicDetails.languages":  { "value": "...", "confidence": "high|medium|low", "sourceLabel": "...", "sourcePage": "..." },
    "guidelines.promiseAndStory.brandPromise":  { ... },
    "guidelines.promiseAndStory.brandStory":    { ... },
    "guidelines.toneAndVoice.traits":               { ... },
    "guidelines.toneAndVoice.personalityAttributes":{ ... },
    "guidelines.toneAndVoice.isIsNotFraming":        { ... },
    "guidelines.textGuidelines.dosAndDonts":         { ... },
    "guidelines.textGuidelines.requiredPhrases":     { ... },
    "guidelines.textGuidelines.restrictedLanguage":  { ... },
    "guidelines.visualIdentity.logoVariants":        { ... },
    "guidelines.visualIdentity.colorPalette":        { ... },
    "guidelines.visualIdentity.typographyHierarchy": { ... },
    "guidelines.imageGuidelines.dosAndDonts":         { ... },
    "guidelines.imageGuidelines.compositionConstraints": { ... },
    "guidelines.imageGuidelines.styleConstraints":    { ... },
    "guidelines.messagingGuidelines.guidelines":      { ... },
    "guidelines.messagingGuidelines.tagline":         { ... },
    "guidelines.messagingGuidelines.taglineUsageRules": { ... },
    "guidelines.messagingGuidelines.cobrandingRules":  { ... },
    "complianceRules.requiredDisclaimers":  { ... },
    "complianceRules.restrictedTerms":      { ... },
    "complianceRules.legalNotes":           { ... },
    "complianceRules.regulatedCategories":  { ... }
  }
}

Rules:
- Only include fields where you actually found relevant information in the document. Omit fields you cannot find.
- confidence: "high" = explicitly stated verbatim, "medium" = inferred/paraphrased, "low" = uncertain or implied
- sourceLabel: the section heading or phrase in the document where you found this (e.g. "Brand Voice", "Color Palette")
- sourcePage: page number if visible, otherwise null
- value: concise and clean — do not copy verbatim walls of text unless necessary
- Return ONLY the JSON object. No markdown fences, no preamble.

When the user sends a chat message instead of a document, respond conversationally in the same JSON format with an empty "fields" object.`;

export interface ExtractedField {
  value: string;
  confidence: BrandConfidence;
  sourceLabel: string;
  sourcePage: string | null;
}

export interface ExtractResponse {
  message: string;
  fields: Record<string, ExtractedField>;
}

export function makeBrandExtractRouter(): Router {
  const router = Router();

  // POST /api/brands/:id/extract
  // Body: { llmModel?, message?, fileBase64?, mimeType?, fileName? }
  router.post("/:id/extract", async (req, res) => {
    const { llmModel = "claude-sonnet-4-6", message = "", fileBase64, mimeType, fileName } = req.body as {
      llmModel?: string;
      message?: string;
      fileBase64?: string;
      mimeType?: string;
      fileName?: string;
    };

    // Load the current brand for context
    let brandContext = "";
    try {
      const raw = await storage().read(brandPath(req.params.id));
      const brand = JSON.parse(raw) as Brand;
      brandContext = `\n\nCurrent brand being edited: "${brand.name}"`;
    } catch { /* brand may not exist yet */ }

    const userMessage = fileBase64
      ? `Please extract brand information from the attached document "${fileName ?? "brand guidelines"}".${message ? ` Additional context: ${message}` : ""}${brandContext}`
      : `${message}${brandContext}`;

    const libraryContent = fileBase64 && mimeType
      ? [{ name: fileName ?? "document", mimeType, base64: fileBase64 }]
      : undefined;

    try {
      const result = await routeLLM({
        llmModel,
        systemPrompt: EXTRACTION_SYSTEM,
        userMessage,
        libraryContent,
      });

      // Parse the JSON from the LLM reply
      const raw = result.rawResponse ?? result.reply ?? result.summary ?? "";
      let parsed: ExtractResponse;
      try {
        // strip any accidental markdown fences
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
        parsed = JSON.parse(cleaned) as ExtractResponse;
      } catch {
        parsed = { message: raw, fields: {} };
      }

      res.json(parsed);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
