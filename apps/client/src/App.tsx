import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { useStore } from "./store.js";
import { listProjects, loadProject, createProject, createBrand, loadBrand, createCatalog, loadCatalog } from "./api.js";
import { getWizardShape } from "./wizardStandin.js";
import WizardSurface from "./components/WizardSurface.js";
import QAViewer from "./components/QAViewer.js";
import HistoryPanel from "./components/HistoryPanel.js";
import AdminPanel from "./components/AdminPanel.js";
import GlobalRail from "./components/shell/GlobalRail.js";
import WorkflowTopBar from "./components/shell/WorkflowTopBar.js";
import SubStepNav from "./components/shell/SubStepNav.js";
import AgentPanel from "./components/shell/AgentPanel.js";
import EntityListView from "./components/shell/EntityListView.js";
import CenterContent from "./components/shell/CenterContent.js";
import BrandSubFlow from "./components/brand/BrandSubFlow.js";
import CatalogSubFlow from "./components/catalog/CatalogSubFlow.js";

function useGlobalDropGuard() {
  useEffect(() => {
    const stop = (e: DragEvent) => e.preventDefault();
    document.addEventListener("dragover", stop);
    document.addEventListener("drop", stop);
    return () => {
      document.removeEventListener("dragover", stop);
      document.removeEventListener("drop", stop);
    };
  }, []);
}

function NewCampaignModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(trimmed);
    } catch (err) {
      setError((err as Error).message ?? "Failed to create campaign");
      setBusy(false);
    }
  }

  return (
    <div className="syn-modal-backdrop" onClick={onClose}>
      <div className="syn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="syn-modal-title">New campaign</div>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="syn-modal-input"
            placeholder="Campaign name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
          />
          {error && <div className="syn-modal-error">{error}</div>}
          <div className="syn-modal-actions">
            <button
              type="button"
              className="syn-modal-btn syn-modal-btn--cancel"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="syn-modal-btn syn-modal-btn--create"
              disabled={!name.trim() || busy}
            >
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MainApp() {
  useGlobalDropGuard();

  const synapseEntity        = useStore((s) => s.synapseEntity);
  const campaignOpen         = useStore((s) => s.campaignOpen);
  const setCampaignOpen      = useStore((s) => s.setCampaignOpen);
  const brandOpen            = useStore((s) => s.brandOpen);
  const setBrandOpen         = useStore((s) => s.setBrandOpen);
  const activeBrand          = useStore((s) => s.activeBrand);
  const setActiveBrand       = useStore((s) => s.setActiveBrand);
  const catalogOpen          = useStore((s) => s.catalogOpen);
  const setCatalogOpen       = useStore((s) => s.setCatalogOpen);
  const activeCatalog        = useStore((s) => s.activeCatalog);
  const setActiveCatalog     = useStore((s) => s.setActiveCatalog);
  const availableProjects    = useStore((s) => s.availableProjects);
  const setAvailableProjects = useStore((s) => s.setAvailableProjects);
  const loadVersionStore     = useStore((s) => s.loadVersion);
  const openWizard           = useStore((s) => s.openWizard);

  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showNewBrand, setShowNewBrand]       = useState(false);
  const [newBrandName, setNewBrandName]       = useState("");
  const [newBrandBusy, setNewBrandBusy]       = useState(false);
  const [newCatalogBusy, setNewCatalogBusy]   = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const list = await listProjects();
        setAvailableProjects(list);
        if (list.length > 0) {
          const v = await loadProject(list[0].id);
          loadVersionStore(v);
        }
      } catch (err) {
        console.error("[app] init failed:", err);
      }
    }
    init();
  }, []);

  async function handleCreateCampaign(name: string) {
    const newVersion = await createProject(name);
    const list = await listProjects();
    setAvailableProjects(list);
    loadVersionStore(newVersion);
    setShowNewCampaign(false);
    setCampaignOpen(true);
  }

  async function handleCreateBrand() {
    const trimmed = newBrandName.trim();
    if (!trimmed || newBrandBusy) return;
    setNewBrandBusy(true);
    try {
      const brand = await createBrand(trimmed);
      setActiveBrand(brand);
      setBrandOpen(true);
      setShowNewBrand(false);
      setNewBrandName("");
    } catch (err) {
      console.error(err);
    } finally {
      setNewBrandBusy(false);
    }
  }

  async function handleOpenBrand(id: string) {
    try {
      const brand = await loadBrand(id);
      setActiveBrand(brand);
      setBrandOpen(true);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateCatalog() {
    if (newCatalogBusy) return;
    setNewCatalogBusy(true);
    try {
      const catalog = await createCatalog();
      setActiveCatalog(catalog);
      setCatalogOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setNewCatalogBusy(false);
    }
  }

  async function handleOpenCatalog(id: string) {
    try {
      const catalog = await loadCatalog(id);
      setActiveCatalog(catalog);
      setCatalogOpen(true);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="syn-shell">
      {/* Wizard modal — overlays everything */}
      <WizardSurface />

      {showNewCampaign && (
        <NewCampaignModal
          onClose={() => setShowNewCampaign(false)}
          onCreate={handleCreateCampaign}
        />
      )}

      {showNewBrand && (
        <div className="syn-modal-backdrop" onClick={() => setShowNewBrand(false)}>
          <div className="syn-modal" onClick={(e) => e.stopPropagation()}>
            <div className="syn-modal-title">New brand</div>
            <input
              className="syn-modal-input"
              placeholder="Brand name"
              value={newBrandName}
              autoFocus
              onChange={(e) => setNewBrandName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateBrand();
                if (e.key === "Escape") setShowNewBrand(false);
              }}
            />
            <div className="syn-modal-actions">
              <button
                className="syn-modal-btn syn-modal-btn--cancel"
                onClick={() => setShowNewBrand(false)}
              >
                Cancel
              </button>
              <button
                className="syn-modal-btn syn-modal-btn--create"
                disabled={!newBrandName.trim() || newBrandBusy}
                onClick={handleCreateBrand}
              >
                {newBrandBusy ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global left rail */}
      <GlobalRail />

      {/* Main content area */}
      <div className="syn-main">
        {campaignOpen && synapseEntity === "campaigns" ? (
          // ── Campaign shell (4-zone layout) ──
          <div className="syn-campaign-shell">
            <WorkflowTopBar onBack={() => setCampaignOpen(false)} />
            <div className="syn-workflow-body">
              <SubStepNav />
              <div className="syn-center">
                <CenterContent />
              </div>
              <AgentPanel />
            </div>
          </div>
        ) : brandOpen && synapseEntity === "brands" && activeBrand ? (
          // ── Brand sub-flow ──
          <BrandSubFlow
            brand={activeBrand}
            onBack={() => setBrandOpen(false)}
          />
        ) : catalogOpen && synapseEntity === "catalogs" && activeCatalog ? (
          // ── Catalog sub-flow ──
          <CatalogSubFlow
            catalog={activeCatalog}
            onBack={() => setCatalogOpen(false)}
          />
        ) : (
          // ── Entity list view ──
          <EntityListView
            entity={synapseEntity}
            onOpenCampaign={() => setCampaignOpen(true)}
            onOpenBrand={handleOpenBrand}
            onOpenCatalog={handleOpenCatalog}
            onNew={() => {
              if (synapseEntity === "campaigns") setShowNewCampaign(true);
              if (synapseEntity === "brands") setShowNewBrand(true);
              if (synapseEntity === "catalogs") handleCreateCatalog();
            }}
          />
        )}
      </div>
    </div>
  );
}

function AdminShell() {
  return (
    <div className="syn-shell">
      <GlobalRail />
      <div className="syn-main">
        <AdminPanel />
      </div>
    </div>
  );
}

function HistoryShell() {
  return (
    <div className="syn-shell">
      <GlobalRail />
      <div className="syn-main">
        <HistoryPanel />
      </div>
    </div>
  );
}

function QAShell() {
  return (
    <div className="syn-shell">
      <GlobalRail />
      <div className="syn-main">
        <QAViewer />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin"   element={<AdminShell />}   />
      <Route path="/history" element={<HistoryShell />} />
      <Route path="/qa"      element={<QAShell />}      />
      <Route path="/*"       element={<MainApp />}      />
    </Routes>
  );
}
