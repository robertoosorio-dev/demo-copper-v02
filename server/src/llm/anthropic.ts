import Anthropic from "@anthropic-ai/sdk";
import type { LLMRequest, LLMResponse, ReasoningBlock } from "./router.js";
import { extractJSON } from "./utils.js";

// MIME types the Anthropic API accepts as document source blocks
const CLAUDE_DOC_MIMES: Record<string, boolean> = {
  "application/pdf":  true,
  "text/plain":       true,
  "text/html":        true,
  "text/markdown":    true,
  "text/csv":         true,
};

// Build a document content block (structure matches API; cast needed for old SDK types)
function docBlock(name: string, mimeType: string, base64: string): unknown {
  return {
    type: "document",
    source: { type: "base64", media_type: mimeType, data: base64 },
    title: name,
  };
}

export async function callAnthropic({ llmModel, systemPrompt, userMessage, libraryContent }: LLMRequest): Promise<LLMResponse> {
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  // Build user content: doc blocks first, then the text message
  const userBlocks: unknown[] = [];
  if (libraryContent?.length) {
    for (const f of libraryContent) {
      const baseMime = f.mimeType.split(";")[0].trim();
      if (CLAUDE_DOC_MIMES[baseMime]) {
        userBlocks.push(docBlock(f.name, baseMime, f.base64));
      }
    }
  }
  userBlocks.push({ type: "text", text: userMessage });

  const response = await client.messages.create({
    model: llmModel,
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: "user", content: userBlocks as Anthropic.MessageParam["content"] }],
  });

  const text = (response.content.find((b) => b.type === "text") as { type: "text"; text: string } | undefined)?.text ?? "";
  console.log(`[anthropic] raw (${text.length} chars): ${text.slice(0, 300)}${text.length > 300 ? "…" : ""}`);
  try {
    const parsed = extractJSON(text);
    return {
      summary:     (parsed.summary as string)          ?? (parsed.reply as string) ?? "",
      ops:         (parsed.ops as unknown[])            ?? null,
      proposal:    parsed.proposal                       ?? null,
      plan:        (parsed.plan as string)               ?? null,
      rawResponse: text,
      reasoning:   (parsed.reasoning as ReasoningBlock) ?? null,
      reply:       (parsed.reply as string)             ?? null,
      card:        (parsed.card as { cardType: string; props: Record<string, unknown> }) ?? null,
    };
  } catch (err) {
    console.error(`[anthropic] JSON parse failed: ${(err as Error).message}`);
    throw Object.assign(new Error("LLM returned invalid JSON"), { raw: text });
  }
}
