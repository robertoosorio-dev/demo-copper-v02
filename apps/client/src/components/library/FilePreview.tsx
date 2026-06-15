import React from "react";
import type { LibraryFile } from "@copper/contracts";

interface FilePreviewProps {
  file: LibraryFile;
  size: "mini" | "large";
  selected?: boolean;
  onClick?: () => void;
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function formatMeta(file: LibraryFile): string {
  if (file.size) {
    const kb = file.size / 1024;
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
  }
  const d = new Date(file.updatedAt);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function MiniSketch({ ext }: { ext: string }) {
  switch (ext) {
    case "xlsx":
      return (
        <div className="fp-mgrid">
          {[...Array(12)].map((_, i) => (
            <i key={i} className={i < 3 ? "fp-hd" : ""} />
          ))}
        </div>
      );
    case "pptx":
      return (
        <div className="fp-mslide">
          <div className="fp-msb" />
          <div className="fp-mbb" />
        </div>
      );
    default:
      return (
        <>
          <div className="fp-ml fp-ml-h" />
          <div className="fp-ml fp-ml-a" />
          <div className="fp-ml fp-ml-b" />
          <div className="fp-ml fp-ml-c" />
        </>
      );
  }
}

function LargeSketch({ ext }: { ext: string }) {
  switch (ext) {
    case "xlsx":
      return (
        <div className="fp-sheet">
          {[...Array(20)].map((_, i) => (
            <i key={i} className={i < 4 ? "fp-hd" : ""} />
          ))}
        </div>
      );
    case "pptx":
      return (
        <div className="fp-slide">
          <div className="fp-sbar" />
          <div className="fp-sblk" />
          <div className="fp-sduo">
            <span /><span />
          </div>
        </div>
      );
    case "md":
      return (
        <div className="fp-mdbody">
          <div className="fp-mdhh"># Title</div>
          <div className="fp-ln fp-ln-l" />
          <div className="fp-ln fp-ln-s" />
          <div className="fp-ln fp-ln-m" />
          <div className="fp-ln fp-ln-l" />
          <div className="fp-ln fp-ln-x" />
        </div>
      );
    default:
      return (
        <>
          <div className="fp-ln fp-ln-h" />
          <div className="fp-ln fp-ln-l" />
          <div className="fp-ln fp-ln-s" />
          <div className="fp-ln fp-ln-m" />
          <div className="fp-ln fp-ln-l" style={{ marginTop: 11 }} />
          <div className="fp-ln fp-ln-s" />
          <div className="fp-ln fp-ln-x" />
        </>
      );
  }
}

export function FilePreview({ file, size, selected, onClick }: FilePreviewProps) {
  const ext = (file.type || "").toLowerCase();
  const chip = (ext || file.name.split(".").pop() || "FILE").toUpperCase();

  if (size === "mini") {
    return (
      <div className="lib-mini" data-type={ext} onClick={onClick}>
        <div className="fp-mcard">
          <MiniSketch ext={ext} />
        </div>
        <span className="lib-mname">{truncate(file.name.replace(/\.[^.]+$/, ""), 7)}</span>
      </div>
    );
  }

  return (
    <div
      className={`lib-tile${selected ? " lib-tile--sel" : ""}`}
      data-type={ext}
      onClick={onClick}
    >
      <div className="fp-page">
        <LargeSketch ext={ext} />
        <span className="fp-chip">{chip}</span>
      </div>
      <div className="lib-meta">
        <span className="lib-fname">{file.name}</span>
        <span className="lib-sub">{formatMeta(file)}</span>
      </div>
    </div>
  );
}
