// @copper/intelligence — the black box
// Exposes submit(intent) -> { version, trace }
// Workers are real seams but run synchronously for now (M3).
// M1/M2: stub only — no engines wired.

import type { Intent, Version, ReasoningLogEntry } from "@copper/contracts";

export interface IntelligenceResult {
  version: Version;
  trace: ReasoningLogEntry[];
}

// TODO(M3): implement sync, consistency, import-validate workers
export async function submit(
  _intent: Intent,
  _currentVersion: Version,
): Promise<IntelligenceResult> {
  throw new Error("Intelligence seam not yet wired (M3)");
}
