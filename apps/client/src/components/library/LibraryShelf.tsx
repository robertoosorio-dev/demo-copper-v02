import React from "react";
import { useStore } from "../../store.js";
import { FilePreview } from "./FilePreview.js";

const SHELF_MAX = 4;

// SVG icons (inline — no extra dependency)
function IconLibrary() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 5h16v14H4z" /><path d="M4 9h16" /><path d="M9 5v14" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
    </svg>
  );
}

export default function LibraryShelf() {
  const libraryFiles = useStore((s) => s.libraryFiles);
  const setLibraryOpen = useStore((s) => s.setLibraryOpen);

  const sorted = [...libraryFiles].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const shown = sorted.slice(0, SHELF_MAX);
  const overflow = libraryFiles.length - shown.length;

  // TODO(human): empty shelf shows "Add files" affordance — default per spec
  if (libraryFiles.length === 0) {
    return (
      <div className="lib-shelf lib-shelf--empty" onClick={() => setLibraryOpen(true)}>
        <div className="lib-shelf-head">
          <span className="lib-shelf-t">
            <IconLibrary />
            Library
          </span>
        </div>
        <span className="lib-shelf-add">Add files</span>
      </div>
    );
  }

  return (
    <div className="lib-shelf" onClick={() => setLibraryOpen(true)}>
      <div className="lib-shelf-head">
        <span className="lib-shelf-t">
          <IconLibrary />
          Library
        </span>
        <span className="lib-shelf-n">{libraryFiles.length} files</span>
      </div>
      <div className="lib-strip">
        {shown.map((f) => (
          <FilePreview key={f.id} file={f} size="mini" />
        ))}
        {overflow > 0 && <div className="lib-more">+{overflow}</div>}
      </div>
      <div className="lib-expand" aria-label="Expand library">
        <IconExpand />
      </div>
    </div>
  );
}
