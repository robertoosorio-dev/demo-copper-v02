import React, { useRef, useState } from "react";
import { useStore } from "../../store.js";
import type { LibraryFile } from "@copper/contracts";
import { FilePreview } from "./FilePreview.js";
import { putLibrary, libraryContentUrl } from "../../api.js";

interface TakeoverProps {
  onAddFile: (file: File) => void;
}

// ── Tree helpers ──────────────────────────────────────────────────────────────

function filterByPath(files: LibraryFile[], path: string | null): LibraryFile[] {
  if (path === null) return files;
  if (path === "__global__") return files.filter((f) => f.tier === "global");
  return files.filter((f) => f.tier === "local" && f.folderPath === path);
}

// ── SVG icons ──────────────────────────────────────────────────────────────────

function IconChevLeft() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>;
}
function IconLibrary() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M4 5h16v14H4z" /><path d="M4 9h16" /><path d="M9 5v14" /></svg>;
}
function IconSearch() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>;
}
function IconGridView() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
}
function IconListView() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>;
}
function IconPlus() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>;
}
function IconFolder() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 7h6l2 2h10v9H3z" /></svg>;
}
function IconPencil() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}
function IconTrash() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>;
}

// ── Move-to-folder popover ─────────────────────────────────────────────────────

function MoveFolderMenu({ folders, currentFolder, onMove, onClose }: {
  folders: string[];
  currentFolder: string;
  onMove: (folder: string) => void;
  onClose: () => void;
}) {
  const options = ["", ...folders].filter((f) => f !== currentFolder);
  return (
    <div className="lib-move-drop">
      <div className="lib-move-title">Move to…</div>
      {options.map((f) => (
        <button key={f || "__root__"} className="lib-move-item" onClick={() => { onMove(f); onClose(); }}>
          {f || "Root"}
        </button>
      ))}
    </div>
  );
}

// ── Rename inline modal ───────────────────────────────────────────────────────

