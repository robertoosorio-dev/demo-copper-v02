import React from "react";
import { useStore } from "../store.js";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";

export default function PlanDocument() {
  const activePlan         = useStore((s) => s.activePlan);
  const mediaDocument      = useStore((s) => s.mediaDocument());
  const updateMediaDocument = useStore((s) => s.updateMediaDocument);
  const version            = useStore((s) => s.version);

  if (activePlan === "creative") {
    return (
      <div className="plan-doc plan-doc--stub">
        <div className="plan-doc-empty">Creative Plan — coming soon</div>
      </div>
    );
  }

  if (activePlan === "data") {
    const doc = version?.plans.data.document ?? "";
    return (
      <div className="plan-doc">
        <div className="plan-doc-header">
          <span className="plan-doc-label">Data Plan · Document</span>
        </div>
        <div className="plan-doc-body plan-doc-body--readonly">
          {doc ? (
            <pre className="plan-doc-pre">{doc}</pre>
          ) : (
            <div className="plan-doc-empty">Document auto-generated from model (M3)</div>
          )}
        </div>
      </div>
    );
  }

  // Media plan — editable markdown
  return (
    <div className="plan-doc">
      <div className="plan-doc-header">
        <span className="plan-doc-label">Media Plan · Document</span>
        <button
          className="btn btn-sm"
          disabled
          title="Implement Plan compiles document to model — requires M3"
        >
          Implement Plan
        </button>
      </div>
      <div className="plan-doc-body plan-doc-cm">
        <CodeMirror
          value={mediaDocument}
          onChange={updateMediaDocument}
          extensions={[markdown()]}
          theme={oneDark}
          style={{ height: "100%", fontSize: 12 }}
        />
      </div>
    </div>
  );
}
