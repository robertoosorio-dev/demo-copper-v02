import React from "react";
import type { ProposalPayload } from "@copper/contracts";

interface Props {
  proposal: ProposalPayload;
  onAccept?: () => void;
  onRollback?: () => void;
}

export default function ProposalCard({ proposal, onAccept, onRollback }: Props) {
  return (
    <div className="proposal-card">
      <div className="pc-desc">{proposal.description}</div>

      {proposal.backward.length > 0 && (
        <div className="pc-section">
          <div className="pc-section-label">Dependencies</div>
          {proposal.backward.map((item, i) => (
            <div key={i} className={`pc-item pc-item--${item.type}`}>
              <span className="pc-item-label">{item.label}</span>
              <span className="pc-item-note">{item.note}</span>
            </div>
          ))}
        </div>
      )}

      {proposal.forward.length > 0 && (
        <div className="pc-section">
          <div className="pc-section-label">Effects</div>
          {proposal.forward.map((item, i) => (
            <div key={i} className={`pc-item pc-item--${item.type}`}>
              <span className="pc-item-label">{item.label}</span>
              <span className="pc-item-note">{item.note}</span>
            </div>
          ))}
        </div>
      )}

      {(onAccept || onRollback) && (
        <div className="pc-actions">
          {onAccept && <button className="btn btn-accept" onClick={onAccept}>Accept</button>}
          {onRollback && <button className="btn btn-rollback" onClick={onRollback}>Rollback</button>}
        </div>
      )}
    </div>
  );
}
