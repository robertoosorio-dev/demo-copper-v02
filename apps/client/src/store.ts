import { create } from "zustand";
import type { Version, DataPlanModel, MediaPlanModel, Exchange, LibraryFile } from "@copper/contracts";
import { saveProject as apiSaveProject } from "./api.js";
import type { WizardShape } from "./wizardStandin.js";
import type { LibraryData } from "./api.js";

export type SaveStatus = "saved" | "saving" | "unsaved";
export type ActivePlan = "data" | "media" | "creative";
export type PanelFocus = "none" | "context" | "plan" | "model" | "context-min" | "plan-min" | "model-min";

const PANEL_LAYOUT_KEY = "copper-panel-layout";
function loadPanelLayout(): { panelFocus: PanelFocus; contextW: number; planDocW: number } {
  try {
    const raw = localStorage.getItem(PANEL_LAYOUT_KEY);
    if (!raw) return { panelFocus: "none", contextW: 300, planDocW: 380 };
    return { panelFocus: "none", contextW: 300, planDocW: 380, ...JSON.parse(raw) };
  } catch { return { panelFocus: "none", contextW: 300, planDocW: 380 }; }
}
function savePanelLayout(s: { panelFocus: PanelFocus; contextW: number; planDocW: number }) {
  try { localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(s)); } catch {}
}

interface State {
  // Project / version
  version: Version | null;
  availableProjects: Array<{ id: string; name: string; version: number; updatedAt: string }>;
  saveStatus: SaveStatus;

  // Active plan tab
  activePlan: ActivePlan;

  // UI
  selectedNodeId: string | null;
  graphOrganizeBy: string;
  graphViewMode: number;
  graphSelection: string[];
  llmModel: string;
  isLoading: boolean;
  wizardShape: WizardShape | null;
  libraryFiles: LibraryFile[];
  libraryFolders: string[];
  libraryOpen: boolean;
  panelFocus: PanelFocus;
  contextW: number;
  planDocW: number;

  // ── Derived accessors (computed from version) ──────────────────────────────
  dataModel: () => DataPlanModel | null;
  mediaModel: () => MediaPlanModel | null;
  mediaDocument: () => string;
  exchanges: () => Version["context"]["exchanges"];
  contextFiles: () => Version["context"]["contextFiles"];

  // ── Actions ────────────────────────────────────────────────────────────────
  setAvailableProjects: (list: Array<{ id: string; name: string; version: number; updatedAt: string }>) => void;
  loadVersion: (v: Version) => void;
  setActivePlan: (plan: ActivePlan) => void;
  selectNode: (id: string | null) => void;
  setGraphOrganizeBy: (t: string) => void;
  setGraphViewMode: (m: number) => void;
  setGraphSelection: (ids: string[]) => void;
  setLlmModel: (m: string) => void;
  setLoading: (v: boolean) => void;
  openWizard: (shape: WizardShape) => void;
  closeWizard: () => void;
  setLibraryData: (data: LibraryData) => void;
  setLibraryFiles: (files: LibraryFile[]) => void;
  setLibraryFolders: (folders: string[]) => void;
  setLibraryOpen: (open: boolean) => void;
  addLibraryFile: (file: LibraryFile) => void;
  updateLibraryFile: (id: string, patch: Partial<LibraryFile>) => void;
  removeLibraryFile: (id: string) => void;
  setPanelFocus: (f: PanelFocus) => void;
  setContextW: (w: number) => void;
  setPlanDocW: (w: number) => void;

  updateDataDocument: (doc: string) => void;
  updateMediaDocument: (doc: string) => void;
  appendExchanges: (exchanges: Exchange[]) => void;
  setVersion: (v: Version) => void;
  // Called when server returns ops result — updates plans but preserves client exchanges, marks unsaved
  mergeServerVersion: (v: Version) => void;

  // Save
  saveNow: () => Promise<void>;
  _markUnsaved: () => void;
}

