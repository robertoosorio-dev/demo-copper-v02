import { useStore } from "../store.js";
import { chat, uploadLibraryContent, putLibrary, extractCampaignBrief } from "../api.js";
import type { Exchange, LibraryFile, ClarificationQuestion } from "@copper/contracts";

interface FileInput {
  id: string;
  name: string;
  file: File;
}

/**
 * Returns a `submit` function that mirrors ContextPanel.doSubmit exactly:
 * upload files → run step-specific extraction → call chat → update exchanges.
 *
 * Call it from any component (form drop zone, chat composer, etc.) to get
 * identical behaviour regardless of which UI triggered the file drop.
 */
export type { ClarificationQuestion };

export function useAgentChat() {
  const version            = useStore((s) => s.version);
  const llmModel           = useStore((s) => s.llmModel);
  const libraryFiles       = useStore((s) => s.libraryFiles);
  const libraryFolders     = useStore((s) => s.libraryFolders);
  const appendExchanges    = useStore((s) => s.appendExchanges);
  const mergeServerVersion = useStore((s) => s.mergeServerVersion);
  const addLibraryFile     = useStore((s) => s.addLibraryFile);
  const updateLibraryFile  = useStore((s) => s.updateLibraryFile);
  const patchVersion       = useStore((s) => s.patchVersion);
  const openWizard         = useStore((s) => s.openWizard);
  const setLoading         = useStore((s) => s.setLoading);
  const synapseSubStep     = useStore((s) => s.synapseSubStep);

  async function submit(message: string, files: FileInput[] = []) {
    if (!version?.id) return;
    if (!message.trim() && files.length === 0) return;

    // If user dropped file(s) with no message, generate a context-aware one
    const effectiveMessage = message.trim() || (
      files.length === 1
        ? `I've shared "${files[0].name}" — please read it and help me with the current step. If there's a form to fill out, extract the relevant fields from the document.`
        : `I've shared ${files.length} files — please read them and help me with the current step.`
    );

    // 1. Upload files, await contentPaths so they're ready for the chat call
    const uploadedLibFiles: LibraryFile[] = [];
    if (files.length > 0) {
      const newLibFiles: LibraryFile[] = files.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.name.split(".").pop()?.toLowerCase() ?? "",
        tier: "local" as const,
        folderPath: "",
        updatedAt: new Date().toISOString(),
        size: f.file.size,
        selectedForContext: true,
      }));
      for (const lf of newLibFiles) addLibraryFile(lf);

      const settled = await Promise.all(
        newLibFiles.map(async (lf) => {
          const att = files.find((f) => f.id === lf.id);
          if (!att) return lf;
          try {
            const { contentPath } = await uploadLibraryContent(version.id!, att.id, att.file);
            const withPath = { ...lf, contentPath };
            updateLibraryFile(att.id, { contentPath });
            return withPath;
          } catch {
            return lf;
          }
        })
      );
      uploadedLibFiles.push(...settled);

      // Persist manifest with contentPaths
      const merged = [...libraryFiles, ...settled];
      void putLibrary(version.id, { files: merged, folders: libraryFolders });
    }

    // 2. Append user exchange (with attachment names if files present)
    // When no text typed, show the file name(s) prominently as the bubble text (like BrandAgentPanel)
    const displayText = message.trim()
      ? message.trim()
      : files.map((f) => `📎 ${f.name}`).join("\n");
    const userExchange: Exchange = {
      id: `ex_u_${Date.now()}`,
      role: "user",
      text: displayText,
      status: "success",
      startedAt: new Date().toISOString(),
      ...(files.length > 0 ? { attachmentNames: files.map((f) => f.name) } : {}),
    };
    appendExchanges([userExchange]);
    setLoading(true);

    // 3. Run step-specific extraction in parallel (don't await — let form fill async)
    if (synapseSubStep === "brand_brief" && files.length > 0) {
      const firstFile = files[0]?.file;
      if (firstFile) {
        extractCampaignBrief(version.id!, { file: firstFile, llmModel }).then((resp) => {
          const current = useStore.getState().version;
          if (!current) return;
          const existingBrief = (current.context as any)?.brief ?? {};
          patchVersion({
            ...current,
            context: { ...current.context, brief: { ...existingBrief, ...resp.brief } } as any,
          });
        }).catch(console.error);
      }
    }

    // 4. Send to intelligence layer
    try {
      const freshLib = useStore.getState().libraryFiles;
      const selectedForContext = [
        ...freshLib.filter((f) => f.selectedForContext && !uploadedLibFiles.some((u) => u.id === f.id)),
        ...uploadedLibFiles,
      ];
      const currentExchanges = useStore.getState().version?.context.exchanges ?? [];
      const result = await chat(
        version.id!,
        effectiveMessage,
        llmModel,
        [...currentExchanges],
        version,
        selectedForContext.length > 0 ? selectedForContext : undefined,
        synapseSubStep,
      );
      appendExchanges([result.exchange]);
      if (result.version) mergeServerVersion(result.version);
      if (result.wizard) openWizard(result.wizard);

      // Surface askClarification questions — stored on the exchange so
      // CampaignStrategyView can read them from the latest assistant exchange
      if (result.clarificationQuestions?.length) {
        appendExchanges([{
          id: `ex_clarify_${Date.now()}`,
          role: "assistant",
          text: "__clarification__",
          status: "success",
          startedAt: new Date().toISOString(),
          clarificationQuestions: result.clarificationQuestions,
        } as Exchange & { clarificationQuestions: ClarificationQuestion[] }]);
      }
    } catch (err) {
      appendExchanges([{
        id: `ex_err_${Date.now()}`,
        role: "assistant",
        text: `Error: ${(err as Error).message}`,
        status: "error",
        startedAt: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  return { submit };
}
