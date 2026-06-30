import React from "react";
import ReactMarkdown from "react-markdown";
import { useStore } from "../../store.js";
import { IconFileText } from "@tabler/icons-react";

export default function MediaPlanDocView() {
  const doc = useStore((s) => s.version?.plans.media.document ?? "");

  if (!doc.trim()) {
    return (
      <div className="mp-doc-empty">
        <IconFileText size={28} style={{ color: "#cbd5e1", marginBottom: 10 }} />
        <p className="mp-doc-empty-title">No media plan document yet</p>
        <p className="mp-doc-empty-hint">
          Import a media plan file and the agent will generate a structured document here once you approve the proposed structure.
        </p>
      </div>
    );
  }

  return (
    <div className="mp-doc-shell">
      <div className="mp-doc-header">
        <IconFileText size={13} style={{ color: "var(--blue-txt)", flexShrink: 0 }} />
        <span>Media Plan</span>
      </div>
      <div className="mp-doc-body">
        <div className="mp-doc-content">
          <ReactMarkdown>{doc}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
