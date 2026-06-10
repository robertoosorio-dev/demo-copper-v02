import React from "react";
import { useStore } from "../store.js";

export default function VersionBar() {
  const version = useStore((s) => s.version);
  if (!version) return null;

  return (
    <div className="version-bar">
      <span className="vb-label">Version</span>
      <span className="vb-num">v{version.version}</span>
      {version.parentVersion !== null && (
        <span className="vb-parent">← v{version.parentVersion}</span>
      )}
      <span className="vb-author">{version.authoredBy}</span>
      <span className="vb-date">{new Date(version.createdAt).toLocaleDateString()}</span>
    </div>
  );
}
