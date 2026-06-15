import { useCallback } from "react";
import { useStore } from "../store.js";
import { parseContextFile, buildWizardShapeFromFile } from "../lib/parseContextFile.js";

export function useDocumentHandlers() {
  const openWizard = useStore((s) => s.openWizard);

  const launchWizard = useCallback(
    async (file: File) => {
      try {
        const parsed = await parseContextFile(file);
        openWizard(buildWizardShapeFromFile(parsed));
      } catch (err) {
        console.error("[launchWizard]", err);
      }
    },
    [openWizard],
  );

  return { launchWizard };
}