export const useStore = create<State>((set, get) => ({
  version: null,
  availableProjects: [],
  saveStatus: "saved",

  activePlan: "data",

  selectedNodeId: null,
  graphOrganizeBy: "MediaPartner",
  graphViewMode: 1,
  graphSelection: [],
  llmModel: "claude-sonnet-4-6",
  isLoading: false,
  wizardShape: null,
  libraryFiles: [],
  libraryFolders: [],
  libraryOpen: false,
  ...loadPanelLayout(),

  // Derived — read from version each time (no redundant mirrors)
  dataModel: () => get().version?.plans.data.model ?? null,
  mediaModel: () => get().version?.plans.media.model ?? null,
  mediaDocument: () => get().version?.plans.media.document ?? "",
  exchanges: () => get().version?.context.exchanges ?? [],
  contextFiles: () => get().version?.context.contextFiles ?? [],

  // Actions
  setAvailableProjects: (list) => set({ availableProjects: list }),

  loadVersion: (v) =>
    set({
      version: v,
      saveStatus: "saved",
      selectedNodeId: null,
      graphSelection: [],
      graphOrganizeBy: "MediaPartner",
      graphViewMode: 1,
    }),

  setActivePlan: (activePlan) =>
    set({ activePlan, selectedNodeId: null, graphSelection: [] }),

  selectNode: (selectedNodeId) => set({ selectedNodeId }),

  setGraphOrganizeBy: (graphOrganizeBy) => set({ graphOrganizeBy }),
  setGraphViewMode: (graphViewMode) => set({ graphViewMode }),
  setGraphSelection: (graphSelection) => set({ graphSelection }),

  setLlmModel: (llmModel) => set({ llmModel }),
  setLoading: (isLoading) => set({ isLoading }),
  openWizard: (wizardShape) => set({ wizardShape }),
  closeWizard: () => set({ wizardShape: null }),
  setLibraryData: ({ files, folders }) => set({ libraryFiles: files, libraryFolders: folders }),
  setLibraryFiles: (libraryFiles) => set({ libraryFiles }),
  setLibraryFolders: (libraryFolders) => set({ libraryFolders }),
  setLibraryOpen: (libraryOpen) => {
    if (libraryOpen) {
      const { contextW, planDocW } = get();
      savePanelLayout({ panelFocus: "context", contextW, planDocW });
      set({ libraryOpen, panelFocus: "context" });
    } else {
      set({ libraryOpen });
    }
  },
  addLibraryFile: (file) => set((s) => ({ libraryFiles: [...s.libraryFiles, file] })),
  updateLibraryFile: (id, patch) =>
    set((s) => ({ libraryFiles: s.libraryFiles.map((f) => f.id === id ? { ...f, ...patch } : f) })),
  removeLibraryFile: (id) =>
    set((s) => ({ libraryFiles: s.libraryFiles.filter((f) => f.id !== id) })),

  setPanelFocus: (panelFocus) => {
    const { contextW, planDocW } = get();
    savePanelLayout({ panelFocus, contextW, planDocW });
    set({ panelFocus });
  },
  setContextW: (contextW) => {
    const { panelFocus, planDocW } = get();
    savePanelLayout({ panelFocus, contextW, planDocW });
    set({ contextW });
  },
  setPlanDocW: (planDocW) => {
    const { panelFocus, contextW } = get();
    savePanelLayout({ panelFocus, contextW, planDocW });
    set({ planDocW });
  },

  updateDataDocument: (doc) =>
    set((s) => {
      if (!s.version) return {};
      return {
        version: {
          ...s.version,
          plans: { ...s.version.plans, data: { ...s.version.plans.data, document: doc } },
        },
        saveStatus: "unsaved" as SaveStatus,
      };
    }),

  updateMediaDocument: (doc) =>
    set((s) => {
      if (!s.version) return {};
      return {
        version: {
          ...s.version,
          plans: { ...s.version.plans, media: { ...s.version.plans.media, document: doc } },
        },
        saveStatus: "unsaved" as SaveStatus,
      };
    }),

  setVersion: (v) => set({ version: v, saveStatus: "saved" }),

  mergeServerVersion: (v) =>
    set((s) => ({
      version: s.version ? { ...v, context: s.version.context } : v,
      saveStatus: "unsaved" as SaveStatus,
    })),

  appendExchanges: (exchanges) =>
    set((s) => {
      if (!s.version) return {};
      return {
        version: {
          ...s.version,
          context: {
            ...s.version.context,
            exchanges: [...s.version.context.exchanges, ...exchanges],
          },
        },
      };
    }),

  _markUnsaved: () => set({ saveStatus: "unsaved" }),

  saveNow: async () => {
    const { version } = get();
    if (!version?.id) return;
    set({ saveStatus: "saving" });
    try {
      await apiSaveProject(version.id, version);
      set({ saveStatus: "saved" });
    } catch {
      set({ saveStatus: "unsaved" });
    }
  },
}));
