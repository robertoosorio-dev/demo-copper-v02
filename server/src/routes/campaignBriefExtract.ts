import { Router } from "express";
import { routeLLM } from "../llm/router.js";

const EXTRACT_SYSTEM = `You are a campaign brief analyst. Given freeform text, a document, or a message describing a campaign, extract structured campaign information.

Return JSON with EXACTLY this shape (no markdown, no preamble):
{
  "campaignName": "<campaign name or empty string>",
  "startDate": "<YYYY-MM-DD or empty string>",
  "endDate": "<YYYY-MM-DD or empty string>",
  "description": "<full campaign description, 1-3 sentences or empty string>",
  "objective": "<awareness|traffic|conversions|app_installs|engagement|other or empty string>",
  "primaryKpi": "<e.g. CTR, ROAS, CPA, Impressions or empty string>",
  "targetAudience": "<description of target audience or empty string>",
  "channels": ["<Display|Video|Social|HTML5|Email|Search|OOH>"],
  "regions": ["<country or region names>"],
  "offerFocus": "<product or offer being promoted or empty string>",
  "complianceNotes": "<any compliance or legal notes or empty string>"
}

Only include fields you can confidently extract. Leave others as empty string or empty array.
Return ONLY the JSON object. No markdown fences, no preamble.`;

export function makeCampaignBriefExtractRouter(): Router {
  const router = Router();

  router.post("/:id/extract-brief", async (req, res) => {
    const { llmModel = "claude-sonnet-4-6", message = "", fileBase64, mimeType, fileName } = req.body as {
      llmModel?: string;
      message?: string;
      fileBase64?: string;
      mimeType?: string;
      fileName?: string;
    };

    const userMessage = fileBase64
      ? `Extract campaign brief information from the attached file "${fileName ?? "brief"}".${message ? ` Additional context: ${message}` : ""}`
      : message || "No brief content provided.";

    const libraryContent = fileBase64 && mimeType
      ? [{ name: fileName ?? "brief", mimeType, base64: fileBase64 }]
      : undefined;

    try {
      const result = await routeLLM({
        llmModel,
        systemPrompt: EXTRACT_SYSTEM,
        userMessage,
        libraryContent,
      });

      const raw = result.rawResponse ?? result.reply ?? result.summary ?? "{}";
      let parsed: Record<string, unknown> = {};
      try {
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
        parsed = JSON.parse(cleaned);
      } catch { /* return empty */ }

      res.json({ brief: parsed });
    } catch (err: any) {
      console.error("[campaignBriefExtract] error:", err);
      res.status(500).json({ error: err?.message ?? "LLM error" });
    }
  });

  return router;
}