function RenameModal({ label, current, onConfirm, onCancel }: {
  label: string;
  current: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(current);
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Rename {label}</div>
        <input
          className="modal-input"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && val.trim()) onConfirm(val.trim());
            if (e.key === "Escape") onCancel();
          }}
        />
        <div className="modal-actions">
          <button className="modal-btn" onClick={onCancel}>Cancel</button>
          <button
            className="modal-btn modal-btn--primary"
            onClick={() => { if (val.trim()) onConfirm(val.trim()); }}
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LibraryTakeover({ onAddFile }: TakeoverProps) {
  const version        = useStore((s) => s.version);
  const libraryFiles   = useStore((s) => s.libraryFiles);
  const libraryFolders = useStore((s) => s.libraryFolders);
  const setLibraryOpen = useStore((s) => s.setLibraryOpen);
  const updateLibraryFile = useStore((s) => s.updateLibraryFile);
  const removeLibraryFile = useStore((s) => s.removeLibraryFile);
  const setLibraryFiles   = useStore((s) => s.setLibraryFiles);
  const setLibraryFolders = useStore((s) => s.setLibraryFolders);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [movingFileId, setMovingFileId] = useState<string | null>(null);
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const localFiles  = libraryFiles.filter((f) => f.tier === "local");
  const globalFiles = libraryFiles.filter((f) => f.tier === "global");
  const gridFiles   = filterByPath(libraryFiles, selectedPath);

  const crumb = selectedPath === null
    ? ["Library"]
    : selectedPath === "__global__"
      ? ["Library", "Global"]
      : ["Library", selectedPath || "Root"];

  function persist(files: LibraryFile[], folders: string[]) {
    if (!version?.id) return;
    void putLibrary(version.id, { files, folders });
  }

  // ── File actions ────────────────────────────────────────────────────────────

  function handleToggleContext(id: string) {
    const file = libraryFiles.find((f) => f.id === id);
    if (!file) return;
    const updated = libraryFiles.map((f) => f.id === id ? { ...f, selectedForContext: !f.selectedForContext } : f);
    setLibraryFiles(updated);
    persist(updated, libraryFolders);
  }

  function handleOpenFile(file: LibraryFile) {
    if (!file.contentPath || !version?.id) {
      alert("No preview available yet — content is still uploading.");
      return;
    }
    window.open(libraryContentUrl(version.id, file.id), "_blank");
  }

  function handleDeleteFile(id: string) {
    const file = libraryFiles.find((f) => f.id === id);
    if (!file) return;
    if (!window.confirm(`Delete "${file.name}"?`)) return;
    const updated = libraryFiles.filter((f) => f.id !== id);
    removeLibraryFile(id);
    persist(updated, libraryFolders);
  }

  function handleRenameFile(id: string, newName: string) {
    const updated = libraryFiles.map((f) => f.id === id ? { ...f, name: newName } : f);
    updateLibraryFile(id, { name: newName });
    persist(updated, libraryFolders);
    setRenamingFile(null);
  }

  function handleMoveFile(id: string, folder: string) {
    const updated = libraryFiles.map((f) => f.id === id ? { ...f, folderPath: folder } : f);
    updateLibraryFile(id, { folderPath: folder });
    persist(updated, libraryFolders);
    setMovingFileId(null);
  }

  // ── Folder actions ──────────────────────────────────────────────────────────

  function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name || libraryFolders.includes(name)) { setNewFolderMode(false); return; }
    const updated = [...libraryFolders, name];
    setLibraryFolders(updated);
    persist(libraryFiles, updated);
    setSelectedPath(name);
    setNewFolderMode(false);
    setNewFolderName("");
  }

  function handleRenameFolder(oldName: string, newName: string) {
    if (!newName.trim() || oldName === newName.trim()) { setRenamingFolder(null); return; }
    const n = newName.trim();
    const updatedFolders = libraryFolders.map((f) => f === oldName ? n : f);
    const updatedFiles = libraryFiles.map((f) => f.folderPath === oldName ? { ...f, folderPath: n } : f);
    setLibraryFolders(updatedFolders);
    setLibraryFiles(updatedFiles);
    persist(updatedFiles, updatedFolders);
    if (selectedPath === oldName) setSelectedPath(n);
    setRenamingFolder(null);
  }

  function handleDeleteFolder(name: string) {
    const hasFiles = libraryFiles.some((f) => f.folderPath === name && f.tier === "local");
    const msg = hasFiles
      ? `Delete folder "${name}"? Files inside will be moved to root.`
      : `Delete folder "${name}"?`;
    if (!window.confirm(msg)) return;
    const updatedFolders = libraryFolders.filter((f) => f !== name);
    const updatedFiles = libraryFiles.map((f) => f.folderPath === name ? { ...f, folderPath: "" } : f);
    setLibraryFolders(updatedFolders);
    setLibraryFiles(updatedFiles);
    persist(updatedFiles, updatedFolders);
    if (selectedPath === name) setSelectedPath(null);
  }

  const rootLocalCount = localFiles.filter((f) => f.folderPath === "").length;

  return (
    <div className="lib-takeover">
      {/* Rename modals */}
      {renamingFolder && (
        <RenameModal
          label="Folder"
          current={renamingFolder}
          onConfirm={(n) => handleRenameFolder(renamingFolder, n)}
          onCancel={() => setRenamingFolder(null)}
        />
      )}
      {renamingFile && (
        <RenameModal
          label="File"
          current={libraryFiles.find((f) => f.id === renamingFile)?.name ?? ""}
          onConfirm={(n) => handleRenameFile(renamingFile, n)}
          onCancel={() => setRenamingFile(null)}
        />
      )}

      {/* Header */}
      <div className="lib-head">
        <div className="lib-head-row">
          <button className="lib-back" onClick={() => setLibraryOpen(false)}>
            <IconChevLeft />
            Conversation
          </button>
          <span className="lib-title"><IconLibrary />Library</span>
          <span className="lib-spacer" />
          <div className="lib-search"><IconSearch />Search files</div>
          <div className="lib-viewtoggle">
            <button className="lib-view-btn lib-view-btn--on" title="Large icons"><IconGridView /></button>
            <button className="lib-view-btn" title="List (coming soon)" disabled><IconListView /></button>
          </div>
          <button className="lib-add-btn" onClick={() => fileInputRef.current?.click()}>
            <IconPlus />Add
          </button>
        </div>
        <div className="lib-crumb">
          {crumb.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="lib-crumb-sep">/</span>}
              <span className={i === crumb.length - 1 ? "lib-crumb-here" : ""}>{part}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="lib-body">
        {/* Folder tree */}
        <nav className="lib-tree">
          <div className="lib-tree-grp">Folders</div>

          {/* Root — all files */}
          <div
            className={`lib-tree-node${selectedPath === null ? " lib-tree-node--sel" : ""}`}
            onClick={() => setSelectedPath(null)}
          >
            <span className="lib-tree-tw" />
            <IconLibrary />
            <span className="lib-tree-lbl">All Files</span>
            <span className="lib-tree-ct">{libraryFiles.length}</span>
          </div>

          {/* Root-level (unfoldered) local files */}
          {rootLocalCount > 0 && (
            <div
              className={`lib-tree-node lib-tree-node--child${selectedPath === "" ? " lib-tree-node--sel" : ""}`}
              onClick={() => setSelectedPath("")}
            >
              <span className="lib-tree-tw lib-tree-tw--empty" />
              <IconFolder />
              <span className="lib-tree-lbl">Root</span>
              <span className="lib-tree-ct">{rootLocalCount}</span>
            </div>
          )}

          {/* Explicit folders */}
          {libraryFolders.map((folder) => {
            const count = localFiles.filter((f) => f.folderPath === folder).length;
            return (
              <div
                key={folder}
                className={`lib-tree-node lib-tree-node--child lib-tree-folder${selectedPath === folder ? " lib-tree-node--sel" : ""}`}
                onClick={() => setSelectedPath(folder)}
              >
                <span className="lib-tree-tw lib-tree-tw--empty" />
                <IconFolder />
                <span className="lib-tree-lbl">{folder}</span>
                <span className="lib-tree-ct">{count}</span>
                <span className="lib-tree-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="lib-tree-act"
                    title="Rename"
                    onClick={() => setRenamingFolder(folder)}
                  ><IconPencil /></button>
                  <button
                    className="lib-tree-act lib-tree-act--del"
                    title="Delete folder"
                    onClick={() => handleDeleteFolder(folder)}
                  ><IconTrash /></button>
                </span>
              </div>
            );
          })}

          {/* New folder entry */}
          {newFolderMode ? (
            <div className="lib-tree-node lib-tree-node--child lib-new-folder-input">
              <span className="lib-tree-tw lib-tree-tw--empty" />
              <IconFolder />
              <input
                className="lib-folder-inp"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") { setNewFolderMode(false); setNewFolderName(""); }
                }}
                onBlur={handleCreateFolder}
                placeholder="Folder name"
              />
            </div>
          ) : (
            <button className="lib-new-folder-btn" onClick={() => setNewFolderMode(true)}>
              <IconPlus />New Folder
            </button>
          )}

          {/* Global files section */}
          {globalFiles.length > 0 && (
            <>
              <div className="lib-tree-grp" style={{ marginTop: 14 }}>Global</div>
              <div
                className={`lib-tree-node${selectedPath === "__global__" ? " lib-tree-node--sel" : ""}`}
                onClick={() => setSelectedPath("__global__")}
              >
                <span className="lib-tree-tw lib-tree-tw--empty" />
                <IconFolder />
                <span className="lib-tree-lbl">Global Files</span>
                <span className="lib-tree-ct">{globalFiles.length}</span>
              </div>
            </>
          )}
        </nav>

        {/* Grid */}
        <section className="lib-grid" style={{ position: "relative" }}>
          {gridFiles.length === 0 && (
            <div className="lib-grid-empty">No files here yet</div>
          )}
          {gridFiles.map((f) => (
            <div key={f.id} style={{ position: "relative" }}>
              <FilePreview
                file={f}
                size="large"
                onToggleContext={() => handleToggleContext(f.id)}
                onOpen={() => handleOpenFile(f)}
                onRename={() => setRenamingFile(f.id)}
                onDelete={() => handleDeleteFile(f.id)}
              />
              {/* Move-to-folder popover */}
              {movingFileId === f.id && (
                <MoveFolderMenu
                  folders={libraryFolders}
                  currentFolder={f.folderPath}
                  onMove={(folder) => handleMoveFile(f.id, folder)}
                  onClose={() => setMovingFileId(null)}
                />
              )}
            </div>
          ))}
        </section>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          Array.from(e.target.files ?? []).forEach(onAddFile);
          e.target.value = "";
        }}
      />
    </div>
  );
}
