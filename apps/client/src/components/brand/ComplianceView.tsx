import React, { useState, useRef } from "react";
import type { RuleSet, ComplianceSection, ComplianceRule, ComplianceProperty, BrandSeverity } from "@copper/contracts";
import { parseComplianceRules } from "../../api.js";
import { IconPlus, IconTrash, IconChevronDown, IconChevronRight, IconCloudUpload, IconPencil, IconCheck, IconX } from "@tabler/icons-react";

// ── Severity picker ───────────────────────────────────────────────────────────

const SEVERITY_OPTIONS: { value: BrandSeverity; label: string; color: string }[] = [
  { value: "required",   label: "Required",   color: "#ef4444" },
  { value: "preference", label: "Preference", color: "#f59e0b" },
  { value: "suggestion", label: "Suggestion", color: "#3b82f6" },
];

function SeverityBadge({ value, onChange }: { value: BrandSeverity; onChange: (v: BrandSeverity) => void }) {
  const opt = SEVERITY_OPTIONS.find((o) => o.value === value) ?? SEVERITY_OPTIONS[0];
  return (
    <select
      className="cr-severity-select"
      value={value}
      style={{ "--sev-color": opt.color } as React.CSSProperties}
      onChange={(e) => onChange(e.target.value as BrandSeverity)}
      onClick={(e) => e.stopPropagation()}
    >
      {SEVERITY_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── Count unconfirmed AI rules (exported for BrandSubFlow save warning) ───────

export function countUnconfirmedRules(ruleSets: RuleSet[]): number {
  let n = 0;
  for (const rs of ruleSets) {
    for (const s of rs.sections) for (const r of s.rules) if (r.aiExtracted && !r.confirmed) n++;
    for (const r of rs.rules) if (r.aiExtracted && !r.confirmed) n++;
  }
  return n;
}

export function confirmAllRules(ruleSets: RuleSet[]): RuleSet[] {
  return ruleSets.map((rs) => ({
    ...rs,
    sections: rs.sections.map((s) => ({ ...s, rules: s.rules.map((r) => ({ ...r, confirmed: true })) })),
    rules: rs.rules.map((r) => ({ ...r, confirmed: true })),
  }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function fuzzyMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = norm(a);
  const nb = norm(b);
  return na.includes(nb) || nb.includes(na) || na === nb;
}

// ── Intent dialog ─────────────────────────────────────────────────────────────

interface IntentDialogProps {
  fileName: string;
  existing: RuleSet[];
  suggestedId: string | null;   // pre-selected match
  onConfirm: (intent: "new" | "update" | "append", targetId?: string) => void;
  onCancel: () => void;
}

function IntentDialog({ fileName, existing, suggestedId, onConfirm, onCancel }: IntentDialogProps) {
  const [choice, setChoice] = useState<{ intent: "new" | "update" | "append"; id?: string }>(
    suggestedId
      ? { intent: "update", id: suggestedId }
      : { intent: "new" }
  );

  return (
    <div className="cr-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="cr-intent-dialog">
        <div className="cr-intent-title">Where should these rules go?</div>
        <div className="cr-intent-file">From: {fileName}</div>

        <div className="cr-intent-options">
          <label className="cr-intent-opt">
            <input type="radio" checked={choice.intent === "new"} onChange={() => setChoice({ intent: "new" })} />
            <span>Create a new Rule Set</span>
          </label>
          {existing.map((rs) => (
            <React.Fragment key={rs.id}>
              <label className="cr-intent-opt">
                <input
                  type="radio"
                  checked={choice.intent === "update" && choice.id === rs.id}
                  onChange={() => setChoice({ intent: "update", id: rs.id })}
                />
                <span>Replace <strong>{rs.name}</strong></span>
                {suggestedId === rs.id && <span className="cr-intent-badge">likely match</span>}
              </label>
              <label className="cr-intent-opt cr-intent-opt--sub">
                <input
                  type="radio"
                  checked={choice.intent === "append" && choice.id === rs.id}
                  onChange={() => setChoice({ intent: "append", id: rs.id })}
                />
                <span>Add rules to <strong>{rs.name}</strong></span>
              </label>
            </React.Fragment>
          ))}
        </div>

        <div className="cr-intent-footer">
          <button className="cr-btn cr-btn--ghost" onClick={onCancel}>Cancel</button>
          <button
            className="cr-btn cr-btn--primary"
            onClick={() => {
              const rs = existing.find((r) => r.id === choice.id);
              onConfirm(choice.intent, choice.id ? rs?.name : undefined);
            }}
          >
            Confirm →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline edit ───────────────────────────────────────────────────────────────

function InlineEdit({ value, onSave, placeholder = "Untitled", multiline = false }: {
  value: string; onSave: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <span className="cr-inline-view" onClick={() => { setDraft(value); setEditing(true); }}>
        {value || <span className="cr-inline-placeholder">{placeholder}</span>}
        <IconPencil size={11} className="cr-inline-icon" />
      </span>
    );
  }

  const commit = () => { onSave(draft); setEditing(false); };
  const cancel = () => setEditing(false);

  return (
    <span className="cr-inline-edit-wrap">
      {multiline ? (
        <textarea
          className="cr-inline-input cr-inline-textarea"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") cancel(); }}
        />
      ) : (
        <input
          className="cr-inline-input"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
        />
      )}
      <button className="cr-inline-btn cr-inline-btn--ok" onClick={commit}><IconCheck size={11} /></button>
      <button className="cr-inline-btn cr-inline-btn--cancel" onClick={cancel}><IconX size={11} /></button>
    </span>
  );
}

// ── Properties editor ─────────────────────────────────────────────────────────

function PropertiesEditor({ props, onChange }: { props: ComplianceProperty[]; onChange: (p: ComplianceProperty[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [draftKey, setDraftKey] = useState("");
  const [draftVal, setDraftVal] = useState("");

  return (
    <div className="cr-props">
      {props.map((p, i) => (
        <span key={i} className="cr-prop-chip">
          <span className="cr-prop-key">{p.key}</span>
          <span className="cr-prop-sep">:</span>
          <InlineEdit value={p.value} onSave={(v) => onChange(props.map((x, j) => j === i ? { ...x, value: v } : x))} />
          <button className="cr-prop-del" onClick={() => onChange(props.filter((_, j) => j !== i))}><IconX size={9} /></button>
        </span>
      ))}
      {adding ? (
        <span className="cr-prop-adder">
          <input className="cr-prop-key-input" placeholder="key" value={draftKey} onChange={(e) => setDraftKey(e.target.value)} />
          <span className="cr-prop-sep">:</span>
          <input className="cr-prop-val-input" placeholder="value" value={draftVal} onChange={(e) => setDraftVal(e.target.value)} />
          <button className="cr-inline-btn cr-inline-btn--ok" onClick={() => {
            if (draftKey.trim()) onChange([...props, { key: draftKey.trim(), value: draftVal.trim() }]);
            setDraftKey(""); setDraftVal(""); setAdding(false);
          }}><IconCheck size={11} /></button>
          <button className="cr-inline-btn cr-inline-btn--cancel" onClick={() => setAdding(false)}><IconX size={11} /></button>
        </span>
      ) : (
        <button className="cr-prop-add-btn" onClick={() => setAdding(true)}>+ property</button>
      )}
    </div>
  );
}

// ── Rule card ─────────────────────────────────────────────────────────────────

function RuleCard({ rule, onUpdate, onDelete }: {
  rule: ComplianceRule;
  onUpdate: (r: ComplianceRule) => void;
  onDelete: () => void;
}) {
  const needsReview = rule.aiExtracted && !rule.confirmed;
  return (
    <div className={`cr-rule${needsReview ? " cr-rule--unconfirmed" : " cr-rule--confirmed"}`}>
      <div className="cr-rule-header">
        <span className="cr-rule-bullet">•</span>
        <InlineEdit value={rule.name} placeholder="Rule name" onSave={(v) => onUpdate({ ...rule, name: v, confirmed: false })} />
        <div className="cr-rule-actions">
          <SeverityBadge value={rule.severity ?? "required"} onChange={(s) => onUpdate({ ...rule, severity: s })} />
          {needsReview ? (
            <button
              className="cr-confirm-btn"
              title="Approve this rule"
              onClick={() => onUpdate({ ...rule, confirmed: true })}
            >
              <IconCheck size={11} /> Approve
            </button>
          ) : rule.aiExtracted ? (
            <span className="cr-confirmed-badge"><IconCheck size={10} /> Approved</span>
          ) : null}
          <button className="cr-icon-btn" onClick={onDelete} title="Delete rule"><IconTrash size={11} /></button>
        </div>
      </div>
      <div className="cr-rule-desc">
        <InlineEdit value={rule.description} placeholder="Describe this rule…" multiline onSave={(v) => onUpdate({ ...rule, description: v, confirmed: false })} />
      </div>
      <PropertiesEditor
        props={rule.properties}
        onChange={(p) => onUpdate({ ...rule, properties: p })}
      />
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ section, onUpdate, onDelete }: {
  section: ComplianceSection;
  onUpdate: (s: ComplianceSection) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(true);

  const addRule = () => {
    const r: ComplianceRule = { id: `r_${uid()}`, name: "", description: "", severity: "required", confirmed: true, aiExtracted: false, properties: [] };
    onUpdate({ ...section, rules: [...section.rules, r] });
  };

  return (
    <div className="cr-section">
      <div className="cr-section-header" onClick={() => setOpen((v) => !v)}>
        {open ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
        <InlineEdit value={section.name} placeholder="Section name" onSave={(v) => onUpdate({ ...section, name: v })} />
        <button className="cr-icon-btn" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete section"><IconTrash size={11} /></button>
      </div>
      {open && (
        <div className="cr-section-body">
          {section.description && (
            <div className="cr-section-desc">
              <InlineEdit value={section.description} placeholder="Section description…" multiline onSave={(v) => onUpdate({ ...section, description: v })} />
            </div>
          )}
          {section.rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onUpdate={(r) => onUpdate({ ...section, rules: section.rules.map((x) => x.id === r.id ? r : x) })}
              onDelete={() => onUpdate({ ...section, rules: section.rules.filter((x) => x.id !== rule.id) })}
            />
          ))}
          <button className="cr-add-rule-btn" onClick={addRule}>
            <IconPlus size={11} /> Add rule
          </button>
        </div>
      )}
    </div>
  );
}

// ── RuleSet card ──────────────────────────────────────────────────────────────

function RuleSetCard({ ruleSet, onUpdate, onDelete }: {
  ruleSet: RuleSet;
  onUpdate: (rs: RuleSet) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(true);
  const totalRules = ruleSet.sections.reduce((n, s) => n + s.rules.length, 0) + ruleSet.rules.length;

  const addSection = () => {
    const s: ComplianceSection = { id: `s_${uid()}`, name: "", description: "", properties: [], rules: [] };
    onUpdate({ ...ruleSet, sections: [...ruleSet.sections, s] });
  };

  const addDirectRule = () => {
    const r: ComplianceRule = { id: `r_${uid()}`, name: "", description: "", severity: "required", confirmed: true, aiExtracted: false, properties: [] };
    onUpdate({ ...ruleSet, rules: [...ruleSet.rules, r] });
  };

  return (
    <div className="cr-ruleset">
      <div className="cr-ruleset-header" onClick={() => setOpen((v) => !v)}>
        {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        <div className="cr-ruleset-title-wrap">
          <InlineEdit value={ruleSet.name} placeholder="Rule Set name" onSave={(v) => onUpdate({ ...ruleSet, name: v })} />
          <span className="cr-ruleset-meta">
            {ruleSet.sections.length > 0 && `${ruleSet.sections.length} section${ruleSet.sections.length !== 1 ? "s" : ""} · `}
            {totalRules} rule{totalRules !== 1 ? "s" : ""}
          </span>
        </div>
        <button className="cr-icon-btn cr-icon-btn--danger" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete Rule Set">
          <IconTrash size={12} />
        </button>
      </div>

      {open && (
        <div className="cr-ruleset-body">
          {ruleSet.description && (
            <div className="cr-ruleset-desc">
              <InlineEdit value={ruleSet.description} placeholder="Description…" multiline onSave={(v) => onUpdate({ ...ruleSet, description: v })} />
            </div>
          )}
          <PropertiesEditor
            props={ruleSet.properties}
            onChange={(p) => onUpdate({ ...ruleSet, properties: p })}
          />

          {ruleSet.sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              onUpdate={(s) => onUpdate({ ...ruleSet, sections: ruleSet.sections.map((x) => x.id === s.id ? s : x) })}
              onDelete={() => onUpdate({ ...ruleSet, sections: ruleSet.sections.filter((x) => x.id !== section.id) })}
            />
          ))}

          {ruleSet.rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onUpdate={(r) => onUpdate({ ...ruleSet, rules: ruleSet.rules.map((x) => x.id === r.id ? r : x) })}
              onDelete={() => onUpdate({ ...ruleSet, rules: ruleSet.rules.filter((x) => x.id !== rule.id) })}
            />
          ))}

          <div className="cr-ruleset-actions">
            <button className="cr-add-rule-btn" onClick={addSection}><IconPlus size={11} /> Add section</button>
            <button className="cr-add-rule-btn" onClick={addDirectRule}><IconPlus size={11} /> Add rule</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ComplianceView ───────────────────────────────────────────────────────

interface ComplianceViewProps {
  brandId: string;
  ruleSets: RuleSet[];
  onChange: (rs: RuleSet[]) => void;
}

type PendingParse = {
  file?: File;
  text?: string;
  fileName: string;
};

export default function ComplianceView({ brandId, ruleSets, onChange }: ComplianceViewProps) {
  const [input, setInput]         = useState("");
  const [dragOver, setDragOver]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [pending, setPending]     = useState<PendingParse | null>(null);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  // Detect fuzzy match against existing rule sets
  function detectMatch(name: string): string | null {
    const baseName = name.replace(/\.[^.]+$/, "");
    const match = ruleSets.find((rs) => fuzzyMatch(rs.name, baseName) || (rs.sourceFile && fuzzyMatch(rs.sourceFile, name)));
    return match?.id ?? null;
  }

  // Route file or text to intent dialog (if needed) or straight to parse
  async function handleInput(opts: PendingParse) {
    setError(null);
    if (ruleSets.length === 0) {
      await runParse(opts, "new");
    } else {
      const matchId = detectMatch(opts.fileName);
      setPending({ ...opts, fileName: opts.fileName });
      // Store match in pending so IntentDialog can access it
      _pendingMatch.current = matchId;
    }
  }

  const _pendingMatch = useRef<string | null>(null);

  async function runParse(opts: PendingParse, intent: "new" | "update" | "append", targetId?: string) {
    setLoading(true);
    setError(null);
    try {
      const targetName = ruleSets.find((rs) => rs.id === targetId)?.name;
      const ruleSet = await parseComplianceRules(brandId, {
        text: opts.text,
        file: opts.file,
        intent,
        targetRuleSetName: targetName,
      });

      if (intent === "update" && targetId) {
        onChange(ruleSets.map((rs) => rs.id === targetId ? { ...ruleSet, id: targetId } : rs));
      } else if (intent === "append" && targetId) {
        const target = ruleSets.find((rs) => rs.id === targetId)!;
        const merged: RuleSet = {
          ...target,
          sections: [...target.sections, ...ruleSet.sections],
          rules: [...target.rules, ...ruleSet.rules],
          updatedAt: new Date().toISOString(),
        };
        onChange(ruleSets.map((rs) => rs.id === targetId ? merged : rs));
      } else {
        onChange([...ruleSets, ruleSet]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    void handleInput({ file, fileName: file.name });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void handleInput({ file, fileName: file.name });
    e.target.value = "";
  }

  function handleTextSubmit() {
    const txt = input.trim();
    if (!txt) return;
    setInput("");
    void handleInput({ text: txt, fileName: "Manual entry" });
  }

  return (
    <div className="cr-root">
      {/* Intent dialog */}
      {pending && (
        <IntentDialog
          fileName={pending.fileName}
          existing={ruleSets}
          suggestedId={_pendingMatch.current}
          onConfirm={(intent, targetName) => {
            const targetId = ruleSets.find((rs) => rs.name === targetName)?.id;
            setPending(null);
            void runParse(pending, intent, targetId);
          }}
          onCancel={() => setPending(null)}
        />
      )}

      {/* Rule Sets tree */}
      <div className={`cr-drop-zone${dragOver ? " cr-drop-zone--over" : ""}`}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {dragOver && (
          <div className="cr-drop-overlay">
            <IconCloudUpload size={24} />
            <span>Drop to import rules</span>
          </div>
        )}

        {ruleSets.length === 0 && !loading ? (
          <div className="cr-empty">
            <IconCloudUpload size={28} style={{ color: "#cbd5e1", marginBottom: 8 }} />
            <p className="cr-empty-title">No compliance rules yet</p>
            <p className="cr-empty-hint">Drop a document, paste text below, or type a rule and click Analyze.</p>
          </div>
        ) : (
          <div className="cr-rulesets">
            {ruleSets.map((rs) => (
              <RuleSetCard
                key={rs.id}
                ruleSet={rs}
                onUpdate={(updated) => onChange(ruleSets.map((x) => x.id === updated.id ? updated : x))}
                onDelete={() => onChange(ruleSets.filter((x) => x.id !== rs.id))}
              />
            ))}
          </div>
        )}

        {loading && (
          <div className="cr-loading">
            <div className="cr-loading-spinner" />
            <span>Analyzing rules…</span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="cr-input-area">
        {error && <div className="cr-error">{error}</div>}
        <textarea
          className="cr-textarea"
          placeholder={'Drop a file above, or type / paste compliance rules here (e.g. "All price mentions must include the APR disclaimer")...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          disabled={loading}
        />
        <div className="cr-input-toolbar">
          <button className="cr-btn cr-btn--ghost cr-file-btn" onClick={() => fileInputRef.current?.click()} disabled={loading}>
            <IconCloudUpload size={13} /> Upload file
          </button>
          <button className="cr-btn cr-btn--primary" onClick={handleTextSubmit} disabled={loading || !input.trim()}>
            Analyze & Add
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" style={{ display: "none" }} onChange={handleFileChange} />
      </div>
    </div>
  );
}
