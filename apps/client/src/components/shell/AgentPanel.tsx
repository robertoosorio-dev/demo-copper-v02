import React from "react";
import { useStore } from "../../store.js";
import ContextPanel from "../ContextPanel.js";
import { IconChevronLeft, IconChevronRight, IconMessage } from "@tabler/icons-react";

export default function AgentPanel() {
  const agentOpen    = useStore((s) => s.agentOpen);
  const setAgentOpen = useStore((s) => s.setAgentOpen);

  if (!agentOpen) {
    return (
      <div className="syn-agent collapsed" onClick={() => setAgentOpen(true)}>
        <div className="syn-agent-rail">
          <IconMessage size={18} color="#64748B" />
          <IconChevronLeft size={14} color="#94A3B8" />
          <span className="syn-agent-rail-label">Agent</span>
        </div>
      </div>
    );
  }

  return (
    <div className="syn-agent">
      <div className="syn-agent-header">
        <span className="syn-agent-title">Agent</span>
        <button
          className="syn-agent-collapse-btn"
          onClick={() => setAgentOpen(false)}
          title="Collapse agent panel"
        >
          <IconChevronRight size={16} />
        </button>
      </div>
      <div className="syn-agent-body">
        <ContextPanel style={{ flex: 1, width: "auto" }} />
      </div>
    </div>
  );
}
