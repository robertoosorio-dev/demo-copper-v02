import React, { useRef, useState } from "react";
import { useStore } from "../../store.js";
import type { LibraryFile } from "@copper/contracts";
import { FilePreview } from "./FilePreview.js";

interface TakeoverProps {
  onAddFile: (file: File) => void;
}

// ── Tree helpers ──────────────────────────────────────────────────────────────

interface TreeNode {
  label: string;
  path: string;
  count: number;
  children: TreeNode[];
}

function buildTree(files: LibraryFile[]): TreeNode[] {
  const globalFiles = files.filter((f) => f.tier === "global");
  const localFiles = files.filter((f) => f.tier === "local");
  const nodes: TreeNode[] = [];
  if (globalFiles.length > 0) {
    nodes.push({
      label: "Global",
      path: "global",
      count: globalFiles.length,
      children: getSubfolders(globalFiles, "global"),
    });
  }
  if (localFiles.length > 0) {
    nodes.push({
      label: "Local",
      path: "local",
      count: localFiles.length,
      children: getSubfolders(localFiles, "local"),
    });
  }
  return nodes;
}

function getSubfolders(files: LibraryFile[], tierKey: string): TreeNode[] {
  const counts = new Map<string, number>();
  for (const f of files) {
    const seg = f.folderPath.split("/").find((s) => s.length > 0) ?? "Other";
    counts.set(seg, (counts.get(seg) ?? 0) + 1);
  }
  return [...counts.entries()].map(([seg, count]) => ({
    label: seg,
    path: `${tierKey}/${seg.toLowerCase()}`,
    count,
    children: [],
  }));
}

function filterByPath(files: LibraryFile[], path: string | null): LibraryFile[] {
  if (!path) return files;
  const [tier, sub] = path.split("/");
  return files.filter((f) => {
    if (f.tier !== tier) return false;
    if (!sub) return true;
    return f.folderPath.toLowerCase().includes(sub);
  });
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function IconChevLeft() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function IconLibrary() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 5h16v14H4z" /><path d="M4 9h16" /><path d="M9 5v14" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
    </svg>
  );
}
function IconGridView() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IconListView() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconFolder() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 7h6l2 2h10v9H3z" />
    </svg>
  );
}
function IconChevDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function IconChevRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LibraryTakeover({ onAddFile }: TakeoverProps) {
  const libraryFiles = useStore((s) => s.libraryFiles);
  const setLibraryOpen = useStore((s) => s.setLibraryOpen);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [globalOpen, setGlobalOpen] = useState(true);
  const [localOpen, setLocalOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tree = buildTree(libraryFiles);
  const gridFiles = filterByPath(libraryFiles, selectedPath);

  const crumb = selectedPath
    ? ["Library", ...selectedPath.split("/").map((s) => s[0].toUpperCase() + s.slice(1))]
    : ["Library"];

  return (
    <div className="lib-takeover">
      {/* Header */}
      <div className="lib-head">
        <div className="lib-head-row">
          <button className="lib-back" onClick={() => setLibraryOpen(false)}>
            <IconChevLeft />
            Conversation
          </button>
          <span className="lib-title">
            <IconLibrary />
            Library
          </span>
          <span className="lib-spacer" />
          {/* Search — visual stub, no backend */}
          <div className="lib-search">
            <IconSearch />
            Search files
          </div>
          {/* View toggle — large-icons built; list is a stub */}
          <div className="lib-viewtoggle">
            <button className="lib-view-btn lib-view-btn--on" title="Large icons">
              <IconGridView />
            </button>
            <button className="lib-view-btn" title="List (coming soon)" disabled>
              <IconListView />
            </button>
          </div>
          <button className="lib-add-btn" onClick={() => fileInputRef.current?.click()}>
            <IconPlus />
            Add
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

      {/* Body: tree + grid */}
      <div className="lib-body">
        {/* Folder tree */}
        <nav className="lib-tree">
          <div className="lib-tree-grp">Folders</div>
          {/* Root */}
          <div
            className={`lib-tree-node${selectedPath === null ? " lib-tree-node--sel" : ""}`}
            onClick={() => setSelectedPath(null)}
          >
            <span className="lib-tree-tw"><IconChevDown /></span>
            <IconLibrary />
            <span className="lib-tree-lbl">Library</span>
          </div>
          {/* Tiers */}
          {tree.map((tier) => {
            const isOpen = tier.path === "global" ? globalOpen : localOpen;
            const toggle = tier.path === "global"
              ? () => setGlobalOpen((v) => !v)
              : () => setLocalOpen((v) => !v);
            return (
              <React.Fragment key={tier.path}>
                <div
                  className={`lib-tree-node lib-tree-node--child${selectedPath === tier.path ? " lib-tree-node--sel" : ""}`}
                  onClick={() => { setSelectedPath(tier.path); toggle(); }}
                >
                  <span className="lib-tree-tw" onClick={(e) => { e.stopPropagation(); toggle(); }}>
                    {isOpen ? <IconChevDown /> : <IconChevRight />}
                  </span>
                  <IconFolder />
                  <span className="lib-tree-lbl">{tier.label}</span>
                  <span className="lib-tree-ct">{tier.count}</span>
                </div>
                {isOpen && tier.children.map((sub) => (
                  <div
                    key={sub.path}
                    className={`lib-tree-node lib-tree-node--deep${selectedPath === sub.path ? " lib-tree-node--sel" : ""}`}
                    onClick={() => setSelectedPath(sub.path)}
                  >
                    <span className="lib-tree-tw lib-tree-tw--empty" />
                    <IconFolder />
                    <span className="lib-tree-lbl">{sub.label}</span>
                    <span className="lib-tree-ct">{sub.count}</span>
                  </div>
                ))}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Large-icon grid */}
        <section className="lib-grid">
          {gridFiles.length === 0 && (
            <div className="lib-grid-empty">No files here yet</div>
          )}
          {gridFiles.map((f) => (
            <FilePreview
              key={f.id}
              file={f}
              size="large"
              selected={selectedFileId === f.id}
              onClick={() => setSelectedFileId(f.id === selectedFileId ? null : f.id)}
            />
          ))}
        </section>
      </div>

      {/* Hidden file picker */}
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
